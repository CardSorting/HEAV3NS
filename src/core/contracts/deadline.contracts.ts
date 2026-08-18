/**
 * deadline.contracts.ts
 *
 * Core contracts, interfaces, and invariants for
 * Unified Deadline Engine, Bounded Execution & Emergency Stop Governance
 * (Phase 125 / ADR-101 / Target #58).
 */

export type DeadlineOutcome =
  | "completed"
  | "timed_out"
  | "aborted"
  | "estopped";

export type DeadlineLeaseStatus =
  | "active"
  | "completed"
  | "timed_out"
  | "aborted"
  | "estopped";

export interface DeadlineLease {
  leaseId: string;
  actionName: string;
  agentId: string;
  timeoutMs: number;
  deadlineTimestamp: number;
  status: DeadlineLeaseStatus;
  outcome?: DeadlineOutcome;
  durationMs?: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface BoundedResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
  outcome: DeadlineOutcome;
  timedOut: boolean;
}

export interface EstopState {
  engaged: boolean;
  reason?: string;
  engagedAt?: number;
  engagedBy?: string;
  targetScope?: string;
}

export interface DeadlineConfig {
  defaultTimeoutMs: number;
  maxSafeTimeoutMs: number;
  enforceEstopOnNewWork: boolean;
  sentinelFilename: string;
  maxConcurrentLeases?: number;
  defaultPriority?: number;
}

export interface DeadlineMetrics {
  totalExecutions: number;
  timeoutsEncountered: number;
  estopEngagements: number;
  estopRejections: number;
  activeLeases: number;
}

export interface DeadlineWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  estop: EstopState;
  metrics: DeadlineMetrics;
  leases?: readonly DeadlineLease[];
  config?: DeadlineConfig;
}

export const MAX_SAFE_TIMEOUT_MS = 31_536_000_000; // 365 days

export const DEFAULT_DEADLINE_CONFIG: DeadlineConfig = {
  defaultTimeoutMs: 30000,
  maxSafeTimeoutMs: MAX_SAFE_TIMEOUT_MS,
  enforceEstopOnNewWork: true,
  sentinelFilename: "ESTOP",
  maxConcurrentLeases: 1000,
  defaultPriority: 5,
};

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface DeadlineLeaseRow {
  id: string;
  actionName: string;
  agentId: string;
  timeoutMs: number;
  deadlineTimestamp: number;
  status: DeadlineLeaseStatus;
  durationMs: number;
  createdAt: number;
  readonly [key: string]: unknown;
}

export interface DeadlineTimeoutRow {
  id: string;
  leaseId: string;
  actionName: string;
  timeoutMs: number;
  durationMs: number;
  timestamp: number;
  readonly [key: string]: unknown;
}

export interface DeadlineEstopRow {
  id: string;
  engaged: boolean;
  reason: string;
  engagedBy: string;
  engagedAt: number;
  disengagedAt?: number;
  targetScope?: string;
  readonly [key: string]: unknown;
}

export interface DeadlineAuditRow {
  id: string;
  action: string;
  operator: string;
  reason: string;
  timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Budget Diagnostics
// ---------------------------------------------------------------------------

export type DeadlineHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "estop_locked";

export interface DeadlineHealthAuditReport {
  totalExecutions: number;
  timeoutsEncountered: number;
  estopEngagements: number;
  estopRejections: number;
  activeLeases: number;
  healthStatus: DeadlineHealthStatus;
  slaBreachCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  recommendations: readonly string[];
}

export interface DeadlineMetricsReport {
  totalExecutions: number;
  timeoutsEncountered: number;
  estopEngagements: number;
  estopRejections: number;
  activeLeases: number;
  throughputOpsPerSec: number;
  p50DurationMs: number;
  p95DurationMs: number;
  timeoutRatePercent: number;
  estopUptimeRatio: number;
  statusCounts: Record<DeadlineLeaseStatus, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type DeadlineGroupBy =
  | "status"
  | "outcome"
  | "urgency"
  | "agent";

export type DeadlineSortBy =
  | "duration"
  | "timeout"
  | "timestamp";

export type DeadlineSortDirection = "asc" | "desc";

export interface DeadlineGroupedLane {
  key: string;
  title: string;
  count: number;
  leases: readonly DeadlineLease[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface DeadlineDslQueryFilter {
  rawQuery: string;
  status?: DeadlineLeaseStatus;
  outcome?: DeadlineOutcome;
  agentId?: string;
  minTimeoutMs?: number;
  maxTimeoutMs?: number;
  timedOut?: boolean;
  textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Results
// ---------------------------------------------------------------------------

export interface DeadlineMutationUndoRecord {
  mutationType: "acquire" | "release" | "renew" | "abort" | "estop_engage" | "estop_disengage" | "bulk";
  previousSnapshot: DeadlineWorkspaceSnapshot;
  nextSnapshot: DeadlineWorkspaceSnapshot;
  timestampMs: number;
}

export interface DeadlineBulkMutationResult {
  matchedCount: number;
  modifiedCount: number;
  updatedLeaseIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliDeadlineSubstrate {
  setConfig(config: Partial<DeadlineConfig>): void;
  getConfig(): DeadlineConfig;
  getEstopState(): EstopState;
  setEstop(engaged: boolean, reason?: string, engagedBy?: string, targetScope?: string): void;
  acquireLease(actionName: string, timeoutMs: number, agentId?: string, metadata?: Record<string, unknown>): DeadlineLease;
  renewLease(leaseId: string, extensionMs: number): DeadlineLease | undefined;
  releaseLease(leaseId: string, outcome?: DeadlineOutcome, durationMs?: number): boolean;
  abortLease(leaseId: string, reason?: string): boolean;
  getLease(leaseId: string): DeadlineLease | undefined;
  listLeases(statusFilter?: DeadlineLeaseStatus): readonly DeadlineLease[];
  getMetrics(): DeadlineMetrics;
  getDeadlineMetrics(): DeadlineMetricsReport;
  auditDeadlineHealth(): DeadlineHealthAuditReport;
  getGroupedDeadlines(groupBy?: DeadlineGroupBy, sortBy?: DeadlineSortBy, direction?: DeadlineSortDirection): readonly DeadlineGroupedLane[];
  queryDeadlinesDsl(query: DeadlineDslQueryFilter | string): readonly DeadlineLease[];
  bulkReleaseLeases(leaseIds: readonly string[]): DeadlineBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  createSnapshot(snapshotId: string): DeadlineWorkspaceSnapshot;
  restoreSnapshot(snapshot: DeadlineWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
