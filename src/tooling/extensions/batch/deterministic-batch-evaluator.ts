/**
 * deterministic-batch-evaluator.ts
 *
 * In-memory zero-GC concurrent batch evaluation engine with Mulberry32 PRNG (Phase 84 / ADR-036).
 */

import { performance } from "node:perf_hooks";
import type {
  BatchExecutionConfig,
  BatchRunMetrics,
  BatchTaskItem,
  BatchTaskResult,
} from "../../../core/contracts/batch.contracts.js";

export type TaskRunnerFn = (item: BatchTaskItem) => Promise<string>;

export class DeterministicBatchEvaluator {
  private defaultConfig: BatchExecutionConfig;

  constructor(defaultConfig?: Partial<BatchExecutionConfig>) {
    this.defaultConfig = {
      concurrency: defaultConfig?.concurrency ?? 4,
      timeoutPerTaskMs: defaultConfig?.timeoutPerTaskMs ?? 5000,
      seed: defaultConfig?.seed ?? 1337,
      stopOnFirstFailure: defaultConfig?.stopOnFirstFailure ?? false,
    };
  }

  /**
   * Evaluates a list of batch task items with bounded in-memory concurrency.
   */
  async evaluateBatch(
    runId: string,
    tasks: readonly BatchTaskItem[],
    runner: TaskRunnerFn,
    configOverride?: Partial<BatchExecutionConfig>
  ): Promise<{ metrics: BatchRunMetrics; results: readonly BatchTaskResult[] }> {
    const startedAt = performance.now();
    const config: BatchExecutionConfig = {
      ...this.defaultConfig,
      ...configOverride,
    };

    // Deterministically shuffle tasks using Mulberry32
    const shuffledTasks = this.shuffleWithSeed(tasks, config.seed);
    const results: BatchTaskResult[] = [];
    let completedCount = 0;
    let failedCount = 0;
    let totalScoreSum = 0;
    let totalTaskDurationSum = 0;

    const queue = [...shuffledTasks];
    const workerCount = Math.max(1, Math.min(config.concurrency, tasks.length || 1));

    const worker = async () => {
      while (queue.length > 0) {
        if (config.stopOnFirstFailure && failedCount > 0) {
          break;
        }

        const task = queue.shift();
        if (!task) break;

        const taskStart = performance.now();
        let status: BatchTaskResult["status"] = "completed";
        let output = "";
        let error: string | undefined;

        try {
          // Wrap runner in timeout promise race
          let timeoutId: NodeJS.Timeout | undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error(`Task timed out after ${config.timeoutPerTaskMs} ms`));
            }, config.timeoutPerTaskMs);
          });

          output = await Promise.race([runner(task), timeoutPromise]);
          if (timeoutId) clearTimeout(timeoutId);
        } catch (err: unknown) {
          status = "failed";
          error = err instanceof Error ? err.message : String(err);
        }

        const taskDuration = Number((performance.now() - taskStart).toFixed(3));
        totalTaskDurationSum += taskDuration;

        // Evaluate criteria
        const criteria = task.expectedCriteria ?? [];
        let criteriaMet = 0;
        if (status === "completed") {
          for (const crit of criteria) {
            if (this.matchesCriterion(output, crit)) {
              criteriaMet++;
            }
          }
        }

        const totalCriteria = criteria.length;
        const score = totalCriteria > 0 ? Number((criteriaMet / totalCriteria).toFixed(4)) : (status === "completed" ? 1.0 : 0.0);
        totalScoreSum += score;

        if (status === "completed" && (totalCriteria === 0 || criteriaMet === totalCriteria)) {
          completedCount++;
        } else {
          status = "failed";
          failedCount++;
        }

        results.push({
          taskId: task.id,
          status,
          output,
          durationMs: taskDuration,
          error,
          criteriaMet,
          totalCriteria,
          score,
          timestamp: Date.now(),
        });
      }
    };

    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    const totalDuration = Number((performance.now() - startedAt).toFixed(3));
    const totalTasks = tasks.length;
    const meanTaskDuration = totalTasks > 0 ? Number((totalTaskDurationSum / totalTasks).toFixed(3)) : 0;
    const passRate = totalTasks > 0 ? Number((completedCount / totalTasks).toFixed(4)) : 0;
    const meanScore = totalTasks > 0 ? Number((totalScoreSum / totalTasks).toFixed(4)) : 0;

    const metrics: BatchRunMetrics = {
      runId,
      totalTasks,
      completedTasks: completedCount,
      failedTasks: failedCount,
      meanTaskDurationMs: meanTaskDuration,
      passRate,
      meanScore,
      totalDurationMs: totalDuration,
    };

    return { metrics, results };
  }

  /**
   * Deterministic Mulberry32 PRNG Fisher-Yates array shuffle.
   */
  public shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
    const copy = [...items];
    let s = seed | 0;

    const random = () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }

    return copy;
  }

  private matchesCriterion(output: string, criterion: string): boolean {
    const trimmed = criterion.trim();
    if (trimmed.startsWith("/") && trimmed.endsWith("/")) {
      try {
        const regex = new RegExp(trimmed.slice(1, -1), "i");
        return regex.test(output);
      } catch {
        return output.includes(trimmed);
      }
    }
    return output.toLowerCase().includes(trimmed.toLowerCase());
  }
}
