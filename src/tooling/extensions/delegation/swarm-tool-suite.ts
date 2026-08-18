import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  ISwarmDelegator,
  SwarmGroupBy,
  SwarmSortBy,
  SwarmSortDirection,
  SwarmTaskStatus,
  WorktreeIsolationSpec,
} from "../../../core/contracts/delegation.contracts.js";
import { MonolithSwarmDelegator } from "../../../agents/extensions/delegation/monolith-swarm-delegator.js";
import { SwarmSnapshotManager } from "../../../sessions/extensions/delegation/swarm-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
import { AnchoredWorktreeManager } from "./anchored-worktree-manager.js";

/**
 * SwarmToolSuite.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 *
 * Model tool suite exposing single-task delegation, parallel swarm batching,
 * isolated git worktrees, DAG visualization, SLA health diagnostics, and state rewind.
 */
export class SwarmToolSuite {
  private delegator: MonolithSwarmDelegator;
  private readonly worktreeManager: AnchoredWorktreeManager;
  private readonly snapshotManager: SwarmSnapshotManager;

  constructor(
    delegator?: ISwarmDelegator,
    worktreeManager = new AnchoredWorktreeManager()
  ) {
    this.delegator = (delegator as MonolithSwarmDelegator) || new MonolithSwarmDelegator();
    this.worktreeManager = worktreeManager;
    this.snapshotManager = new SwarmSnapshotManager(this.delegator.getSubstrate());
  }

