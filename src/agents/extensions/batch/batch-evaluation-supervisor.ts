/**
 * batch-evaluation-supervisor.ts
 *
 * Master Batch Evaluation Supervisor coordinating dataset ingestion, concurrent worker
 * execution, and benchmark score aggregation (Phase 84 / ADR-036).
 */

import type {
  BatchExecutionConfig,
  BatchRunMetrics,
  BatchTaskItem,
  BatchTaskResult,
  BatchWorkspaceSnapshot,
} from "../../../core/contracts/batch.contracts.js";
import {
  DeterministicBatchEvaluator,
  type TaskRunnerFn,
} from "../../../tooling/extensions/batch/deterministic-batch-evaluator.js";
import { BroccoliBatchSubstrate } from "../../../sessions/extensions/batch/broccoli-batch-substrate.js";

export class BatchEvaluationSupervisor {
  private evaluator: DeterministicBatchEvaluator;
  private substrate: BroccoliBatchSubstrate;

  constructor(evaluator: DeterministicBatchEvaluator, substrate: BroccoliBatchSubstrate) {
    this.evaluator = evaluator;
    this.substrate = substrate;
  }

  /**
   * Registers a dataset in the Broccolidb repository.
   */
  registerDataset(name: string, tasks: readonly BatchTaskItem[]): void {
    this.substrate.storeDataset(name, tasks);
  }

  /**
   * Runs an evaluation batch across a named dataset or explicit task list.
   */
  async runEvaluation(
    datasetNameOrTasks: string | readonly BatchTaskItem[],
    runner: TaskRunnerFn,
    configOverride?: Partial<BatchExecutionConfig>
  ): Promise<BatchRunMetrics> {
    let tasks: readonly BatchTaskItem[];
    let runName = "batch_run";

    if (typeof datasetNameOrTasks === "string") {
      runName = datasetNameOrTasks;
      const loaded = this.substrate.getDataset(datasetNameOrTasks);
      if (!loaded || loaded.length === 0) {
        throw new Error(`Dataset '${datasetNameOrTasks}' not found or empty in repository`);
      }
      tasks = loaded;
    } else {
      tasks = datasetNameOrTasks;
    }

    const runId = `${runName}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { metrics, results } = await this.evaluator.evaluateBatch(
      runId,
      tasks,
      runner,
      configOverride
    );

    this.substrate.recordRun(metrics, results);
    return metrics;
  }

  /**
   * Retrieves run metrics.
   */
  getRunMetrics(runId: string): BatchRunMetrics | undefined {
    return this.substrate.getRunMetrics(runId);
  }

  /**
   * Retrieves detailed task results.
   */
  getRunResults(runId: string): readonly BatchTaskResult[] | undefined {
    return this.substrate.getRunResults(runId);
  }

  /**
   * Returns workspace stats.
   */
  getStats(): BatchWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  /**
   * Lists historical run summaries.
   */
  listRuns(limit: number = 20): readonly BatchRunMetrics[] {
    return this.substrate.listRuns(limit);
  }
}
