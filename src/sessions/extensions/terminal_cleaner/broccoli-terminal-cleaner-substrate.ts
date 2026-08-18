/**
 * broccoli-terminal-cleaner-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for caching terminal cleaner events,
 * sanitization metrics, binary asset safeguards, and multi-criteria swimlanes (Phase 136 / ADR-112 / Target #76).
 */

import type {
  IBroccoliTerminalCleanerSubstrate,
  TerminalCleanEventRow,
  TerminalCleanerAuditRow,
  TerminalCleanerBulkMutationResult,
  TerminalCleanerConfig,
  TerminalCleanerDslQueryFilter,
  TerminalCleanerGroupBy,
  TerminalCleanerGroupedLane,
  TerminalCleanerHealthAuditReport,
  TerminalCleanerHealthStatus,
  TerminalCleanerMetrics,
  TerminalCleanerMetricsReport,
  TerminalCleanerMutationUndoRecord,
  TerminalCleanerSortBy,
  TerminalCleanerSortDirection,
  TerminalCleanerWorkspaceSnapshot,
} from "../../../core/contracts/terminal-cleaner.contracts.js";
import { DEFAULT_TERMINAL_CLEANER_CONFIG } from "../../../core/contracts/terminal-cleaner.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliTerminalCleanerSubstrate implements IBroccoliTerminalCleanerSubstrate {
  private config: TerminalCleanerConfig = { ...DEFAULT_TERMINAL_CLEANER_CONFIG };
  private readonly events = new Map<string, TerminalCleanEventRow>();
  private readonly undoStack: TerminalCleanerMutationUndoRecord[] = [];
  private readonly redoStack: TerminalCleanerMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  private totalFastPathPasses = 0;
  private totalOpaqueDocumentWritesBlocked = 0;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private eventsTable?: IDbTable<TerminalCleanEventRow>;
  private auditsTable?: IDbTable<TerminalCleanerAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.eventsTable = dbKernel.getTable<TerminalCleanEventRow>("terminal_clean_events");
      this.auditsTable = dbKernel.getTable<TerminalCleanerAuditRow>("terminal_cleaner_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  public setConfig(config: Partial<TerminalCleanerConfig>): void {
    const prev = this.exportSnapshot();
    this.config = { ...this.config, ...config };
    this.pushUndoRecord("config_change", prev);
  }

  public getConfig(): TerminalCleanerConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: TerminalCleanerMutationUndoRecord["mutationType"], prev: TerminalCleanerWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliTerminalCleanerSubstrate.MAX_UNDO_STACK) {
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
      nextSnapshot: record.previousSnapshot,
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
  // Clean Event Storage & Recording
  // ---------------------------------------------------------------------------

  public recordEvent(event: TerminalCleanEventRow): void {
    const prev = this.exportSnapshot();
    this.events.set(event.id, { ...event });

    if (this.eventsTable) {
      this.eventsTable.put(event.id, { ...event });
    }

    this.pushUndoRecord("add_event", prev);
  }

  public recordClean(params: {
    ansiStrippedCount?: number;
    controlFilteredCount?: number;
    fastPath?: boolean;
    durationMs?: number;
  }): void {
    if (params.fastPath) {
      this.totalFastPathPasses++;
    }
    const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const event: TerminalCleanEventRow = {
      id,
      mode: "sanitize_display",
      originalLength: 0,
      cleanedLength: 0,
      ansiCodesCount: params.ansiStrippedCount || 0,
      controlCharsCount: params.controlFilteredCount || 0,
      durationMs: params.durationMs || 0.05,
      timestamp: Date.now(),
    };
    this.recordEvent(event);
  }

  public recordBlockedOpaqueWrite(): void {
    this.totalOpaqueDocumentWritesBlocked++;
  }

  public getEvent(id: string): TerminalCleanEventRow | undefined {
    return this.events.get(id);
  }

  public listEvents(): readonly TerminalCleanEventRow[] {
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

    this.pushUndoRecord("bulk_purge", prev);
    return true;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): TerminalCleanerHealthAuditReport {
    const events = Array.from(this.events.values());
    const total = events.length;
    let totalAnsi = 0;
    let totalControl = 0;

    for (const ev of events) {
      totalAnsi += ev.ansiCodesCount;
      totalControl += ev.controlCharsCount;
    }

    const fastPathRatio = total === 0 ? 1 : Number((this.totalFastPathPasses / (total + this.totalFastPathPasses)).toFixed(3));

    let healthStatus: TerminalCleanerHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (this.totalOpaqueDocumentWritesBlocked > 0) {
      recommendations.push(`Blocked ${this.totalOpaqueDocumentWritesBlocked} unsafe writes to opaque document files.`);
    }

    if (totalAnsi > 1000) {
      healthStatus = "degraded";
      recommendations.push("High volume of ANSI codes detected in terminal output streams.");
    }

    if (total === 0) {
      healthStatus = "healthy";
      recommendations.push("Terminal output cleaner initialized cleanly.");
    }

    return {
      totalStringsCleaned: total,
      ansiSequencesStripped: totalAnsi,
      controlCharsFiltered: totalControl,
      opaqueDocumentWritesBlocked: this.totalOpaqueDocumentWritesBlocked,
      fastPathRatio,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): TerminalCleanerMetricsReport {
    const events = Array.from(this.events.values());
    let totalAnsi = 0;
    let totalControl = 0;
    let totalDuration = 0;
    const eventsByMode: Record<string, number> = {};

    for (const ev of events) {
      totalAnsi += ev.ansiCodesCount;
      totalControl += ev.controlCharsCount;
      totalDuration += ev.durationMs;
      eventsByMode[ev.mode] = (eventsByMode[ev.mode] || 0) + 1;
    }

    return {
      totalStringsCleaned: events.length,
      ansiSequencesStripped: totalAnsi,
      controlCharsFiltered: totalControl,
      opaqueDocumentWritesBlocked: this.totalOpaqueDocumentWritesBlocked,
      fastPathPasses: this.totalFastPathPasses,
      avgDurationMs: events.length === 0 ? 0 : Number((totalDuration / events.length).toFixed(3)),
      eventsByMode,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedEvents(
    groupBy: TerminalCleanerGroupBy = "mode",
    sortBy: TerminalCleanerSortBy = "timestamp",
    direction: TerminalCleanerSortDirection = "desc"
  ): readonly TerminalCleanerGroupedLane[] {
    const lanes = new Map<string, TerminalCleanEventRow[]>();
    const all = Array.from(this.events.values());

    for (const ev of all) {
      let key = "default";
      switch (groupBy) {
        case "mode":
          key = ev.mode;
          break;
        case "status":
          key = ev.ansiCodesCount > 0 ? "ansi_stripped" : "clean";
          break;
        case "reductionTier": {
          const ratio = ev.originalLength > 0 ? ev.cleanedLength / ev.originalLength : 1;
          key = ratio < 0.5 ? "high_reduction" : ratio < 0.9 ? "moderate" : "minimal";
          break;
        }
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(ev);
    }

    const result: TerminalCleanerGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = b.timestamp - a.timestamp;
        else if (sortBy === "originalLength") cmp = b.originalLength - a.originalLength;
        else if (sortBy === "durationMs") cmp = b.durationMs - a.durationMs;
        else if (sortBy === "ansiCount") cmp = b.ansiCodesCount - a.ansiCodesCount;
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

  public queryEventsDsl(query: TerminalCleanerDslQueryFilter | string): readonly TerminalCleanEventRow[] {
    const parsed: TerminalCleanerDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const all = Array.from(this.events.values());

    return all.filter((ev) => {
      if (parsed.mode && ev.mode !== parsed.mode) return false;
      if (parsed.minAnsiCount !== undefined && ev.ansiCodesCount < parsed.minAnsiCount) return false;
      if (parsed.minDurationMs !== undefined && ev.durationMs < parsed.minDurationMs) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${ev.id} ${ev.mode}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): TerminalCleanerDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let mode: any;
    let minAnsiCount: number | undefined;
    let minDurationMs: number | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("mode:")) {
        mode = tok.slice(5).toLowerCase() as any;
      } else if (tok.startsWith("minAnsi:")) {
        minAnsiCount = parseInt(tok.slice(8), 10);
      } else if (tok.startsWith("minDuration:")) {
        minDurationMs = parseFloat(tok.slice(12));
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      mode,
      minAnsiCount,
      minDurationMs,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeEvents(ids: readonly string[]): TerminalCleanerBulkMutationResult {
    const prev = this.exportSnapshot();
    let modified = 0;

    for (const id of ids) {
      if (this.events.has(id)) {
        this.events.delete(id);
        if (this.eventsTable) this.eventsTable.delete(id);
        modified++;
      }
    }

    this.pushUndoRecord("bulk_purge", prev);
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
  <title>LUMI Terminal Output Cleaner & ANSI Sanitizer Ledger</title>
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
  <h1>🧹 LUMI Terminal Output Cleaner & ANSI Sanitizer</h1>
  <p style="color: #94a3b8;">Deterministic ANSI Stripping & Control Byte Filtering (Phase 136 / ADR-112)</p>
  
  <div class="grid">
    <div class="card"><div>Cleaned Strings</div><div class="metric-val">${metrics.totalStringsCleaned}</div></div>
    <div class="card"><div>ANSI Codes Stripped</div><div class="metric-val" style="color:#10b981;">${metrics.ansiSequencesStripped}</div></div>
    <div class="card"><div>Control Bytes Filtered</div><div class="metric-val" style="color:#f43f5e;">${metrics.controlCharsFiltered}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Recent Cleaning Events</h2>
  <table>
    <thead><tr><th>Event ID</th><th>Mode</th><th>Original Length</th><th>Cleaned Length</th><th>ANSI Count</th><th>Duration</th></tr></thead>
    <tbody>
      ${events.map((e) => `<tr><td><code>${e.id}</code></td><td>${e.mode}</td><td>${e.originalLength}B</td><td>${e.cleanedLength}B</td><td>${e.ansiCodesCount}</td><td>${e.durationMs.toFixed(2)}ms</td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const events = this.listEvents();

    let md = `# LUMI Terminal Cleaner Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Strings Cleaned:** \`${metrics.totalStringsCleaned}\` | **ANSI Stripped:** \`${metrics.ansiSequencesStripped}\` | **Blocked Writes:** \`${metrics.opaqueDocumentWritesBlocked}\`\n\n`;
    md += `## Clean Events (${events.length})\n\n`;
    md += `| Event ID | Mode | Original | Cleaned | ANSI Count | Duration |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const e of events) {
      md += `| \`${e.id}\` | ${e.mode} | ${e.originalLength}B | ${e.cleanedLength}B | ${e.ansiCodesCount} | ${e.durationMs.toFixed(2)}ms |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "id,mode,originalLength,cleanedLength,ansiCodesCount,controlCharsCount,durationMs,timestamp\n";
    const rows = Array.from(this.events.values()).map((e) => {
      return `"${e.id}","${e.mode}",${e.originalLength},${e.cleanedLength},${e.ansiCodesCount},${e.controlCharsCount},${e.durationMs.toFixed(2)},${e.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): TerminalCleanerWorkspaceSnapshot {
    const events = Array.from(this.events.values());
    let totalAnsi = 0;
    let totalControl = 0;

    for (const ev of events) {
      totalAnsi += ev.ansiCodesCount;
      totalControl += ev.controlCharsCount;
    }

    return {
      snapshotId: `snap-${Date.now()}`,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: {
        totalStringsCleaned: events.length,
        ansiSequencesStripped: totalAnsi,
        controlCharsFiltered: totalControl,
        opaqueDocumentWritesBlocked: this.totalOpaqueDocumentWritesBlocked,
        fastPathPasses: this.totalFastPathPasses,
      },
      events,
    };
  }

  public createSnapshot(snapshotId: string): TerminalCleanerWorkspaceSnapshot {
    const snap = this.exportSnapshot();
    return { ...snap, snapshotId };
  }

  public importSnapshot(snapshot: TerminalCleanerWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.events.clear();
    if (snapshot.events) {
      for (const ev of snapshot.events) {
        this.events.set(ev.id, { ...ev });
      }
    }
    this.totalFastPathPasses = snapshot.metrics.fastPathPasses;
    this.totalOpaqueDocumentWritesBlocked = snapshot.metrics.opaqueDocumentWritesBlocked;
  }

  public restoreSnapshot(snapshot: TerminalCleanerWorkspaceSnapshot): void {
    this.importSnapshot(snapshot);
  }

  public clear(): void {
    this.config = { ...DEFAULT_TERMINAL_CLEANER_CONFIG };
    this.events.clear();
    this.totalFastPathPasses = 0;
    this.totalOpaqueDocumentWritesBlocked = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