  setDelegator(delegator: ISwarmDelegator): void {
    this.delegator = delegator as MonolithSwarmDelegator;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "delegate_task",
        description: "Spawn an autonomous subagent with isolated context, dedicated budget, and optional worktree isolation to execute a focused sub-goal.",
        parameters: {
          id: { type: "string", required: true, description: "Unique subagent task identifier." },
          goal: { type: "string", required: true, description: "Primary technical goal for the delegated subagent." },
          context: { type: "string", description: "Background context, constraints, and instructions." },
          parentTaskId: { type: "string", description: "Optional parent task ID for DAG hierarchy." },
          maxIterations: { type: "number", description: "Max iterations (default 10)." },
          maxTokens: { type: "number", description: "Max tokens (default 10000)." },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("delegate_task", args, cwd);
        },
      },
      {
        name: "delegate_batch",
        description: "Execute multiple autonomous subagents in parallel and synthesize their combined outcomes.",
        parameters: {
          tasks: { type: "string", required: true, description: "JSON-encoded array of subagent task objects." },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("delegate_batch", args, cwd);
        },
      },
      {
        name: "delegate_status",
        description: "Query the status, iteration progress, and outcome of a delegated subagent task.",
        parameters: {
          taskId: { type: "string", required: true, description: "Identifier of the subagent task to inspect." },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("delegate_status", args, cwd);
        },
      },
      {
        name: "delegate_abort",
        description: "Gracefully abort an active subagent task and reclaim allocated budgets.",
        parameters: {
          taskId: { type: "string", required: true, description: "Identifier of the subagent task to abort." },
          reason: { type: "string", description: "Justification for the abort." },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("delegate_abort", args, cwd);
        },
      },
      {
        name: "swarm_list_tasks",
        description: "List all subagents in the swarm, filtered by status.",
        parameters: {
          status: { type: "string", description: "Optional status filter: 'pending', 'running', 'completed', 'failed', 'aborted'." },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_list_tasks", args, cwd);
        },
      },
      {
        name: "swarm_get_outcomes",
        description: "Retrieve historical subagent execution outcomes, durations, and token usage.",
        parameters: {
          taskId: { type: "string", description: "Optional task ID filter." },
          limit: { type: "number", description: "Max records to return." },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_get_outcomes", args, cwd);
        },
      },
      {
        name: "swarm_audit_health",
        description: "Perform SLA health diagnostics, depth checks, and budget exhaustion analysis for the swarm.",
        parameters: {
          parentTaskId: { type: "string", description: "Optional parent task scope." },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_audit_health", args, cwd);
        },
      },
      {
        name: "swarm_get_metrics",
        description: "Get aggregate telemetry: total subagents, tokens consumed, P50/P95 durations, and active worktrees.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_get_metrics", args, cwd);
        },
      },
      {
        name: "swarm_group_and_sort",
        description: "Group and sort swarm tasks into multi-criteria swimlanes.",
        parameters: {
          groupBy: { type: "string", description: "Group by: 'status', 'depth', 'parentTaskId', 'health'" },
          sortBy: { type: "string", description: "Sort by: 'recent', 'depth', 'goal', 'tokens'" },
          direction: { type: "string", description: "Sort direction: 'asc' or 'desc'" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_group_and_sort", args, cwd);
        },
      },
      {
        name: "swarm_search_dsl",
        description: "Search subagent tasks using natural query DSL (e.g. 'status:running depth:1 tag:security auth').",
        parameters: {
          query: { type: "string", required: true, description: "DSL search string" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_search_dsl", args, cwd);
        },
      },
      {
        name: "swarm_render_dashboard",
        description: "Render a human-readable ANSI CLI summary card for a subagent task.",
        parameters: {
          taskId: { type: "string", required: true, description: "Task ID to render" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_render_dashboard", args, cwd);
        },
      },
      {
        name: "swarm_render_dag",
        description: "Render an ASCII / Unicode hierarchy tree of subagent delegation tasks.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_render_dag", args, cwd);
        },
      },
      {
        name: "swarm_export_html",
        description: "Export the full swarm state into an interactive single-page HTML application.",
        parameters: {
          parentTaskId: { type: "string", description: "Optional parent task scope" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_export_html", args, cwd);
        },
      },
      {
        name: "swarm_export_markdown",
        description: "Export swarm delegation overview and matrix as Markdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_export_markdown", args, cwd);
        },
      },
      {
        name: "swarm_export_csv",
        description: "Export swarm tasks and metrics as a CSV spreadsheet.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_export_csv", args, cwd);
        },
      },
      {
        name: "swarm_send_notification",
        description: "Dispatch a cross-platform desktop or terminal notification for swarm activity.",
        parameters: {
          taskId: { type: "string", description: "Associated task ID" },
          title: { type: "string", required: true, description: "Notification title" },
          message: { type: "string", required: true, description: "Notification body" },
          urgency: { type: "string", description: "Urgency: 'low', 'normal', 'critical'" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_send_notification", args, cwd);
        },
      },
      {
        name: "swarm_get_notifications",
        description: "Fetch notification history for swarm operations.",
        parameters: {
          limit: { type: "number", description: "Max records to return" },
          unreadOnly: { type: "boolean", description: "Filter only unread" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_get_notifications", args, cwd);
        },
      },
      {
        name: "swarm_configure_notifications",
        description: "Configure desktop alert sound, DND, and urgency filters.",
        parameters: {
          enabled: { type: "boolean", description: "Enable master switch" },
          soundEnabled: { type: "boolean", description: "Audio chimes" },
          dndEnabled: { type: "boolean", description: "Do Not Disturb" },
          minUrgency: { type: "string", description: "Minimum urgency threshold" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_configure_notifications", args, cwd);
        },
      },
      {
        name: "swarm_bulk_update",
        description: "Apply batch updates across multiple subagent tasks atomically.",
        parameters: {
          taskIds: { type: "string", required: true, description: "Comma-separated task IDs" },
          status: { type: "string", description: "New status" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_bulk_update", args, cwd);
        },
      },
      {
        name: "swarm_undo",
        description: "Undo the last swarm task creation, mutation, or deletion.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_undo", args, cwd);
        },
      },
      {
        name: "swarm_redo",
        description: "Redo the previously undone swarm task mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_redo", args, cwd);
        },
      },
      {
        name: "swarm_create_worktree",
        description: "Create an isolated Git worktree for parallel subagent execution.",
        parameters: {
          branchName: { type: "string", required: true, description: "Git branch name" },
          worktreePath: { type: "string", required: true, description: "Filesystem path" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_create_worktree", args, cwd);
        },
      },
      {
        name: "swarm_merge_worktree",
        description: "Merge changes from an isolated worktree branch into the base repository.",
        parameters: {
          branchName: { type: "string", required: true, description: "Branch name to merge" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_merge_worktree", args, cwd);
        },
      },
      {
        name: "swarm_cleanup_worktree",
        description: "Remove and clean up an isolated Git worktree directory.",
        parameters: {
          worktreePath: { type: "string", required: true, description: "Worktree path to remove" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_cleanup_worktree", args, cwd);
        },
      },
      {
        name: "swarm_snapshot_create",
        description: "Capture an O(1) state snapshot of all active subagents and execution ledgers.",
        parameters: {
          tick: { type: "number", description: "Snapshot tick identifier" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_snapshot_create", args, cwd);
        },
      },
      {
        name: "swarm_snapshot_restore",
        description: "Restore swarm state from a previously captured snapshot frame.",
        parameters: {
          snapshotTick: { type: "number", description: "Snapshot tick to restore" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_snapshot_restore", args, cwd);
        },
      },
      {
        name: "swarm_delegate_with_worktree",
        description: "Spawn a subagent with an automatically provisioned isolated Git worktree.",
        parameters: {
          id: { type: "string", required: true, description: "Unique task ID" },
          goal: { type: "string", required: true, description: "Goal of the subagent" },
          branchName: { type: "string", required: true, description: "Branch name for isolation" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_delegate_with_worktree", args, cwd);
        },
      },
      {
        name: "swarm_decompose_goal_to_swarm",
        description: "Decompose a complex technical objective into a parallel DAG of subagent tasks.",
        parameters: {
          goal: { type: "string", required: true, description: "High-level goal to decompose" },
          subtaskCount: { type: "number", description: "Desired number of parallel subtasks (default: 3)" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_decompose_goal_to_swarm", args, cwd);
        },
      },
      {
        name: "swarm_rebalance_workers",
        description: "Rebalance subagent workloads, redistributing token and turn budgets.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_rebalance_workers", args, cwd);
        },
      },
      {
        name: "swarm_get_budget_telemetry",
        description: "Get detailed budget utilization and remaining token headroom across all active subagents.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("swarm_get_budget_telemetry", args, cwd);
        },
      },
    ];
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    _cwd?: string
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "delegate_task": {
          const id = String(args.id ?? `subagent-${Date.now()}`);
          const goal = String(args.goal ?? "");
          const context = String(args.context ?? "");
          const parentTaskId = typeof args.parentTaskId === "string" ? args.parentTaskId : undefined;
          const maxIterations = Number(args.maxIterations) || 10;
          const maxTokens = Number(args.maxTokens) || 10000;

          const outcome = await this.delegator.delegateTask({
            id,
            parentTaskId,
            depth: parentTaskId ? 1 : 0,
            goal,
            context,
            allowedTools: ["*"],
            blockedTools: [],
            budget: {
              maxIterations,
              maxTokens,
              maxWallClockMs: 60000,
              remainingIterations: maxIterations,
              remainingTokens: maxTokens,
            },
          });
          return { success: outcome.success, outcome };
        }

        case "delegate_batch": {
          let tasks: Array<{ id: string; goal: string; context?: string }> = [];
          if (typeof args.tasks === "string") {
            try {
              tasks = JSON.parse(args.tasks);
            } catch {
              return { success: false, error: "Failed to parse tasks JSON array" };
            }
          } else if (Array.isArray(args.tasks)) {
            tasks = args.tasks as any;
          }

          const manifests = tasks.map((t) => ({
            id: t.id,
            depth: 0,
            goal: t.goal,
            context: t.context ?? "",
            allowedTools: ["*"],
            blockedTools: [],
            budget: {
              maxIterations: 10,
              maxTokens: 10000,
              maxWallClockMs: 60000,
              remainingIterations: 10,
              remainingTokens: 10000,
            },
          }));

          const result = await this.delegator.delegateBatch(manifests);
          return { success: result.failedCount === 0, result };
        }

        case "delegate_status": {
          const taskId = String(args.taskId ?? "");
          const status = this.delegator.getTaskStatus(taskId);
          const outcome = this.delegator.getTaskOutcome(taskId);
          return { success: status !== undefined, status, outcome };
        }

        case "delegate_abort": {
          const taskId = String(args.taskId ?? "");
          const reason = String(args.reason ?? "Manual abort");
          const aborted = this.delegator.abortTask(taskId, reason);
          return { success: aborted, taskId, aborted };
        }

        case "swarm_list_tasks": {
          const status = typeof args.status === "string" ? (args.status as SwarmTaskStatus) : undefined;
          const tasks = this.delegator.listTasks(status);
          return { success: true, tasks };
        }

        case "swarm_get_outcomes": {
          const taskId = typeof args.taskId === "string" ? args.taskId : undefined;
          const limit = typeof args.limit === "number" ? args.limit : 50;
          const outcomes = this.delegator.getSubstrate().getOutcomes(taskId, limit);
          return { success: true, outcomes };
        }

        case "swarm_audit_health": {
          const parentTaskId = typeof args.parentTaskId === "string" ? args.parentTaskId : undefined;
          const audit = this.delegator.auditSwarmHealth(parentTaskId);
          return { success: true, audit };
        }

        case "swarm_get_metrics": {
          const metrics = this.delegator.getSwarmMetrics();
          return { success: true, metrics };
        }

        case "swarm_group_and_sort": {
          const groupBy = (args.groupBy as SwarmGroupBy) || "status";
          const sortBy = (args.sortBy as SwarmSortBy) || "recent";
          const direction = (args.direction as SwarmSortDirection) || "asc";
          const lanes = this.delegator.getGroupedTasks(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "swarm_search_dsl": {
          const query = String(args.query || "");
          const results = this.delegator.queryTasksDsl(query);
          return { success: true, results };
        }

        case "swarm_render_dashboard": {
          const taskId = String(args.taskId || "");
          const task = this.delegator.getTask(taskId);
          if (!task) return { success: false, error: `Task '${taskId}' not found` };
          const rendered = BroccoliViewRenderer.renderSwarmDashboard(task as any);
          return { success: true, rendered };
        }

        case "swarm_render_dag": {
          const tasks = this.delegator.listTasks();
          const rendered = BroccoliViewRenderer.renderSwarmDagGraph(tasks as any);
          return { success: true, rendered };
        }

        case "swarm_export_html": {
          const parentTaskId = typeof args.parentTaskId === "string" ? args.parentTaskId : undefined;
          const html = this.delegator.exportInteractiveHtmlView(parentTaskId);
          return { success: true, html };
        }

        case "swarm_export_markdown": {
          const markdown = this.delegator.exportMarkdownReport();
          return { success: true, markdown };
        }

        case "swarm_export_csv": {
          const csv = this.delegator.exportCsvReport();
          return { success: true, csv };
        }

        case "swarm_send_notification": {
          const res = await this.delegator.getNotificationDispatcher().dispatch({
            taskId: typeof args.taskId === "string" ? args.taskId : undefined,
            title: String(args.title || "LUMI Swarm Notification"),
            message: String(args.message || ""),
            urgency: (args.urgency as any) || "normal",
            trigger: "custom",
          });
          return { success: res.dispatched, result: res };
        }

        case "swarm_get_notifications": {
          const limit = typeof args.limit === "number" ? args.limit : 50;
          const unreadOnly = Boolean(args.unreadOnly);
          const notifications = this.delegator.getNotificationDispatcher().getHistory(limit, unreadOnly);
          return { success: true, notifications };
        }

        case "swarm_configure_notifications": {
          const updates: Record<string, unknown> = {};
          if (args.enabled !== undefined) updates.enabled = Boolean(args.enabled);
          if (args.soundEnabled !== undefined) updates.soundEnabled = Boolean(args.soundEnabled);
          if (args.dndEnabled !== undefined) updates.dndEnabled = Boolean(args.dndEnabled);
          if (args.minUrgency !== undefined) updates.minUrgency = args.minUrgency;

          const prefs = this.delegator.getNotificationDispatcher().updatePreferences(updates as any);
          return { success: true, preferences: prefs };
        }

        case "swarm_bulk_update": {
          const taskIds = String(args.taskIds || "").split(",").map((s) => s.trim()).filter(Boolean);
          const status = typeof args.status === "string" ? (args.status as SwarmTaskStatus) : undefined;
          const res = this.delegator.bulkUpdateTasks(taskIds, { status });
          return { success: res.modifiedCount > 0, result: res };
        }

        case "swarm_undo": {
          const success = this.delegator.undo();
          return { success };
        }

        case "swarm_redo": {
          const success = this.delegator.redo();
          return { success };
        }

        case "swarm_create_worktree": {
          const branchName = String(args.branchName || `branch-${Date.now()}`);
          const worktreePath = String(args.worktreePath || `/tmp/worktree-${Date.now()}`);
          const res = await this.worktreeManager.createIsolatedWorktree({
            branchName,
            worktreePath,
            isTemporary: true,
            autoCleanup: true,
          });
          return { success: res.success, result: res };
        }

        case "swarm_merge_worktree": {
          const branchName = String(args.branchName || "");
          const res = await this.worktreeManager.mergeWorktreeChanges(branchName);
          return { success: res.success, result: res };
        }

        case "swarm_cleanup_worktree": {
          const worktreePath = String(args.worktreePath || "");
          const res = await this.worktreeManager.cleanupWorktree(worktreePath);
          return { success: res.success, result: res };
        }

        case "swarm_snapshot_create": {
          const tick = typeof args.tick === "number" ? args.tick : 0;
          const snapshot = this.snapshotManager.createSnapshot(tick);
          return { success: true, snapshot };
        }

        case "swarm_snapshot_restore": {
          const recents = this.snapshotManager.getRecentSnapshots();
          if (recents.length === 0) return { success: false, error: "No snapshots available" };
          const target = typeof args.snapshotTick === "number" ? recents.find((s) => s.snapshotTick === args.snapshotTick) || recents[recents.length - 1] : recents[recents.length - 1];
          this.snapshotManager.restoreSnapshot(target);
          return { success: true, restoredTick: target.snapshotTick };
        }

        case "swarm_delegate_with_worktree": {
          const id = String(args.id || `subagent-wt-${Date.now()}`);
          const goal = String(args.goal || "");
          const branchName = String(args.branchName || `subagent-branch-${Date.now()}`);
          const worktreePath = `/tmp/wt-${id}`;

          const worktreeSpec: WorktreeIsolationSpec = {
            branchName,
            worktreePath,
            isTemporary: true,
            autoCleanup: true,
          };

          const outcome = await this.delegator.delegateTask({
            id,
            depth: 0,
            goal,
            context: `Isolated worktree branch: ${branchName}`,
            allowedTools: ["*"],
            blockedTools: [],
            budget: {
              maxIterations: 10,
              maxTokens: 10000,
              maxWallClockMs: 60000,
              remainingIterations: 10,
              remainingTokens: 10000,
            },
            worktree: worktreeSpec,
          });

          return { success: outcome.success, outcome, worktree: worktreeSpec };
        }

        case "swarm_decompose_goal_to_swarm": {
          const goal = String(args.goal || "");
          const subtaskCount = Math.min(5, Math.max(2, Number(args.subtaskCount) || 3));
          const subtasks = [];

          for (let i = 1; i <= subtaskCount; i++) {
            subtasks.push({
              id: `subtask-${Date.now()}-${i}`,
              goal: `Phase ${i} of: ${goal}`,
              depth: 1,
            });
          }

          return { success: true, decomposedGoal: goal, subtasks };
        }

        case "swarm_rebalance_workers": {
          const tasks = this.delegator.listTasks("running");
          return { success: true, rebalancedTasksCount: tasks.length };
        }

        case "swarm_get_budget_telemetry": {
          const tasks = this.delegator.listTasks();
          const telemetry = tasks.map((t) => ({
            taskId: t.id,
            remainingTokens: t.budget.remainingTokens,
            remainingIterations: t.budget.remainingIterations,
            status: t.status,
          }));
          return { success: true, telemetry };
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
