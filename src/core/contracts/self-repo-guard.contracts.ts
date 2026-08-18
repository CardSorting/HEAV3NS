/**
 * self-repo-guard.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Deterministic Self-Repository Mutation Guard,
 * Shell Worktree Context Tracker & Module-Skew Firewall Subsystem (Phase 138 / ADR-114 / Target #78).
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

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Row Schemas
// ---------------------------------------------------------------------------

export interface SelfRepoGuardIncidentRow {
  incidentId: string;
  command: string;
  targetPath: string;
  runningRoot: string;
  operation: string;
  reason: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface SelfRepoGuardAuditRow {
  auditId: string;
  totalIncidents: number;
  totalBlocked: number;
  totalPassed: number;
  healthStatus: SelfRepoGuardHealthStatus;
  timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Health Matrix & Telemetry Reports
// ---------------------------------------------------------------------------

export type SelfRepoGuardHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface SelfRepoGuardHealthAuditReport {
  totalCommandsInspected: number;
  destructiveGitMutationsBlocked: number;
  safeGitOperationsPassed: number;
  foreignRepoMutationsAllowed: number;
  healthStatus: SelfRepoGuardHealthStatus;
  recommendations: string[];
}

export interface SelfRepoGuardMetricsReport {
  totalCommandsInspected: number;
  destructiveGitMutationsBlocked: number;
  safeGitOperationsPassed: number;
  foreignRepoMutationsAllowed: number;
  blockRatePercent: number;
  incidentsByOperation: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Swimlane Grouping
// ---------------------------------------------------------------------------

export type SelfRepoGuardGroupBy = "operation" | "targetPath" | "runningRoot";
export type SelfRepoGuardSortBy = "timestamp" | "operation" | "command";
export type SelfRepoGuardSortDirection = "asc" | "desc";

export interface SelfRepoGuardGroupedLane {
  key: string;
  title: string;
  count: number;
  incidents: readonly SelfRepoGuardIncidentRow[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search
// ---------------------------------------------------------------------------

export interface SelfRepoGuardDslQueryFilter {
  rawQuery?: string;
  operation?: string;
  targetPath?: string;
  textTerms?: string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Bulk Operations
// ---------------------------------------------------------------------------

export interface SelfRepoGuardMutationUndoRecord {
  mutationType: "add_incident" | "bulk_purge" | "clear" | "config_change";
  previousSnapshot: SelfRepoGuardWorkspaceSnapshot;
  nextSnapshot: SelfRepoGuardWorkspaceSnapshot;
  timestampMs: number;
}

export interface SelfRepoGuardBulkMutationResult {
  matchedCount: number;
  modifiedCount: number;
  affectedIncidentIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Core Interface
// ---------------------------------------------------------------------------

export interface IBroccoliSelfRepoGuardSubstrate {
  recordIncident(incident: SelfRepoGuardIncidentRow): void;
  getIncident(id: string): SelfRepoGuardIncidentRow | undefined;
  listIncidents(): readonly SelfRepoGuardIncidentRow[];
  removeIncident(id: string): boolean;
  clear(): void;

  auditHealth(): SelfRepoGuardHealthAuditReport;
  getMetrics(): SelfRepoGuardMetrics;
  getMetricsReport(): SelfRepoGuardMetricsReport;
  getGroupedIncidents(
    groupBy?: SelfRepoGuardGroupBy,
    sortBy?: SelfRepoGuardSortBy,
    direction?: SelfRepoGuardSortDirection
  ): readonly SelfRepoGuardGroupedLane[];
  queryIncidentsDsl(query: SelfRepoGuardDslQueryFilter | string): readonly SelfRepoGuardIncidentRow[];

  bulkPurgeIncidents(ids: readonly string[]): SelfRepoGuardBulkMutationResult;

  undo(): boolean;
  redo(): boolean;

  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;

  exportSnapshot(): SelfRepoGuardWorkspaceSnapshot;
  importSnapshot(snapshot: SelfRepoGuardWorkspaceSnapshot): void;
}
