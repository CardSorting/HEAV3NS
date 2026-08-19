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

export interface KanbanSubtaskChecklistItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
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
  readonly subtaskChecklist?: readonly KanbanSubtaskChecklistItem[];
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
  readonly runbookRunId?: string;
  readonly fsmVerificationStatus?: "verified" | "gate_blocked" | "in_progress";
  readonly verificationErrors?: readonly string[];
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
  readonly subtaskChecklist?: readonly KanbanSubtaskChecklistItem[];
  readonly goalMode?: boolean;
  readonly goalMaxTurns?: number;
  readonly workspaceKind?: KanbanWorkspaceKind;
  readonly branchName?: string;
  readonly prUrl?: string;
  readonly commitSha?: string;
  readonly reasoningEffort?: KanbanReasoningEffort;
  readonly metadata?: Record<string, unknown>;
  readonly runbookRunId?: string;
  readonly fsmVerificationStatus?: "verified" | "gate_blocked" | "in_progress";
  readonly verificationErrors?: readonly string[];
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

// ---------------------------------------------------------------------------
// Desktop Notifications & Alert Contracts
// ---------------------------------------------------------------------------

export type KanbanNotificationUrgency = "low" | "normal" | "high" | "urgent";

export type KanbanNotificationTrigger =
  | "task_created"
  | "column_transition"
  | "assigned"
  | "blocked"
  | "unblocked"
  | "priority_changed"
  | "deadline_warning"
  | "sla_breached"
  | "wip_exceeded"
  | "comment_added"
  | "custom";

export interface KanbanNotificationEvent {
  readonly id: string;
  readonly taskId?: string;
  readonly boardId?: string;
  readonly title: string;
  readonly message: string;
  readonly urgency: KanbanNotificationUrgency;
  readonly trigger: KanbanNotificationTrigger;
  readonly soundName?: string;
  readonly timestampMs: number;
  readonly metadata?: Record<string, unknown>;
}

export interface KanbanNotificationPreferences {
  readonly enabled: boolean;
  readonly desktopEnabled: boolean;
  readonly terminalEscapesEnabled: boolean;
  readonly soundEnabled: boolean;
  readonly dndEnabled: boolean;
  readonly minUrgency: KanbanNotificationUrgency;
  readonly notifyOnAssign: boolean;
  readonly notifyOnBlock: boolean;
  readonly notifyOnDone: boolean;
  readonly notifyOnWipBreach: boolean;
  readonly notifyOnDueSoonHours: number;
  readonly mutedTaskIds: readonly string[];
}

export interface KanbanNotificationRecord {
  readonly id: string;
  readonly event: KanbanNotificationEvent;
  readonly read: boolean;
  readonly deliveredVia: readonly ("desktop" | "terminal" | "web" | "internal")[];
  readonly createdAtMs: number;
}

// ---------------------------------------------------------------------------
// View, Grouping, Sorting & Ergonomics Contracts
// ---------------------------------------------------------------------------

export type KanbanViewMode = "board" | "swimlane" | "list" | "timeline";

export type KanbanGroupBy = "column" | "priority" | "assignee" | "category" | "blocked";

export type KanbanSortBy = "priority" | "dueDate" | "estimate" | "updated" | "created" | "title";

export type KanbanSortDirection = "asc" | "desc";

export interface KanbanGroupedSwimlane {
  readonly key: string;
  readonly title: string;
  readonly tasks: readonly KanbanTask[];
  readonly count: number;
  readonly wipLimit?: number;
  readonly isWipExceeded?: boolean;
}

export interface KanbanDeadlinesReport {
  readonly boardId: string;
  readonly timestamp: number;
  readonly overdueTasks: readonly KanbanTask[];
  readonly upcomingSoonTasks: readonly KanbanTask[];
  readonly totalAudited: number;
}

export interface KanbanMutationUndoRecord {
  readonly undoId: string;
  readonly boardId: string;
  readonly taskId: string;
  readonly previousState: KanbanTask;
  readonly newState: KanbanTask;
  readonly timestampMs: number;
}

