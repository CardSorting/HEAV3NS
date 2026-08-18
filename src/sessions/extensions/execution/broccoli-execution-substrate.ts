/**
 * broccoli-execution-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate leveraging the Hybrid BroccoliDB Kernel
 * for Sandboxed Code Executions, programmatic tool call ledgers, and SLA health audits (Phase 82 / ADR-034).
 */

import type {
  ExecutionAuditRow,
  ExecutionBulkMutationResult,
  ExecutionDslQueryFilter,
  ExecutionGroupBy,
  ExecutionGroupedLane,
  ExecutionHealthAuditReport,
  ExecutionHealthStatus,
  ExecutionMetricsReport,
  ExecutionMutationUndoRecord,
  ExecutionRecord,
  ExecutionRecordRow,
  ExecutionSortBy,
  ExecutionSortDirection,
  ExecutionWorkspaceSnapshot,
  IBroccoliExecutionSubstrate,
  ProgrammaticToolCall,
  ToolCallRow,
} from "../../../core/contracts/execution.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliExecutionSubstrate implements IBroccoliExecutionSubstrate {
  private readonly records: Map<string, ExecutionRecord>;
  private readonly toolCalls: Map<string, ProgrammaticToolCall[]>;
  private readonly auditLogs: ExecutionAuditRow[] = [];

  private readonly undoStack: ExecutionMutationUndoRecord[] = [];
  private readonly redoStack: ExecutionMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private recordsTable?: IDbTable<ExecutionRecordRow>;
  private toolCallsTable?: IDbTable<ToolCallRow>;
  private auditsTable?: IDbTable<ExecutionAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    this.records = new Map<string, ExecutionRecord>();
    this.toolCalls = new Map<string, ProgrammaticToolCall[]>();

    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.recordsTable = dbKernel.getTable<ExecutionRecordRow>("execution_records");
      this.toolCallsTable = dbKernel.getTable<ToolCallRow>("execution_tool_calls");
      this.auditsTable = dbKernel.getTable<ExecutionAuditRow>("execution_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: ExecutionMutationUndoRecord["mutationType"], prev: ExecutionWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliExecutionSubstrate.MAX_UNDO_STACK) {
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
    this.recordAudit("system", "undo", "system", `Reverted ${record.mutationType}`);
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
    this.recordAudit("system", "redo", "system", `Reapplied ${record.mutationType}`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Core Execution Operations
  // ---------------------------------------------------------------------------

  public recordExecution(record: ExecutionRecord): void {
    const prev = this.exportSnapshot();
    this.records.set(record.id, record);

    if (this.recordsTable) {
      this.recordsTable.put(record.id, {
        id: record.id,
        language: record.language,
        status: record.result.status,
        executionTimeMs: record.result.executionTimeMs,
        toolCallsExecuted: record.result.toolCallsExecuted,
        success: record.result.success,
        createdFrame: record.createdFrame,
        timestamp: record.timestamp,
      });
    }

    if (record.result.toolCalls && record.result.toolCalls.length > 0) {
      this.toolCalls.set(record.id, [...record.result.toolCalls]);
      if (this.toolCallsTable) {
        for (let i = 0; i < record.result.toolCalls.length; i++) {
          const tc = record.result.toolCalls[i];
          this.toolCallsTable.put(`${record.id}_${i}`, {
            id: `${record.id}_${i}`,
            executionId: record.id,
            toolName: tc.toolName,
            executionTimeMs: tc.executionTimeMs,
            success: tc.success,
            timestamp: tc.timestamp,
          });
        }
      }
    }

    this.pushUndoRecord("record_execution", prev);
    this.recordAudit(record.id, "record_execution", "executor", `Executed ${record.language} script in ${record.result.executionTimeMs} ms`);
  }

  public getExecution(executionId: string): ExecutionRecord | undefined {
    return this.records.get(executionId);
  }

  public listExecutions(limit = 50): readonly ExecutionRecord[] {
    return Array.from(this.records.values()).slice(0, limit);
  }

  public recordToolCall(executionId: string, call: ProgrammaticToolCall): void {
    if (!this.toolCalls.has(executionId)) {
      this.toolCalls.set(executionId, []);
    }
    this.toolCalls.get(executionId)!.push(call);
  }

  public listToolCalls(executionId?: string, limit = 100): readonly ProgrammaticToolCall[] {
    if (executionId) {
      return (this.toolCalls.get(executionId) ?? []).slice(0, limit);
    }
    const all: ProgrammaticToolCall[] = [];
    for (const calls of this.toolCalls.values()) {
      all.push(...calls);
    }
    return all.slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditExecutionHealth(): ExecutionHealthAuditReport {
    const list = Array.from(this.records.values());
    const totalExecutions = list.length;
    const successCount = list.filter((r) => r.result.status === "success").length;
    const failureCount = list.filter((r) => r.result.status === "failure").length;
    const timedOutCount = list.filter((r) => r.result.status === "timed_out").length;
    const securityBlockedCount = list.filter((r) => r.result.status === "security_blocked").length;

    const overallSuccessRate = totalExecutions > 0 ? Number((successCount / totalExecutions).toFixed(2)) : 1.0;
    const totalDur = list.reduce((sum, r) => sum + r.result.executionTimeMs, 0);
    const avgDuration = totalExecutions > 0 ? Number((totalDur / totalExecutions).toFixed(2)) : 0;

    let healthStatus: ExecutionHealthStatus = "optimal";
    if (securityBlockedCount > 0) {
      healthStatus = "security_alert";
    } else if (failureCount > 0 || timedOutCount > 0) {
      healthStatus = "degraded";
    } else if (totalExecutions > 0) {
      healthStatus = "healthy";
    }

    const recommendations: string[] = [];
    if (securityBlockedCount > 0) {
      recommendations.push(`${securityBlockedCount} security violations blocked. Review script sandbox permissions.`);
    }
    if (timedOutCount > 0) {
      recommendations.push(`${timedOutCount} execution(s) timed out. Consider raising sandbox timeout limit.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("Code execution sandbox and programmatic tool calling are operating optimally.");
    }

    return {
      totalExecutions,
      successCount,
      failureCount,
      timedOutCount,
      securityBlockedCount,
      overallSuccessRate,
      avgExecutionTimeMs: avgDuration,
      healthStatus,
      recommendations,
    };
  }

  public getExecutionMetrics(): ExecutionMetricsReport {
    const list = Array.from(this.records.values());
    const totalExecutions = list.length;
    const successCount = list.filter((r) => r.result.status === "success").length;
    const failureCount = list.filter((r) => r.result.status === "failure").length;
    const timedOutCount = list.filter((r) => r.result.status === "timed_out").length;
    const securityBlockedCount = list.filter((r) => r.result.status === "security_blocked").length;

    const overallSuccessRate = totalExecutions > 0 ? Number((successCount / totalExecutions).toFixed(2)) : 1.0;
    const totalDur = list.reduce((sum, r) => sum + r.result.executionTimeMs, 0);
    const avgDuration = totalExecutions > 0 ? Number((totalDur / totalExecutions).toFixed(2)) : 0;

    const durations = list.map((r) => r.result.executionTimeMs).sort((a, b) => a - b);
    const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;

    let totalToolCalls = 0;
    const toolCounts: Record<string, number> = {};
    for (const calls of this.toolCalls.values()) {
      totalToolCalls += calls.length;
      for (const tc of calls) {
        toolCounts[tc.toolName] = (toolCounts[tc.toolName] ?? 0) + 1;
      }
    }

    const topTools = Object.entries(toolCounts)
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalExecutions,
      successCount,
      failureCount,
      timedOutCount,
      securityBlockedCount,
      totalToolCalls,
      overallSuccessRate,
      avgExecutionTimeMs: avgDuration,
      p50ExecutionTimeMs: Number(p50.toFixed(2)),
      p95ExecutionTimeMs: Number(p95.toFixed(2)),
      topInvokedTools: topTools,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedExecutions(
    groupBy: ExecutionGroupBy = "language",
    sortBy: ExecutionSortBy = "timestamp",
    direction: ExecutionSortDirection = "desc"
  ): readonly ExecutionGroupedLane[] {
    const lanes = new Map<string, ExecutionRecord[]>();

    for (const record of this.records.values()) {
      let key = "javascript";
      switch (groupBy) {
        case "language":
          key = record.language;
          break;
        case "status":
          key = record.result.status;
          break;
        case "createdFrame":
          key = `frame_${record.createdFrame}`;
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(record);
    }

    const result: ExecutionGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = a.timestamp - b.timestamp;
        else if (sortBy === "executionTimeMs") cmp = a.result.executionTimeMs - b.result.executionTimeMs;
        else if (sortBy === "toolCallsExecuted") cmp = a.result.toolCallsExecuted - b.result.toolCallsExecuted;
        return direction === "asc" ? cmp : -cmp;
      });

      const succ = items.filter((i) => i.result.success).length;
      const rate = items.length > 0 ? Number((succ / items.length).toFixed(2)) : 1.0;

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        successRate: rate,
        records: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryExecutionsDsl(query: ExecutionDslQueryFilter | string): readonly ExecutionRecord[] {
    const parsed: ExecutionDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;

    return Array.from(this.records.values()).filter((record) => {
      if (parsed.language && record.language !== parsed.language) return false;
      if (parsed.status && record.result.status !== parsed.status) return false;

      if (parsed.minExecutionTimeMs !== undefined && record.result.executionTimeMs < parsed.minExecutionTimeMs) return false;
      if (parsed.maxExecutionTimeMs !== undefined && record.result.executionTimeMs > parsed.maxExecutionTimeMs) return false;

      if (parsed.hasToolCalls !== undefined) {
        const has = record.result.toolCallsExecuted > 0;
        if (has !== parsed.hasToolCalls) return false;
      }

      if (parsed.toolName) {
        const hasTool = record.result.toolCalls.some((tc) => tc.toolName === parsed.toolName);
        if (!hasTool) return false;
      }

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${record.id} ${record.language} ${record.code} ${record.result.output}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): ExecutionDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let language: ExecutionDslQueryFilter["language"];
    let status: ExecutionDslQueryFilter["status"];
    let maxExecutionTimeMs: number | undefined;
    let toolName: string | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("lang:")) {
        language = tok.slice(5) as ExecutionDslQueryFilter["language"];
      } else if (tok.startsWith("status:")) {
        status = tok.slice(7) as ExecutionDslQueryFilter["status"];
      } else if (tok.startsWith("duration<")) {
        maxExecutionTimeMs = Number(tok.slice(9));
      } else if (tok.startsWith("tool:")) {
        toolName = tok.slice(5);
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      language,
      status,
      maxExecutionTimeMs,
      toolName,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeRecords(executionIds: readonly string[]): ExecutionBulkMutationResult {
    const prev = this.exportSnapshot();
    const affected: string[] = [];

    for (const id of executionIds) {
      if (this.records.delete(id)) {
        this.toolCalls.delete(id);
        affected.push(id);
      }
    }

    this.pushUndoRecord("bulk", prev);
    return {
      matchedCount: executionIds.length,
      modifiedCount: affected.length,
      affectedExecutionIds: affected,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getExecutionMetrics();
    const health = this.auditExecutionHealth();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Sandboxed Code Execution & Tool Calling</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #10b981; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #10b981; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .badge-succ { background: #16a34a; color: #bbf7d0; }
    .badge-fail { background: #dc2626; color: #fecaca; }
  </style>
</head>
<body>
  <h1>⚡ LUMI Sandboxed Code Execution & Tool Calling</h1>
  <p style="color: #94a3b8;">Deterministic Programmatic Scripting, Sandbox Security & Telemetry (Phase 82 / ADR-034)</p>
  
  <div class="grid">
    <div class="card"><div>Total Executions</div><div class="metric-val">${metrics.totalExecutions}</div></div>
    <div class="card"><div>Successful</div><div class="metric-val" style="color:#22c55e;">${metrics.successCount}</div></div>
    <div class="card"><div>Success Rate</div><div class="metric-val" style="color:#10b981;">${(metrics.overallSuccessRate * 100).toFixed(0)}%</div></div>
    <div class="card"><div>Health Status</div><div class="metric-val" style="color:#22c55e;">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Execution History</h2>
  <table>
    <thead>
      <tr>
        <th>Execution ID</th>
        <th>Language</th>
        <th>Status</th>
        <th>Duration</th>
        <th>Tools</th>
        <th>Code Snippet</th>
      </tr>
    </thead>
    <tbody>
      ${Array.from(this.records.values()).slice(0, 25).map((r) => `
        <tr>
          <td><code>${r.id}</code></td>
          <td>${r.language}</td>
          <td><span class="badge ${r.result.success ? "badge-succ" : "badge-fail"}">${r.result.status}</span></td>
          <td>${r.result.executionTimeMs} ms</td>
          <td>${r.result.toolCallsExecuted}</td>
          <td>${r.code.slice(0, 40)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getExecutionMetrics();
    const health = this.auditExecutionHealth();

    let md = `# LUMI Sandboxed Code Execution Diagnostic Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Success Rate:** \`${(metrics.overallSuccessRate * 100).toFixed(0)}%\` | **Total Executions:** \`${metrics.totalExecutions}\`\n\n`;
    md += `## Metrics Summary\n`;
    md += `- **Successful:** ${metrics.successCount}\n`;
    md += `- **Failed:** ${metrics.failureCount}\n`;
    md += `- **Timed Out:** ${metrics.timedOutCount}\n`;
    md += `- **Security Blocked:** ${metrics.securityBlockedCount}\n`;
    md += `- **Tool Calls Executed:** ${metrics.totalToolCalls}\n`;
    md += `- **Avg Duration:** ${metrics.avgExecutionTimeMs} ms (p95: ${metrics.p95ExecutionTimeMs} ms)\n\n`;

    md += `## Recent Executions\n\n`;
    md += `| ID | Language | Status | Duration | Tools | Code |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const r of Array.from(this.records.values()).slice(0, 20)) {
      md += `| \`${r.id}\` | ${r.language} | \`${r.result.status}\` | ${r.result.executionTimeMs} ms | ${r.result.toolCallsExecuted} | ${r.code.slice(0, 30).replace(/\|/g, "\\|")} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "id,language,status,executionTimeMs,toolCallsExecuted,success,timestamp\n";
    const rows = Array.from(this.records.values()).map((r) => {
      return `"${r.id}","${r.language}","${r.result.status}",${r.result.executionTimeMs},${r.result.toolCallsExecuted},${r.result.success},${r.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Auditing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): ExecutionWorkspaceSnapshot {
    const list = Array.from(this.records.values());
    const successes = list.filter((r) => r.result.success).length;

    let totalTools = 0;
    for (const calls of this.toolCalls.values()) {
      totalTools += calls.length;
    }

    return {
      totalExecutions: list.length,
      successCount: successes,
      failureCount: list.length - successes,
      totalToolCalls: totalTools,
      records: list,
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: ExecutionWorkspaceSnapshot): void {
    this.records.clear();
    this.toolCalls.clear();

    for (const r of snapshot.records) {
      this.records.set(r.id, r);
      if (r.result.toolCalls) {
        this.toolCalls.set(r.id, [...r.result.toolCalls]);
      }
    }
  }

  public recordAudit(executionId: string, action: string, operator: string, details: string): void {
    const row: ExecutionAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      executionId,
      action,
      operator,
      details,
      timestamp: Date.now(),
    };
    this.auditLogs.unshift(row);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
    if (this.auditsTable) {
      this.auditsTable.put(row.id, row);
    }
  }

  public clear(): void {
    this.records.clear();
    this.toolCalls.clear();
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
