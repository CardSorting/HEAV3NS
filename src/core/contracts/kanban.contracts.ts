/**
 * kanban.contracts.ts
 *
 * Core data contracts for the Deterministic Kanban Board Dispatcher, Task DAG & Multi-Agent Issue Orchestrator (Phase 81 / ADR-033).
 */

export type KanbanColumn = "backlog" | "todo" | "in_progress" | "review" | "done" | "archived";

export type KanbanPriority = "low" | "medium" | "high" | "critical";

export interface KanbanTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly column: KanbanColumn;
  readonly priority: KanbanPriority;
  readonly assignee?: string;
  readonly tags: readonly string[];
  readonly blockedBy: readonly string[];
  readonly createdFrame: number;
  readonly updatedFrame: number;
  readonly metadata?: Record<string, unknown>;
}

export interface KanbanBoard {
  readonly boardId: string;
  readonly title: string;
  readonly tasks: readonly KanbanTask[];
  readonly columns: readonly KanbanColumn[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface KanbanTaskMutation {
  readonly title?: string;
  readonly description?: string;
  readonly column?: KanbanColumn;
  readonly priority?: KanbanPriority;
  readonly assignee?: string;
  readonly tags?: readonly string[];
  readonly blockedBy?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export interface KanbanQueryFilter {
  readonly column?: KanbanColumn;
  readonly priority?: KanbanPriority;
  readonly assignee?: string;
  readonly tag?: string;
  readonly isBlocked?: boolean;
}

export interface KanbanWorkspaceSnapshot {
  readonly boards: readonly KanbanBoard[];
  readonly totalTasks: number;
  readonly totalActiveTasks: number;
  readonly timestamp: number;
}
