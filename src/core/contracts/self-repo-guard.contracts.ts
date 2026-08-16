/**
 * self-repo-guard.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Deterministic Self-Repository Mutation Guard,
 * Shell Worktree Context Tracker & Module-Skew Firewall Subsystem (Phase 138 / ADR-114 / Target #71).
 */

export type GitOperationSafety =
  | "safe_read"
  | "safe_staged"
  | "destructive_worktree"
  | "unknown";

export interface SelfRepoGuardVerdict {
  allowed: boolean;
  operation?: string;
  targetPath?: string;
  runningRoot?: string;
  reason?: string;
  suggestedRemediation?: string;
}

export interface SelfRepoGuardConfig {
  enabled: boolean;
  enforceStrictRootProtection: boolean;
  runningSourceRoot?: string;
  allowWorktreeSandboxes: boolean;
}

export interface SelfRepoGuardMetrics {
  totalCommandsInspected: number;
  destructiveGitMutationsBlocked: number;
  safeGitOperationsPassed: number;
  foreignRepoMutationsAllowed: number;
}

export interface SelfRepoGuardIncident {
  incidentId: string;
  timestamp: number;
  command: string;
  targetPath: string;
  runningRoot: string;
  operation: string;
  reason: string;
}

export interface SelfRepoGuardWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: SelfRepoGuardConfig;
  metrics: SelfRepoGuardMetrics;
  incidents: readonly SelfRepoGuardIncident[];
}

export const WORKTREE_MUTATING_GIT_COMMANDS = new Set<string>([
  "checkout",
  "switch",
  "rebase",
  "merge",
  "pull",
  "restore",
  "clean",
  "cherry-pick",
  "revert",
  "bisect",
]);

export const WORKTREE_TARGET_ACTIONS = new Set<string>([
  "move",
  "remove",
]);

export const STASH_SAFE_ACTIONS = new Set<string>([
  "list",
  "show",
  "create",
  "store",
  "drop",
  "clear",
]);

export const RESET_WORKTREE_MODES = new Set<string>([
  "--hard",
  "--merge",
  "--keep",
]);

export const SAFE_GIT_BUILTINS = new Set<string>([
  "status",
  "diff",
  "log",
  "show",
  "branch",
  "tag",
  "blame",
  "rev-parse",
  "rev-list",
  "ls-files",
  "grep",
  "fetch",
  "commit",
  "add",
]);

export const DEFAULT_SELF_REPO_GUARD_CONFIG: SelfRepoGuardConfig = {
  enabled: true,
  enforceStrictRootProtection: true,
  allowWorktreeSandboxes: true,
};
