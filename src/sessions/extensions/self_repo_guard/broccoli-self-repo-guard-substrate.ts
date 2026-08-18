/**
 * broccoli-self-repo-guard-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for caching self-repository guard configuration,
 * incident audit logs, mutation safety metrics, and multi-criteria swimlanes (Phase 138 / ADR-114 / Target #78).
 */

import type {
  IBroccoliSelfRepoGuardSubstrate,
  SelfRepoGuardAuditRow,
  SelfRepoGuardBulkMutationResult,
  SelfRepoGuardConfig,
  SelfRepoGuardDslQueryFilter,
  SelfRepoGuardGroupBy,
  SelfRepoGuardGroupedLane,
  SelfRepoGuardHealthAuditReport,
  SelfRepoGuardHealthStatus,
  SelfRepoGuardIncident,
  SelfRepoGuardIncidentRow,
  SelfRepoGuardMetrics,
  SelfRepoGuardMetricsReport,
  SelfRepoGuardMutationUndoRecord,
  SelfRepoGuardSortBy,
  SelfRepoGuardSortDirection,
  SelfRepoGuardWorkspaceSnapshot,
} from "../../../core/contracts/self-repo-guard.contracts.js";
import { DEFAULT_SELF_REPO_GUARD_CONFIG } from "../../../core/contracts/self-repo-guard.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliSelfRepoGuardSubstrate implements IBroccoliSelfRepoGuardSubstrate {
  private config: SelfRepoGuardConfig = { ...DEFAULT_SELF_REPO_GUARD_CONFIG };
  private metrics: SelfRepoGuardMetrics = {
    totalCommandsInspected: 0,
    destructiveGitMutationsBlocked: 0,
    safeGitOperationsPassed: 0,
    foreignRepoMutationsAllowed: 0,
  };
  private readonly incidents = new Map<string, SelfRepoGuardIncidentRow>();
  private readonly undoStack: SelfRepoGuardMutationUndoRecord[] = [];
  private readonly redoStack: SelfRepoGuardMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private incidentsTable?: IDbTable<SelfRepoGuardIncidentRow>;
  private auditsTable?: IDbTable<SelfRepoGuardAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.incidentsTable = dbKernel.getTable<SelfRepoGuardIncidentRow>("self_repo_guard_incidents");
      this.auditsTable = dbKernel.getTable<SelfRepoGuardAuditRow>("self_repo_guard_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  public setConfig(config: Partial<SelfRepoGuardConfig>): void {
    const prev = this.exportSnapshot();
    this.config = { ...this.config, ...config };
    this.pushUndoRecord("config_change", prev);
  }

  public getConfig(): SelfRepoGuardConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: SelfRepoGuardMutationUndoRecord["mutationType"], prev: SelfRepoGuardWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliSelfRepoGuardSubstrate.MAX_UNDO_STACK) {
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
  // Incident Storage & Metric Recording
  // ---------------------------------------------------------------------------

  public recordIncident(incident: SelfRepoGuardIncidentRow): void {
    const prev = this.exportSnapshot();
    this.incidents.set(incident.incidentId, { ...incident });
    this.metrics.destructiveGitMutationsBlocked++;

    if (this.incidentsTable) {
      this.incidentsTable.put(incident.incidentId, { ...incident });
    }

    this.pushUndoRecord("add_incident", prev);
  }

  public recordBlockedIncident(incident: SelfRepoGuardIncident): void {
    this.recordIncident({
      ...incident,
    });
  }

  public recordCommandInspected(): void {
    this.metrics.totalCommandsInspected++;
  }

  public recordSafeOperation(): void {
    this.metrics.safeGitOperationsPassed++;
  }

  public recordForeignMutation(): void {
    this.metrics.foreignRepoMutationsAllowed++;
  }

  public getIncident(id: string): SelfRepoGuardIncidentRow | undefined {
    return this.incidents.get(id);
  }

  public listIncidents(): readonly SelfRepoGuardIncidentRow[] {
    return Array.from(this.incidents.values());
  }

  public getIncidents(): readonly SelfRepoGuardIncident[] {
    return Array.from(this.incidents.values());
  }

  public removeIncident(id: string): boolean {
    const exists = this.incidents.has(id);
    if (!exists) return false;

    const prev = this.exportSnapshot();
    this.incidents.delete(id);

    if (this.incidentsTable) {
      this.incidentsTable.delete(id);
    }

    this.pushUndoRecord("clear", prev);
    return true;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): SelfRepoGuardHealthAuditReport {
    let healthStatus: SelfRepoGuardHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (this.metrics.destructiveGitMutationsBlocked > 10) {
      healthStatus = "degraded";
      recommendations.push("Frequent destructive Git mutations intercepted on self-repository root.");
    }

    if (this.metrics.totalCommandsInspected === 0) {
      healthStatus = "healthy";
      recommendations.push("Self-repository guard initialized cleanly.");
    }

    return {
      totalCommandsInspected: this.metrics.totalCommandsInspected,
      destructiveGitMutationsBlocked: this.metrics.destructiveGitMutationsBlocked,
      safeGitOperationsPassed: this.metrics.safeGitOperationsPassed,
      foreignRepoMutationsAllowed: this.metrics.foreignRepoMutationsAllowed,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): SelfRepoGuardMetrics {
    return { ...this.metrics };
  }

  public getMetricsReport(): SelfRepoGuardMetricsReport {
    const blockRate =
      this.metrics.totalCommandsInspected === 0
        ? 0
        : Number(((this.metrics.destructiveGitMutationsBlocked / this.metrics.totalCommandsInspected) * 100).toFixed(1));

    const incidentsByOperation: Record<string, number> = {};
    for (const inc of this.incidents.values()) {
      incidentsByOperation[inc.operation] = (incidentsByOperation[inc.operation] || 0) + 1;
    }

    return {
      ...this.metrics,
      blockRatePercent: blockRate,
      incidentsByOperation,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedIncidents(
    groupBy: SelfRepoGuardGroupBy = "operation",
    sortBy: SelfRepoGuardSortBy = "timestamp",
    direction: SelfRepoGuardSortDirection = "desc"
  ): readonly SelfRepoGuardGroupedLane[] {
    const lanes = new Map<string, SelfRepoGuardIncidentRow[]>();
    const all = Array.from(this.incidents.values());

    for (const inc of all) {
      let key = "default";
      switch (groupBy) {
        case "operation":
          key = inc.operation;
          break;
        case "targetPath":
          key = inc.targetPath;
          break;
        case "runningRoot":
          key = inc.runningRoot;
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(inc);
    }

    const result: SelfRepoGuardGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = b.timestamp - a.timestamp;
        else if (sortBy === "operation") cmp = b.operation.localeCompare(a.operation);
        else if (sortBy === "command") cmp = b.command.localeCompare(a.command);
        return direction === "asc" ? -cmp : cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        incidents: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryIncidentsDsl(query: SelfRepoGuardDslQueryFilter | string): readonly SelfRepoGuardIncidentRow[] {
    const parsed: SelfRepoGuardDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const all = Array.from(this.incidents.values());

    return all.filter((inc) => {
      if (parsed.operation && !inc.operation.toLowerCase().includes(parsed.operation.toLowerCase())) return false;
      if (parsed.targetPath && !inc.targetPath.toLowerCase().includes(parsed.targetPath.toLowerCase())) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${inc.incidentId} ${inc.command} ${inc.reason}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): SelfRepoGuardDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let operation: string | undefined;
    let targetPath: string | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("op:")) {
        operation = tok.slice(3);
      } else if (tok.startsWith("path:")) {
        targetPath = tok.slice(5);
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      operation,
      targetPath,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeIncidents(ids: readonly string[]): SelfRepoGuardBulkMutationResult {
    const prev = this.exportSnapshot();
    let modified = 0;

    for (const id of ids) {
      if (this.incidents.has(id)) {
        this.incidents.delete(id);
        if (this.incidentsTable) this.incidentsTable.delete(id);
        modified++;
      }
    }

    this.pushUndoRecord("clear", prev);
    return {
      matchedCount: ids.length,
      modifiedCount: modified,
      affectedIncidentIds: ids,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const incidents = this.listIncidents();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Self-Repository Git Operation Guard Ledger</title>
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
  <h1>🛡️ LUMI Self-Repository Git Mutation Guard</h1>
  <p style="color: #94a3b8;">Deterministic Shell Context & Module-Skew Firewall (Phase 138 / ADR-114)</p>
  
  <div class="grid">
    <div class="card"><div>Commands Inspected</div><div class="metric-val">${metrics.totalCommandsInspected}</div></div>
    <div class="card"><div>Mutations Blocked</div><div class="metric-val" style="color:#f43f5e;">${metrics.destructiveGitMutationsBlocked}</div></div>
    <div class="card"><div>Safe Ops Passed</div><div class="metric-val" style="color:#10b981;">${metrics.safeGitOperationsPassed}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Blocked Incidents Ledger</h2>
  <table>
    <thead><tr><th>Incident ID</th><th>Operation</th><th>Command</th><th>Target Path</th><th>Reason</th></tr></thead>
    <tbody>
      ${incidents.map((i) => `<tr><td><code>${i.incidentId}</code></td><td>${i.operation}</td><td><code>${i.command}</code></td><td>${i.targetPath}</td><td>${i.reason}</td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const incidents = this.listIncidents();

    let md = `# LUMI Self-Repo Guard Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Inspected:** \`${metrics.totalCommandsInspected}\` | **Blocked:** \`${metrics.destructiveGitMutationsBlocked}\` | **Passed:** \`${metrics.safeGitOperationsPassed}\`\n\n`;
    md += `## Blocked Incidents (${incidents.length})\n\n`;
    md += `| Incident ID | Operation | Command | Target Path | Reason |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const i of incidents) {
      md += `| \`${i.incidentId}\` | ${i.operation} | \`${i.command}\` | ${i.targetPath} | ${i.reason} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "incidentId,operation,command,targetPath,runningRoot,reason,timestamp\n";
    const rows = Array.from(this.incidents.values()).map((i) => {
      return `"${i.incidentId}","${i.operation}","${i.command.replace(/"/g, '""')}","${i.targetPath}","${i.runningRoot}","${i.reason.replace(/"/g, '""')}",${i.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): SelfRepoGuardWorkspaceSnapshot {
    return {
      snapshotId: `snap-${Date.now()}`,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
      incidents: Array.from(this.incidents.values()),
    };
  }

  public createSnapshot(snapshotId: string): SelfRepoGuardWorkspaceSnapshot {
    const snap = this.exportSnapshot();
    return { ...snap, snapshotId };
  }

  public importSnapshot(snapshot: SelfRepoGuardWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.metrics = { ...snapshot.metrics };
    this.incidents.clear();
    if (snapshot.incidents) {
      for (const inc of snapshot.incidents) {
        this.incidents.set(inc.incidentId, { ...inc });
      }
    }
  }

  public restoreSnapshot(snapshot: SelfRepoGuardWorkspaceSnapshot): void {
    this.importSnapshot(snapshot);
  }

  public clear(): void {
    this.config = { ...DEFAULT_SELF_REPO_GUARD_CONFIG };
    this.metrics = {
      totalCommandsInspected: 0,
      destructiveGitMutationsBlocked: 0,
      safeGitOperationsPassed: 0,
      foreignRepoMutationsAllowed: 0,
    };
    this.incidents.clear();
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
