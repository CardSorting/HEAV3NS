/**
 * Core Contracts for Autonomous Swarm Delegation & Git Worktree Isolation.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 */

export type SwarmTaskStatus = "pending" | "running" | "completed" | "failed" | "aborted";

export interface SubagentBudget {
  readonly maxIterations: number;
  readonly maxTokens: number;
  readonly maxWallClockMs: number;
  readonly remainingIterations: number;
  readonly remainingTokens: number;
}

export interface WorktreeIsolationSpec {
  readonly worktreePath: string;
  readonly branchName: string;
  readonly baseCommitSha?: string;
  readonly isTemporary: boolean;
  readonly autoCleanup: boolean;
}

export interface SwarmTaskManifest {
  readonly id: string;
  readonly parentTaskId?: string;
  readonly depth: number;
  readonly goal: string;
  readonly context: string;
  readonly allowedTools: readonly string[];
  readonly blockedTools: readonly string[];
  readonly budget: SubagentBudget;
  readonly worktree?: WorktreeIsolationSpec;
  readonly status: SwarmTaskStatus;
  readonly tags?: readonly string[];
  readonly createdTick: number;
  readonly completedTick?: number;
  readonly createdAtMs?: number;
  readonly updatedAtMs?: number;
}

export interface DelegationOutcome {
  readonly taskId: string;
  readonly success: boolean;
  readonly summary: string;
  readonly output?: unknown;
  readonly toolCallsCount: number;
  readonly tokenUsage: number;
  readonly durationMs: number;
  readonly filesModified: readonly string[];
  readonly error?: string;
  readonly auditedBy: string;
  readonly timestampMs?: number;
}

export interface BatchDelegationResult {
  readonly batchId: string;
  readonly totalTasks: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly outcomes: readonly DelegationOutcome[];
  readonly combinedSummary: string;
  readonly totalDurationMs: number;
}

// ---------------------------------------------------------------------------
// Health, Metrics & SLA Contracts
// ---------------------------------------------------------------------------

export type SwarmHealthStatus = "healthy" | "congested" | "budget_exhausted" | "failed";

export interface SwarmHealthAuditReport {
  readonly parentTaskId?: string;
  readonly totalTasks: number;
  readonly activeTasks: number;
  readonly healthStatus: SwarmHealthStatus;
  readonly overallSuccessRatePercent: number;
  readonly budgetExhaustedTasks: number;
  readonly maxDepthReached: number;
  readonly recommendations: readonly string[];
}

export interface SwarmMetricsReport {
  readonly totalTasks: number;
  readonly activeTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly abortedTasks: number;
  readonly totalTokensUsed: number;
  readonly totalToolCalls: number;
  readonly overallSuccessRatePercent: number;
  readonly p50DurationMs: number;
  readonly p95DurationMs: number;
  readonly p99DurationMs: number;
  readonly activeWorktreesCount: number;
}

// ---------------------------------------------------------------------------
// Grouping & Swimlanes Contracts
// ---------------------------------------------------------------------------

export type SwarmGroupBy = "status" | "depth" | "parentTaskId" | "health";
export type SwarmSortBy = "recent" | "duration" | "tokens" | "depth" | "goal";
export type SwarmSortDirection = "asc" | "desc";

export interface SwarmGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly tasks: readonly SwarmTaskManifest[];
}

// ---------------------------------------------------------------------------
// Notification Contracts
// ---------------------------------------------------------------------------

export type SwarmNotificationTrigger =
  | "task_delegated"
  | "task_completed"
  | "task_failed"
  | "task_aborted"
  | "budget_warning"
  | "worktree_conflict"
  | "custom";

export type SwarmNotificationUrgency = "low" | "normal" | "critical";

export interface SwarmNotificationEvent {
  readonly taskId?: string;
  readonly parentTaskId?: string;
  readonly title: string;
  readonly message: string;
  readonly urgency: SwarmNotificationUrgency;
  readonly trigger: SwarmNotificationTrigger;
  readonly metadata?: Record<string, unknown>;
  readonly actionUrl?: string;
}

export interface SwarmNotificationPreferences {
  readonly enabled: boolean;
  readonly soundEnabled: boolean;
  readonly dndEnabled: boolean;
  readonly minUrgency: SwarmNotificationUrgency;
  readonly allowedTriggers: readonly SwarmNotificationTrigger[];
}

