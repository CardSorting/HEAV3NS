/**
 * batch.contracts.ts
 *
 * Core data contracts for the Deterministic Batch Evaluation, SWE Benchmark Runner &
 * Dataset Orchestration Subsystem (Phase 84 / ADR-036).
 */

export type BatchTaskStatus = "pending" | "running" | "completed" | "failed" | "aborted";

export interface BatchTaskItem {
  readonly id: string;
  readonly prompt: string;
  readonly expectedCriteria?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export interface BatchTaskResult {
  readonly taskId: string;
  readonly status: BatchTaskStatus;
  readonly output: string;
  readonly durationMs: number;
  readonly error?: string;
  readonly criteriaMet: number;
  readonly totalCriteria: number;
  readonly score: number;
  readonly timestamp: number;
}

export interface BatchRunMetrics {
  readonly runId: string;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly meanTaskDurationMs: number;
  readonly passRate: number;
  readonly meanScore: number;
  readonly totalDurationMs: number;
}

export interface BatchExecutionConfig {
  readonly concurrency: number;
  readonly timeoutPerTaskMs: number;
  readonly seed: number;
  readonly stopOnFirstFailure?: boolean;
}

export interface BatchWorkspaceSnapshot {
  readonly activeRunId?: string;
  readonly totalTasksRecorded: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly timestamp: number;
}
