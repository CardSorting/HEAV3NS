/**
 * batch-evaluation-tool-suite.ts
 *
 * Model tool surface for the Batch Evaluation, SWE Benchmark Runner & Dataset Orchestration Subsystem:
 * 30 specialized model tools for run creation, task enqueueing, automated grading,
 * multi-criteria swimlanes, natural query DSL, and interactive exports (Phase 84 / ADR-036).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { BatchEvaluationSupervisor } from "../../../agents/extensions/batch/batch-evaluation-supervisor.js";
import { BroccoliBatchSubstrate } from "../../../sessions/extensions/batch/broccoli-batch-substrate.js";
import { DeterministicBatchEvaluator } from "./deterministic-batch-evaluator.js";
import { BatchSnapshotManager } from "../../../sessions/extensions/batch/batch-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
import type {
  BatchBenchmarkType,
  BatchGroupBy,
  BatchPriority,
  BatchSortBy,
  BatchSortDirection,
  BatchTaskStatus,
} from "../../../core/contracts/batch.contracts.js";

export class BatchEvaluationToolSuite {
  private readonly supervisor: BatchEvaluationSupervisor;
  private readonly substrate: BroccoliBatchSubstrate;
  private readonly evaluator: DeterministicBatchEvaluator;
  private readonly snapshotManager: BatchSnapshotManager;

  constructor(
    supervisor?: BatchEvaluationSupervisor,
    substrate?: BroccoliBatchSubstrate,
    evaluator?: DeterministicBatchEvaluator
  ) {
    this.evaluator = evaluator ?? new DeterministicBatchEvaluator();
    this.substrate = substrate ?? new BroccoliBatchSubstrate();
    this.supervisor = supervisor ?? new BatchEvaluationSupervisor(this.evaluator, this.substrate);
    this.snapshotManager = new BatchSnapshotManager(this.substrate);
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "create_batch_run",
        description: "Creates a new benchmark evaluation run with reproducible seed configuration.",
        parameters: {
          title: { type: "string", required: true, description: "Title of the benchmark run" },
          benchmarkType: { type: "string", description: "Type: swe_bench, human_eval, code_repair, unit_test, synthetic_eval" },
          concurrency: { type: "number", description: "Worker concurrency limit (default: 4)" },
          seed: { type: "number", description: "PRNG seed for deterministic evaluation" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("create_batch_run", args);
        },
      },
      {
        name: "enqueue_batch_task",
        description: "Enqueues a task item into a benchmark run with expected criteria for automated grading.",
        parameters: {
          runId: { type: "string", required: true, description: "Benchmark run ID" },
          prompt: { type: "string", required: true, description: "Prompt / problem statement" },
          expectedCriteriaJson: { type: "string", description: "JSON array of expected strings in output" },
          benchmarkType: { type: "string", description: "Benchmark type" },
          priority: { type: "string", description: "Priority: low, medium, high, critical" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("enqueue_batch_task", args);
        },
      },
      {
        name: "execute_batch_task",
        description: "Executes and grades a single batch task.",
        parameters: {
          taskId: { type: "string", required: true, description: "Task ID to execute" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("execute_batch_task", args);
        },
      },
      {
        name: "execute_batch_run",
        description: "Executes all pending tasks in a benchmark run.",
        parameters: {
          runId: { type: "string", required: true, description: "Benchmark run ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("execute_batch_run", args);
        },
      },
      {
        name: "get_batch_run",
        description: "Retrieves metadata and execution metrics for a specific benchmark run.",
        parameters: {
          runId: { type: "string", required: true, description: "Benchmark run ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("get_batch_run", args);
        },
      },
      {
        name: "list_batch_runs",
        description: "Lists registered benchmark evaluation runs.",
        parameters: {
          limit: { type: "number", description: "Maximum runs to return (default: 20)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("list_batch_runs", args);
        },
      },
      {
        name: "get_batch_task",
        description: "Retrieves details of a specific batch task item.",
        parameters: {
          taskId: { type: "string", required: true, description: "Task ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("get_batch_task", args);
        },
      },
      {
        name: "list_batch_tasks",
        description: "Lists batch tasks for a run with optional filtering.",
        parameters: {
          runId: { type: "string", description: "Optional run ID filter" },
          limit: { type: "number", description: "Maximum tasks to return (default: 50)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("list_batch_tasks", args);
        },
      },
      {
        name: "get_batch_result",
        description: "Retrieves the evaluation and grading result for a task.",
        parameters: {
          taskId: { type: "string", required: true, description: "Task ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("get_batch_result", args);
        },
      },
      {
        name: "list_batch_results",
        description: "Lists evaluation results for a benchmark run.",
        parameters: {
          runId: { type: "string", description: "Optional run ID filter" },
          limit: { type: "number", description: "Maximum results to return (default: 50)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("list_batch_results", args);
        },
      },
      {
        name: "cancel_batch_task",
        description: "Cancels or aborts a pending batch task.",
        parameters: {
          taskId: { type: "string", required: true, description: "Task ID to cancel" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cancel_batch_task", args);
        },
      },
      {
        name: "retry_batch_task",
        description: "Retries a failed batch task item.",
        parameters: {
          taskId: { type: "string", required: true, description: "Task ID to retry" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("retry_batch_task", args);
        },
      },
      {
        name: "batch_audit_health",
        description: "Audits SLA benchmark health, pass rate, failure rate, and concurrency utilization.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_audit_health", args);
        },
      },
      {
        name: "batch_get_metrics",
        description: "Fetches comprehensive telemetry on tasks, pass rates, latency percentiles, and mean scores.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_get_metrics", args);
        },
      },
      {
        name: "batch_group_and_sort",
        description: "Organizes tasks into multi-criteria swimlanes (run, benchmarkType, priority, status).",
        parameters: {
          groupBy: { type: "string", description: "Group by: run, benchmarkType, priority, status" },
          sortBy: { type: "string", description: "Sort by: timestamp, duration, score, priority" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_group_and_sort", args);
        },
      },
      {
        name: "batch_search_dsl",
        description: "Searches batch tasks using natural query DSL (e.g. 'status:completed score>0.8 type:swe_bench').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_search_dsl", args);
        },
      },
      {
        name: "batch_render_dashboard",
        description: "Renders an ANSI CLI dashboard summary card for batch evaluation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_render_dashboard", args);
        },
      },
      {
        name: "batch_render_task_card",
        description: "Renders an interactive ANSI CLI task card with criteria checklist.",
        parameters: {
          taskId: { type: "string", required: true, description: "Task ID to render" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_render_task_card", args);
        },
      },
      {
        name: "batch_export_html",
        description: "Exports benchmark evaluation status to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_export_html", args);
        },
      },
      {
        name: "batch_export_markdown",
        description: "Exports benchmark evaluation results to a formatted Markdown report.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_export_markdown", args);
        },
      },
      {
        name: "batch_export_csv",
        description: "Exports benchmark tasks and scores to a CSV format string.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_export_csv", args);
        },
      },
      {
        name: "batch_bulk_cancel",
        description: "Atomically cancels multiple pending batch tasks.",
        parameters: {
          taskIdsJson: { type: "string", required: true, description: "JSON array of task IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_bulk_cancel", args);
        },
      },
      {
        name: "batch_bulk_retry",
        description: "Atomically resets multiple failed batch tasks for retry.",
        parameters: {
          taskIdsJson: { type: "string", required: true, description: "JSON array of task IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_bulk_retry", args);
        },
      },
      {
        name: "batch_undo",
        description: "Reverts the last batch state mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_undo", args);
        },
      },
      {
        name: "batch_redo",
        description: "Re-applies the last undone batch state mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_redo", args);
        },
      },
      {
        name: "batch_capture_snapshot",
        description: "Captures a frame-perfect snapshot of batch evaluation state in memory.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Execution frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_capture_snapshot", args);
        },
      },
      {
        name: "batch_restore_snapshot",
        description: "Restores batch evaluation state to a previous frame snapshot in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Execution frame index to restore" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_restore_snapshot", args);
        },
      },
      {
        name: "batch_recompute_metrics",
        description: "Recomputes pass rate, mean score, and latency percentiles for a run.",
        parameters: {
          runId: { type: "string", required: true, description: "Benchmark run ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_recompute_metrics", args);
        },
      },
      {
        name: "batch_update_task_status",
        description: "Directly updates the execution status of a task item.",
        parameters: {
          taskId: { type: "string", required: true, description: "Task ID" },
          status: { type: "string", required: true, description: "Status: pending, running, completed, failed, aborted" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_update_task_status", args);
        },
      },
      {
        name: "batch_inspect_run_state",
        description: "Inspects full run state, task count breakdown, and completion status.",
        parameters: {
          runId: { type: "string", required: true, description: "Run ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("batch_inspect_run_state", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    _cwd?: string
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "create_batch_run": {
          const title = String(args.title || "").trim();
          if (!title) return { success: false, error: "title is required" };

          const benchmarkType = (args.benchmarkType as BatchBenchmarkType) || "swe_bench";
          const concurrency = typeof args.concurrency === "number" ? args.concurrency : 4;
          const seed = typeof args.seed === "number" ? args.seed : 42;

          const run = this.supervisor.createRun(title, benchmarkType, { concurrency, seed });
          return { success: true, runId: run.runId, title: run.title, benchmarkType: run.benchmarkType };
        }

        case "enqueue_batch_task": {
          const runId = String(args.runId || "").trim();
          const prompt = String(args.prompt || "").trim();
          if (!runId || !prompt) return { success: false, error: "runId and prompt are required" };

          let expectedCriteria: string[] = [];
          if (args.expectedCriteriaJson) {
            try {
              expectedCriteria = JSON.parse(String(args.expectedCriteriaJson));
            } catch {
              return { success: false, error: "expectedCriteriaJson must be valid JSON" };
            }
          }

          const priority = (args.priority as BatchPriority) || "medium";
          const benchmarkType = (args.benchmarkType as BatchBenchmarkType) || undefined;

          const task = this.supervisor.enqueueTask(runId, prompt, expectedCriteria, {
            priority,
            benchmarkType,
          });

          return { success: true, taskId: task.id, runId: task.runId, prompt: task.prompt };
        }

        case "execute_batch_task": {
          const taskId = String(args.taskId || "").trim();
          if (!taskId) return { success: false, error: "taskId is required" };

          const result = await this.supervisor.executeTask(taskId);
          return { success: true, result };
        }

        case "execute_batch_run": {
          const runId = String(args.runId || "").trim();
          if (!runId) return { success: false, error: "runId is required" };

          const metrics = await this.supervisor.executeRun(runId);
          return { success: true, runId, metrics };
        }

        case "get_batch_run": {
          const runId = String(args.runId || "").trim();
          const run = this.supervisor.getRun(runId);
          return { success: run !== undefined, run };
        }

        case "list_batch_runs": {
          const limit = typeof args.limit === "number" ? args.limit : 20;
          const runs = this.supervisor.listRuns(limit);
          return { success: true, count: runs.length, runs };
        }

        case "get_batch_task": {
          const taskId = String(args.taskId || "").trim();
          const task = this.supervisor.getTask(taskId);
          return { success: task !== undefined, task };
        }

        case "list_batch_tasks": {
          const runId = typeof args.runId === "string" ? args.runId : undefined;
          const limit = typeof args.limit === "number" ? args.limit : 50;
          const tasks = this.supervisor.listTasks(runId, limit);
          return { success: true, count: tasks.length, tasks };
        }

        case "get_batch_result": {
          const taskId = String(args.taskId || "").trim();
          const result = this.supervisor.getResult(taskId);
          return { success: result !== undefined, result };
        }

        case "list_batch_results": {
          const runId = typeof args.runId === "string" ? args.runId : undefined;
          const limit = typeof args.limit === "number" ? args.limit : 50;
          const results = this.supervisor.listResults(runId, limit);
          return { success: true, count: results.length, results };
        }

        case "cancel_batch_task": {
          const taskId = String(args.taskId || "").trim();
          const ok = this.supervisor.updateTaskStatus(taskId, "aborted");
          return { success: ok, taskId };
        }

        case "retry_batch_task": {
          const taskId = String(args.taskId || "").trim();
          const result = this.supervisor.bulkRetry([taskId]);
          return { success: result.modifiedCount > 0, taskId };
        }

        case "batch_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "batch_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "batch_group_and_sort": {
          const groupBy = (args.groupBy as BatchGroupBy) || "benchmarkType";
          const sortBy = (args.sortBy as BatchSortBy) || "timestamp";
          const direction = (args.direction as BatchSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedTasks(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "batch_search_dsl": {
          const query = String(args.query || "");
          const tasks = this.supervisor.queryDsl(query);
          return { success: true, count: tasks.length, tasks };
        }

        case "batch_render_dashboard": {
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderBatchDashboard(metrics);
          return { success: true, rendered };
        }

        case "batch_render_task_card": {
          const taskId = String(args.taskId || "");
          const task = this.supervisor.getTask(taskId);
          if (!task) return { success: false, error: `Task ${taskId} not found` };
          const result = this.supervisor.getResult(taskId);
          const rendered = BroccoliViewRenderer.renderBatchTaskCard(task, result);
          return { success: true, rendered };
        }

        case "batch_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "batch_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "batch_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "batch_bulk_cancel": {
          const idsJson = String(args.taskIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "taskIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkCancel(ids);
          return { success: true, result };
        }

        case "batch_bulk_retry": {
          const idsJson = String(args.taskIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "taskIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkRetry(ids);
          return { success: true, result };
        }

        case "batch_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "batch_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "batch_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "batch_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreSnapshot(frame);
          return { ...res };
        }

        case "batch_recompute_metrics": {
          const runId = String(args.runId || "");
          const metrics = this.evaluator.recomputeRunMetrics(runId);
          return { success: metrics !== undefined, metrics };
        }

        case "batch_update_task_status": {
          const taskId = String(args.taskId || "");
          const status = args.status as BatchTaskStatus;
          const ok = this.supervisor.updateTaskStatus(taskId, status);
          return { success: ok, taskId, status };
        }

        case "batch_inspect_run_state": {
          const runId = String(args.runId || "");
          const run = this.supervisor.getRun(runId);
          if (!run) return { success: false, error: `Run ${runId} not found` };
          return { success: true, run };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
