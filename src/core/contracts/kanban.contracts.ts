/**
 * kanban.contracts.ts
 *
 * Core data contracts for the Deterministic Kanban Board Dispatcher, Task DAG & Multi-Agent Issue Orchestrator
 * Upgraded to World-Class Industry Standards (Linear, Jira, GitHub Projects, and Hermes parity) - ADR-118.
 */

export type KanbanStatus =
  | "triage"
  | "backlog"
  | "todo"
  | "ready"
  | "in_progress"
  | "blocked"
  | "review"
  | "done"
  | "canceled"
  | "archived";

/** Backwards-compatible alias for KanbanStatus */
export type KanbanColumn = KanbanStatus;

export type KanbanStageCategory =
  | "backlog"
  | "unstarted"
  | "started"
  | "completed"
  | "canceled";

export type KanbanPriority = "none" | "low" | "medium" | "high" | "urgent" | "critical";

export type KanbanBlockKind = "dependency" | "needs_input" | "capability" | "transient";

export type KanbanRelationType =
  | "blocks"
  | "blocked_by"
  | "relates_to"
  | "duplicates"
  | "parent_of"
  | "subtask_of";

export type KanbanWorkspaceKind = "scratch" | "worktree" | "dir";

export type KanbanReasoningEffort = "none" | "low" | "medium" | "high";

export const BLOCK_RECURRENCE_LIMIT = 2;

export const DEFAULT_KANBAN_COLUMNS: readonly KanbanColumn[] = [
  "triage",
  "backlog",
  "todo",
  "ready",
  "in_progress",
  "blocked",
  "review",
  "done",
  "archived",
];

export interface KanbanColumnDefinition {
  readonly id: KanbanColumn;
  readonly title: string;
  readonly category: KanbanStageCategory;
  readonly wipLimit?: number;
}

export interface KanbanTaskLink {
  readonly id: string;
  readonly sourceTaskId: string;
  readonly targetTaskId: string;
  readonly relationType: KanbanRelationType;
  readonly createdAtMs: number;
}

export interface KanbanTaskComment {
  readonly id: string;
  readonly taskId: string;
  readonly author: string;
  readonly content: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface KanbanTaskEvent {
  readonly id: string;
  readonly taskId: string;
  readonly eventType:
    | "created"
    | "updated"
    | "column_transition"
    | "assigned"
    | "blocked"
    | "unblocked"
    | "priority_changed"
    | "link_added"
    | "link_removed"
    | "comment_added";
  readonly actor: string;
  readonly details: Record<string, unknown>;
  readonly timestampMs: number;
}

export interface KanbanTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly column: KanbanColumn;
  readonly priority: KanbanPriority;
  readonly priorityWeight: number;
  readonly assignee?: string;
  readonly owner?: string;
  readonly tags: readonly string[];
  readonly blockedBy: readonly string[];
  readonly blockKind?: KanbanBlockKind;
  readonly blockReason?: string;
  readonly blockRecurrences: number;
  readonly estimatePoints?: number;
  readonly dueDateMs?: number;
  readonly slaDeadlineMs?: number;
  readonly goalMode?: boolean;
  readonly goalMaxTurns?: number;
  readonly workspaceKind?: KanbanWorkspaceKind;
  readonly branchName?: string;
  readonly prUrl?: string;
  readonly commitSha?: string;
  readonly reasoningEffort?: KanbanReasoningEffort;
  readonly createdFrame: number;
  readonly updatedFrame: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly metadata?: Record<string, unknown>;
}

export interface KanbanBoard {
  readonly boardId: string;
  readonly title: string;
  readonly description?: string;
  readonly tasks: readonly KanbanTask[];
  readonly columns: readonly (KanbanColumn | KanbanColumnDefinition)[];
  readonly defaultColumn?: KanbanColumn;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface KanbanTaskMutation {
  readonly title?: string;
  readonly description?: string;
  readonly column?: KanbanColumn;
  readonly priority?: KanbanPriority;
  readonly assignee?: string;
  readonly owner?: string;
  readonly tags?: readonly string[];
  readonly blockedBy?: readonly string[];
  readonly blockKind?: KanbanBlockKind;
  readonly blockReason?: string;
  readonly blockRecurrences?: number;
  readonly estimatePoints?: number;
  readonly dueDateMs?: number;
  readonly slaDeadlineMs?: number;
  readonly goalMode?: boolean;
  readonly goalMaxTurns?: number;
  readonly workspaceKind?: KanbanWorkspaceKind;
  readonly branchName?: string;
  readonly prUrl?: string;
  readonly commitSha?: string;
  readonly reasoningEffort?: KanbanReasoningEffort;
  readonly metadata?: Record<string, unknown>;
}

export interface KanbanQueryFilter {
  readonly query?: string;
  readonly column?: KanbanColumn;
  readonly category?: KanbanStageCategory;
  readonly priority?: KanbanPriority;
  readonly assignee?: string;
  readonly tag?: string;
  readonly isBlocked?: boolean;
  readonly isReady?: boolean;
  readonly goalMode?: boolean;
  readonly searchTerm?: string;
}

export interface KanbanWorkspaceSnapshot {
  readonly boards: readonly KanbanBoard[];
  readonly links: readonly KanbanTaskLink[];
  readonly comments: readonly KanbanTaskComment[];
  readonly events: readonly KanbanTaskEvent[];
  readonly totalTasks: number;
  readonly totalActiveTasks: number;
  readonly timestamp: number;
}
