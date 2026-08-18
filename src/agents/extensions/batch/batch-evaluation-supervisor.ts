/**
 * batch-evaluation-supervisor.ts
 *
 * Master Batch Evaluation Supervisor orchestrating SWE benchmark runs,
 * parallel task pipelines, automated grading loops, and SLA health audits (Phase 84 / ADR-036).
 */

import type {
  BatchBenchmarkType,
  BatchBulkMutationResult,
  BatchDslQueryFilter,
  BatchExecutionConfig,
  BatchGroupBy,
  BatchGroupedLane,
  BatchHealthAuditReport,
  BatchMetricsReport,
  BatchPriority,
  BatchRunMetrics,
  BatchRunState,
  BatchSortBy,
  BatchSortDirection,
  BatchTaskItem,
  BatchTaskResult,
  BatchTaskStatus,
  BatchWorkspaceSnapshot,
} from "../../../core/contracts/batch.contracts.js";
import { DeterministicBatchEvaluator } from "../../../tooling/extensions/batch/deterministic-batch-evaluator.js";
import { BroccoliBatchSubstrate } from "../../../sessions/extensions/batch/broccoli-batch-substrate.js";

export class BatchEvaluationSupervisor {
  private readonly evaluator: DeterministicBatchEvaluator;
  private readonly substrate: BroccoliBatchSubstrate;
  private currentFrame: number;

  constructor(evaluator: DeterministicBatchEvaluator, substrate: BroccoliBatchSubstrate) {
    this.evaluator = evaluator;
    this.substrate = substrate;
    this.currentFrame = 1;
  }

  public setFrameIndex(frame: number): void {
    this.currentFrame = frame;
  }

  /**
   * Creates a new benchmark evaluation run.
   */
  public createRun(
    title: string,
    benchmarkType: BatchBenchmarkType = "swe_bench",
    config: Partial<BatchExecutionConfig> = {}
  ): BatchRunState {
    const run = this.evaluator.createRun(title, benchmarkType, config);
    this.substrate.recordRun(run);
    return run;
  }

  /**
   * Enqueues a batch task for execution.
   */
  public enqueueTask(
    runId: string,
    prompt: string,
    expectedCriteria: readonly string[] = [],
    options: {
      priority?: BatchPriority;
      benchmarkType?: BatchBenchmarkType;
      timeoutMs?: number;
      maxRetries?: number;
      tags?: readonly string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): BatchTaskItem {
    const task = this.evaluator.enqueueTask(runId, prompt, expectedCriteria, options);
    this.substrate.recordTask(task);
    return task;
  }

  /**
   * Executes a single batch task and records the graded result.
   */
  public async executeTask(
    taskId: string,
    taskRunner?: (prompt: string) => Promise<string>
  ): Promise<BatchTaskResult> {
    const result = await this.evaluator.executeTask(taskId, taskRunner);
    this.substrate.recordResult(result);
    return result;
  }

  /**
   * Executes all pending tasks in a run with bounded concurrency.
   */
  public async executeRun(
    runId: string,
    taskRunner?: (prompt: string) => Promise<string>
  ): Promise<BatchRunMetrics | undefined> {
    const tasks = this.evaluator.listTasks(runId);
    for (const task of tasks) {
      if (!this.evaluator.getResult(task.id)) {
        await this.executeTask(task.id, taskRunner);
      }
    }
    const metrics = this.evaluator.recomputeRunMetrics(runId);
    const updatedRun = this.evaluator.getRun(runId);
    if (updatedRun) {
      this.substrate.recordRun(updatedRun);
    }
    return metrics;
  }

  // ---------------------------------------------------------------------------
  // Queries & Diagnostics
  // ---------------------------------------------------------------------------

  public getRun(runId: string): BatchRunState | undefined {
    return this.substrate.getRun(runId) ?? this.evaluator.getRun(runId);
  }

  public listRuns(limit: number = 20): readonly BatchRunState[] {
    return this.substrate.listRuns(limit);
  }

  public getTask(taskId: string): BatchTaskItem | undefined {
    return this.substrate.getTask(taskId) ?? this.evaluator.getTask(taskId);
  }

  public listTasks(runId?: string, limit: number = 50): readonly BatchTaskItem[] {
    return this.substrate.listTasks(runId, limit);
  }

  public getResult(taskId: string): BatchTaskResult | undefined {
    return this.substrate.getResult(taskId) ?? this.evaluator.getResult(taskId);
  }

  public listResults(runId?: string, limit: number = 50): readonly BatchTaskResult[] {
    return this.substrate.listResults(runId, limit);
  }

  public updateTaskStatus(taskId: string, status: BatchTaskStatus): boolean {
    return this.substrate.updateTaskStatus(taskId, status);
  }

  public auditHealth(): BatchHealthAuditReport {
    return this.substrate.auditBatchHealth();
  }

  public getMetrics(): BatchMetricsReport {
    return this.substrate.getBatchMetrics();
  }

  public getGroupedTasks(groupBy?: BatchGroupBy, sortBy?: BatchSortBy, direction?: BatchSortDirection): readonly BatchGroupedLane[] {
    return this.substrate.getGroupedTasks(groupBy, sortBy, direction);
  }

  public queryDsl(query: BatchDslQueryFilter | string): readonly BatchTaskItem[] {
    return this.substrate.queryTasksDsl(query);
  }

  public bulkCancel(taskIds: readonly string[]): BatchBulkMutationResult {
    return this.substrate.bulkCancelTasks(taskIds);
  }

  public bulkRetry(taskIds: readonly string[]): BatchBulkMutationResult {
    return this.substrate.bulkRetryTasks(taskIds);
  }

  public getStats(): BatchWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }

  public getEvaluator(): DeterministicBatchEvaluator {
    return this.evaluator;
  }

  public getSubstrate(): BroccoliBatchSubstrate {
    return this.substrate;
  }
}
