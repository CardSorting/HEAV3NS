/**
 * broccoli-heredoc-terminal-substrate.ts
 *
 * In-memory Hybrid BroccoliDB substrate repository maintaining sanitization event logs,
 * safety evaluation verdicts, diagnostic histories, swimlanes, and SLA health audits
 * (Phase 110 / ADR-086 / Target #86).
 */

import type {
  HeredocSanitizationLogRecord,
  TerminalExecutionDiagnostics,
  HeredocTerminalWorkspaceSnapshot,
  CommandSafetyClassification,
  HeredocSanitizationResult,
  HeredocTerminalConfig,
  HeredocSanitizationRow,
  HeredocDiagnosticRow,
  HeredocAuditRow,
  HeredocTerminalHealthStatus,
  HeredocTerminalHealthAuditReport,
  HeredocTerminalMetricsReport,
  HeredocTerminalGroupBy,
  HeredocTerminalSortBy,
  HeredocTerminalSortDirection,
  HeredocTerminalGroupedLane,
  HeredocTerminalDslQueryFilter,
  HeredocTerminalMutationUndoRecord,
  HeredocTerminalBulkMutationResult,
  IBroccoliHeredocTerminalSubstrate,
  CommandRiskLevel,
  TerminalDiagnosticCategory,
} from "../../../core/contracts/heredoc-terminal.contracts.js";
import { DEFAULT_HEREDOC_TERMINAL_CONFIG } from "../../../core/contracts/heredoc-terminal.contracts.js";

export class BroccoliHeredocTerminalSubstrate implements IBroccoliHeredocTerminalSubstrate {
  private config: HeredocTerminalConfig = { ...DEFAULT_HEREDOC_TERMINAL_CONFIG };
  private readonly sanitizationLogs = new Map<string, HeredocSanitizationRow>();
  private readonly diagnosticsLogs = new Map<string, HeredocDiagnosticRow>();
  private readonly rawSanitizations: HeredocSanitizationLogRecord[] = [];
  private readonly rawDiagnostics: TerminalExecutionDiagnostics[] = [];

  private totalSanitizations = 0;
  private totalMaskedBodies = 0;
  private totalDangerousCommandsBlocked = 0;
  private totalDiagnosticsGenerated = 0;

  // Undo / Redo Stacks
  private readonly undoStack: HeredocTerminalMutationUndoRecord[] = [];
  private readonly redoStack: HeredocTerminalMutationUndoRecord[] = [];
  private readonly MAX_UNDO_DEPTH = 32;

