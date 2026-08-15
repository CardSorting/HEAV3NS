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
  readonly createdTick: number;
  readonly completedTick?: number;
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
