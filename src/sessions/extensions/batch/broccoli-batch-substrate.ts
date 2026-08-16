/**
 * broccoli-batch-substrate.ts
 *
 * In-memory Broccolidb substrate for batch datasets, run records, and task metrics (Phase 84 / ADR-036).
 */

import type {
  BatchRunMetrics,
  BatchTaskItem,
  BatchTaskResult,
  BatchWorkspaceSnapshot,
} from "../../../core/contracts/batch.contracts.js";

export class BroccoliBatchSubstrate {
  private datasets: Map<string, BatchTaskItem[]>;
  private runMetricsMap: Map<string, BatchRunMetrics>;
  private runResultsMap: Map<string, BatchTaskResult[]>;
  private activeRunId?: string;
  private totalTasksRecorded: number;
  private completedCount: number;
  private failedCount: number;

  constructor() {
    this.datasets = new Map<string, BatchTaskItem[]>();
    this.runMetricsMap = new Map<string, BatchRunMetrics>();
    this.runResultsMap = new Map<string, BatchTaskResult[]>();
    this.totalTasksRecorded = 0;
    this.completedCount = 0;
    this.failedCount = 0;
  }

  /**
   * Stores a named dataset of batch task items.
   */
  storeDataset(name: string, tasks: readonly BatchTaskItem[]): void {
    this.datasets.set(name, [...tasks]);
  }

  /**
   * Retrieves a dataset by name.
   */
  getDataset(name: string): readonly BatchTaskItem[] | undefined {
    return this.datasets.get(name);
  }

  /**
   * Records completed batch run metrics and task outcomes.
   */
  recordRun(metrics: BatchRunMetrics, results: readonly BatchTaskResult[]): void {
    this.activeRunId = metrics.runId;
    this.runMetricsMap.set(metrics.runId, metrics);
    this.runResultsMap.set(metrics.runId, [...results]);
    this.totalTasksRecorded += metrics.totalTasks;
    this.completedCount += metrics.completedTasks;
    this.failedCount += metrics.failedTasks;
  }

  /**
   * Retrieves metrics for a specific run ID.
   */
  getRunMetrics(runId: string): BatchRunMetrics | undefined {
    return this.runMetricsMap.get(runId);
  }

  /**
   * Retrieves detailed task results for a run ID.
   */
  getRunResults(runId: string): readonly BatchTaskResult[] | undefined {
    return this.runResultsMap.get(runId);
  }

  /**
   * Lists historical batch run metrics.
   */
  listRuns(limit: number = 20): readonly BatchRunMetrics[] {
    const all = Array.from(this.runMetricsMap.values());
    return all.slice(-limit);
  }

  /**
   * Exports full state snapshot.
   */
  exportSnapshot(): BatchWorkspaceSnapshot {
    return {
      activeRunId: this.activeRunId,
      totalTasksRecorded: this.totalTasksRecorded,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      timestamp: Date.now(),
    };
  }

  /**
   * Restores state from a snapshot.
   */
  importSnapshot(snapshot: BatchWorkspaceSnapshot): void {
    this.activeRunId = snapshot.activeRunId;
    this.totalTasksRecorded = snapshot.totalTasksRecorded;
    this.completedCount = snapshot.completedCount;
    this.failedCount = snapshot.failedCount;
  }

  /**
   * Clears all stored datasets and run history.
   */
  clear(): void {
    this.datasets.clear();
    this.runMetricsMap.clear();
    this.runResultsMap.clear();
    this.activeRunId = undefined;
    this.totalTasksRecorded = 0;
    this.completedCount = 0;
    this.failedCount = 0;
  }
}
