/**
 * kanban-orchestration-tool-suite.ts
 *
 * Model tool surface for the World-Class Kanban Subsystem (ADR-118).
 * Provides ergonomic model tools for task tracking, typed blocking, dependency linking,
 * comments, natural query search, and board analytics.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  KanbanBlockKind,
  KanbanColumn,
  KanbanPriority,
  KanbanReasoningEffort,
  KanbanRelationType,
  KanbanWorkspaceKind,
} from "../../../core/contracts/kanban.contracts.js";
import { KanbanBoardSupervisor } from "../../../agents/extensions/kanban/kanban-board-supervisor.js";

export class KanbanOrchestrationToolSuite {
  private readonly supervisor: KanbanBoardSupervisor;

  constructor(supervisor: KanbanBoardSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "kanban_board_list",
        description: "Lists all available Kanban boards across the workspace.",
        parameters: {},
        execute: async (_args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boards = this.supervisor.listBoards();
          return {
            success: true,
            totalBoards: boards.length,
            boards: boards.map((b) => ({
              boardId: b.boardId,
              title: b.title,
              taskCount: b.tasks.length,
              columns: b.columns.map((c) => (typeof c === "string" ? c : c.id)),
            })),
          };
        },
      },
      {
        name: "kanban_board_create",
        description: "Creates a new project Kanban board with optional custom columns and default column.",
        parameters: {
          boardId: { type: "string", required: true, description: "Unique board slug/ID (e.g. 'auth-service', 'frontend')" },
          title: { type: "string", required: true, description: "Human-readable board title" },
          defaultColumn: { type: "string", description: "Default column for new tasks (default: 'backlog')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = String(args.boardId || "").trim();
          const title = String(args.title || "").trim();
          if (!boardId || !title) return { success: false, error: "boardId and title are required" };

          const board = this.supervisor.createBoard(
            boardId,
            title,
            undefined,
            args.defaultColumn as KanbanColumn | undefined
          );

          return {
            success: true,
            board: { boardId: board.boardId, title: board.title, columns: board.columns },
            message: `Created Kanban board '${board.boardId}' (${board.title})`,
          };
        },
      },
      {
        name: "kanban_create_task",
        description: "Creates a new task on the Kanban board with rich metadata (priority, estimate, tags, dependencies, goalMode).",
        parameters: {
          title: { type: "string", required: true, description: "Concise title of the task" },
          boardId: { type: "string", description: "Target board ID (default: 'default')" },
          description: { type: "string", description: "Detailed description and acceptance criteria" },
          priority: { type: "string", description: "Priority: 'none' | 'low' | 'medium' | 'high' | 'urgent' | 'critical'" },
          column: { type: "string", description: "Initial column: 'triage' | 'backlog' | 'todo' | 'ready' | 'in_progress'" },
          assignee: { type: "string", description: "Assignee worker / subagent ID" },
          owner: { type: "string", description: "Owner / author username or agent" },
          tags: { type: "string", description: "Comma-separated categorization tags" },
          blockedBy: { type: "string", description: "Comma-separated task IDs that block this task" },
          estimatePoints: { type: "number", description: "Story points or estimate (1, 2, 3, 5, 8)" },
          dueDateMs: { type: "number", description: "Due date timestamp in milliseconds" },
          slaDeadlineMs: { type: "number", description: "SLA deadline timestamp in milliseconds" },
          goalMode: { type: "boolean", description: "Enable Ralph-style multi-turn goal loop execution" },
          goalMaxTurns: { type: "number", description: "Maximum turns budget for goal_mode worker" },
          workspaceKind: { type: "string", description: "Workspace kind: 'scratch' | 'worktree' | 'dir'" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const title = String(args.title || "").trim();
          if (!title) return { success: false, error: "title is required" };

          const tags =
            typeof args.tags === "string" && args.tags.length > 0
              ? args.tags.split(",").map((t) => t.trim()).filter(Boolean)
              : Array.isArray(args.tags)
              ? (args.tags as string[])
              : undefined;

          const blockedBy =
            typeof args.blockedBy === "string" && args.blockedBy.length > 0
              ? args.blockedBy.split(",").map((b) => b.trim()).filter(Boolean)
              : Array.isArray(args.blockedBy)
              ? (args.blockedBy as string[])
              : undefined;

          const res = this.supervisor.createTask({
            boardId: typeof args.boardId === "string" ? args.boardId : "default",
            title,
            description: typeof args.description === "string" ? args.description : undefined,
            priority: typeof args.priority === "string" ? (args.priority as KanbanPriority) : undefined,
            column: typeof args.column === "string" ? (args.column as KanbanColumn) : undefined,
            assignee: typeof args.assignee === "string" ? args.assignee : undefined,
            owner: typeof args.owner === "string" ? args.owner : undefined,
            tags,
            blockedBy,
            estimatePoints: typeof args.estimatePoints === "number" ? args.estimatePoints : undefined,
            dueDateMs: typeof args.dueDateMs === "number" ? args.dueDateMs : undefined,
            slaDeadlineMs: typeof args.slaDeadlineMs === "number" ? args.slaDeadlineMs : undefined,
            goalMode: typeof args.goalMode === "boolean" ? args.goalMode : undefined,
            goalMaxTurns: typeof args.goalMaxTurns === "number" ? args.goalMaxTurns : undefined,
            workspaceKind: typeof args.workspaceKind === "string" ? (args.workspaceKind as KanbanWorkspaceKind) : undefined,
          });

          if (!res.success) {
            return { success: false, error: res.error };
          }

          return {
            success: true,
            task: res.task,
            message: `Task '${res.task?.id}' ("${res.task?.title}") created in column '${res.task?.column}'`,
          };
        },
      },
      {
        name: "kanban_update_task",
        description: "Updates task fields, column transition, priority, assignee, or estimation on the Kanban board.",
        parameters: {
          taskId: { type: "string", required: true, description: "Target task ID (e.g. 'task-1')" },
          boardId: { type: "string", description: "Board ID (default: 'default')" },
          title: { type: "string", description: "Updated task title" },
          description: { type: "string", description: "Updated task description" },
          column: { type: "string", description: "New column transition" },
          priority: { type: "string", description: "Updated priority: 'none' | 'low' | 'medium' | 'high' | 'urgent'" },
          assignee: { type: "string", description: "Updated assignee" },
          tags: { type: "string", description: "Updated comma-separated tags" },
          blockedBy: { type: "string", description: "Updated comma-separated blocker task IDs" },
          estimatePoints: { type: "number", description: "Updated story points" },
          goalMode: { type: "boolean", description: "Enable or disable goal_mode" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const taskId = String(args.taskId || "").trim();
          if (!taskId) return { success: false, error: "taskId is required" };

          const tags =
            typeof args.tags === "string" && args.tags.length > 0
              ? args.tags.split(",").map((t) => t.trim()).filter(Boolean)
              : Array.isArray(args.tags)
              ? (args.tags as string[])
              : undefined;

          const blockedBy =
            typeof args.blockedBy === "string" && args.blockedBy.length > 0
              ? args.blockedBy.split(",").map((b) => b.trim()).filter(Boolean)
              : Array.isArray(args.blockedBy)
              ? (args.blockedBy as string[])
              : undefined;

          const res = this.supervisor.updateTask(boardId, taskId, {
            title: typeof args.title === "string" ? args.title : undefined,
            description: typeof args.description === "string" ? args.description : undefined,
            column: typeof args.column === "string" ? (args.column as KanbanColumn) : undefined,
            priority: typeof args.priority === "string" ? (args.priority as KanbanPriority) : undefined,
            assignee: typeof args.assignee === "string" ? args.assignee : undefined,
            tags,
            blockedBy,
            estimatePoints: typeof args.estimatePoints === "number" ? args.estimatePoints : undefined,
            goalMode: typeof args.goalMode === "boolean" ? args.goalMode : undefined,
          });

          if (!res.success) {
            return { success: false, error: res.error };
          }

          return {
            success: true,
            task: res.task,
            message: `Task '${taskId}' updated successfully`,
          };
        },
      },
      {
        name: "kanban_get_task",
        description: "Retrieves complete details of a task including discussion comments, relation links, and audit history.",
        parameters: {
          taskId: { type: "string", required: true, description: "Target task ID (e.g. 'task-1')" },
          boardId: { type: "string", description: "Optional board ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const taskId = String(args.taskId || "").trim();
          const boardId = typeof args.boardId === "string" ? args.boardId : undefined;
          if (!taskId) return { success: false, error: "taskId is required" };

          const details = this.supervisor.getTaskDetails(taskId, boardId);
          if (!details) {
            return { success: false, error: `Task '${taskId}' not found` };
          }

          return {
            success: true,
            boardId: details.boardId,
            task: details.task,
            comments: details.comments,
            events: details.events,
            links: details.links,
          };
        },
      },
      {
        name: "kanban_block_task",
        description: "Blocks a task with a typed block kind ('dependency', 'needs_input', 'capability', 'transient') and reason.",
        parameters: {
          taskId: { type: "string", required: true, description: "Target task ID" },
          blockKind: { type: "string", required: true, description: "'dependency' | 'needs_input' | 'capability' | 'transient'" },
          reason: { type: "string", description: "Explanation of why the task is blocked" },
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const taskId = String(args.taskId || "").trim();
          const blockKind = String(args.blockKind || "needs_input") as KanbanBlockKind;
          const reason = typeof args.reason === "string" ? args.reason : "Blocked";
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";

          const res = this.supervisor.blockTask(boardId, taskId, blockKind, reason);
          if (!res.success) return { success: false, error: res.error };

          return {
            success: true,
            task: res.task,
            message: `Task '${taskId}' marked as blocked (${blockKind}): "${reason}"`,
          };
        },
      },
      {
        name: "kanban_unblock_task",
        description: "Unblocks a task and routes it to ready/todo.",
        parameters: {
          taskId: { type: "string", required: true, description: "Target task ID" },
          reason: { type: "string", description: "Resolution reason" },
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const taskId = String(args.taskId || "").trim();
          const reason = typeof args.reason === "string" ? args.reason : "Resolved";
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";

          const res = this.supervisor.unblockTask(boardId, taskId, reason);
          if (!res.success) return { success: false, error: res.error };

          return {
            success: true,
            task: res.task,
            message: `Task '${taskId}' unblocked and moved to '${res.task?.column}'`,
          };
        },
      },
      {
        name: "kanban_link_tasks",
        description: "Creates a typed dependency or relation link between two tasks ('blocks', 'blocked_by', 'relates_to', 'parent_of', 'subtask_of').",
        parameters: {
          sourceTaskId: { type: "string", required: true, description: "Source task ID" },
          targetTaskId: { type: "string", required: true, description: "Target task ID" },
          relationType: { type: "string", required: true, description: "'blocks' | 'blocked_by' | 'relates_to' | 'parent_of' | 'subtask_of'" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const sourceTaskId = String(args.sourceTaskId || "").trim();
          const targetTaskId = String(args.targetTaskId || "").trim();
          const relationType = String(args.relationType || "relates_to") as KanbanRelationType;

          const res = this.supervisor.linkTasks(sourceTaskId, targetTaskId, relationType);
          if (!res.success) return { success: false, error: res.error };

          return {
            success: true,
            link: res.link,
            message: `Linked '${sourceTaskId}' -> '${targetTaskId}' as '${relationType}'`,
          };
        },
      },
      {
        name: "kanban_add_comment",
        description: "Adds a discussion comment or progress update to a task.",
        parameters: {
          taskId: { type: "string", required: true, description: "Target task ID" },
          content: { type: "string", required: true, description: "Comment body or progress note" },
          author: { type: "string", description: "Author name or agent identity" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const taskId = String(args.taskId || "").trim();
          const content = String(args.content || "").trim();
          const author = typeof args.author === "string" ? args.author : "user";
          if (!taskId || !content) return { success: false, error: "taskId and content are required" };

          const res = this.supervisor.addComment(taskId, author, content);
          return {
            success: res.success,
            comment: res.comment,
            message: `Added comment to task '${taskId}'`,
          };
        },
      },
      {
        name: "kanban_search_tasks",
        description: "Searches and filters tasks using natural query syntax (e.g. 'is:open is:blocked priority:urgent tag:bug') or structured parameters.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
          query: { type: "string", description: "Natural filter query (e.g. 'is:open priority:high tag:auth')" },
          column: { type: "string", description: "Filter by column" },
          priority: { type: "string", description: "Filter by priority" },
          assignee: { type: "string", description: "Filter by assignee" },
          tag: { type: "string", description: "Filter by tag" },
          isBlocked: { type: "boolean", description: "Filter for blocked tasks" },
          isReady: { type: "boolean", description: "Filter for ready-to-work tasks" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const tasks = this.supervisor.listTasks(boardId, {
            query: typeof args.query === "string" ? args.query : undefined,
            column: typeof args.column === "string" ? (args.column as KanbanColumn) : undefined,
            priority: typeof args.priority === "string" ? (args.priority as KanbanPriority) : undefined,
            assignee: typeof args.assignee === "string" ? args.assignee : undefined,
            tag: typeof args.tag === "string" ? args.tag : undefined,
            isBlocked: typeof args.isBlocked === "boolean" ? args.isBlocked : undefined,
            isReady: typeof args.isReady === "boolean" ? args.isReady : undefined,
          });

          return {
            success: true,
            boardId,
            totalTasks: tasks.length,
            tasks,
          };
        },
      },
      {
        name: "kanban_claim_task",
        description: "Atomically claims an unblocked task on the board for a worker and moves it to 'in_progress'.",
        parameters: {
          taskId: { type: "string", required: true, description: "Target task ID" },
          boardId: { type: "string", description: "Board ID (default: 'default')" },
          workerId: { type: "string", description: "Assignee / worker ID" },
          assignee: { type: "string", description: "Assignee / worker ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const taskId = String(args.taskId || "").trim();
          const assignee = String(args.assignee || args.workerId || "").trim();
          if (!taskId || !assignee) return { success: false, error: "taskId and workerId/assignee are required" };

          const res = this.supervisor.claimTask(boardId, taskId, assignee);
          if (!res.success) return { success: false, error: res.error };

          return {
            success: true,
            task: res.task,
            message: `Task '${taskId}' claimed by '${assignee}' and moved to 'in_progress'`,
          };
        },
      },
      {
        name: "kanban_list_tasks",
        description: "Queries and lists tasks on the Kanban board filtered by column, priority, assignee, tag, or blocked status.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
          column: { type: "string", description: "Filter by column" },
          priority: { type: "string", description: "Filter by priority" },
          assignee: { type: "string", description: "Filter by assignee" },
          tag: { type: "string", description: "Filter by tag" },
          isBlocked: { type: "boolean", description: "Filter for blocked/unblocked tasks" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const tasks = this.supervisor.listTasks(boardId, {
            column: typeof args.column === "string" ? (args.column as KanbanColumn) : undefined,
            priority: typeof args.priority === "string" ? (args.priority as KanbanPriority) : undefined,
            assignee: typeof args.assignee === "string" ? args.assignee : undefined,
            tag: typeof args.tag === "string" ? args.tag : undefined,
            isBlocked: typeof args.isBlocked === "boolean" ? args.isBlocked : undefined,
          });

          return {
            success: true,
            boardId,
            totalTasks: tasks.length,
            tasks,
          };
        },
      },
      {
        name: "kanban_board_status",
        description: "Retrieves comprehensive board health metrics, column counts, ready tasks, and WIP utilization.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const metrics = this.supervisor.getBoardMetrics(boardId);
          if (!metrics) return { success: false, error: `Board '${boardId}' not found` };

          return {
            success: true,
            status: metrics,
            metrics,
          };
        },
      },
    ];
  }
}
