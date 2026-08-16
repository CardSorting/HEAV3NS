/**
 * kanban-board-supervisor.ts
 *
 * Master Kanban Board Supervisor coordinating task lifecycles, DAG dependency resolution,
 * worker task claiming, and WIP governor (Phase 81 / ADR-033).
 */

import type {
  KanbanColumn,
  KanbanPriority,
  KanbanQueryFilter,
  KanbanTask,
  KanbanTaskMutation,
} from "../../../core/contracts/kanban.contracts.js";
import { DeterministicKanbanEngine } from "../../../tooling/extensions/kanban/deterministic-kanban-engine.js";
import { BroccoliKanbanSubstrate } from "../../../sessions/extensions/kanban/broccoli-kanban-substrate.js";

export interface CreateTaskParams {
  boardId?: string;
  title: string;
  description?: string;
  priority?: KanbanPriority;
  column?: KanbanColumn;
  assignee?: string;
  tags?: readonly string[];
  blockedBy?: readonly string[];
  metadata?: Record<string, unknown>;
  frameIndex?: number;
}

export interface BoardStatusMetrics {
  boardId: string;
  title: string;
  totalTasks: number;
  columnCounts: Record<KanbanColumn, number>;
  readyTasksCount: number;
  blockedTasksCount: number;
  activeAssignees: readonly string[];
}

export class KanbanBoardSupervisor {
  private engine: DeterministicKanbanEngine;
  private substrate: BroccoliKanbanSubstrate;
  private taskCounter: number;

  constructor(engine: DeterministicKanbanEngine, substrate: BroccoliKanbanSubstrate) {
    this.engine = engine;
    this.substrate = substrate;
    this.taskCounter = 1;
  }

  /**
   * Creates a new work item task on the board with cycle validation.
   */
  createTask(params: CreateTaskParams): { success: boolean; task?: KanbanTask; error?: string } {
    const boardId = params.boardId ?? "default";
    const board = this.substrate.getBoard(boardId);
    if (!board) {
      return { success: false, error: `Board '${boardId}' not found` };
    }

    let taskId = `task-${this.taskCounter++}`;
    while (board.tasks.some((t) => t.id === taskId)) {
      taskId = `task-${this.taskCounter++}`;
    }
    const blockedBy = params.blockedBy ?? [];

    // Verify no dependency cycles
    if (blockedBy.length > 0) {
      if (this.engine.hasDependencyCycle(taskId, blockedBy, board.tasks)) {
        return { success: false, error: `Cannot create task: dependency cycle detected in blockedBy [${blockedBy.join(", ")}]` };
      }
    }

    const newTask: KanbanTask = {
      id: taskId,
      title: params.title,
      description: params.description ?? "",
      column: params.column ?? "backlog",
      priority: params.priority ?? "medium",
      assignee: params.assignee,
      tags: params.tags ?? [],
      blockedBy,
      createdFrame: params.frameIndex ?? 0,
      updatedFrame: params.frameIndex ?? 0,
      metadata: params.metadata,
    };

    const added = this.substrate.addTask(boardId, newTask);
    if (!added) {
      return { success: false, error: `Failed to add task '${taskId}' to board '${boardId}'` };
    }

    return { success: true, task: newTask };
  }

  /**
   * Updates an existing task on the board, enforcing transition and cycle rules.
   */
  updateTask(
    boardId: string = "default",
    taskId: string,
    mutation: KanbanTaskMutation,
    frameIndex: number = 0
  ): { success: boolean; task?: KanbanTask; error?: string } {
    const current = this.substrate.getTask(boardId, taskId);
    if (!current) {
      return { success: false, error: `Task '${taskId}' not found on board '${boardId}'` };
    }

    // Validate column transition if changing columns
    if (mutation.column && mutation.column !== current.column) {
      if (!this.engine.isValidTransition(current.column, mutation.column)) {
        return {
          success: false,
          error: `Invalid transition from '${current.column}' to '${mutation.column}'`,
        };
      }
    }

    // Validate dependency cycles if changing blockers
    if (mutation.blockedBy) {
      const board = this.substrate.getBoard(boardId)!;
      if (this.engine.hasDependencyCycle(taskId, mutation.blockedBy, board.tasks)) {
        return {
          success: false,
          error: `Cannot update task: dependency cycle detected with blockedBy [${mutation.blockedBy.join(", ")}]`,
        };
      }
    }

    const updated = this.substrate.updateTask(boardId, taskId, mutation, frameIndex);
    if (!updated) {
      return { success: false, error: `Failed to update task '${taskId}'` };
    }

    return { success: true, task: updated };
  }

