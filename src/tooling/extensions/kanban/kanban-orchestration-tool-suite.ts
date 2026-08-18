/**
 * kanban-orchestration-tool-suite.ts
 *
 * Model tool surface for the World-Class Kanban Subsystem (ADR-118).
 * Provides ergonomic model tools for task tracking, typed blocking, dependency linking,
 * comments, natural query search, desktop notifications, deadline audits, and HTML export.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  KanbanBlockKind,
  KanbanColumn,
  KanbanGroupBy,
  KanbanNotificationTrigger,
  KanbanNotificationUrgency,
  KanbanPriority,
  KanbanReasoningEffort,
  KanbanRelationType,
  KanbanSortBy,
  KanbanSortDirection,
  KanbanIssueTemplateKind,
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
      {
        name: "kanban_configure_notifications",
        description: "Configures Kanban desktop notification preferences, DND, sound, and trigger thresholds.",
        parameters: {
          enabled: { type: "boolean", description: "Master enable toggle" },
          desktopEnabled: { type: "boolean", description: "Native OS desktop notifications toggle" },
          soundEnabled: { type: "boolean", description: "Sound alerts toggle" },
          dndEnabled: { type: "boolean", description: "Do Not Disturb mode" },
          minUrgency: { type: "string", description: "'low' | 'normal' | 'high' | 'urgent'" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const dispatcher = this.supervisor.getSubstrate().getNotificationDispatcher();
          const updated = dispatcher.updatePreferences({
            enabled: typeof args.enabled === "boolean" ? args.enabled : undefined,
            desktopEnabled: typeof args.desktopEnabled === "boolean" ? args.desktopEnabled : undefined,
            soundEnabled: typeof args.soundEnabled === "boolean" ? args.soundEnabled : undefined,
            dndEnabled: typeof args.dndEnabled === "boolean" ? args.dndEnabled : undefined,
            minUrgency: typeof args.minUrgency === "string" ? (args.minUrgency as KanbanNotificationUrgency) : undefined,
          });

          return {
            success: true,
            preferences: updated,
            message: "Kanban notification preferences updated",
          };
        },
      },
      {
        name: "kanban_send_notification",
        description: "Dispatches a manual or test desktop notification through the Kanban notification subsystem.",
        parameters: {
          title: { type: "string", required: true, description: "Notification title" },
          message: { type: "string", required: true, description: "Notification body" },
          urgency: { type: "string", description: "'low' | 'normal' | 'high' | 'urgent'" },
          trigger: { type: "string", description: "Trigger reason" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const title = String(args.title || "").trim();
          const message = String(args.message || "").trim();
          if (!title || !message) return { success: false, error: "title and message are required" };

          const dispatcher = this.supervisor.getSubstrate().getNotificationDispatcher();
          const res = await dispatcher.dispatch({
            title,
            message,
            urgency: typeof args.urgency === "string" ? (args.urgency as KanbanNotificationUrgency) : "normal",
            trigger: typeof args.trigger === "string" ? (args.trigger as KanbanNotificationTrigger) : "custom",
          });

          return {
            success: res.dispatched,
            record: res.record,
            reason: res.reason,
          };
        },
      },
      {
        name: "kanban_get_notifications",
        description: "Retrieves recent Kanban notification history with unread count.",
        parameters: {
          unreadOnly: { type: "boolean", description: "Filter for unread notifications only" },
          limit: { type: "number", description: "Maximum records to return (default: 50)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const dispatcher = this.supervisor.getSubstrate().getNotificationDispatcher();
          const unreadOnly = Boolean(args.unreadOnly);
          const limit = typeof args.limit === "number" ? args.limit : 50;
          const records = dispatcher.getHistory({ unreadOnly, limit });

          return {
            success: true,
            totalRecords: records.length,
            records,
          };
        },
      },
      {
        name: "kanban_check_deadlines",
        description: "Scans active tasks for approaching due dates and breached SLAs, triggering warning notifications.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
          warningHours: { type: "number", description: "Warning window in hours (default: 24)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const hours = typeof args.warningHours === "number" ? args.warningHours : 24;
          const report = this.supervisor.checkUpcomingDeadlines(boardId, hours * 3600 * 1000);

          return {
            success: true,
            boardId,
            report,
            message: `Deadlines audited: ${report.overdueTasks.length} overdue, ${report.upcomingSoonTasks.length} due soon.`,
          };
        },
      },
      {
        name: "kanban_group_and_sort_tasks",
        description: "Retrieves structured Kanban swimlanes grouped by status, priority, assignee, category, or blocked state.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
          groupBy: { type: "string", description: "'column' | 'priority' | 'assignee' | 'category' | 'blocked'" },
          sortBy: { type: "string", description: "'priority' | 'dueDate' | 'estimate' | 'updated' | 'created' | 'title'" },
          sortDirection: { type: "string", description: "'asc' | 'desc'" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const groupBy = (typeof args.groupBy === "string" ? args.groupBy : "column") as KanbanGroupBy;
          const sortBy = (typeof args.sortBy === "string" ? args.sortBy : "priority") as KanbanSortBy;
          const sortDirection = (typeof args.sortDirection === "string" ? args.sortDirection : "desc") as KanbanSortDirection;

          const swimlanes = this.supervisor.getGroupedTasks(boardId, groupBy, sortBy, sortDirection);

          return {
            success: true,
            boardId,
            groupBy,
            sortBy,
            swimlanes,
          };
        },
      },
      {
        name: "kanban_undo",
        description: "Undoes the last task mutation on the Kanban board.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const res = this.supervisor.undo(boardId);
          return {
            success: res.success,
            restoredTask: res.restoredTask,
            message: res.success ? `Undid last mutation on task '${res.restoredTask?.id}'` : "No mutations to undo",
          };
        },
      },
      {
        name: "kanban_export_html",
        description: "Exports a standalone interactive responsive HTML web board view with drag-and-drop and desktop notification support.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const html = this.supervisor.exportHtml(boardId);
          return {
            success: true,
            boardId,
            htmlLength: html.length,
            html,
            message: "Generated interactive HTML Kanban board",
          };
        },
      },
      {
        name: "kanban_get_task_hierarchy",
        description: "Retrieves a task with its complete dependency DAG hierarchy, blockers, dependents, parent, and subtasks.",
        parameters: {
          taskId: { type: "string", required: true, description: "Target task ID (e.g. 'task-1')" },
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const taskId = String(args.taskId || "").trim();
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          if (!taskId) return { success: false, error: "taskId is required" };

          const hierarchy = this.supervisor.getTaskHierarchy(taskId, boardId);
          if (!hierarchy) return { success: false, error: `Task '${taskId}' not found` };

          return {
            success: true,
            hierarchy,
          };
        },
      },
      {
        name: "kanban_get_velocity_metrics",
        description: "Computes delivery velocity, completed story points, lead time, cycle time, WIP, and daily throughput for a board.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const metrics = this.supervisor.getVelocityMetrics(boardId);
          if (!metrics) return { success: false, error: `Board '${boardId}' not found` };

          return {
            success: true,
            metrics,
          };
        },
      },
      {
        name: "kanban_bulk_update_tasks",
        description: "Applies mutations (column, priority, assignee, tags) to multiple tasks atomically in a single batch.",
        parameters: {
          taskIds: { type: "string", required: true, description: "Comma-separated task IDs" },
          boardId: { type: "string", description: "Board ID (default: 'default')" },
          column: { type: "string", description: "Target column transition" },
          priority: { type: "string", description: "Target priority" },
          assignee: { type: "string", description: "Target assignee" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const rawIds = String(args.taskIds || "").trim();
          if (!rawIds) return { success: false, error: "taskIds is required" };

          const taskIds = rawIds.split(",").map((s) => s.trim()).filter(Boolean);
          const res = this.supervisor.bulkUpdateTasks(boardId, taskIds, {
            column: typeof args.column === "string" ? (args.column as KanbanColumn) : undefined,
            priority: typeof args.priority === "string" ? (args.priority as KanbanPriority) : undefined,
            assignee: typeof args.assignee === "string" ? args.assignee : undefined,
          });

          return {
            success: res.updatedCount > 0,
            result: res,
            message: `Bulk updated ${res.updatedCount}/${res.totalTargeted} tasks on board '${boardId}'`,
          };
        },
      },
      {
        name: "kanban_toggle_subtask_item",
        description: "Toggles or adds an actionable checklist subtask item on a task card.",
        parameters: {
          taskId: { type: "string", required: true, description: "Target task ID" },
          subtaskId: { type: "string", required: true, description: "Subtask item identifier or description" },
          done: { type: "boolean", description: "Completed status (optional, defaults to toggle)" },
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const taskId = String(args.taskId || "").trim();
          const subtaskId = String(args.subtaskId || "").trim();
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const done = typeof args.done === "boolean" ? args.done : undefined;
          if (!taskId || !subtaskId) return { success: false, error: "taskId and subtaskId are required" };

          const res = this.supervisor.toggleSubtaskChecklist(boardId, taskId, subtaskId, done);
          return {
            success: res.success,
            task: res.task,
            error: res.error,
          };
        },
      },
      {
        name: "kanban_move_task_board",
        description: "Moves a task from one Kanban board to another board.",
        parameters: {
          taskId: { type: "string", required: true, description: "Target task ID" },
          fromBoardId: { type: "string", required: true, description: "Source board ID" },
          toBoardId: { type: "string", required: true, description: "Destination board ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const taskId = String(args.taskId || "").trim();
          const fromBoardId = String(args.fromBoardId || "").trim();
          const toBoardId = String(args.toBoardId || "").trim();
          if (!taskId || !fromBoardId || !toBoardId) {
            return { success: false, error: "taskId, fromBoardId, and toBoardId are required" };
          }

          const res = this.supervisor.moveTaskToBoard(taskId, fromBoardId, toBoardId);
          return {
            success: res.success,
            error: res.error,
            message: res.success ? `Moved task '${taskId}' from '${fromBoardId}' to '${toBoardId}'` : res.error,
          };
        },
      },
      {
        name: "kanban_auto_assign",
        description: "Automatically balances and distributes unassigned ready tasks across available worker agent IDs.",
        parameters: {
          workerIds: { type: "string", required: true, description: "Comma-separated worker/agent IDs" },
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const rawWorkers = String(args.workerIds || "").trim();
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          if (!rawWorkers) return { success: false, error: "workerIds is required" };

          const workers = rawWorkers.split(",").map((s) => s.trim()).filter(Boolean);
          const res = this.supervisor.autoAssignWorkload(boardId, workers);

          return {
            success: true,
            result: res,
            message: `Auto-assigned ${res.assignedCount} tasks across ${workers.length} workers on board '${boardId}'`,
          };
        },
      },
      {
        name: "kanban_export_markdown",
        description: "Exports the Kanban board and its swimlanes as a clean GitHub-flavored Markdown table document.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const markdown = this.supervisor.exportMarkdown(boardId);
          return {
            success: true,
            boardId,
            markdown,
          };
        },
      },
      {
        name: "kanban_export_csv",
        description: "Exports all tasks on a Kanban board into CSV table format.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const csv = this.supervisor.exportCsv(boardId);
          return {
            success: true,
            boardId,
            csv,
          };
        },
      },
      {
        name: "kanban_create_from_template",
        description: "Creates a pre-structured task from an issue template (bug_report, feature_spec, security_fix, refactor).",
        parameters: {
          templateKind: { type: "string", required: true, description: "Template kind: bug_report | feature_spec | security_fix | refactor" },
          title: { type: "string", required: true, description: "Task title" },
          boardId: { type: "string", description: "Board ID (default: 'default')" },
          priority: { type: "string", description: "Optional priority override" },
          assignee: { type: "string", description: "Optional assignee" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const templateKind = String(args.templateKind || "").trim() as KanbanIssueTemplateKind;
          const title = String(args.title || "").trim();
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          if (!templateKind || !title) return { success: false, error: "templateKind and title are required" };

          const res = this.supervisor.createTaskFromTemplate(boardId, templateKind, title, {
            priority: typeof args.priority === "string" ? (args.priority as KanbanPriority) : undefined,
            assignee: typeof args.assignee === "string" ? args.assignee : undefined,
          });

          return {
            success: res.success,
            task: res.task,
            error: res.error,
          };
        },
      },
      {
        name: "kanban_archive_completed",
        description: "Archives all done tasks on a board to maintain a clean active stream workspace.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
          cutoffMs: { type: "number", description: "Optional max timestamp cutoff for archived tasks" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const cutoffMs = typeof args.cutoffMs === "number" ? args.cutoffMs : undefined;
          const res = this.supervisor.archiveCompletedTasks(boardId, cutoffMs);
          return {
            success: true,
            result: res,
            message: `Archived ${res.archivedCount} tasks on board '${boardId}'`,
          };
        },
      },
      {
        name: "kanban_clone_board",
        description: "Clones a board's column configuration, WIP limits, and optionally tasks for a new sprint/milestone.",
        parameters: {
          sourceBoardId: { type: "string", required: true, description: "Source board ID to clone" },
          targetBoardId: { type: "string", required: true, description: "New destination board ID" },
          newTitle: { type: "string", description: "Title for the cloned board" },
          includeTasks: { type: "boolean", description: "Whether to clone tasks into the new board" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const sourceBoardId = String(args.sourceBoardId || "").trim();
          const targetBoardId = String(args.targetBoardId || "").trim();
          if (!sourceBoardId || !targetBoardId) {
            return { success: false, error: "sourceBoardId and targetBoardId are required" };
          }

          const res = this.supervisor.cloneBoard(sourceBoardId, targetBoardId, {
            newTitle: typeof args.newTitle === "string" ? args.newTitle : undefined,
            includeTasks: typeof args.includeTasks === "boolean" ? args.includeTasks : false,
          });

          return {
            success: res.success,
            error: res.error,
            message: res.success ? `Cloned board '${sourceBoardId}' to '${targetBoardId}'` : res.error,
          };
        },
      },
      {
        name: "kanban_render_dag_graph",
        description: "Renders an ASCII / Unicode DAG dependency tree and blocker graph for terminal visualization.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const graph = this.supervisor.renderDagGraph(boardId);
          return {
            success: true,
            boardId,
            graph,
          };
        },
      },
    ];
  }
}
