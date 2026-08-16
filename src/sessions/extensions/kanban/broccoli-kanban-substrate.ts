/**
 * broccoli-kanban-substrate.ts
 *
 * In-memory Broccolidb substrate for boards, tasks, historical task transitions,
 * and multi-agent assignee routing (Phase 81 / ADR-033).
 */

import type {
  KanbanBoard,
  KanbanColumn,
  KanbanQueryFilter,
  KanbanTask,
  KanbanTaskMutation,
  KanbanWorkspaceSnapshot,
} from "../../../core/contracts/kanban.contracts.js";

export interface KanbanTransitionRecord {
  readonly boardId: string;
  readonly taskId: string;
  readonly fromColumn: KanbanColumn;
  readonly toColumn: KanbanColumn;
  readonly frameIndex: number;
  readonly timestamp: number;
}

export class BroccoliKanbanSubstrate {
  private boards: Map<string, KanbanBoard>;
  private transitionHistory: KanbanTransitionRecord[];
  private static readonly MAX_HISTORY = 1000;

  constructor() {
    this.boards = new Map<string, KanbanBoard>();
    this.transitionHistory = [];
    // Initialize default board
    this.createBoard("default", "Master Agentic Workflow Board");
  }

  /**
   * Creates a new board in the substrate.
   */
  createBoard(boardId: string, title: string): KanbanBoard {
    const existing = this.boards.get(boardId);
    if (existing) return existing;

    const board: KanbanBoard = {
      boardId,
      title,
      tasks: [],
      columns: ["backlog", "todo", "in_progress", "review", "done", "archived"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.boards.set(boardId, board);
    return board;
  }

  /**
   * Retrieves a board by ID.
   */
  getBoard(boardId: string = "default"): KanbanBoard | undefined {
    return this.boards.get(boardId);
  }

  /**
   * Lists all boards.
   */
  listBoards(): readonly KanbanBoard[] {
    return Array.from(this.boards.values());
  }

  /**
   * Adds a task to a board.
   */
  addTask(boardId: string = "default", task: KanbanTask): boolean {
    const board = this.boards.get(boardId);
    if (!board) return false;

    // Check duplicate ID
    if (board.tasks.some((t) => t.id === task.id)) {
      return false;
    }

    const updatedTasks = [...board.tasks, task];
    this.boards.set(boardId, {
      ...board,
      tasks: updatedTasks,
      updatedAt: Date.now(),
    });
    return true;
  }

  /**
   * Retrieves a task by board ID and task ID.
   */
  getTask(boardId: string = "default", taskId: string): KanbanTask | undefined {
    const board = this.boards.get(boardId);
    if (!board) return undefined;
    return board.tasks.find((t) => t.id === taskId);
  }

  /**
   * Updates an existing task with mutations.
   */
  updateTask(
    boardId: string = "default",
    taskId: string,
    mutation: KanbanTaskMutation,
    frameIndex: number = 0
  ): KanbanTask | undefined {
    const board = this.boards.get(boardId);
    if (!board) return undefined;

    const idx = board.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return undefined;

    const current = board.tasks[idx];
    const updated: KanbanTask = {
      id: current.id,
      title: mutation.title ?? current.title,
      description: mutation.description ?? current.description,
      column: mutation.column ?? current.column,
      priority: mutation.priority ?? current.priority,
      assignee: mutation.assignee !== undefined ? mutation.assignee : current.assignee,
      tags: mutation.tags ?? current.tags,
      blockedBy: mutation.blockedBy ?? current.blockedBy,
      createdFrame: current.createdFrame,
      updatedFrame: frameIndex,
      metadata: mutation.metadata ? { ...current.metadata, ...mutation.metadata } : current.metadata,
    };

    if (mutation.column && mutation.column !== current.column) {
      this.recordTransition(boardId, taskId, current.column, mutation.column, frameIndex);
    }

    const newTasks = [...board.tasks];
    newTasks[idx] = updated;

    this.boards.set(boardId, {
      ...board,
      tasks: newTasks,
      updatedAt: Date.now(),
    });

    return updated;
  }

  /**
   * Deletes a task from a board.
   */
  deleteTask(boardId: string = "default", taskId: string): boolean {
    const board = this.boards.get(boardId);
    if (!board) return false;

    const filtered = board.tasks.filter((t) => t.id !== taskId);
    if (filtered.length === board.tasks.length) return false;

    this.boards.set(boardId, {
      ...board,
      tasks: filtered,
      updatedAt: Date.now(),
    });
    return true;
  }

  /**
   * Queries tasks on a board according to filter criteria.
   */
  queryTasks(boardId: string = "default", filter: KanbanQueryFilter = {}): readonly KanbanTask[] {
    const board = this.boards.get(boardId);
    if (!board) return [];

    return board.tasks.filter((task) => {
      if (filter.column && task.column !== filter.column) return false;
      if (filter.priority && task.priority !== filter.priority) return false;
      if (filter.assignee && task.assignee !== filter.assignee) return false;
      if (filter.tag && !task.tags.includes(filter.tag)) return false;
      return true;
    });
  }

  /**
   * Records a column transition in the audit log.
   */
  recordTransition(
    boardId: string,
    taskId: string,
    fromColumn: KanbanColumn,
    toColumn: KanbanColumn,
    frameIndex: number
  ): void {
    const record: KanbanTransitionRecord = {
      boardId,
      taskId,
      fromColumn,
      toColumn,
      frameIndex,
      timestamp: Date.now(),
    };

    this.transitionHistory.push(record);
    if (this.transitionHistory.length > BroccoliKanbanSubstrate.MAX_HISTORY) {
      this.transitionHistory.shift();
    }
  }

  /**
   * Retrieves the transition audit records.
   */
  getTransitions(boardId?: string, limit: number = 50): readonly KanbanTransitionRecord[] {
    let list = this.transitionHistory;
    if (boardId) {
      list = list.filter((r) => r.boardId === boardId);
    }
    return list.slice(-limit);
  }

  /**
   * Exports full state snapshot.
   */
  exportSnapshot(): KanbanWorkspaceSnapshot {
    const boards = Array.from(this.boards.values());
    let totalTasks = 0;
    let totalActiveTasks = 0;

    for (let i = 0; i < boards.length; i++) {
      const b = boards[i];
      totalTasks += b.tasks.length;
      totalActiveTasks += b.tasks.filter((t) => t.column !== "done" && t.column !== "archived").length;
    }

    return {
      boards: JSON.parse(JSON.stringify(boards)),
      totalTasks,
      totalActiveTasks,
      timestamp: Date.now(),
    };
  }

  /**
   * Restores state from a snapshot.
   */
  importSnapshot(snapshot: KanbanWorkspaceSnapshot): void {
    this.boards.clear();
    for (let i = 0; i < snapshot.boards.length; i++) {
      const b = snapshot.boards[i];
      this.boards.set(b.boardId, {
        ...b,
        tasks: [...b.tasks],
        columns: [...b.columns],
      });
    }
  }

  /**
   * Resets substrate to initial state.
   */
  clear(): void {
    this.boards.clear();
    this.transitionHistory = [];
    this.createBoard("default", "Master Agentic Workflow Board");
  }
}
