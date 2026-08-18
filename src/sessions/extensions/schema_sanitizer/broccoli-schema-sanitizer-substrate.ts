/**
 * broccoli-schema-sanitizer-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for caching tool parameter schema transformation rules,
 * key mapping dictionaries, sanitization events, and metrics (Phase 139 / ADR-115 / Target #80).
 */

import type {
  IBroccoliSchemaSanitizerSubstrate,
  SchemaSanitizationEventRow,
  SchemaSanitizerAuditRow,
  SchemaSanitizerBulkMutationResult,
  SchemaSanitizerConfig,
  SchemaSanitizerDslQueryFilter,
  SchemaSanitizerGroupBy,
  SchemaSanitizerGroupedLane,
  SchemaSanitizerHealthAuditReport,
  SchemaSanitizerHealthStatus,
  SchemaSanitizerMetrics,
  SchemaSanitizerMetricsReport,
  SchemaSanitizerMutationUndoRecord,
  SchemaSanitizerSortBy,
  SchemaSanitizerSortDirection,
  SchemaSanitizerWorkspaceSnapshot,
} from "../../../core/contracts/schema-sanitizer.contracts.js";
import { DEFAULT_SCHEMA_SANITIZER_CONFIG } from "../../../core/contracts/schema-sanitizer.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliSchemaSanitizerSubstrate implements IBroccoliSchemaSanitizerSubstrate {
  private config: SchemaSanitizerConfig = { ...DEFAULT_SCHEMA_SANITIZER_CONFIG };
  private metrics: SchemaSanitizerMetrics = {
    totalSchemasSanitized: 0,
    invalidPropertyKeysRenamed: 0,
    nullableUnionsCollapsed: 0,
    refSiblingsStripped: 0,
    topLevelCombinatorsCleaned: 0,
    argumentsUnrenamed: 0,
  };
  private readonly events = new Map<string, SchemaSanitizationEventRow>();
  private readonly undoStack: SchemaSanitizerMutationUndoRecord[] = [];
  private readonly redoStack: SchemaSanitizerMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private eventsTable?: IDbTable<SchemaSanitizationEventRow>;
  private auditsTable?: IDbTable<SchemaSanitizerAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.eventsTable = dbKernel.getTable<SchemaSanitizationEventRow>("schema_sanitizer_events");
      this.auditsTable = dbKernel.getTable<SchemaSanitizerAuditRow>("schema_sanitizer_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  public setConfig(config: Partial<SchemaSanitizerConfig>): void {
    const prev = this.exportSnapshot();
    this.config = { ...this.config, ...config };
    this.pushUndoRecord("config_change", prev);
  }

  public getConfig(): SchemaSanitizerConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: SchemaSanitizerMutationUndoRecord["mutationType"], prev: SchemaSanitizerWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliSchemaSanitizerSubstrate.MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  public undo(): boolean {
    const record = this.undoStack.pop();
    if (!record) return false;

    this.redoStack.push({
      mutationType: record.mutationType,
      previousSnapshot: this.exportSnapshot(),
      nextSnapshot: record.nextSnapshot,
      timestampMs: Date.now(),
    });

    this.importSnapshot(record.previousSnapshot);
    return true;
  }

  public redo(): boolean {
    const record = this.redoStack.pop();
    if (!record) return false;

    this.undoStack.push({
      mutationType: record.mutationType,
      previousSnapshot: this.exportSnapshot(),
      nextSnapshot: record.nextSnapshot,
      timestampMs: Date.now(),
    });

    this.importSnapshot(record.nextSnapshot);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Event Storage & Metric Recording
  // ---------------------------------------------------------------------------

  public recordSchemaSanitized(
    invalidKeysCount: number,
    nullableUnionsCount: number,
    refSiblingsCount: number,
    topLevelCombinatorsCount: number
  ): void {
    this.metrics.totalSchemasSanitized++;
    this.metrics.invalidPropertyKeysRenamed += invalidKeysCount;
    this.metrics.nullableUnionsCollapsed += nullableUnionsCount;
    this.metrics.refSiblingsStripped += refSiblingsCount;
    this.metrics.topLevelCombinatorsCleaned += topLevelCombinatorsCount;
  }

  public recordArgumentUnrenamed(): void {
    this.metrics.argumentsUnrenamed++;
  }

  public recordEvent(event: SchemaSanitizationEventRow): void {
    const prev = this.exportSnapshot();
    this.events.set(event.eventId, { ...event });

    if (this.eventsTable) {
      this.eventsTable.put(event.eventId, { ...event });
    }

    this.pushUndoRecord("add_event", prev);
  }

  public getEvent(id: string): SchemaSanitizationEventRow | undefined {
    return this.events.get(id);
  }

  public listEvents(): readonly SchemaSanitizationEventRow[] {
    return Array.from(this.events.values());
  }

  public removeEvent(id: string): boolean {
    const exists = this.events.has(id);
    if (!exists) return false;

    const prev = this.exportSnapshot();
    this.events.delete(id);

    if (this.eventsTable) {
      this.eventsTable.delete(id);
    }

    this.pushUndoRecord("clear", prev);
    return true;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): SchemaSanitizerHealthAuditReport {
    let healthStatus: SchemaSanitizerHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (this.metrics.invalidPropertyKeysRenamed > 50) {
      healthStatus = "degraded";
      recommendations.push("High frequency of non-conforming schema property keys detected.");
    }

    if (this.metrics.totalSchemasSanitized === 0) {
      healthStatus = "healthy";
      recommendations.push("Schema sanitizer initialized cleanly.");
    }

    return {
      totalSchemasSanitized: this.metrics.totalSchemasSanitized,
      invalidPropertyKeysRenamed: this.metrics.invalidPropertyKeysRenamed,
      nullableUnionsCollapsed: this.metrics.nullableUnionsCollapsed,
      refSiblingsStripped: this.metrics.refSiblingsStripped,
      topLevelCombinatorsCleaned: this.metrics.topLevelCombinatorsCleaned,
      argumentsUnrenamed: this.metrics.argumentsUnrenamed,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): SchemaSanitizerMetrics {
    return { ...this.metrics };
  }

  public getMetricsReport(): SchemaSanitizerMetricsReport {
    const totalMutations =
      this.metrics.invalidPropertyKeysRenamed +
      this.metrics.nullableUnionsCollapsed +
      this.metrics.refSiblingsStripped +
      this.metrics.topLevelCombinatorsCleaned;

    const rate =
      this.metrics.totalSchemasSanitized === 0
        ? 0
        : Number(((totalMutations / this.metrics.totalSchemasSanitized) * 100).toFixed(1));

    return {
      ...this.metrics,
      mutationRatePercent: rate,
      mutationsBreakdown: {
        invalidPropertyKeysRenamed: this.metrics.invalidPropertyKeysRenamed,
        nullableUnionsCollapsed: this.metrics.nullableUnionsCollapsed,
        refSiblingsStripped: this.metrics.refSiblingsStripped,
        topLevelCombinatorsCleaned: this.metrics.topLevelCombinatorsCleaned,
        argumentsUnrenamed: this.metrics.argumentsUnrenamed,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedEvents(
    groupBy: SchemaSanitizerGroupBy = "schemaName",
    sortBy: SchemaSanitizerSortBy = "timestamp",
    direction: SchemaSanitizerSortDirection = "desc"
  ): readonly SchemaSanitizerGroupedLane[] {
    const lanes = new Map<string, SchemaSanitizationEventRow[]>();
    const all = Array.from(this.events.values());

    for (const ev of all) {
      let key = "default";
      switch (groupBy) {
        case "schemaName":
          key = ev.schemaName || "unnamed";
          break;
        case "mutationType":
          key = ev.mutationsApplied.length > 0 ? ev.mutationsApplied[0] : "clean";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(ev);
    }

    const result: SchemaSanitizerGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = b.timestamp - a.timestamp;
        else if (sortBy === "renamedKeyCount") cmp = b.renamedKeyCount - a.renamedKeyCount;
        else if (sortBy === "schemaName") cmp = b.schemaName.localeCompare(a.schemaName);
        return direction === "asc" ? -cmp : cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        events: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryEventsDsl(query: SchemaSanitizerDslQueryFilter | string): readonly SchemaSanitizationEventRow[] {
    const parsed: SchemaSanitizerDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const all = Array.from(this.events.values());

    return all.filter((ev) => {
      if (parsed.schemaName && !ev.schemaName.toLowerCase().includes(parsed.schemaName.toLowerCase())) return false;
      if (parsed.mutationType && !ev.mutationsApplied.some((m) => m.toLowerCase().includes(parsed.mutationType!.toLowerCase()))) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${ev.eventId} ${ev.schemaName} ${ev.mutationsApplied.join(" ")} ${ev.warnings.join(" ")}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): SchemaSanitizerDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let schemaName: string | undefined;
    let mutationType: string | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("schema:") || tok.startsWith("name:")) {
        schemaName = tok.split(":")[1];
      } else if (tok.startsWith("mut:") || tok.startsWith("mutation:")) {
        mutationType = tok.split(":")[1];
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      schemaName,
      mutationType,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeEvents(ids: readonly string[]): SchemaSanitizerBulkMutationResult {
    const prev = this.exportSnapshot();
    let modified = 0;

    for (const id of ids) {
      if (this.events.has(id)) {
        this.events.delete(id);
        if (this.eventsTable) this.eventsTable.delete(id);
        modified++;
      }
    }

    this.pushUndoRecord("clear", prev);
    return {
      matchedCount: ids.length,
      modifiedCount: modified,
      affectedEventIds: ids,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const events = this.listEvents();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI JSON Schema Sanitizer Ledger</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>🧬 LUMI JSON Schema Grammar Firewall</h1>
  <p style="color: #94a3b8;">Deterministic Tool Schema Sanitizer & GBNF Compliance Guard (Phase 139 / ADR-115)</p>
  
  <div class="grid">
    <div class="card"><div>Schemas Sanitized</div><div class="metric-val">${metrics.totalSchemasSanitized}</div></div>
    <div class="card"><div>Keys Renamed</div><div class="metric-val" style="color:#f43f5e;">${metrics.invalidPropertyKeysRenamed}</div></div>
    <div class="card"><div>Unions Collapsed</div><div class="metric-val" style="color:#10b981;">${metrics.nullableUnionsCollapsed}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Sanitization Events Ledger</h2>
  <table>
    <thead><tr><th>Event ID</th><th>Schema Name</th><th>Mutations</th><th>Renamed Keys</th><th>Warnings</th></tr></thead>
    <tbody>
      ${events.map((e) => `<tr><td><code>${e.eventId}</code></td><td>${e.schemaName}</td><td>${e.mutationsApplied.length}</td><td>${e.renamedKeyCount}</td><td>${e.warnings.length}</td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const events = this.listEvents();

    let md = `# LUMI Schema Sanitizer Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Sanitized:** \`${metrics.totalSchemasSanitized}\` | **Renamed Keys:** \`${metrics.invalidPropertyKeysRenamed}\` | **Collapsed:** \`${metrics.nullableUnionsCollapsed}\`\n\n`;
    md += `## Sanitization Events (${events.length})\n\n`;
    md += `| Event ID | Schema Name | Mutations | Renamed Keys | Warnings |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const e of events) {
      md += `| \`${e.eventId}\` | ${e.schemaName} | ${e.mutationsApplied.length} | ${e.renamedKeyCount} | ${e.warnings.length} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "eventId,schemaName,renamedKeyCount,mutationsCount,warningsCount,timestamp\n";
    const rows = Array.from(this.events.values()).map((e) => {
      return `"${e.eventId}","${e.schemaName}",${e.renamedKeyCount},${e.mutationsApplied.length},${e.warnings.length},${e.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): SchemaSanitizerWorkspaceSnapshot {
    return {
      snapshotId: `snap-${Date.now()}`,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
      events: Array.from(this.events.values()),
    };
  }

  public createSnapshot(snapshotId: string): SchemaSanitizerWorkspaceSnapshot {
    const snap = this.exportSnapshot();
    return { ...snap, snapshotId };
  }

  public importSnapshot(snapshot: SchemaSanitizerWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.metrics = { ...snapshot.metrics };
    this.events.clear();
    if (snapshot.events) {
      for (const ev of snapshot.events) {
        this.events.set(ev.eventId, { ...ev });
      }
    }
  }

  public restoreSnapshot(snapshot: SchemaSanitizerWorkspaceSnapshot): void {
    this.importSnapshot(snapshot);
  }

  public clear(): void {
    this.config = { ...DEFAULT_SCHEMA_SANITIZER_CONFIG };
    this.metrics = {
      totalSchemasSanitized: 0,
      invalidPropertyKeysRenamed: 0,
      nullableUnionsCollapsed: 0,
      refSiblingsStripped: 0,
      topLevelCombinatorsCleaned: 0,
      argumentsUnrenamed: 0,
    };
    this.events.clear();
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