export interface SwarmNotificationRecord {
  readonly id: string;
  readonly event: SwarmNotificationEvent;
  readonly dispatchedAtMs: number;
  readonly delivered: boolean;
  readonly read: boolean;
  readonly audioPlayed: boolean;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Query Contracts
// ---------------------------------------------------------------------------

export interface SwarmMutationUndoRecord {
  readonly mutationType: "create" | "update" | "delete" | "status" | "bulk";
  readonly previousManifest?: SwarmTaskManifest;
  readonly nextManifest?: SwarmTaskManifest;
  readonly previousManifests?: readonly SwarmTaskManifest[];
  readonly nextManifests?: readonly SwarmTaskManifest[];
  readonly timestampMs: number;
}

export interface SwarmDslQueryFilter {
  readonly rawQuery: string;
  readonly status?: SwarmTaskStatus;
  readonly depth?: number;
  readonly parentTaskId?: string;
  readonly healthStatus?: SwarmHealthStatus;
  readonly tags?: readonly string[];
  readonly hasWorktree?: boolean;
  readonly textTerms?: readonly string[];
}

export interface SwarmBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly updatedTaskIds: readonly string[];
}

export interface SwarmStateSnapshot {
  readonly tasks: readonly SwarmTaskManifest[];
  readonly outcomes: readonly DelegationOutcome[];
  readonly timestamp: number;
  readonly snapshotTick: number;
}

// ---------------------------------------------------------------------------
// BroccoliDB Table Row Schemas
// ---------------------------------------------------------------------------

export interface SwarmTaskRow {
  readonly id: string;
  readonly parentTaskId?: string;
  readonly depth: number;
  readonly goal: string;
  readonly status: SwarmTaskStatus;
  readonly remainingIterations: number;
  readonly remainingTokens: number;
  readonly worktreePath?: string;
  readonly tags: string;
  readonly updatedAtMs: number;
  readonly [key: string]: unknown;
}

export interface SwarmOutcomeRow {
  readonly id: string;
  readonly taskId: string;
  readonly success: boolean;
  readonly toolCallsCount: number;
  readonly tokenUsage: number;
  readonly durationMs: number;
  readonly summary: string;
  readonly auditedBy: string;
  readonly [key: string]: unknown;
}

export interface SwarmWorktreeRow {
  readonly id: string;
  readonly branchName: string;
  readonly worktreePath: string;
  readonly baseCommitSha?: string;
  readonly isTemporary: boolean;
  readonly [key: string]: unknown;
}

export interface SwarmNotificationRow {
  readonly id: string;
  readonly taskId?: string;
  readonly title: string;
  readonly trigger: SwarmNotificationTrigger;
  readonly urgency: SwarmNotificationUrgency;
  readonly dispatchedAtMs: number;
  readonly read: boolean;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Core Interfaces
// ---------------------------------------------------------------------------

export interface ISwarmDelegator {
  delegateTask(manifest: Omit<SwarmTaskManifest, "status" | "createdTick">): Promise<DelegationOutcome>;
  delegateBatch(tasks: readonly Omit<SwarmTaskManifest, "status" | "createdTick">[]): Promise<BatchDelegationResult>;
  getTaskStatus(taskId: string): SwarmTaskStatus | undefined;
  abortTask(taskId: string, reason: string): boolean;
}

export interface IWorktreeManager {
  createIsolatedWorktree(spec: WorktreeIsolationSpec): Promise<{ success: boolean; path?: string; error?: string }>;
  mergeWorktreeChanges(branchName: string): Promise<{ success: boolean; commitSha?: string; filesChanged: readonly string[]; error?: string }>;
  cleanupWorktree(worktreePath: string): Promise<{ success: boolean; error?: string }>;
}

export interface ISubagentVfsBrancher {
  createBranchOverlay(parentSessionId: string, subagentSessionId: string): void;
  commitBranchOverlay(subagentSessionId: string): readonly string[];
  discardBranchOverlay(subagentSessionId: string): void;
}

export interface ISubagentBudgetGovernor {
  allocateBudget(taskManifest: SwarmTaskManifest): SubagentBudget;
  consumeTurn(taskId: string, tokensUsed: number): { allowed: boolean; remainingBudget: SubagentBudget; reason?: string };
}

export interface IBroccoliSwarmSubstrate {
  storeTask(task: SwarmTaskManifest): void;
  getTask(taskId: string): SwarmTaskManifest | undefined;
  deleteTask(taskId: string): boolean;
  listTasks(statusFilter?: SwarmTaskStatus): readonly SwarmTaskManifest[];
  recordOutcome(outcome: DelegationOutcome): void;
  getOutcomes(taskId?: string, limit?: number): readonly DelegationOutcome[];
  clear(): void;
}

export interface ISwarmSnapshotManager {
  createSnapshot(snapshotTick: number): SwarmStateSnapshot;
  restoreSnapshot(snapshot: SwarmStateSnapshot): void;
}
