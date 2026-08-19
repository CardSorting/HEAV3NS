/**
 * kanban-board-supervisor.ts
 *
 * Master Kanban Board Supervisor coordinating task lifecycles, DAG dependency resolution,
 * typed blockers, unblock loop breaker, comments, links, desktop notifications, and WIP limits (ADR-118).
 */

import type {
  KanbanBlockKind,
  KanbanBoard,
  KanbanBulkMutationResult,
  KanbanColumn,
  KanbanColumnDefinition,
  KanbanDeadlinesReport,
  KanbanGroupedSwimlane,
  KanbanGroupBy,
  KanbanPriority,
  KanbanQueryFilter,
  KanbanReasoningEffort,
  KanbanRelationType,
  KanbanSortBy,
  KanbanSortDirection,
  KanbanTask,
  KanbanTaskComment,
  KanbanTaskEvent,
  KanbanTaskHierarchy,
  KanbanTaskLink,
  KanbanTaskMutation,
  KanbanVelocityMetrics,
  KanbanWorkloadBalanceResult,
  KanbanArchiveResult,
  KanbanCloneBoardOptions,
  KanbanIssueTemplateKind,
  KanbanWorkspaceKind,
} from "../../../core/contracts/kanban.contracts.js";
import { BLOCK_RECURRENCE_LIMIT } from "../../../core/contracts/kanban.contracts.js";
import { DeterministicKanbanEngine } from "../../../tooling/extensions/kanban/deterministic-kanban-engine.js";
import { BroccoliKanbanSubstrate } from "../../../sessions/extensions/kanban/broccoli-kanban-substrate.js";
import { FilePredicateEvaluator } from "../runbooks/file-predicate-evaluator.js";
import type { RunbookSupervisor } from "../runbooks/runbook-supervisor.js";

export interface CreateTaskParams {
  boardId?: string;
  title: string;
  description?: string;
  priority?: KanbanPriority;
  column?: KanbanColumn;
  assignee?: string;
  owner?: string;
  tags?: readonly string[];
  blockedBy?: readonly string[];
  blockKind?: KanbanBlockKind;
  blockReason?: string;
  estimatePoints?: number;
  dueDateMs?: number;
  slaDeadlineMs?: number;
  goalMode?: boolean;
  goalMaxTurns?: number;
  workspaceKind?: KanbanWorkspaceKind;
  branchName?: string;
  prUrl?: string;
  commitSha?: string;
  reasoningEffort?: KanbanReasoningEffort;
  frameIndex?: number;
  metadata?: Record<string, unknown>;
}

export interface BoardStatusMetrics {
  boardId: string;
  title: string;
  totalTasks: number;
  columnCounts: Record<KanbanColumn, number>;
  readyTasksCount: number;
  blockedTasksCount: number;
  inProgressCount: number;
  activeAssignees: readonly string[];
  wipViolations: readonly string[];
}

export type BoardDiagnostics = BoardStatusMetrics;

export class KanbanBoardSupervisor {
  private engine: DeterministicKanbanEngine;
  private substrate: BroccoliKanbanSubstrate;
  private taskCounter: number;
  private readonly predicateEvaluator: FilePredicateEvaluator;
  private readonly runbookSupervisor?: RunbookSupervisor;

  constructor(
    engine: DeterministicKanbanEngine,
    substrate: BroccoliKanbanSubstrate,
    runbookSupervisor?: RunbookSupervisor,
    predicateEvaluator?: FilePredicateEvaluator
  ) {
    this.engine = engine;
    this.substrate = substrate;
    this.taskCounter = 1;
    this.runbookSupervisor = runbookSupervisor;
    this.predicateEvaluator = predicateEvaluator || new FilePredicateEvaluator();
  }

  /**
   * Retrieves underlying substrate.
   */
  getSubstrate(): BroccoliKanbanSubstrate {
    return this.substrate;
  }

  /**
   * Creates or registers a new board.
   */
  createBoard(
    boardId: string,
    title: string,
    columns?: readonly (KanbanColumn | KanbanColumnDefinition)[],
    defaultColumn?: KanbanColumn
  ): KanbanBoard {
    return this.substrate.createBoard(boardId, title, columns, defaultColumn);
  }

  /**
   * Lists all boards.
   */
  listBoards(): readonly KanbanBoard[] {
    return this.substrate.listBoards();
  }

