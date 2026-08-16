/**
 * worktree.contracts.ts
 *
 * Core contracts, interfaces, and invariants for
 * Git Worktree Isolation, Multi-Agent Branch Sandboxing & Workspace Governance
 * (Phase 123 / ADR-099 / Target #56).
 */

export type WorktreeStatus =
  | "active"
  | "clean"
  | "dirty"
  | "committed"
  | "merged"
  | "pruned";

export interface WorktreeDescriptor {
  id: string;
  subagentId: string;
  branch: string;
  path: string;
  repoRoot: string;
  baseCommit: string;
  commitCount: number;
  isDirty: boolean;
  modifiedFiles: readonly string[];
  status: WorktreeStatus;
  createdAt: number;
  lastInspectedAt?: number;
}

export interface WorktreeConfig {
  enabled: boolean;
  worktreeDir: string;
  branchPrefix: string;
  autoPruneClean: boolean;
  timeoutMs: number;
}

export interface WorktreeMetrics {
  totalCreated: number;
  totalPruned: number;
  totalMerged: number;
  activeCount: number;
}

export interface WorktreeWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  worktrees: readonly WorktreeDescriptor[];
  metrics: WorktreeMetrics;
}

export const DEFAULT_WORKTREE_CONFIG: WorktreeConfig = {
  enabled: true,
  worktreeDir: ".worktrees",
  branchPrefix: "lumi-subagent",
  autoPruneClean: true,
  timeoutMs: 30000,
};