  constructor(config?: Partial<HeredocTerminalConfig>) {
    if (config) {
      this.config = { ...DEFAULT_HEREDOC_TERMINAL_CONFIG, ...config };
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Management
  // ---------------------------------------------------------------------------

  private pushUndoRecord(action: string, snapshot: HeredocTerminalWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationId: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      action,
      snapshot,
    });
    if (this.undoStack.length > this.MAX_UNDO_DEPTH) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  public undo(): boolean {
    const record = this.undoStack.pop();
    if (!record) return false;
    this.redoStack.push({
      mutationId: `redo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      action: record.action,
      snapshot: this.exportSnapshot(),
    });
    this.importSnapshot(record.snapshot);
    return true;
  }

  public redo(): boolean {
    const record = this.redoStack.pop();
    if (!record) return false;
    this.undoStack.push({
      mutationId: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      action: record.action,
      snapshot: this.exportSnapshot(),
    });
    this.importSnapshot(record.snapshot);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Core Substrate Recording
  // ---------------------------------------------------------------------------

  public recordSanitization(
    record: HeredocSanitizationLogRecord,
    originalCommand = "",
    sanitizedCommand = ""
  ): void {
    const prev = this.exportSnapshot();
    this.totalSanitizations++;
    this.totalMaskedBodies += record.maskedBodiesCount;
    if (record.riskLevel === "blocked") {
      this.totalDangerousCommandsBlocked++;
    }

    this.rawSanitizations.push({ ...record });
    if (this.rawSanitizations.length > this.config.maxLogHistory) {
      this.rawSanitizations.shift();
    }

    const row: HeredocSanitizationRow = {
      recordId: record.recordId,
      originalCommandPreview: originalCommand.slice(0, 100) || "N/A",
      sanitizedCommandPreview: sanitizedCommand.slice(0, 100) || "N/A",
      hasHeredocs: record.maskedBodiesCount > 0,
      maskedBodiesCount: record.maskedBodiesCount,
      riskLevel: record.riskLevel,
      hadAmbiguity: record.hadAmbiguity,
      latencyMs: record.latencyMs,
      timestamp: record.timestamp,
    };
    this.sanitizationLogs.set(row.recordId, row);

    this.pushUndoRecord("record_sanitization", prev);
  }

  public recordResult(result: HeredocSanitizationResult, safety: CommandSafetyClassification): void {
    const logRecord: HeredocSanitizationLogRecord = {
      recordId: `san-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      commandLength: result.originalCommand.length,
      maskedBodiesCount: result.maskedBodiesCount,
      hadAmbiguity: result.hadAmbiguity,
      latencyMs: result.latencyMs,
      riskLevel: safety.riskLevel,
    };

    this.recordSanitization(logRecord, result.originalCommand, result.sanitizedCommand);
  }

  public recordDiagnostic(diag: TerminalExecutionDiagnostics): void {
    const prev = this.exportSnapshot();
    this.totalDiagnosticsGenerated++;
    this.rawDiagnostics.push({ ...diag });
    if (this.rawDiagnostics.length > this.config.maxDiagnosticsHistory) {
      this.rawDiagnostics.shift();
    }

    const diagId = `diag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const row: HeredocDiagnosticRow = {
      diagId,
      exitCode: diag.exitCode,
      category: diag.primaryHint?.category || "generic",
      title: diag.primaryHint?.title || "Command Failed",
      rootCauseSummary: diag.rootCauseSummary,
      isRecoverable: diag.isRecoverable,
      executionTimeMs: diag.executionTimeMs || 0,
      timestamp: Date.now(),
    };
    this.diagnosticsLogs.set(diagId, row);

    this.pushUndoRecord("record_diagnostic", prev);
  }

  public recordDiagnostics(diag: TerminalExecutionDiagnostics): void {
    this.recordDiagnostic(diag);
  }

  // ---------------------------------------------------------------------------
  // Queries & Read Access
  // ---------------------------------------------------------------------------

  public getRecentLogs(limit = 50): readonly HeredocSanitizationLogRecord[] {
    return this.rawSanitizations.slice(-limit);
  }

  public getRecentDiagnostics(limit = 50): readonly TerminalExecutionDiagnostics[] {
    return this.rawDiagnostics.slice(-limit);
  }

  public getConfig(): HeredocTerminalConfig {
    return { ...this.config };
  }

  public updateConfig(patch: Partial<HeredocTerminalConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  public clear(): void {
    const prev = this.exportSnapshot();
    this.sanitizationLogs.clear();
    this.diagnosticsLogs.clear();
    this.rawSanitizations.length = 0;
    this.rawDiagnostics.length = 0;
    this.totalSanitizations = 0;
    this.totalMaskedBodies = 0;
    this.totalDangerousCommandsBlocked = 0;
    this.totalDiagnosticsGenerated = 0;
    this.pushUndoRecord("clear", prev);
  }

  // ---------------------------------------------------------------------------
  // Snapshot Operations
  // ---------------------------------------------------------------------------

  public exportSnapshot(): HeredocTerminalWorkspaceSnapshot {
    return {
      snapshotId: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      totalSanitizations: this.totalSanitizations,
      totalMaskedBodies: this.totalMaskedBodies,
      totalDangerousCommandsBlocked: this.totalDangerousCommandsBlocked,
      totalDiagnosticsGenerated: this.totalDiagnosticsGenerated,
      recentLogs: [...this.rawSanitizations],
      recentDiagnostics: [...this.rawDiagnostics],
    };
  }

  public createSnapshot(snapshotId: string): HeredocTerminalWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      totalSanitizations: this.totalSanitizations,
      totalMaskedBodies: this.totalMaskedBodies,
      totalDangerousCommandsBlocked: this.totalDangerousCommandsBlocked,
      totalDiagnosticsGenerated: this.totalDiagnosticsGenerated,
      recentLogs: [...this.rawSanitizations],
      recentDiagnostics: [...this.rawDiagnostics],
    };
  }

  public importSnapshot(snapshot: HeredocTerminalWorkspaceSnapshot): void {
    this.totalSanitizations = snapshot.totalSanitizations;
    this.totalMaskedBodies = snapshot.totalMaskedBodies;
    this.totalDangerousCommandsBlocked = snapshot.totalDangerousCommandsBlocked;
    this.totalDiagnosticsGenerated = snapshot.totalDiagnosticsGenerated;

    this.rawSanitizations.length = 0;
    this.rawSanitizations.push(...snapshot.recentLogs);

    this.rawDiagnostics.length = 0;
    this.rawDiagnostics.push(...snapshot.recentDiagnostics);

    this.sanitizationLogs.clear();
    for (const log of this.rawSanitizations) {
      this.sanitizationLogs.set(log.recordId, {
        recordId: log.recordId,
        originalCommandPreview: "Restored",
        sanitizedCommandPreview: "Restored",
        hasHeredocs: log.maskedBodiesCount > 0,
        maskedBodiesCount: log.maskedBodiesCount,
        riskLevel: log.riskLevel,
        hadAmbiguity: log.hadAmbiguity,
        latencyMs: log.latencyMs,
        timestamp: log.timestamp,
      });
    }

    this.diagnosticsLogs.clear();
    for (const diag of this.rawDiagnostics) {
      const diagId = `diag-restored-${Math.random().toString(36).slice(2, 7)}`;
      this.diagnosticsLogs.set(diagId, {
        diagId,
        exitCode: diag.exitCode,
        category: diag.primaryHint?.category || "generic",
        title: diag.primaryHint?.title || "Restored Diagnostic",
        rootCauseSummary: diag.rootCauseSummary,
        isRecoverable: diag.isRecoverable,
        executionTimeMs: diag.executionTimeMs || 0,
        timestamp: Date.now(),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // SLA Health Audits & Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): HeredocTerminalHealthAuditReport {
    let healthStatus: HeredocTerminalHealthStatus = "optimal";
    const recommendations: string[] = [];

    const totalLogs = this.rawSanitizations.length;
    const cleanLogs = this.rawSanitizations.filter((l) => l.riskLevel === "clean" || l.riskLevel === "low").length;
    const cleanRatioPercent = totalLogs > 0 ? Math.round((cleanLogs / totalLogs) * 100) : 100;

    let avgLatency = 0;
    if (totalLogs > 0) {
      const sumLatency = this.rawSanitizations.reduce((acc, l) => acc + l.latencyMs, 0);
      avgLatency = Number((sumLatency / totalLogs).toFixed(3));
    }

    if (this.totalDangerousCommandsBlocked > 5) {
      healthStatus = "degraded";
      recommendations.push("Frequent dangerous shell commands intercepted. Review subagent command generation.");
    }

    if (cleanRatioPercent < 50) {
      healthStatus = "critical";
      recommendations.push("High volume of risky/blocked shell invocations. Enable strict guard mode.");
    }

    return {
      timestamp: Date.now(),
      healthStatus,
      totalSanitizations: this.totalSanitizations,
      totalMaskedBodies: this.totalMaskedBodies,
      totalDangerousCommandsBlocked: this.totalDangerousCommandsBlocked,
      totalDiagnosticsGenerated: this.totalDiagnosticsGenerated,
      avgSanitizationLatencyMs: avgLatency,
      cleanRatioPercent,
      recommendations,
    };
  }

  public getMetricsReport(): HeredocTerminalMetricsReport {
    const riskLevelBreakdown: Record<CommandRiskLevel, number> = {
      clean: 0,
      low: 0,
      medium: 0,
      high: 0,
      blocked: 0,
    };
    for (const log of this.rawSanitizations) {
      riskLevelBreakdown[log.riskLevel] = (riskLevelBreakdown[log.riskLevel] || 0) + 1;
    }

    const diagnosticCategoryBreakdown: Record<TerminalDiagnosticCategory, number> = {
      missing_module: 0,
      port_collision: 0,
      permission_denied: 0,
      missing_command: 0,
      git_conflict: 0,
      syntax_error: 0,
      timeout: 0,
      generic: 0,
    };
    for (const diag of this.rawDiagnostics) {
      const cat = diag.primaryHint?.category || "generic";
      diagnosticCategoryBreakdown[cat] = (diagnosticCategoryBreakdown[cat] || 0) + 1;
    }

    let avgLatency = 0;
    if (this.rawSanitizations.length > 0) {
      const sum = this.rawSanitizations.reduce((a, b) => a + b.latencyMs, 0);
      avgLatency = Number((sum / this.rawSanitizations.length).toFixed(3));
    }

    return {
      totalSanitizations: this.totalSanitizations,
      totalMaskedBodies: this.totalMaskedBodies,
      totalDangerousCommandsBlocked: this.totalDangerousCommandsBlocked,
      totalDiagnosticsGenerated: this.totalDiagnosticsGenerated,
      riskLevelBreakdown,
      diagnosticCategoryBreakdown,
      avgSanitizationLatencyMs: avgLatency,
    };
  }

  public getMetrics() {
    return {
      totalSanitizations: this.totalSanitizations,
      totalMaskedBodies: this.totalMaskedBodies,
      totalDangerousCommandsBlocked: this.totalDangerousCommandsBlocked,
      totalDiagnosticsGenerated: this.totalDiagnosticsGenerated,
      loggedSanitizationsCount: this.rawSanitizations.length,
      loggedDiagnosticsCount: this.rawDiagnostics.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Swimlane Organizing & Natural Query DSL
  // ---------------------------------------------------------------------------

  public getGroupedRecords(
    groupBy: HeredocTerminalGroupBy = "riskLevel",
    sortBy: HeredocTerminalSortBy = "timestamp",
    direction: HeredocTerminalSortDirection = "desc"
  ): readonly HeredocTerminalGroupedLane[] {
    const rows = Array.from(this.sanitizationLogs.values());

    const groups = new Map<string, HeredocSanitizationRow[]>();
    for (const r of rows) {
      let key = "other";
      if (groupBy === "riskLevel") key = r.riskLevel;
      else if (groupBy === "hasHeredocs") key = r.hasHeredocs ? "has_heredocs" : "no_heredocs";

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    const lanes: HeredocTerminalGroupedLane[] = [];
    for (const [key, groupRows] of groups.entries()) {
      groupRows.sort((a, b) => {
        let diff = 0;
        if (sortBy === "timestamp") diff = a.timestamp - b.timestamp;
        else if (sortBy === "latencyMs") diff = a.latencyMs - b.latencyMs;
        else if (sortBy === "commandLength") diff = a.originalCommandPreview.length - b.originalCommandPreview.length;
        return direction === "asc" ? diff : -diff;
      });

      lanes.push({
        laneKey: key,
        label: key.toUpperCase(),
        count: groupRows.length,
        records: groupRows,
      });
    }

    return lanes;
  }

  public queryRecordsDsl(query: HeredocTerminalDslQueryFilter | string): readonly HeredocSanitizationRow[] {
    let filter: HeredocTerminalDslQueryFilter = {};
    if (typeof query === "string") {
      const q = query.trim().toLowerCase();
      const parts = q.split(/\s+/);
      const searchTerms: string[] = [];

      for (const p of parts) {
        if (p.startsWith("risk:")) {
          filter = { ...filter, risk: p.slice(5) as CommandRiskLevel };
        } else if (p.startsWith("is:heredoc") || p === "has:heredocs") {
          filter = { ...filter, hasHeredocs: true };
        } else if (p.length > 0) {
          searchTerms.push(p);
        }
      }
      if (searchTerms.length > 0) {
        filter = { ...filter, query: searchTerms.join(" ") };
      }
    } else {
      filter = query;
    }

    return Array.from(this.sanitizationLogs.values()).filter((row) => {
      if (filter.risk && row.riskLevel !== filter.risk) return false;
      if (filter.hasHeredocs !== undefined && row.hasHeredocs !== filter.hasHeredocs) return false;
      if (filter.query) {
        const text = `${row.originalCommandPreview} ${row.sanitizedCommandPreview} ${row.riskLevel}`.toLowerCase();
        if (!text.includes(filter.query.toLowerCase())) return false;
      }
      return true;
    });
  }

  public bulkPurgeRecords(recordIds: readonly string[]): HeredocTerminalBulkMutationResult {
    const prev = this.exportSnapshot();
    const toDelete = new Set(recordIds);
    let matchedCount = 0;
    const deletedIds: string[] = [];

    for (const id of toDelete) {
      if (this.sanitizationLogs.delete(id)) {
        matchedCount++;
        deletedIds.push(id);
      }
    }

    for (let i = this.rawSanitizations.length - 1; i >= 0; i--) {
      if (toDelete.has(this.rawSanitizations[i].recordId)) {
        this.rawSanitizations.splice(i, 1);
      }
    }

    this.pushUndoRecord("bulk_purge", prev);
    return {
      matchedCount,
      modifiedCount: matchedCount,
      deletedIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportHtml(): string {
    const health = this.auditHealth();
    const rows = Array.from(this.sanitizationLogs.values());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>LUMI Heredoc Terminal Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1, h2 { color: #38bdf8; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
    .badge-optimal { background: #16a34a; color: white; }
    .badge-degraded { background: #ca8a04; color: white; }
    .badge-critical { background: #dc2626; color: white; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; background: #1e293b; border-radius: 8px; overflow: hidden; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #334155; }
    th { background: #0f172a; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>LUMI Heredoc Terminal & Diagnostics Dashboard</h1>
  <p>Status: <span class="badge badge-${health.healthStatus}">${health.healthStatus.toUpperCase()}</span> | Total Sanitizations: <strong>${health.totalSanitizations}</strong> | Dangerous Blocked: <strong>${health.totalDangerousCommandsBlocked}</strong></p>
  <h2>Recent Command Sanitizations</h2>
  <table>
    <thead>
      <tr>
        <th>Record ID</th>
        <th>Risk Level</th>
        <th>Has Heredocs</th>
        <th>Latency</th>
        <th>Command Preview</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (r) => `<tr>
        <td><code>${r.recordId}</code></td>
        <td><strong>${r.riskLevel.toUpperCase()}</strong></td>
        <td>${r.hasHeredocs ? "Yes" : "No"}</td>
        <td>${r.latencyMs.toFixed(3)} ms</td>
        <td><code>${escapeHtml(r.originalCommandPreview)}</code></td>
      </tr>`
        )
        .join("\n")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdown(): string {
    const health = this.auditHealth();
    const rows = Array.from(this.sanitizationLogs.values());

    return `# LUMI Heredoc Terminal & Diagnostics Report
Generated: ${new Date(health.timestamp).toISOString()}
Status: **${health.healthStatus.toUpperCase()}** | Total Sanitizations: **${health.totalSanitizations}** | Blocked: **${health.totalDangerousCommandsBlocked}**

## Sanitization Log
| Record ID | Risk Level | Has Heredocs | Latency (ms) | Preview |
|---|---|---|---|---|
${rows.map((r) => `| \`${r.recordId}\` | **${r.riskLevel}** | ${r.hasHeredocs} | ${r.latencyMs.toFixed(3)} | \`${r.originalCommandPreview.replace(/\|/g, "\\|")}\` |`).join("\n")}
`;
  }

  public exportCsv(): string {
    const rows = Array.from(this.sanitizationLogs.values());
    const header = "recordId,riskLevel,hasHeredocs,maskedBodiesCount,latencyMs,timestamp\n";
    const body = rows
      .map((r) => `"${r.recordId}","${r.riskLevel}",${r.hasHeredocs},${r.maskedBodiesCount},${r.latencyMs},${r.timestamp}`)
      .join("\n");
    return header + body;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
