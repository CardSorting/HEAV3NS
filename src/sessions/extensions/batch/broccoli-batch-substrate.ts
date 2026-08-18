/**
 * broccoli-batch-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate leveraging the Hybrid BroccoliDB Kernel
 * for Batch Evaluation runs, task ledgers, automated grading scores, and SLA health audits (Phase 84 / ADR-036).
 */

import type {
  BatchAuditRow,
  BatchBulkMutationResult,
  BatchDslQueryFilter,
  BatchGroupBy,
  BatchGroupedLane,
  BatchHealthAuditReport,
  BatchHealthStatus,
  BatchMetricsReport,
  BatchMutationUndoRecord,
  BatchResultRow,
  BatchRunRow,
  BatchRunState,
  BatchSortBy,
  BatchSortDirection,
  BatchTaskItem,
  BatchTaskResult,
  BatchTaskRow,
  BatchTaskStatus,
  BatchWorkspaceSnapshot,
  IBroccoliBatchSubstrate,
} from "../../../core/contracts/batch.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliBatchSubstrate implements IBroccoliBatchSubstrate {
  private readonly runs: Map<string, BatchRunState>;
  private readonly tasks: Map<string, BatchTaskItem>;
  private readonly results: Map<string, BatchTaskResult>;
  private readonly auditLogs: BatchAuditRow[] = [];
  private activeRunId?: string;

  private readonly undoStack: BatchMutationUndoRecord[] = [];
  private readonly redoStack: BatchMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private runsTable?: IDbTable<BatchRunRow>;
  private tasksTable?: IDbTable<BatchTaskRow>;
  private resultsTable?: IDbTable<BatchResultRow>;
  private auditsTable?: IDbTable<BatchAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    this.runs = new Map<string, BatchRunState>();
    this.tasks = new Map<string, BatchTaskItem>();
    this.results = new Map<string, BatchTaskResult>();

    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.runsTable = dbKernel.getTable<BatchRunRow>("batch_runs");
      this.tasksTable = dbKernel.getTable<BatchTaskRow>("batch_tasks");
      this.resultsTable = dbKernel.getTable<BatchResultRow>("batch_results");
      this.auditsTable = dbKernel.getTable<BatchAuditRow>("batch_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: BatchMutationUndoRecord["mutationType"], prev: BatchWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliBatchSubstrate.MAX_UNDO_STACK) {
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
    this.recordAudit(record.previousSnapshot.activeRunId ?? "system", "undo", "system", `Reverted ${record.mutationType}`);
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
    this.recordAudit(record.nextSnapshot.activeRunId ?? "system", "redo", "system", `Reapplied ${record.mutationType}`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Core Batch Operations
  // ---------------------------------------------------------------------------

  public recordRun(run: BatchRunState): void {
    const prev = this.exportSnapshot();
    this.runs.set(run.runId, run);
    this.activeRunId = run.runId;

    if (this.runsTable) {
      this.runsTable.put(run.runId, {
        id: run.runId,
        title: run.title,
        benchmarkType: run.benchmarkType,
        status: run.status,
        totalTasks: run.totalTasks,
        completedCount: run.completedCount,
        failedCount: run.failedCount,
        passRate: run.metrics.passRate,
        meanScore: run.metrics.meanScore,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      });
    }

    this.pushUndoRecord("create_run", prev);
    this.recordAudit(run.runId, "record_run", "supervisor", `Created benchmark run: ${run.title}`);
  }

  public getRun(runId: string): BatchRunState | undefined {
    return this.runs.get(runId);
  }

  public listRuns(limit = 50): readonly BatchRunState[] {
    return Array.from(this.runs.values()).slice(0, limit);
  }

  public recordTask(task: BatchTaskItem): void {
    const prev = this.exportSnapshot();
    this.tasks.set(task.id, task);

    if (this.tasksTable) {
      this.tasksTable.put(task.id, {
        id: task.id,
        runId: task.runId,
        prompt: task.prompt,
        priority: task.priority,
        benchmarkType: task.benchmarkType,
        status: "pending",
        retryCount: task.retryCount,
        maxRetries: task.maxRetries,
        createdAt: task.createdAt,
      });
    }

    this.pushUndoRecord("enqueue_task", prev);
    this.recordAudit(task.runId, "record_task", "supervisor", `Enqueued task: ${task.id}`, task.id);
  }

  public getTask(taskId: string): BatchTaskItem | undefined {
    return this.tasks.get(taskId);
  }

  public listTasks(runId?: string, limit = 100): readonly BatchTaskItem[] {
    const all = Array.from(this.tasks.values());
    const filtered = runId ? all.filter((t) => t.runId === runId) : all;
    return filtered.slice(0, limit);
  }

  public recordResult(result: BatchTaskResult): void {
    const prev = this.exportSnapshot();
    this.results.set(result.taskId, result);

    if (this.resultsTable) {
      this.resultsTable.put(result.taskId, {
        id: `res_${result.taskId}`,
        taskId: result.taskId,
        runId: result.runId,
        status: result.status,
        output: result.output.slice(0, 500),
        durationMs: result.durationMs,
        criteriaMet: result.criteriaMet,
        totalCriteria: result.totalCriteria,
        score: result.score,
        passed: result.passed,
        timestamp: result.timestamp,
      });
    }

    this.pushUndoRecord("execute_task", prev);
    this.recordAudit(result.runId, "record_result", "evaluator", `Result for ${result.taskId}: score=${result.score} passed=${result.passed}`, result.taskId);
  }

  public getResult(taskId: string): BatchTaskResult | undefined {
    return this.results.get(taskId);
  }

  public listResults(runId?: string, limit = 100): readonly BatchTaskResult[] {
    const all = Array.from(this.results.values());
    const filtered = runId ? all.filter((r) => r.runId === runId) : all;
    return filtered.slice(0, limit);
  }

  public updateTaskStatus(taskId: string, status: BatchTaskStatus): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const prev = this.exportSnapshot();
    const existingRes = this.results.get(taskId);
    if (existingRes) {
      this.results.set(taskId, { ...existingRes, status });
    }

    this.pushUndoRecord("cancel", prev);
    return true;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditBatchHealth(): BatchHealthAuditReport {
    const totalRuns = this.runs.size;
    const taskList = Array.from(this.tasks.values());
    const resultList = Array.from(this.results.values());

    const totalTasks = taskList.length;
    const completedTasks = resultList.filter((r) => r.passed).length;
    const failedTasks = resultList.filter((r) => !r.passed).length;

    const passRate = resultList.length > 0 ? Number((completedTasks / resultList.length).toFixed(2)) : 1.0;
    const totalDur = resultList.reduce((sum, r) => sum + r.durationMs, 0);
    const avgDuration = resultList.length > 0 ? Number((totalDur / resultList.length).toFixed(2)) : 0;

    let healthStatus: BatchHealthStatus = "optimal";
    if (failedTasks > completedTasks && totalTasks > 5) {
      healthStatus = "failure_warning";
    } else if (failedTasks > 0) {
      healthStatus = "degraded";
    } else if (totalTasks > 0) {
      healthStatus = "healthy";
    }

    const recommendations: string[] = [];
    if (passRate < 0.8 && resultList.length > 5) {
      recommendations.push(`Pass rate (${(passRate * 100).toFixed(0)}%) is below 80% SLA threshold. Investigate failed task criteria.`);
    }
    if (failedTasks > 0) {
      recommendations.push(`${failedTasks} task(s) failed. Consider running batch retry on failed items.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("Batch evaluation pipeline state and execution throughput are optimal.");
    }

    return {
      totalRuns,
      totalTasks,
      completedTasks,
      failedTasks,
      overallPassRate: passRate,
      avgTaskDurationMs: avgDuration,
      concurrencyUtilization: 0.75,
      healthStatus,
      recommendations,
    };
  }

  public getBatchMetrics(): BatchMetricsReport {
    const taskList = Array.from(this.tasks.values());
    const resultList = Array.from(this.results.values());

    const completed = resultList.filter((r) => r.passed).length;
    const failed = resultList.filter((r) => !r.passed).length;
    const totalTasks = taskList.length;

    const passRate = resultList.length > 0 ? Number((completed / resultList.length).toFixed(2)) : 1.0;
    const totalScore = resultList.reduce((sum, r) => sum + r.score, 0);
    const meanScore = resultList.length > 0 ? Number((totalScore / resultList.length).toFixed(2)) : 1.0;

    const totalDur = resultList.reduce((sum, r) => sum + r.durationMs, 0);
    const avgDuration = resultList.length > 0 ? Number((totalDur / resultList.length).toFixed(2)) : 0;

    const durations = resultList.map((r) => r.durationMs).sort((a, b) => a - b);
    const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;

    return {
      totalRuns: this.runs.size,
      totalTasks,
      completedTasks: completed,
      failedTasks: failed,
      pendingTasks: totalTasks - resultList.length,
      runningTasks: 0,
      overallPassRate: passRate,
      meanScore,
      avgTaskDurationMs: avgDuration,
      p50DurationMs: Number(p50.toFixed(2)),
      p95DurationMs: Number(p95.toFixed(2)),
      activeConcurrency: 4,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedTasks(
    groupBy: BatchGroupBy = "benchmarkType",
    sortBy: BatchSortBy = "timestamp",
    direction: BatchSortDirection = "desc"
  ): readonly BatchGroupedLane[] {
    const lanes = new Map<string, BatchTaskItem[]>();

    for (const task of this.tasks.values()) {
      let key = "general";
      switch (groupBy) {
        case "run":
          key = task.runId;
          break;
        case "benchmarkType":
          key = task.benchmarkType;
          break;
        case "priority":
          key = task.priority;
          break;
        case "status": {
          const res = this.results.get(task.id);
          key = res ? res.status : "pending";
          break;
        }
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(task);
    }

    const result: BatchGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = a.createdAt - b.createdAt;
        else if (sortBy === "priority") cmp = a.priority.localeCompare(b.priority);
        else if (sortBy === "score") {
          const sA = this.results.get(a.id)?.score ?? 0;
          const sB = this.results.get(b.id)?.score ?? 0;
          cmp = sA - sB;
        } else if (sortBy === "duration") {
          const dA = this.results.get(a.id)?.durationMs ?? 0;
          const dB = this.results.get(b.id)?.durationMs ?? 0;
          cmp = dA - dB;
        }
        return direction === "asc" ? cmp : -cmp;
      });

      const resList = items.map((i) => this.results.get(i.id)).filter((r): r is BatchTaskResult => r !== undefined);
      const passedCount = resList.filter((r) => r.passed).length;
      const passRate = resList.length > 0 ? Number((passedCount / resList.length).toFixed(2)) : 1.0;

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        passRate,
        tasks: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryTasksDsl(query: BatchDslQueryFilter | string): readonly BatchTaskItem[] {
    const parsed: BatchDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;

    return Array.from(this.tasks.values()).filter((task) => {
      if (parsed.runId && task.runId !== parsed.runId) return false;
      if (parsed.benchmarkType && task.benchmarkType !== parsed.benchmarkType) return false;
      if (parsed.priority && task.priority !== parsed.priority) return false;

      const res = this.results.get(task.id);
      if (parsed.status) {
        const currentStatus = res ? res.status : "pending";
        if (currentStatus !== parsed.status) return false;
      }

      if (parsed.minScore !== undefined && res && res.score < parsed.minScore) return false;
      if (parsed.maxScore !== undefined && res && res.score > parsed.maxScore) return false;

      if (parsed.tags && parsed.tags.length > 0) {
        const tTags = task.tags ?? [];
        if (!parsed.tags.every((t) => tTags.includes(t))) return false;
      }

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${task.prompt} ${task.id} ${task.benchmarkType}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): BatchDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    const tags: string[] = [];
    let runId: string | undefined;
    let status: BatchDslQueryFilter["status"];
    let benchmarkType: BatchDslQueryFilter["benchmarkType"];
    let priority: BatchDslQueryFilter["priority"];
    let minScore: number | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("run:")) {
        runId = tok.slice(4);
      } else if (tok.startsWith("status:")) {
        status = tok.slice(7) as BatchDslQueryFilter["status"];
      } else if (tok.startsWith("type:")) {
        benchmarkType = tok.slice(5) as BatchDslQueryFilter["benchmarkType"];
      } else if (tok.startsWith("priority:")) {
        priority = tok.slice(9) as BatchDslQueryFilter["priority"];
      } else if (tok.startsWith("score>")) {
        minScore = Number(tok.slice(6));
      } else if (tok.startsWith("tag:")) {
        tags.push(tok.slice(4));
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      runId,
      status,
      benchmarkType,
      priority,
      minScore,
      tags: tags.length > 0 ? tags : undefined,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkCancelTasks(taskIds: readonly string[]): BatchBulkMutationResult {
    const prev = this.exportSnapshot();
    const affected: string[] = [];

    for (const id of taskIds) {
      const ok = this.updateTaskStatus(id, "aborted");
      if (ok) affected.push(id);
    }

    this.pushUndoRecord("bulk", prev);
    return {
      matchedCount: taskIds.length,
      modifiedCount: affected.length,
      affectedTaskIds: affected,
    };
  }

  public bulkRetryTasks(taskIds: readonly string[]): BatchBulkMutationResult {
    const prev = this.exportSnapshot();
    const affected: string[] = [];

    for (const id of taskIds) {
      const task = this.tasks.get(id);
      if (task) {
        this.results.delete(id);
        affected.push(id);
      }
    }

    this.pushUndoRecord("bulk", prev);
    return {
      matchedCount: taskIds.length,
      modifiedCount: affected.length,
      affectedTaskIds: affected,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getBatchMetrics();
    const health = this.auditBatchHealth();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI SWE Benchmark & Batch Evaluation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .badge-pass { background: #16a34a; color: #bbf7d0; }
    .badge-fail { background: #dc2626; color: #fecaca; }
  </style>
</head>
<body>
  <h1>📊 LUMI SWE Benchmark Runner & Batch Evaluation</h1>
  <p style="color: #94a3b8;">Deterministic Multi-Task Pipeline, Automated Criteria Grading & Telemetry (Phase 84 / ADR-036)</p>
  
  <div class="grid">
    <div class="card"><div>Total Tasks</div><div class="metric-val">${metrics.totalTasks}</div></div>
    <div class="card"><div>Completed / Passed</div><div class="metric-val" style="color:#22c55e;">${metrics.completedTasks}</div></div>
    <div class="card"><div>Pass Rate</div><div class="metric-val" style="color:#38bdf8;">${(metrics.overallPassRate * 100).toFixed(0)}%</div></div>
    <div class="card"><div>Health Status</div><div class="metric-val" style="color:#22c55e;">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Task Results</h2>
  <table>
    <thead>
      <tr>
        <th>Task ID</th>
        <th>Benchmark Type</th>
        <th>Status</th>
        <th>Score</th>
        <th>Duration</th>
        <th>Prompt</th>
      </tr>
    </thead>
    <tbody>
      ${Array.from(this.tasks.values()).slice(0, 25).map((t) => {
        const r = this.results.get(t.id);
        const passed = r?.passed ?? false;
        return `
          <tr>
            <td><code>${t.id}</code></td>
            <td>${t.benchmarkType}</td>
            <td><span class="badge ${passed ? "badge-pass" : "badge-fail"}">${r ? r.status : "pending"}</span></td>
            <td>${r ? `${(r.score * 100).toFixed(0)}%` : "-"}</td>
            <td>${r ? `${r.durationMs} ms` : "-"}</td>
            <td>${t.prompt.slice(0, 50)}</td>
          </tr>
        `;
      }).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getBatchMetrics();
    const health = this.auditBatchHealth();

    let md = `# LUMI SWE Benchmark & Batch Evaluation Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Pass Rate:** \`${(metrics.overallPassRate * 100).toFixed(0)}%\` | **Total Tasks:** \`${metrics.totalTasks}\`\n\n`;
    md += `## Metrics Summary\n`;
    md += `- **Completed / Passed:** ${metrics.completedTasks}\n`;
    md += `- **Failed Tasks:** ${metrics.failedTasks}\n`;
    md += `- **Mean Score:** ${(metrics.meanScore * 100).toFixed(0)}%\n`;
    md += `- **Avg Duration:** ${metrics.avgTaskDurationMs} ms (p95: ${metrics.p95DurationMs} ms)\n\n`;

    md += `## Tasks Overview\n\n`;
    md += `| Task ID | Type | Status | Score | Duration | Prompt |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const t of Array.from(this.tasks.values()).slice(0, 20)) {
      const r = this.results.get(t.id);
      md += `| \`${t.id}\` | ${t.benchmarkType} | ${r ? r.status : "pending"} | ${r ? `${(r.score * 100).toFixed(0)}%` : "-"} | ${r ? `${r.durationMs} ms` : "-"} | ${t.prompt.slice(0, 40).replace(/\|/g, "\\|")} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "id,runId,benchmarkType,priority,status,score,durationMs,prompt\n";
    const rows = Array.from(this.tasks.values()).map((t) => {
      const r = this.results.get(t.id);
      return `"${t.id}","${t.runId}","${t.benchmarkType}","${t.priority}","${r ? r.status : "pending"}",${r ? r.score : 0},${r ? r.durationMs : 0},"${t.prompt.replace(/"/g, '""')}"`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Auditing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): BatchWorkspaceSnapshot {
    return {
      activeRunId: this.activeRunId,
      totalTasksRecorded: this.tasks.size,
      completedCount: Array.from(this.results.values()).filter((r) => r.passed).length,
      failedCount: Array.from(this.results.values()).filter((r) => !r.passed).length,
      runs: Array.from(this.runs.values()),
      tasks: Array.from(this.tasks.values()),
      results: Array.from(this.results.values()),
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: BatchWorkspaceSnapshot): void {
    this.runs.clear();
    this.tasks.clear();
    this.results.clear();

    for (const r of snapshot.runs) this.runs.set(r.runId, r);
    for (const t of snapshot.tasks) this.tasks.set(t.id, t);
    for (const res of snapshot.results) this.results.set(res.taskId, res);
    this.activeRunId = snapshot.activeRunId;
  }

  public recordAudit(runId: string, action: string, operator: string, details: string, taskId?: string): void {
    const row: BatchAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      runId,
      taskId,
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
    this.runs.clear();
    this.tasks.clear();
    this.results.clear();
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.activeRunId = undefined;
  }
}
