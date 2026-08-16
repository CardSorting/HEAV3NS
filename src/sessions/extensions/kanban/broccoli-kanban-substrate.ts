/**
 * broccoli-kanban-substrate.ts
 *
 * In-memory Broccolidb substrate for multi-board workflows, rich task entities,
 * task link DAGs, comments, audit trails, and multi-agent issue coordination (ADR-118).
 */

import type {
  KanbanBoard,
  KanbanColumn,
  KanbanColumnDefinition,
  KanbanPriority,
  KanbanQueryFilter,
  KanbanTask,
  KanbanTaskComment,
  KanbanTaskEvent,
  KanbanTaskLink,
  KanbanTaskMutation,
  KanbanWorkspaceSnapshot,
} from "../../../core/contracts/kanban.contracts.js";
import { DEFAULT_KANBAN_COLUMNS } from "../../../core/contracts/kanban.contracts.js";

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
  private links: Map<string, KanbanTaskLink>;
  private comments: Map<string, KanbanTaskComment[]>;
  private events: Map<string, KanbanTaskEvent[]>;
  private transitionHistory: KanbanTransitionRecord[];
  private static readonly MAX_HISTORY = 1000;

  constructor() {
    this.boards = new Map<string, KanbanBoard>();
    this.links = new Map<string, KanbanTaskLink>();
    this.comments = new Map<string, KanbanTaskComment[]>();
    this.events = new Map<string, KanbanTaskEvent[]>();
    this.transitionHistory = [];

    // Initialize default master board
    this.createBoard("default", "Master Agentic Workflow Board");
  }

  /**
   * Helper to derive numeric priority weight.
   */
  static getPriorityWeight(priority: KanbanPriority): number {
    switch (priority) {
      case "critical":
      case "urgent":
        return 4;
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
      case "none":
      default:
        return 0;
    }
  }

  /**
   * Creates a new board in the substrate.
   */
  createBoard(
    boardId: string,
    title: string,
    columns?: readonly (KanbanColumn | KanbanColumnDefinition)[],
    defaultColumn?: KanbanColumn
  ): KanbanBoard {
    const existing = this.boards.get(boardId);
    if (existing) return existing;

    const board: KanbanBoard = {
      boardId,
      title,
      tasks: [],
      columns: columns && columns.length > 0 ? columns : [...DEFAULT_KANBAN_COLUMNS],
      defaultColumn: defaultColumn || "backlog",
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

    this.recordEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskId: task.id,
      eventType: "created",
      actor: task.owner || task.assignee || "system",
      details: { title: task.title, column: task.column, priority: task.priority },
      timestampMs: Date.now(),
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
   * Searches for a task across all boards.
   */
  findTaskAcrossBoards(taskId: string): { boardId: string; task: KanbanTask } | undefined {
    for (const [boardId, board] of this.boards.entries()) {
      const task = board.tasks.find((t) => t.id === taskId);
      if (task) {
        return { boardId, task };
      }
    }
    return undefined;
  }

  /**
   * Updates an existing task on a board.
   */
  updateTask(
    boardId: string = "default",
    taskId: string,
    mutation: KanbanTaskMutation,
    frameIndex: number = 0
  ): KanbanTask | undefined {
    const board = this.boards.get(boardId);
    if (!board) return undefined;

    const taskIndex = board.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return undefined;

    const currentTask = board.tasks[taskIndex];
    const oldColumn = currentTask.column;
    const newColumn = mutation.column ?? currentTask.column;
    const oldPriority = currentTask.priority;
    const newPriority = mutation.priority ?? currentTask.priority;

    // Track column transition if moving
    if (oldColumn !== newColumn) {
      this.recordTransition({
        boardId,
        taskId,
        fromColumn: oldColumn,
        toColumn: newColumn,
        frameIndex,
        timestamp: Date.now(),
      });

      this.recordEvent({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        taskId,
        eventType: "column_transition",
        actor: mutation.assignee || currentTask.assignee || "system",
        details: { from: oldColumn, to: newColumn },
        timestampMs: Date.now(),
      });
    }

    if (oldPriority !== newPriority) {
      this.recordEvent({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        taskId,
        eventType: "priority_changed",
        actor: "system",
        details: { from: oldPriority, to: newPriority },
        timestampMs: Date.now(),
      });
    }

    const updatedTask: KanbanTask = {
      ...currentTask,
      title: mutation.title ?? currentTask.title,
      description: mutation.description ?? currentTask.description,
      column: newColumn,
      priority: newPriority,
      priorityWeight: BroccoliKanbanSubstrate.getPriorityWeight(newPriority),
      assignee: mutation.assignee !== undefined ? mutation.assignee : currentTask.assignee,
      owner: mutation.owner !== undefined ? mutation.owner : currentTask.owner,
      tags: mutation.tags ?? currentTask.tags,
      blockedBy: mutation.blockedBy ?? currentTask.blockedBy,
      blockKind: mutation.blockKind !== undefined ? mutation.blockKind : currentTask.blockKind,
      blockReason: mutation.blockReason !== undefined ? mutation.blockReason : currentTask.blockReason,
      blockRecurrences: mutation.blockRecurrences !== undefined ? mutation.blockRecurrences : currentTask.blockRecurrences,
      estimatePoints: mutation.estimatePoints !== undefined ? mutation.estimatePoints : currentTask.estimatePoints,
      dueDateMs: mutation.dueDateMs !== undefined ? mutation.dueDateMs : currentTask.dueDateMs,
      slaDeadlineMs: mutation.slaDeadlineMs !== undefined ? mutation.slaDeadlineMs : currentTask.slaDeadlineMs,
      goalMode: mutation.goalMode !== undefined ? mutation.goalMode : currentTask.goalMode,
      goalMaxTurns: mutation.goalMaxTurns !== undefined ? mutation.goalMaxTurns : currentTask.goalMaxTurns,
      workspaceKind: mutation.workspaceKind !== undefined ? mutation.workspaceKind : currentTask.workspaceKind,
      branchName: mutation.branchName !== undefined ? mutation.branchName : currentTask.branchName,
      prUrl: mutation.prUrl !== undefined ? mutation.prUrl : currentTask.prUrl,
      commitSha: mutation.commitSha !== undefined ? mutation.commitSha : currentTask.commitSha,
      reasoningEffort: mutation.reasoningEffort !== undefined ? mutation.reasoningEffort : currentTask.reasoningEffort,
      updatedFrame: frameIndex,
      updatedAtMs: Date.now(),
      metadata: mutation.metadata ?? currentTask.metadata,
    };

    const updatedTasks = [...board.tasks];
    updatedTasks[taskIndex] = updatedTask;

    this.boards.set(boardId, {
      ...board,
      tasks: updatedTasks,
      updatedAt: Date.now(),
    });

    return updatedTask;
  }

  /**
   * Deletes a task from a board.
   */
  deleteTask(boardId: string = "default", taskId: string): boolean {
    const board = this.boards.get(boardId);
    if (!board) return false;

    const initialLength = board.tasks.length;
    const filteredTasks = board.tasks.filter((t) => t.id !== taskId);
    if (filteredTasks.length === initialLength) return false;

    this.boards.set(boardId, {
      ...board,
      tasks: filteredTasks,
      updatedAt: Date.now(),
    });

    // Remove task links
    for (const [linkId, link] of this.links.entries()) {
      if (link.sourceTaskId === taskId || link.targetTaskId === taskId) {
        this.links.delete(linkId);
      }
    }

    return true;
  }

  /**
   * Adds a task link (dependency/relation).
   */
  addLink(link: KanbanTaskLink): boolean {
    this.links.set(link.id, link);
    this.recordEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskId: link.sourceTaskId,
      eventType: "link_added",
      actor: "system",
      details: { targetTaskId: link.targetTaskId, relationType: link.relationType },
      timestampMs: Date.now(),
    });
    return true;
  }

  /**
   * Removes a task link by ID.
   */
  removeLink(linkId: string): boolean {
    const link = this.links.get(linkId);
    if (!link) return false;
    this.links.delete(linkId);
    this.recordEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskId: link.sourceTaskId,
      eventType: "link_removed",
      actor: "system",
      details: { targetTaskId: link.targetTaskId, relationType: link.relationType },
      timestampMs: Date.now(),
    });
    return true;
  }

  /**
   * Retrieves all links associated with a task.
   */
  getTaskLinks(taskId: string): readonly KanbanTaskLink[] {
    return Array.from(this.links.values()).filter(
      (link) => link.sourceTaskId === taskId || link.targetTaskId === taskId
    );
  }

  /**
   * Adds a comment to a task.
   */
  addComment(comment: KanbanTaskComment): void {
    const existing = this.comments.get(comment.taskId) || [];
    this.comments.set(comment.taskId, [...existing, comment]);
    this.recordEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskId: comment.taskId,
      eventType: "comment_added",
      actor: comment.author,
      details: { commentId: comment.id, preview: comment.content.slice(0, 100) },
      timestampMs: Date.now(),
    });
  }

  /**
   * Retrieves all comments for a task.
   */
  getTaskComments(taskId: string): readonly KanbanTaskComment[] {
    return this.comments.get(taskId) || [];
  }

  /**
   * Records an audit event for a task.
   */
  recordEvent(event: KanbanTaskEvent): void {
    const existing = this.events.get(event.taskId) || [];
    this.events.set(event.taskId, [...existing, event]);
  }

  /**
   * Retrieves all audit events for a task.
   */
  getTaskEvents(taskId: string): readonly KanbanTaskEvent[] {
    return this.events.get(taskId) || [];
  }

  /**
   * Records a task column transition.
   */
  private recordTransition(record: KanbanTransitionRecord): void {
    this.transitionHistory.push(record);
    if (this.transitionHistory.length > BroccoliKanbanSubstrate.MAX_HISTORY) {
      this.transitionHistory.shift();
    }
  }

  /**
   * Queries tasks on a board by filter.
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
   * Gets transition history, optionally filtered by boardId.
   */
  getTransitions(boardId?: string): readonly KanbanTransitionRecord[] {
    if (!boardId) return [...this.transitionHistory];
    return this.transitionHistory.filter((t) => t.boardId === boardId);
  }

  /**
   * Gets the recent transition history.
   */
  getTransitionHistory(): readonly KanbanTransitionRecord[] {
    return [...this.transitionHistory];
  }

  /**
   * Creates an immutable snapshot of all boards, links, comments, and events.
   */
  createWorkspaceSnapshot(): KanbanWorkspaceSnapshot {
    const boardsCopy = Array.from(this.boards.values()).map((b) => ({
      ...b,
      tasks: b.tasks.map((t) => ({ ...t, tags: [...t.tags], blockedBy: [...t.blockedBy] })),
      columns: [...b.columns],
    }));

    const linksCopy = Array.from(this.links.values()).map((l) => ({ ...l }));
    const commentsCopy = Array.from(this.comments.values()).flat().map((c) => ({ ...c }));
    const eventsCopy = Array.from(this.events.values()).flat().map((e) => ({ ...e }));

    let totalTasks = 0;
    let totalActiveTasks = 0;

    for (const board of boardsCopy) {
      totalTasks += board.tasks.length;
      totalActiveTasks += board.tasks.filter((t) => t.column !== "done" && t.column !== "archived" && t.column !== "canceled").length;
    }

    return {
      boards: boardsCopy,
      links: linksCopy,
      comments: commentsCopy,
      events: eventsCopy,
      totalTasks,
      totalActiveTasks,
      timestamp: Date.now(),
    };
  }

  exportSnapshot(): KanbanWorkspaceSnapshot {
    return this.createWorkspaceSnapshot();
  }

  /**
   * Restores substrate state from a snapshot.
   */
  restoreWorkspaceSnapshot(snapshot: KanbanWorkspaceSnapshot): void {
    this.boards.clear();
    this.links.clear();
    this.comments.clear();
    this.events.clear();

    for (const board of snapshot.boards) {
      this.boards.set(board.boardId, {
        ...board,
        tasks: board.tasks.map((t) => ({ ...t, tags: [...t.tags], blockedBy: [...t.blockedBy] })),
        columns: [...board.columns],
      });
    }

    if (snapshot.links) {
      for (const link of snapshot.links) {
        this.links.set(link.id, { ...link });
      }
    }

    if (snapshot.comments) {
      for (const comment of snapshot.comments) {
        const existing = this.comments.get(comment.taskId) || [];
        this.comments.set(comment.taskId, [...existing, { ...comment }]);
      }
    }

    if (snapshot.events) {
      for (const event of snapshot.events) {
        const existing = this.events.get(event.taskId) || [];
        this.events.set(event.taskId, [...existing, { ...event }]);
      }
    }
  }

  importSnapshot(snapshot: KanbanWorkspaceSnapshot): void {
    this.restoreWorkspaceSnapshot(snapshot);
  }

  /**
   * Clears all state (primarily for test teardown).
   */
  clear(): void {
    this.boards.clear();
    this.links.clear();
    this.comments.clear();
    this.events.clear();
    this.transitionHistory = [];
    this.createBoard("default", "Master Agentic Workflow Board");
  }
}
