/**
 * broccoli-doctor-substrate.ts
 *
 * In-memory zero-GC Broccolidb repository for diagnostic reports, session salvage audit records,
 * and live health probe metrics (Phase 97 / ADR-049 / Target #68).
 */

import type {
  DiagnosticCheckRow,
  DiagnosticDoctorBulkMutationResult,
  DiagnosticDoctorDslQueryFilter,
  DiagnosticDoctorGroupBy,
  DiagnosticDoctorGroupedLane,
  DiagnosticDoctorHealthAuditReport,
  DiagnosticDoctorHealthStatus,
  DiagnosticDoctorMetricsReport,
  DiagnosticDoctorMutationUndoRecord,
  DiagnosticDoctorSortBy,
  DiagnosticDoctorSortDirection,
  DiagnosticReportRow,
  DiagnosticSeverity,
  DoctorAuditRow,
  DoctorWorkspaceSnapshot,
  IBroccoliDoctorSubstrate,
  SessionSalvageReport,
  SessionSalvageRow,
  SystemDiagnosticReport,
} from "../../../core/contracts/diagnostic-doctor.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliDoctorSubstrate implements IBroccoliDoctorSubstrate {
  private reports: SystemDiagnosticReport[] = [];
  private salvages: SessionSalvageReport[] = [];
  private readonly auditLogs: DoctorAuditRow[] = [];

  private readonly undoStack: DiagnosticDoctorMutationUndoRecord[] = [];
  private readonly redoStack: DiagnosticDoctorMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private reportsTable?: IDbTable<DiagnosticReportRow>;
  private checksTable?: IDbTable<DiagnosticCheckRow>;
  private salvagesTable?: IDbTable<SessionSalvageRow>;
  private auditsTable?: IDbTable<DoctorAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.reportsTable = dbKernel.getTable<DiagnosticReportRow>("diagnostic_reports");
      this.checksTable = dbKernel.getTable<DiagnosticCheckRow>("diagnostic_checks");
      this.salvagesTable = dbKernel.getTable<SessionSalvageRow>("session_salvages");
      this.auditsTable = dbKernel.getTable<DoctorAuditRow>("doctor_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: DiagnosticDoctorMutationUndoRecord["mutationType"], prev: DoctorWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliDoctorSubstrate.MAX_UNDO_STACK) {
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
    this.recordAuditRow("system", "undo", "system", `Reverted ${record.mutationType}`);
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
    this.recordAuditRow("system", "redo", "system", `Reapplied ${record.mutationType}`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Diagnostic Reports & Salvage Repository Operations
  // ---------------------------------------------------------------------------

  public recordReport(report: SystemDiagnosticReport): void {
    const prev = this.exportSnapshot();
    this.reports.push(report);
    if (this.reports.length > 200) {
      this.reports.shift();
    }

    if (this.reportsTable) {
      this.reportsTable.put(report.reportId, {
        id: report.reportId,
        reportId: report.reportId,
        overallHealth: report.overallHealth,
        totalChecks: report.totalChecks,
        healthyCount: report.healthyCount,
        warningCount: report.warningCount,
        criticalCount: report.criticalCount,
        fatalCount: report.fatalCount,
        durationMs: report.durationMs,
        timestamp: report.timestamp,
      });
    }

    if (this.checksTable) {
      for (const c of report.checks) {
        this.checksTable.put(c.checkId, {
          id: c.checkId,
          checkId: c.checkId,
          reportId: report.reportId,
          category: c.category,
          severity: c.severity,
          message: c.message,
          timestamp: report.timestamp,
        });
      }
    }

    this.pushUndoRecord("record_report", prev);
    this.recordAuditRow(report.reportId, "record_report", "system", `Health: ${report.overallHealth}`);
  }

  public getReport(reportId: string): SystemDiagnosticReport | undefined {
    return this.reports.find((r) => r.reportId === reportId);
  }

  public listReports(): readonly SystemDiagnosticReport[] {
    return [...this.reports];
  }

  public getLatestReport(): SystemDiagnosticReport | undefined {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : undefined;
  }

  public recordSalvage(salvage: SessionSalvageReport): void {
    const prev = this.exportSnapshot();
    this.salvages.push(salvage);
    if (this.salvages.length > 200) {
      this.salvages.shift();
    }

    if (this.salvagesTable) {
      this.salvagesTable.put(salvage.sessionId, {
        id: salvage.sessionId,
        sessionId: salvage.sessionId,
        totalTurnsExamined: salvage.totalTurnsExamined,
        repairedTurnsCount: salvage.repairedTurnsCount,
        success: salvage.success,
        timestamp: salvage.timestamp,
      });
    }

    this.pushUndoRecord("record_salvage", prev);
    this.recordAuditRow(salvage.sessionId, "record_salvage", "system", `Repaired: ${salvage.repairedTurnsCount}`);
  }

  public listSalvages(): readonly SessionSalvageReport[] {
    return [...this.salvages];
  }

  public getSalvages(): readonly SessionSalvageReport[] {
    return [...this.salvages];
  }

  public getSalvage(sessionId: string): SessionSalvageReport | undefined {
    return this.salvages.find((s) => s.sessionId === sessionId);
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): DiagnosticDoctorHealthAuditReport {
    const latest = this.getLatestReport();
    const latestSeverity: DiagnosticSeverity = latest ? latest.overallHealth : "healthy";
    const totalSalvages = this.salvages.length;
    const totalRepairedTurns = this.salvages.reduce((acc, s) => acc + s.repairedTurnsCount, 0);
    const recommendations: string[] = [];
    let healthStatus: DiagnosticDoctorHealthStatus = "optimal";

    if (latestSeverity === "fatal" || latestSeverity === "critical") {
      healthStatus = "unhealthy";
      recommendations.push("Critical or fatal diagnostic checks detected. Review report details immediately.");
    } else if (latestSeverity === "warning") {
      healthStatus = "degraded";
      recommendations.push("Warning status detected on system diagnostics (e.g. offline credentials mode).");
    }

    if (totalRepairedTurns > 10) {
      recommendations.push("High frequency of session transcript repairs detected. Investigate potential unhandled agent crashes.");
    }

    if (recommendations.length === 0) {
      recommendations.push("Monolithic runtime environment, memory slabs, and state rewind are operating nominally.");
    }

    return {
      totalReports: this.reports.length,
      latestHealthSeverity: latestSeverity,
      totalSalvages,
      totalRepairedTurns,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): DiagnosticDoctorMetricsReport {
    const totalChecks = this.reports.reduce((acc, r) => acc + r.totalChecks, 0);
    const totalRepairedTurns = this.salvages.reduce((acc, s) => acc + s.repairedTurnsCount, 0);
    const durations = this.reports.map((r) => r.durationMs).sort((a, b) => a - b);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;

    return {
      totalReportsGenerated: this.reports.length,
      totalChecksExecuted: totalChecks,
      totalSalvagesAttempted: this.salvages.length,
      totalTurnsRepaired: totalRepairedTurns,
      averageProbeDurationMs: Number(avgDuration.toFixed(2)),
      p50DurationMs: p50,
      p95DurationMs: p95,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedReports(
    groupBy: DiagnosticDoctorGroupBy = "severity",
    sortBy: DiagnosticDoctorSortBy = "timestamp",
    direction: DiagnosticDoctorSortDirection = "desc"
  ): readonly DiagnosticDoctorGroupedLane[] {
    const lanes = new Map<string, SystemDiagnosticReport[]>();

    for (const r of this.reports) {
      let key = "default";
      switch (groupBy) {
        case "severity":
          key = r.overallHealth;
          break;
        case "category":
          key = r.checks.length > 0 ? r.checks[0].category : "general";
          break;
        case "salvage_status":
          key = this.salvages.length > 0 ? "Has Salvages" : "Clean Sessions";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(r);
    }

    const result: DiagnosticDoctorGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = b.timestamp - a.timestamp;
        else if (sortBy === "severity") cmp = a.overallHealth.localeCompare(b.overallHealth);
        else if (sortBy === "durationMs") cmp = b.durationMs - a.durationMs;
        return direction === "asc" ? -cmp : cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        reports: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryReportsDsl(query: DiagnosticDoctorDslQueryFilter | string): readonly SystemDiagnosticReport[] {
    const parsed: DiagnosticDoctorDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;

    return this.reports.filter((r) => {
      if (parsed.severity && r.overallHealth !== parsed.severity) return false;
      if (parsed.minChecks !== undefined && r.totalChecks < parsed.minChecks) return false;
      if (parsed.category && !r.checks.some((c) => c.category === parsed.category)) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${r.reportId} ${r.overallHealth} ${r.checks.map((c) => c.message).join(" ")}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): DiagnosticDoctorDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let severity: DiagnosticSeverity | undefined;
    let category: any | undefined;
    let minChecks: number | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("severity:")) {
        severity = tok.slice(9) as DiagnosticSeverity;
      } else if (tok.startsWith("category:")) {
        category = tok.slice(9);
      } else if (tok.startsWith("min_checks:")) {
        minChecks = Number(tok.slice(11));
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      severity,
      category,
      minChecks,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeReports(reportIds: readonly string[]): DiagnosticDoctorBulkMutationResult {
    const prev = this.exportSnapshot();
    const toPurge = new Set(reportIds);
    const initialLen = this.reports.length;
    this.reports = this.reports.filter((r) => !toPurge.has(r.reportId));
    const modified = initialLen - this.reports.length;

    this.pushUndoRecord("bulk_purge", prev);
    return {
      matchedCount: reportIds.length,
      modifiedCount: modified,
      affectedReportIds: reportIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const latest = this.getLatestReport();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Diagnostic Doctor & State Integrity Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; background: #0284c7; color: #bae6fd; }
  </style>
</head>
<body>
  <h1>🩺 LUMI Diagnostic Doctor & Forensic State Salvage</h1>
  <p style="color: #94a3b8;">Deterministic Health Probing, Orphaned Session Salvage & State Integrity (Phase 97 / Target #68)</p>
  
  <div class="grid">
    <div class="card"><div>Total Reports</div><div class="metric-val">${metrics.totalReportsGenerated}</div></div>
    <div class="card"><div>Checks Executed</div><div class="metric-val" style="color:#10b981;">${metrics.totalChecksExecuted}</div></div>
    <div class="card"><div>Sessions Salvaged</div><div class="metric-val" style="color:#8b5cf6;">${metrics.totalSalvagesAttempted}</div></div>
    <div class="card"><div>Latest Severity</div><div class="metric-val" style="color:${health.latestHealthSeverity === 'healthy' ? '#22c55e' : '#eab308'};">${health.latestHealthSeverity.toUpperCase()}</div></div>
  </div>

  <h2>Latest Diagnostic Checks</h2>
  <table>
    <thead>
      <tr>
        <th>Check ID</th>
        <th>Category</th>
        <th>Severity</th>
        <th>Diagnostic Message</th>
      </tr>
    </thead>
    <tbody>
      ${(latest?.checks || []).map((c) => `
        <tr>
          <td><code>${c.checkId}</code></td>
          <td><span class="badge">${c.category.toUpperCase()}</span></td>
          <td><strong>${c.severity.toUpperCase()}</strong></td>
          <td>${c.message}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const latest = this.getLatestReport();

    let md = `# LUMI Diagnostic Doctor Diagnostic Report\n\n`;
    md += `**Overall Health:** \`${health.latestHealthSeverity.toUpperCase()}\` | **Total Reports:** \`${metrics.totalReportsGenerated}\` | **Salvages:** \`${metrics.totalSalvagesAttempted}\`\n\n`;
    md += `## Metrics Summary\n`;
    md += `- **Checks Executed:** ${metrics.totalChecksExecuted}\n`;
    md += `- **Turns Repaired:** ${metrics.totalTurnsRepaired}\n`;
    md += `- **Average Latency:** ${metrics.averageProbeDurationMs} ms\n\n`;

    if (latest) {
      md += `## Latest Diagnostic Checks (${latest.checks.length})\n\n`;
      md += `| Check ID | Category | Severity | Message |\n`;
      md += `|---|---|---|---|\n`;
      for (const c of latest.checks) {
        md += `| \`${c.checkId}\` | \`${c.category}\` | ${c.severity.toUpperCase()} | ${c.message} |\n`;
      }
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "reportId,overallHealth,totalChecks,healthyCount,warningCount,criticalCount,durationMs,timestamp\n";
    const rows = this.reports.map((r) => {
      return `"${r.reportId}","${r.overallHealth}",${r.totalChecks},${r.healthyCount},${r.warningCount},${r.criticalCount},${r.durationMs},${r.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Audits
  // ---------------------------------------------------------------------------

  public exportSnapshot(): DoctorWorkspaceSnapshot {
    return {
      totalReports: this.reports.length,
      latestReport: this.getLatestReport(),
      totalSalvages: this.salvages.length,
      activeSalvages: [...this.salvages],
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: DoctorWorkspaceSnapshot): void {
    this.reports = snapshot.latestReport ? [snapshot.latestReport] : [];
    this.salvages = [...snapshot.activeSalvages];
  }

  private recordAuditRow(reportId: string, action: string, operator: string, details: string): void {
    const row: DoctorAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: `${action}:${reportId}`,
      operator,
      details,
      timestamp: Date.now(),
    };
    this.auditLogs.unshift(row as any);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
    if (this.auditsTable) {
      this.auditsTable.put(row.id, row);
    }
  }

  public clear(): void {
    this.reports = [];
    this.salvages = [];
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