  /**
   * Moves a task to a different column.
   */
  moveTaskColumn(
    boardId: string = "default",
    taskId: string,
    toColumn: KanbanColumn,
    frameIndex: number = 0
  ): { success: boolean; task?: KanbanTask; error?: string } {
    return this.updateTask(boardId, taskId, { column: toColumn }, frameIndex);
  }

  /**
   * Claims an unblocked task for an agent worker.
   */
  claimTask(
    boardId: string = "default",
    taskId: string,
    workerId: string,
    frameIndex: number = 0
  ): { success: boolean; task?: KanbanTask; error?: string } {
    const current = this.substrate.getTask(boardId, taskId);
    if (!current) {
      return { success: false, error: `Task '${taskId}' not found on board '${boardId}'` };
    }

    const board = this.substrate.getBoard(boardId)!;
    if (!this.engine.isTaskUnblocked(current, board.tasks)) {
      return {
        success: false,
        error: `Cannot claim task '${taskId}': task is blocked by unfinished dependencies [${current.blockedBy.join(", ")}]`,
      };
    }

    if (current.assignee && current.assignee !== workerId) {
      return {
        success: false,
        error: `Task '${taskId}' is already assigned to '${current.assignee}'`,
      };
    }

    // Automatically transition to in_progress if in backlog or todo
    let newColumn = current.column;
    if (current.column === "backlog" || current.column === "todo") {
      newColumn = "in_progress";
    }

    return this.updateTask(
      boardId,
      taskId,
      {
        assignee: workerId,
        column: newColumn,
      },
      frameIndex
    );
  }

  /**
   * Returns all unblocked tasks that are ready to be worked on.
   */
  getReadyTasks(boardId: string = "default"): readonly KanbanTask[] {
    const board = this.substrate.getBoard(boardId);
    if (!board) return [];

    const activeTasks = board.tasks.filter((t) => t.column === "backlog" || t.column === "todo");
    return activeTasks.filter((t) => this.engine.isTaskUnblocked(t, board.tasks));
  }

  /**
   * Queries tasks by criteria.
   */
  listTasks(boardId: string = "default", filter: KanbanQueryFilter = {}): readonly KanbanTask[] {
    const tasks = this.substrate.queryTasks(boardId, filter);
    if (filter.isBlocked !== undefined) {
      const board = this.substrate.getBoard(boardId);
      const all = board ? board.tasks : [];
      return tasks.filter((t) => {
        const unblocked = this.engine.isTaskUnblocked(t, all);
        return filter.isBlocked ? !unblocked : unblocked;
      });
    }
    return tasks;
  }

  /**
   * Returns aggregate board status metrics.
   */
  getBoardStatus(boardId: string = "default"): BoardStatusMetrics | undefined {
    const board = this.substrate.getBoard(boardId);
    if (!board) return undefined;

    const columnCounts: Record<KanbanColumn, number> = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
      archived: 0,
    };

    const assignees = new Set<string>();
    let readyCount = 0;
    let blockedCount = 0;

    for (let i = 0; i < board.tasks.length; i++) {
      const t = board.tasks[i];
      columnCounts[t.column] = (columnCounts[t.column] ?? 0) + 1;
      if (t.assignee) assignees.add(t.assignee);

      if (t.column !== "done" && t.column !== "archived") {
        if (this.engine.isTaskUnblocked(t, board.tasks)) {
          readyCount++;
        } else {
          blockedCount++;
        }
      }
    }

    return {
      boardId: board.boardId,
      title: board.title,
      totalTasks: board.tasks.length,
      columnCounts,
      readyTasksCount: readyCount,
      blockedTasksCount: blockedCount,
      activeAssignees: Array.from(assignees),
    };
  }

  /**
   * Deletes a task from the board.
   */
  deleteTask(boardId: string = "default", taskId: string): boolean {
    return this.substrate.deleteTask(boardId, taskId);
  }
}
