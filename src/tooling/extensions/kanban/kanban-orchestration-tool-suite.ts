/**
 * kanban-orchestration-tool-suite.ts
 *
 * Model tool surface for the Kanban Subsystem (Phase 81 / ADR-033).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  KanbanColumn,
  KanbanPriority,
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
        name: "kanban_create_task",
        description: "Creates a new task work item on the Kanban board with optional priority, assignee, tags, and dependencies.",
        parameters: {
          title: { type: "string", required: true, description: "Concise title of the task" },
          boardId: { type: "string", description: "Target board ID (default: 'default')" },
          description: { type: "string", description: "Detailed description and acceptance criteria" },
          priority: { type: "string", description: "Task priority: 'low' | 'medium' | 'high' | 'critical'" },
          column: { type: "string", description: "Initial column: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'archived'" },
          assignee: { type: "string", description: "Assignee worker/subagent ID" },
          tags: { type: "string", description: "Comma-separated categorization tags" },
          blockedBy: { type: "string", description: "Comma-separated task IDs that must be completed before this task can start" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const title = String(args.title || "").trim();
          if (!title) return { success: false, error: "title is required" };

          const tags = typeof args.tags === "string" && args.tags.length > 0
            ? args.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : Array.isArray(args.tags) ? (args.tags as string[]) : undefined;

          const blockedBy = typeof args.blockedBy === "string" && args.blockedBy.length > 0
            ? args.blockedBy.split(",").map((b) => b.trim()).filter(Boolean)
            : Array.isArray(args.blockedBy) ? (args.blockedBy as string[]) : undefined;

          const res = this.supervisor.createTask({
            boardId: typeof args.boardId === "string" ? args.boardId : "default",
            title,
            description: typeof args.description === "string" ? args.description : undefined,
            priority: typeof args.priority === "string" ? (args.priority as KanbanPriority) : undefined,
            column: typeof args.column === "string" ? (args.column as KanbanColumn) : undefined,
            assignee: typeof args.assignee === "string" ? args.assignee : undefined,
            tags,
            blockedBy,
          });

          if (!res.success) {
            return { success: false, error: res.error };
          }

          return {
            success: true,
            task: res.task,
            message: `Task '${res.task?.id}' (${res.task?.title}) created in column '${res.task?.column}'`,
          };
        },
      },
      {
        name: "kanban_update_task",
        description: "Updates fields or moves a task to a new column on the Kanban board with state-machine and cycle validation.",
        parameters: {
          taskId: { type: "string", required: true, description: "Target task ID (e.g. 'task-1')" },
          boardId: { type: "string", description: "Board ID (default: 'default')" },
          title: { type: "string", description: "Updated task title" },
          description: { type: "string", description: "Updated task description" },
          column: { type: "string", description: "New column: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'archived'" },
          priority: { type: "string", description: "Updated priority: 'low' | 'medium' | 'high' | 'critical'" },
          assignee: { type: "string", description: "Updated assignee" },
          tags: { type: "string", description: "Updated comma-separated tags" },
          blockedBy: { type: "string", description: "Updated comma-separated blocker task IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const taskId = String(args.taskId || "").trim();
          if (!taskId) return { success: false, error: "taskId is required" };

          const tags = typeof args.tags === "string" && args.tags.length > 0
            ? args.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : Array.isArray(args.tags) ? (args.tags as string[]) : undefined;

          const blockedBy = typeof args.blockedBy === "string" && args.blockedBy.length > 0
            ? args.blockedBy.split(",").map((b) => b.trim()).filter(Boolean)
            : Array.isArray(args.blockedBy) ? (args.blockedBy as string[]) : undefined;

          const res = this.supervisor.updateTask(boardId, taskId, {
            title: typeof args.title === "string" ? args.title : undefined,
            description: typeof args.description === "string" ? args.description : undefined,
            column: typeof args.column === "string" ? (args.column as KanbanColumn) : undefined,
            priority: typeof args.priority === "string" ? (args.priority as KanbanPriority) : undefined,
            assignee: typeof args.assignee === "string" ? args.assignee : undefined,
            tags,
            blockedBy,
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
        name: "kanban_claim_task",
        description: "Atomically claims an unblocked task on the board for a worker and moves it to 'in_progress'.",
        parameters: {
          taskId: { type: "string", required: true, description: "Task ID to claim" },
          workerId: { type: "string", required: true, description: "Worker ID or agent name" },
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const taskId = String(args.taskId || "").trim();
          const workerId = String(args.workerId || "").trim();

          if (!taskId || !workerId) {
            return { success: false, error: "taskId and workerId are required" };
          }

          const res = this.supervisor.claimTask(boardId, taskId, workerId);
          if (!res.success) {
            return { success: false, error: res.error };
          }

          return {
            success: true,
            task: res.task,
            message: `Task '${taskId}' successfully claimed by '${workerId}' and moved to 'in_progress'`,
          };
        },
      },
      {
        name: "kanban_board_status",
        description: "Queries board metrics, column task distributions, and work-in-progress pipeline health.",
        parameters: {
          boardId: { type: "string", description: "Board ID (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const boardId = typeof args.boardId === "string" ? args.boardId : "default";
          const status = this.supervisor.getBoardStatus(boardId);
          if (!status) {
            return { success: false, error: `Board '${boardId}' not found` };
          }

          return {
            success: true,
            status,
          };
        },
      },
    ];
  }
}
