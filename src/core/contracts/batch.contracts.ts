/**
 * batch.contracts.ts
 *
 * Core data contracts for the Deterministic Batch Evaluation, SWE Benchmark Runner &
 * Dataset Orchestration Subsystem (Phase 84 / ADR-036).
 */

export type BatchTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "aborted"
  | "skipped"
  | "timed_out";

export type BatchPriority = "low" | "medium" | "high" | "critical";

export type BatchBenchmarkType =
  | "swe_bench"
  | "human_eval"
  | "code_repair"
  | "unit_test"
  | "synthetic_eval"
  | "custom";

export interface BatchTaskItem {
  readonly id: string;
  readonly runId: string;
  readonly prompt: string;
  readonly expectedCriteria?: readonly string[];
  readonly priority: BatchPriority;
  readonly benchmarkType: BatchBenchmarkType;
  readonly timeoutMs?: number;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly tags?: readonly string[];
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: number;
}

export interface BatchTaskResult {
  readonly taskId: string;
  readonly runId: string;
  readonly status: BatchTaskStatus;
  readonly output: string;
  readonly durationMs: number;
  readonly error?: string;
  readonly criteriaMet: number;
  readonly totalCriteria: number;
  readonly score: number; // 0.0 - 1.0
  readonly passed: boolean;
  readonly executionLogs?: readonly string[];
  readonly timestamp: number;
}

export interface BatchRunMetrics {
  readonly runId: string;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly meanTaskDurationMs: number;
  readonly passRate: number; // 0.0 - 1.0
  readonly meanScore: number; // 0.0 - 1.0
  readonly totalDurationMs: number;
  readonly p50DurationMs: number;
  readonly p95DurationMs: number;
}

export interface BatchExecutionConfig {
  readonly concurrency: number;
  readonly timeoutPerTaskMs: number;
  readonly seed: number;
  readonly stopOnFirstFailure?: boolean;
  readonly maxRetries?: number;
  readonly shuffleTasks?: boolean;
}

export interface BatchRunState {
  readonly runId: string;
  readonly title: string;
  readonly benchmarkType: BatchBenchmarkType;
  readonly totalTasks: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly runningCount: number;
  readonly pendingCount: number;
  readonly status: "pending" | "running" | "completed" | "failed" | "aborted";
  readonly config: BatchExecutionConfig;
  readonly metrics: BatchRunMetrics;
  readonly startedAt: number;
  readonly completedAt?: number;
}

export interface BatchWorkspaceSnapshot {
  readonly activeRunId?: string;
  readonly totalTasksRecorded: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly runs: readonly BatchRunState[];
  readonly tasks: readonly BatchTaskItem[];
  readonly results: readonly BatchTaskResult[];
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface BatchTaskRow {
  readonly id: string;
  readonly runId: string;
  readonly prompt: string;
  readonly priority: string;
  readonly benchmarkType: string;
  readonly status: string;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly createdAt: number;
  readonly [key: string]: unknown;
}

export interface BatchResultRow {
  readonly id: string;
  readonly taskId: string;
  readonly runId: string;
  readonly status: string;
  readonly output: string;
  readonly durationMs: number;
  readonly criteriaMet: number;
  readonly totalCriteria: number;
  readonly score: number;
  readonly passed: boolean;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface BatchRunRow {
  readonly id: string;
  readonly title: string;
  readonly benchmarkType: string;
  readonly status: string;
  readonly totalTasks: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly passRate: number;
  readonly meanScore: number;
  readonly startedAt: number;
  readonly completedAt?: number;
  readonly [key: string]: unknown;
}

export interface BatchAuditRow {
  readonly id: string;
  readonly runId: string;
  readonly taskId?: string;
  readonly action: string;
  readonly operator: string;
  readonly details: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Batch Diagnostics
// ---------------------------------------------------------------------------

export type BatchHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "failure_warning";

export interface BatchHealthAuditReport {
  readonly totalRuns: number;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly overallPassRate: number;
  readonly avgTaskDurationMs: number;
  readonly concurrencyUtilization: number; // 0.0 - 1.0
  readonly healthStatus: BatchHealthStatus;
  readonly recommendations: readonly string[];
}

export interface BatchMetricsReport {
  readonly totalRuns: number;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly pendingTasks: number;
  readonly runningTasks: number;
  readonly overallPassRate: number;
  readonly meanScore: number;
  readonly avgTaskDurationMs: number;
  readonly p50DurationMs: number;
  readonly p95DurationMs: number;
  readonly activeConcurrency: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type BatchGroupBy = "run" | "status" | "benchmarkType" | "priority";

export type BatchSortBy = "timestamp" | "duration" | "score" | "priority";

export type BatchSortDirection = "asc" | "desc";

export interface BatchGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly passRate: number;
  readonly tasks: readonly BatchTaskItem[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface BatchDslQueryFilter {
  readonly rawQuery: string;
  readonly runId?: string;
  readonly status?: BatchTaskStatus;
  readonly benchmarkType?: BatchBenchmarkType;
  readonly priority?: BatchPriority;
  readonly minScore?: number;
  readonly maxScore?: number;
  readonly minDurationMs?: number;
  readonly maxDurationMs?: number;
  readonly tags?: readonly string[];
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface BatchMutationUndoRecord {
  readonly mutationType: "create_run" | "enqueue_task" | "execute_task" | "cancel" | "retry" | "bulk";
  readonly previousSnapshot: BatchWorkspaceSnapshot;
  readonly nextSnapshot: BatchWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface BatchBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedTaskIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliBatchSubstrate {
  recordRun(run: BatchRunState): void;
  getRun(runId: string): BatchRunState | undefined;
  listRuns(limit?: number): readonly BatchRunState[];
  recordTask(task: BatchTaskItem): void;
  getTask(taskId: string): BatchTaskItem | undefined;
  listTasks(runId?: string, limit?: number): readonly BatchTaskItem[];
  recordResult(result: BatchTaskResult): void;
  getResult(taskId: string): BatchTaskResult | undefined;
  listResults(runId?: string, limit?: number): readonly BatchTaskResult[];
  updateTaskStatus(taskId: string, status: BatchTaskStatus): boolean;
  getBatchMetrics(): BatchMetricsReport;
  auditBatchHealth(): BatchHealthAuditReport;
  getGroupedTasks(groupBy?: BatchGroupBy, sortBy?: BatchSortBy, direction?: BatchSortDirection): readonly BatchGroupedLane[];
  queryTasksDsl(query: BatchDslQueryFilter | string): readonly BatchTaskItem[];
  bulkCancelTasks(taskIds: readonly string[]): BatchBulkMutationResult;
  bulkRetryTasks(taskIds: readonly string[]): BatchBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): BatchWorkspaceSnapshot;
  importSnapshot(snapshot: BatchWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
