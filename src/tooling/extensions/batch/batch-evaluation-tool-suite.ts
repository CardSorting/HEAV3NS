/**
 * batch-evaluation-tool-suite.ts
 *
 * Model tool surface for Batch Evaluation, SWE Benchmark Runner & Dataset Orchestration (Phase 84 / ADR-036).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { BatchTaskItem } from "../../../core/contracts/batch.contracts.js";
import { BatchEvaluationSupervisor } from "../../../agents/extensions/batch/batch-evaluation-supervisor.js";

export class BatchEvaluationToolSuite {
  private readonly supervisor: BatchEvaluationSupervisor;

  constructor(supervisor: BatchEvaluationSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "batch_run_evaluate",
        description: "Executes a concurrent batch evaluation run across a JSON dataset of tasks with automated criteria grading.",
        parameters: {
          tasksJson: { type: "string", required: true, description: "JSON array of tasks: [{id: string, prompt: string, expectedCriteria?: string[]}]" },
          concurrency: { type: "number", description: "Worker concurrency limit (default: 4)" },
          timeoutPerTaskMs: { type: "number", description: "Timeout per task in ms (default: 5000)" },
          seed: { type: "number", description: "Mulberry32 seed for deterministic task shuffle" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const rawTasks = String(args.tasksJson || "").trim();
          if (!rawTasks) return { success: false, error: "tasksJson parameter is required" };

          let tasks: BatchTaskItem[];
          try {
            tasks = JSON.parse(rawTasks) as BatchTaskItem[];
            if (!Array.isArray(tasks)) {
              return { success: false, error: "tasksJson must be a JSON array" };
            }
          } catch (err: unknown) {
            return { success: false, error: `Invalid JSON tasks: ${err instanceof Error ? err.message : String(err)}` };
          }

          const concurrency = typeof args.concurrency === "number" ? args.concurrency : undefined;
          const timeoutPerTaskMs = typeof args.timeoutPerTaskMs === "number" ? args.timeoutPerTaskMs : undefined;
          const seed = typeof args.seed === "number" ? args.seed : undefined;

          // Default mock/simulation runner for tool calls
          const mockRunner = async (task: BatchTaskItem) => {
            return `Evaluation response for ${task.prompt}`;
          };

          const metrics = await this.supervisor.runEvaluation(
            tasks,
            mockRunner,
            { concurrency, timeoutPerTaskMs, seed }
          );

          return {
            success: true,
            metrics,
          };
        },
      },
      {
        name: "batch_run_status",
        description: "Queries batch evaluation run metrics, recent run history, or detailed results for a specific run ID.",
        parameters: {
          runId: { type: "string", description: "Optional specific run ID to retrieve detailed results for" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const runId = typeof args.runId === "string" ? args.runId : undefined;
          if (runId) {
            const metrics = this.supervisor.getRunMetrics(runId);
            const results = this.supervisor.getRunResults(runId);
            if (!metrics) {
              return { success: false, error: `Run ID '${runId}' not found` };
            }
            return {
              success: true,
              metrics,
              results,
            };
          }

          const stats = this.supervisor.getStats();
          const history = this.supervisor.listRuns(10);
          return {
            success: true,
            stats,
            history,
          };
        },
      },
    ];
  }
}
