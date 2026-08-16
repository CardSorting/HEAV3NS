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
}

export interface DeadlineConfig {
  defaultTimeoutMs: number;
  maxSafeTimeoutMs: number;
  enforceEstopOnNewWork: boolean;
  sentinelFilename: string;
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
}

export const MAX_SAFE_TIMEOUT_MS = 31_536_000_000; // 365 days

export const DEFAULT_DEADLINE_CONFIG: DeadlineConfig = {
  defaultTimeoutMs: 30000,
  maxSafeTimeoutMs: MAX_SAFE_TIMEOUT_MS,
  enforceEstopOnNewWork: true,
  sentinelFilename: "ESTOP",
};