export interface KanbanTaskHierarchy {
  readonly task: KanbanTask;
  readonly boardId: string;
  readonly directBlockers: readonly KanbanTask[];
  readonly directDependents: readonly KanbanTask[];
  readonly parentTask?: KanbanTask;
  readonly subtasks: readonly KanbanTask[];
  readonly comments: readonly KanbanTaskComment[];
  readonly events: readonly KanbanTaskEvent[];
  readonly links: readonly KanbanTaskLink[];
}

export interface KanbanVelocityMetrics {
  readonly boardId: string;
  readonly totalCompletedPoints: number;
  readonly totalCompletedTasks: number;
  readonly averageLeadTimeMs: number;
  readonly averageCycleTimeMs: number;
  readonly currentWipCount: number;
  readonly throughputPerDay: number;
}

export interface KanbanBulkMutationResult {
  readonly totalTargeted: number;
  readonly updatedCount: number;
  readonly failedCount: number;
  readonly updatedTasks: readonly KanbanTask[];
  readonly errors: readonly string[];
}

export type KanbanExportFormat = "html" | "markdown" | "csv" | "json";

export interface KanbanWorkloadBalanceResult {
  readonly boardId: string;
  readonly assignedCount: number;
  readonly unassignedCount: number;
  readonly workerAssignments: Record<string, readonly string[]>;
}

export type KanbanIssueTemplateKind = "bug_report" | "feature_spec" | "security_fix" | "refactor";

export interface KanbanIssueTemplate {
  readonly templateKind: KanbanIssueTemplateKind;
  readonly titlePrefix: string;
  readonly defaultColumn: KanbanColumn;
  readonly defaultPriority: KanbanPriority;
  readonly defaultTags: readonly string[];
  readonly descriptionTemplate: string;
  readonly checklist: readonly string[];
}

export interface KanbanArchiveResult {
  readonly boardId: string;
  readonly archivedCount: number;
  readonly archivedTaskIds: readonly string[];
  readonly remainingActiveCount: number;
}

export interface KanbanCloneBoardOptions {
  readonly includeTasks?: boolean;
  readonly includeWipLimits?: boolean;
  readonly newTitle?: string;
}

// ---------------------------------------------------------------------------
// BroccoliDB Table Row Record Contracts
// ---------------------------------------------------------------------------

export interface KanbanBoardRow extends Record<string, unknown> {
  id: string;
  title: string;
  description?: string;
  columnsJson: string;
  defaultColumn?: string;
  createdAt: number;
  updatedAt: number;
}

export interface KanbanTaskRow extends Record<string, unknown> {
  id: string;
  boardId: string;
  title: string;
  description: string;
  column: KanbanColumn;
  priority: KanbanPriority;
  priorityWeight: number;
  assignee?: string;
  owner?: string;
  tagsJson: string;
  blockedByJson: string;
  blockKind?: KanbanBlockKind;
  blockReason?: string;
  blockRecurrences: number;
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
  createdFrame: number;
  updatedFrame: number;
  createdAtMs: number;
  updatedAtMs: number;
  metadataJson?: string;
}

export interface KanbanLinkRow extends Record<string, unknown> {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  relationType: KanbanRelationType;
  createdAtMs: number;
}

export interface KanbanCommentRow extends Record<string, unknown> {
  id: string;
  taskId: string;
  author: string;
  content: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface KanbanEventRow extends Record<string, unknown> {
  id: string;
  taskId: string;
  eventType: string;
  actor: string;
  detailsJson: string;
  timestampMs: number;
}

export interface KanbanNotificationRow extends Record<string, unknown> {
  id: string;
  taskId?: string;
  boardId?: string;
  title: string;
  message: string;
  urgency: KanbanNotificationUrgency;
  trigger: KanbanNotificationTrigger;
  soundName?: string;
  read: boolean;
  timestampMs: number;
}