  /**
   * Retrieves a board.
   */
  getBoard(boardId: string = "default"): KanbanBoard | undefined {
    return this.substrate.getBoard(boardId);
  }

  /**
   * Creates a new work item task on the board with cycle validation and priority weighting.
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
        return {
          success: false,
          error: `Cannot create task: dependency cycle detected in blockedBy [${blockedBy.join(", ")}]`,
        };
      }
    }

    const priority = params.priority ?? "medium";
    const initialColumn = params.column ?? (board.defaultColumn || "backlog");

    const newTask: KanbanTask = {
      id: taskId,
      title: params.title,
      description: params.description ?? "",
      column: initialColumn,
      priority,
      priorityWeight: BroccoliKanbanSubstrate.getPriorityWeight(priority),
      assignee: params.assignee,
      owner: params.owner,
      tags: params.tags ?? [],
      blockedBy,
      blockKind: params.blockKind,
      blockReason: params.blockReason,
      blockRecurrences: 0,
      estimatePoints: params.estimatePoints,
      dueDateMs: params.dueDateMs,
      slaDeadlineMs: params.slaDeadlineMs,
      goalMode: params.goalMode,
      goalMaxTurns: params.goalMaxTurns,
      workspaceKind: params.workspaceKind,
      branchName: params.branchName,
      prUrl: params.prUrl,
      commitSha: params.commitSha,
      reasoningEffort: params.reasoningEffort,
      createdFrame: params.frameIndex ?? 0,
      updatedFrame: params.frameIndex ?? 0,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      metadata: params.metadata,
      fsmVerificationStatus: "in_progress",
    };

    const added = this.substrate.addTask(boardId, newTask);
    if (!added) {
      return { success: false, error: `Failed to add task '${taskId}' to board '${boardId}'` };
    }

    // Auto-create links for blockedBy relations
    for (const blockerId of blockedBy) {
      this.substrate.addLink({
        id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sourceTaskId: taskId,
        targetTaskId: blockerId,
        relationType: "blocked_by",
        createdAtMs: Date.now(),
      });
    }

    // Emit desktop notification
    this.substrate.getNotificationDispatcher().dispatch({
      taskId,
      boardId,
      title: `Task Created: ${newTask.title}`,
      message: `Added to ${initialColumn} (${priority} priority)`,
      urgency: priority === "urgent" || priority === "critical" ? "high" : "normal",
      trigger: "task_created",
    }).catch(() => {});

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
    const board = this.substrate.getBoard(boardId);
    if (!board) {
      return { success: false, error: `Board '${boardId}' not found` };
    }

    const currentTask = board.tasks.find((t) => t.id === taskId);
    if (!currentTask) {
      return { success: false, error: `Task '${taskId}' not found on board '${boardId}'` };
    }

    // Validate column transition & Definition of Done verification gates
    if (mutation.column && mutation.column !== currentTask.column) {
      if (!this.engine.isValidTransition(currentTask.column, mutation.column)) {
        return {
          success: false,
          error: `Invalid transition from column '${currentTask.column}' to '${mutation.column}'`,
        };
      }

      // Enforce FSM Definition of Done gates when moving to 'done' or 'review'
      if (mutation.column === "done") {
        if (currentTask.subtaskChecklist && currentTask.subtaskChecklist.some((s) => !s.done)) {
          const uncompleted = currentTask.subtaskChecklist.filter((s) => !s.done).length;
          return {
            success: false,
            error: `🛑 Quality Gate Blocked: Cannot move task '${currentTask.title}' to 'done' with ${uncompleted} uncompleted subtask(s).`,
          };
        }

        const verificationRules = (currentTask.metadata?.verification || currentTask.metadata?.gates) as any;
        if (Array.isArray(verificationRules)) {
          for (const rule of verificationRules) {
            const evalRes = this.predicateEvaluator.evaluate(rule);
            if (!evalRes.passed) {
              return {
                success: false,
                error: `🛑 Quality Gate Blocked: ${evalRes.output}`,
              };
            }
          }
        }
      }
    }

    // Check for dependency cycles if blockedBy is modified
    if (mutation.blockedBy) {
      if (this.engine.hasDependencyCycle(taskId, mutation.blockedBy, board.tasks)) {
        return {
          success: false,
          error: `Cannot update task: dependency cycle detected in blockedBy [${mutation.blockedBy.join(", ")}]`,
        };
      }
    }

    const effectiveMutation: KanbanTaskMutation = {
      ...mutation,
      fsmVerificationStatus: mutation.column === "done" ? "verified" : mutation.fsmVerificationStatus || currentTask.fsmVerificationStatus || "in_progress",
    };

    const updated = this.substrate.updateTask(boardId, taskId, effectiveMutation, frameIndex);
    if (!updated) {
      return { success: false, error: `Failed to update task '${taskId}' in substrate` };
    }

    // Dispatch transition notification
    if (mutation.column && mutation.column !== currentTask.column) {
      this.substrate.getNotificationDispatcher().dispatch({
        taskId,
        boardId,
        title: `Task Moved: ${updated.title}`,
        message: `Transitioned from ${currentTask.column} -> ${updated.column}`,
        urgency: updated.column === "done" ? "normal" : "low",
        trigger: "column_transition",
        soundName: updated.column === "done" ? "Hero" : undefined,
      }).catch(() => {});
    }

    // Dispatch assignment notification
    if (mutation.assignee && mutation.assignee !== currentTask.assignee) {
      this.substrate.getNotificationDispatcher().dispatch({
        taskId,
        boardId,
        title: `Task Assigned: ${updated.title}`,
        message: `Assigned to ${mutation.assignee}`,
        urgency: "normal",
        trigger: "assigned",
      }).catch(() => {});
    }

    return { success: true, task: updated };
  }

  /**
   * Blocks a task with a typed block kind and reason.
   */
  blockTask(
    boardId: string = "default",
    taskId: string,
    kind: KanbanBlockKind,
    reason: string = "Blocked"
  ): { success: boolean; task?: KanbanTask; error?: string } {
    const board = this.substrate.getBoard(boardId);
    if (!board) return { success: false, error: `Board '${boardId}' not found` };

    const task = board.tasks.find((t) => t.id === taskId);
    if (!task) return { success: false, error: `Task '${taskId}' not found` };

    let nextColumn: KanbanColumn = "blocked";
    let recurrences = (task.blockRecurrences || 0) + 1;

    // Unblock-loop breaker: if repeatedly blocked for truly blocked reason, escalate to triage
    if (recurrences >= BLOCK_RECURRENCE_LIMIT && (kind === "needs_input" || kind === "capability")) {
      nextColumn = "triage";
    }

    const updated = this.substrate.updateTask(boardId, taskId, {
      column: nextColumn,
      blockKind: kind,
      blockReason: reason,
      blockRecurrences: recurrences,
    });

    this.substrate.recordEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskId,
      eventType: "blocked",
      actor: "system",
      details: { blockKind: kind, reason, recurrences, targetColumn: nextColumn },
      timestampMs: Date.now(),
    });

    // Urgent notification on block
    this.substrate.getNotificationDispatcher().dispatch({
      taskId,
      boardId,
      title: `🛑 Task Blocked (${kind}): ${task.title}`,
      message: reason,
      urgency: "urgent",
      trigger: "blocked",
      soundName: "Basso",
    }).catch(() => {});

    return { success: true, task: updated };
  }

  /**
   * Unblocks a task, resetting its block state.
   */
  unblockTask(
    boardId: string = "default",
    taskId: string,
    reason: string = "Resolved"
  ): { success: boolean; task?: KanbanTask; error?: string } {
    const board = this.substrate.getBoard(boardId);
    if (!board) return { success: false, error: `Board '${boardId}' not found` };

    const task = board.tasks.find((t) => t.id === taskId);
    if (!task) return { success: false, error: `Task '${taskId}' not found` };

    const unblocked = this.engine.isTaskUnblocked(task, board.tasks);
    const targetColumn: KanbanColumn = unblocked ? "ready" : "todo";

    const updated = this.substrate.updateTask(boardId, taskId, {
      column: targetColumn,
      blockKind: undefined,
      blockReason: undefined,
    });

    this.substrate.recordEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskId,
      eventType: "unblocked",
      actor: "system",
      details: { reason, targetColumn },
      timestampMs: Date.now(),
    });

    this.substrate.getNotificationDispatcher().dispatch({
      taskId,
      boardId,
      title: `✅ Task Unblocked: ${task.title}`,
      message: `Moved to ${targetColumn} (${reason})`,
      urgency: "normal",
      trigger: "unblocked",
      soundName: "Ping",
    }).catch(() => {});

    return { success: true, task: updated };
  }

  /**
   * Links two tasks with a typed relation.
   */
  linkTasks(
    sourceTaskId: string,
    targetTaskId: string,
    relationType: KanbanRelationType
  ): { success: boolean; link?: KanbanTaskLink; error?: string } {
    const link: KanbanTaskLink = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceTaskId,
      targetTaskId,
      relationType,
      createdAtMs: Date.now(),
    };

    const added = this.substrate.addLink(link);
    return { success: added, link };
  }

  /**
   * Unlinks a task relation.
   */
  unlinkTasks(linkId: string): boolean {
    return this.substrate.removeLink(linkId);
  }

  /**
   * Adds a comment to a task.
   */
  addComment(
    taskId: string,
    author: string,
    content: string
  ): { success: boolean; comment?: KanbanTaskComment } {
    const comment: KanbanTaskComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskId,
      author,
      content,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    this.substrate.addComment(comment);

    this.substrate.getNotificationDispatcher().dispatch({
      taskId,
      title: `New Comment on #${taskId}`,
      message: `${author}: ${content.slice(0, 80)}`,
      urgency: "low",
      trigger: "comment_added",
    }).catch(() => {});

    return { success: true, comment };
  }

  /**
   * Retrieves full task details including comments, links, and audit trail events.
   */
  getTaskDetails(
    taskId: string,
    boardId?: string
  ): {
    task: KanbanTask;
    boardId: string;
    comments: readonly KanbanTaskComment[];
    events: readonly KanbanTaskEvent[];
    links: readonly KanbanTaskLink[];
  } | undefined {
    let targetBoardId = boardId;
    let foundTask: KanbanTask | undefined;

    if (targetBoardId) {
      foundTask = this.substrate.getTask(targetBoardId, taskId);
    } else {
      const cross = this.substrate.findTaskAcrossBoards(taskId);
      if (cross) {
        targetBoardId = cross.boardId;
        foundTask = cross.task;
      }
    }

    if (!foundTask || !targetBoardId) return undefined;

    return {
      task: foundTask,
      boardId: targetBoardId,
      comments: this.substrate.getTaskComments(taskId),
      events: this.substrate.getTaskEvents(taskId),
      links: this.substrate.getTaskLinks(taskId),
    };
  }

  /**
   * Lists and filters tasks on a board.
   */
  listTasks(boardId: string = "default", filter: KanbanQueryFilter = {}): readonly KanbanTask[] {
    const board = this.substrate.getBoard(boardId);
    if (!board) return [];

    return board.tasks
      .filter((task) => this.engine.matchesFilter(task, filter, board.tasks))
      .sort((a, b) => b.priorityWeight - a.priorityWeight || a.createdAtMs - b.createdAtMs);
  }

  /**
   * Groups and sorts tasks into structured swimlanes for visual rendering.
   */
  getGroupedTasks(
    boardId: string = "default",
    groupBy: KanbanGroupBy = "column",
    sortBy: KanbanSortBy = "priority",
    sortDirection: KanbanSortDirection = "desc",
    filter: KanbanQueryFilter = {}
  ): readonly KanbanGroupedSwimlane[] {
    return this.substrate.getGroupedTasks(boardId, groupBy, sortBy, sortDirection, filter);
  }

  /**
   * Atomically claims an unblocked task for an assignee and moves to 'in_progress'.
   */
  claimTask(
    boardId: string = "default",
    taskId: string,
    assignee: string,
    frameIndex: number = 0
  ): { success: boolean; task?: KanbanTask; error?: string } {
    const board = this.substrate.getBoard(boardId);
    if (!board) {
      return { success: false, error: `Board '${boardId}' not found` };
    }

    const task = board.tasks.find((t) => t.id === taskId);
    if (!task) {
      return { success: false, error: `Task '${taskId}' not found` };
    }

    if (!this.engine.isTaskUnblocked(task, board.tasks)) {
      const blockers = this.engine.getEffectiveBlockers(task, board.tasks);
      return {
        success: false,
        error: `Cannot claim task '${taskId}': blocked by incomplete tasks [${blockers.map((b) => b.id).join(", ")}]`,
      };
    }

    return this.updateTask(boardId, taskId, { column: "in_progress", assignee }, frameIndex);
  }

  /**
   * Completes a task and promotes dependent tasks.
   */
  completeTask(
    boardId: string = "default",
    taskId: string,
    frameIndex: number = 0
  ): { success: boolean; task?: KanbanTask; error?: string } {
    const res = this.updateTask(boardId, taskId, { column: "done" }, frameIndex);
    if (!res.success) return res;

    // Trigger auto-progression on board
    this.recomputeReady(boardId);
    return res;
  }

  /**
   * Recomputes ready state across all tasks on a board.
   */
  recomputeReady(boardId: string = "default"): { promotedTaskIds: string[]; count: number } {
    const board = this.substrate.getBoard(boardId);
    if (!board) return { promotedTaskIds: [], count: 0 };

    const { promotedTaskIds, updatedTasks } = this.engine.recomputeReady(board.tasks);
    for (const updated of updatedTasks) {
      if (promotedTaskIds.includes(updated.id)) {
        this.substrate.updateTask(boardId, updated.id, { column: "ready" });
      }
    }

    return { promotedTaskIds, count: promotedTaskIds.length };
  }

  /**
   * Audits approaching and overdue task deadlines and dispatches SLA alerts.
   */
  checkUpcomingDeadlines(boardId: string = "default", warningWindowMs: number = 86400000): KanbanDeadlinesReport {
    const report = this.substrate.scanDeadlines(boardId, warningWindowMs);

    for (const overdue of report.overdueTasks) {
      this.substrate.getNotificationDispatcher().dispatch({
        taskId: overdue.id,
        boardId,
        title: `🚨 OVERDUE: ${overdue.title}`,
        message: `Task passed due date! Immediate action required.`,
        urgency: "urgent",
        trigger: "sla_breached",
        soundName: "Basso",
      }).catch(() => {});
    }

    for (const upcoming of report.upcomingSoonTasks) {
      this.substrate.getNotificationDispatcher().dispatch({
        taskId: upcoming.id,
        boardId,
        title: `⏰ Due Soon: ${upcoming.title}`,
        message: `Deadline approaching within 24 hours.`,
        urgency: "high",
        trigger: "deadline_warning",
      }).catch(() => {});
    }

    return report;
  }

  /**
   * Undoes the last mutation on a board.
   */
  undo(boardId: string = "default"): { success: boolean; restoredTask?: KanbanTask } {
    return this.substrate.undoMutation(boardId);
  }

  /**
   * Redoes the last undone mutation on a board.
   */
  redo(boardId: string = "default"): { success: boolean; restoredTask?: KanbanTask } {
    return this.substrate.redoMutation(boardId);
  }

  /**
   * Retrieves a task along with its full relational hierarchy (blockers, dependents, subtasks, parent).
   */
  getTaskHierarchy(taskId: string, boardId: string = "default"): KanbanTaskHierarchy | undefined {
    return this.substrate.getTaskWithHierarchy(boardId, taskId);
  }

  /**
   * Computes velocity and throughput metrics for a board.
   */
  getVelocityMetrics(boardId: string = "default"): KanbanVelocityMetrics | undefined {
    return this.substrate.getVelocityMetrics(boardId);
  }

  /**
   * Performs a bulk update across multiple tasks atomically.
   */
  bulkUpdateTasks(
    boardId: string = "default",
    taskIds: readonly string[],
    mutation: KanbanTaskMutation,
    frameIndex: number = 0
  ): KanbanBulkMutationResult {
    return this.substrate.bulkUpdateTasks(boardId, taskIds, mutation, frameIndex);
  }

  /**
   * Toggles or adds a subtask checklist item on a task.
   */
  toggleSubtaskChecklist(
    boardId: string = "default",
    taskId: string,
    subtaskId: string,
    done?: boolean
  ): { success: boolean; task?: KanbanTask; error?: string } {
    const task = this.substrate.toggleSubtaskChecklist(boardId, taskId, subtaskId, done);
    if (!task) return { success: false, error: `Task '${taskId}' not found on board '${boardId}'` };
    return { success: true, task };
  }

  /**
   * Moves a task from one board to another board.
   */
  moveTaskToBoard(taskId: string, fromBoardId: string, toBoardId: string): { success: boolean; error?: string } {
    const ok = this.substrate.moveTaskToBoard(taskId, fromBoardId, toBoardId);
    if (!ok) return { success: false, error: `Could not move task '${taskId}' from '${fromBoardId}' to '${toBoardId}'` };
    return { success: true };
  }

  /**
   * Automatically balances and assigns ready tasks across available workers.
   */
  autoAssignWorkload(boardId: string = "default", workerIds: readonly string[]): KanbanWorkloadBalanceResult {
    return this.substrate.autoAssignWorkload(boardId, workerIds);
  }

  /**
   * Exports an interactive HTML Kanban board.
   */
  exportHtml(boardId: string = "default"): string {
    return this.substrate.exportInteractiveHtmlView(boardId);
  }

  /**
   * Exports a board to GitHub-flavored Markdown.
   */
  exportMarkdown(boardId: string = "default"): string {
    return this.substrate.exportMarkdown(boardId);
  }

  /**
   * Exports all tasks on a board to CSV format.
   */
  exportCsv(boardId: string = "default"): string {
    return this.substrate.exportCsv(boardId);
  }

  /**
   * Exports all tasks and board configuration to JSON.
   */
  exportJson(boardId: string = "default"): string {
    return this.substrate.exportJson(boardId);
  }

  /**
   * Creates a task pre-populated from an issue template (bug_report, feature_spec, security_fix, refactor).
   */
  createTaskFromTemplate(
    boardId: string = "default",
    templateKind: KanbanIssueTemplateKind,
    title: string,
    overrides?: Partial<KanbanTaskMutation>
  ): { success: boolean; task?: KanbanTask; error?: string } {
    const task = this.substrate.createTaskFromTemplate(boardId, templateKind, title, overrides);
    if (!task) return { success: false, error: `Could not create task from template '${templateKind}'` };
    return { success: true, task };
  }

  /**
   * Archives completed tasks on a board.
   */
  archiveCompletedTasks(boardId: string = "default", cutoffMs?: number): KanbanArchiveResult {
    return this.substrate.archiveCompletedTasks(boardId, cutoffMs);
  }

  /**
   * Clones a board structure and optional tasks for a new sprint/milestone.
   */
  cloneBoard(sourceBoardId: string, targetBoardId: string, options?: KanbanCloneBoardOptions): { success: boolean; error?: string } {
    const ok = this.substrate.cloneBoard(sourceBoardId, targetBoardId, options);
    if (!ok) return { success: false, error: `Could not clone board '${sourceBoardId}' to '${targetBoardId}'` };
    return { success: true };
  }

  /**
   * Renders visual ASCII / Unicode DAG dependency graph of the board.
   */
  renderDagGraph(boardId: string = "default"): string {
    return this.substrate.renderDagGraph(boardId);
  }

  /**
   * Gathers comprehensive board status metrics and WIP utilization.
   */
  getBoardMetrics(boardId: string = "default"): BoardStatusMetrics | undefined {
    const board = this.substrate.getBoard(boardId);
    if (!board) return undefined;

    const columnCounts: Record<KanbanColumn, number> = {
      triage: 0,
      backlog: 0,
      todo: 0,
      ready: 0,
      in_progress: 0,
      blocked: 0,
      review: 0,
      done: 0,
      canceled: 0,
      archived: 0,
    };

    const assignees = new Set<string>();
    const wipViolations: string[] = [];

    for (const task of board.tasks) {
      if (task.column in columnCounts) {
        columnCounts[task.column] += 1;
      }
      if (task.assignee) {
        assignees.add(task.assignee);
      }
    }

    // Check WIP limit configurations if present
    for (const col of board.columns) {
      if (typeof col === "object" && col.wipLimit && col.wipLimit > 0) {
        const count = columnCounts[col.id] || 0;
        if (count > col.wipLimit) {
          wipViolations.push(`Column '${col.title}' exceeds WIP limit (${count}/${col.wipLimit})`);
        }
      }
    }

    return {
      boardId: board.boardId,
      title: board.title,
      totalTasks: board.tasks.length,
      columnCounts,
      readyTasksCount: columnCounts.ready,
      blockedTasksCount: columnCounts.blocked,
      inProgressCount: columnCounts.in_progress,
      activeAssignees: Array.from(assignees),
      wipViolations,
    };
  }
}
