/**
 * turn-retry.contracts.ts
 *
 * Core data contracts, interfaces, and invariants for Turn Retry State Machine,
 * One-Shot Recovery Guards & Adaptive Payload Restart Subsystem
 * (Phase 131 / ADR-107 / Target #64).
 */

export type TurnRetryErrorCategory =
  | "auth_expired"
  | "rate_limit_429"
  | "context_overflow"
  | "grammar_malformed"
  | "tool_call_invalid"
  | "network_timeout"
  | "general_fault";

export interface TurnRetryGuards {
  // Per-provider OAuth / credential refresh guards
  codexAuthRetryAttempted: boolean;
  anthropicAuthRetryAttempted: boolean;
  nousAuthRetryAttempted: boolean;
  nousPaidEntitlementRefreshAttempted: boolean;
  copilotAuthRetryAttempted: boolean;
  copilotStaleCredRetryAttempted: boolean;
  vertexAuthRetryAttempted: boolean;

  // Format / payload recovery guards
  thinkingSigRetryAttempted: boolean;
  invalidEncryptedContentRetryAttempted: boolean;
  nativeCompactionRejectRetryAttempted: boolean;
  imageShrinkRetryAttempted: boolean;
  multimodalToolContentRetryAttempted: boolean;
  oauth1mBetaRetryAttempted: boolean;
  llamaCppGrammarRetryAttempted: boolean;

  // Transport / rate-limit recovery
  primaryRecoveryAttempted: boolean;
  hasRetried429: boolean;

  // Auth-failure provider failover
  authFailoverAttempted: boolean;
}

export interface TurnRestartSignals {
  restartWithCompressedMessages: boolean;
  restartWithLengthContinuation: boolean;
  restartWithRebuiltMessages: boolean;
  restartWithRedirectedMessages: boolean;
}

export type TurnRecoveryBranch = keyof TurnRetryGuards;
export type TurnRestartSignalKey = keyof TurnRestartSignals;

export interface TurnRetryHistoryEntry {
  readonly timestamp: number;
  readonly action: "guard_triggered" | "signal_set" | "reset" | "attempt_recovered" | "attempt_failed";
  readonly key: string;
  readonly details?: string;
}

export interface TurnRetryStateDescriptor {
  readonly stateId: string;
  readonly turnIndex: number;
  readonly attemptIndex: number;
  readonly timestamp: number;
  readonly status: "active" | "recovered" | "exhausted" | "cancelled";
  readonly errorCategory?: TurnRetryErrorCategory;
  readonly guards: TurnRetryGuards;
  readonly restartSignals: TurnRestartSignals;
  readonly history: readonly TurnRetryHistoryEntry[];
}

export interface TurnRetryAttemptRecord {
  readonly attemptId: string;
  readonly stateId: string;
  readonly turnIndex: number;
  readonly attemptIndex: number;
  readonly errorCategory: TurnRetryErrorCategory;
  readonly errorMessage: string;
  readonly guardTriggered?: TurnRecoveryBranch;
  readonly signalEmitted?: TurnRestartSignalKey;
  readonly success: boolean;
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface TurnRetryConfig {
  readonly maxRetriesPerTurn: number;
  readonly maxCompressionAttempts: number;
  readonly allowedRecoveryBranches: readonly TurnRecoveryBranch[];
}

export interface TurnRetryMetrics {
  readonly totalStatesCreated: number;
  readonly totalGuardsTriggered: number;
  readonly totalSignalsEmitted: number;
  readonly guardTriggerCounts: Record<string, number>;
  readonly signalTriggerCounts: Record<string, number>;
  readonly recoverySuccessRate: number; // 0.0 - 1.0
  readonly avgRecoveryDurationMs: number;
}

export interface TurnRetryWorkspaceSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly config: TurnRetryConfig;
  readonly metrics: TurnRetryMetrics;
  readonly activeState?: TurnRetryStateDescriptor;
  readonly states: readonly TurnRetryStateDescriptor[];
  readonly attempts: readonly TurnRetryAttemptRecord[];
  readonly archivedStates: readonly TurnRetryStateDescriptor[];
}

export const DEFAULT_TURN_RETRY_GUARDS: TurnRetryGuards = {
  codexAuthRetryAttempted: false,
  anthropicAuthRetryAttempted: false,
  nousAuthRetryAttempted: false,
  nousPaidEntitlementRefreshAttempted: false,
  copilotAuthRetryAttempted: false,
  copilotStaleCredRetryAttempted: false,
  vertexAuthRetryAttempted: false,
  thinkingSigRetryAttempted: false,
  invalidEncryptedContentRetryAttempted: false,
  nativeCompactionRejectRetryAttempted: false,
  imageShrinkRetryAttempted: false,
  multimodalToolContentRetryAttempted: false,
  oauth1mBetaRetryAttempted: false,
  llamaCppGrammarRetryAttempted: false,
  primaryRecoveryAttempted: false,
  hasRetried429: false,
  authFailoverAttempted: false,
};

export const DEFAULT_TURN_RESTART_SIGNALS: TurnRestartSignals = {
  restartWithCompressedMessages: false,
  restartWithLengthContinuation: false,
  restartWithRebuiltMessages: false,
  restartWithRedirectedMessages: false,
};

export const DEFAULT_TURN_RETRY_CONFIG: TurnRetryConfig = {
  maxRetriesPerTurn: 5,
  maxCompressionAttempts: 3,
  allowedRecoveryBranches: Object.keys(DEFAULT_TURN_RETRY_GUARDS) as TurnRecoveryBranch[],
};

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface TurnRetryStateRow {
  readonly id: string;
  readonly turnIndex: number;
  readonly attemptIndex: number;
  readonly status: string;
  readonly errorCategory?: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface TurnRetryAttemptRow {
  readonly id: string;
  readonly stateId: string;
  readonly turnIndex: number;
  readonly attemptIndex: number;
  readonly errorCategory: string;
  readonly errorMessage: string;
  readonly guardTriggered?: string;
  readonly signalEmitted?: string;
  readonly success: boolean;
  readonly durationMs: number;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface TurnRetryAuditRow {
  readonly id: string;
  readonly stateId: string;
  readonly action: string;
  readonly operator: string;
  readonly details: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Metrics Telemetry
// ---------------------------------------------------------------------------

export type TurnRetryHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "exhausted_warning";

export interface TurnRetryHealthAuditReport {
  readonly totalStates: number;
  readonly activeStates: number;
  readonly recoveredCount: number;
  readonly exhaustedCount: number;
  readonly recoverySuccessRate: number; // 0.0 - 1.0
  readonly guardExhaustionIndex: number; // 0.0 - 1.0
  readonly avgRecoveryDurationMs: number;
  readonly healthStatus: TurnRetryHealthStatus;
  readonly recommendations: readonly string[];
}

export interface TurnRetryMetricsReport {
  readonly totalStates: number;
  readonly activeStates: number;
  readonly recoveredCount: number;
  readonly exhaustedCount: number;
  readonly totalGuardsTriggered: number;
  readonly totalSignalsEmitted: number;
  readonly recoverySuccessRate: number;
  readonly avgRecoveryDurationMs: number;
  readonly topTriggeredGuards: readonly { guard: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type TurnRetryGroupBy = "status" | "errorCategory" | "turnIndex";

export type TurnRetrySortBy = "timestamp" | "attemptIndex" | "turnIndex";

export type TurnRetrySortDirection = "asc" | "desc";

export interface TurnRetryGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly recoveryRate: number;
  readonly states: readonly TurnRetryStateDescriptor[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface TurnRetryDslQueryFilter {
  readonly rawQuery: string;
  readonly turnIndex?: number;
  readonly status?: TurnRetryStateDescriptor["status"];
  readonly errorCategory?: TurnRetryErrorCategory;
  readonly guard?: TurnRecoveryBranch;
  readonly signal?: TurnRestartSignalKey;
  readonly minAttempts?: number;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface TurnRetryMutationUndoRecord {
  readonly mutationType: "create_state" | "trigger_guard" | "set_signal" | "recover" | "reset" | "bulk";
  readonly previousSnapshot: TurnRetryWorkspaceSnapshot;
  readonly nextSnapshot: TurnRetryWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface TurnRetryBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedStateIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliTurnRetrySubstrate {
  recordState(state: TurnRetryStateDescriptor): void;
  getState(stateId: string): TurnRetryStateDescriptor | undefined;
  listStates(limit?: number): readonly TurnRetryStateDescriptor[];
  recordAttempt(attempt: TurnRetryAttemptRecord): void;
  listAttempts(stateId?: string, limit?: number): readonly TurnRetryAttemptRecord[];
  updateStateStatus(stateId: string, status: TurnRetryStateDescriptor["status"]): boolean;
  getTurnRetryMetrics(): TurnRetryMetricsReport;
  auditTurnRetryHealth(): TurnRetryHealthAuditReport;
  getGroupedStates(groupBy?: TurnRetryGroupBy, sortBy?: TurnRetrySortBy, direction?: TurnRetrySortDirection): readonly TurnRetryGroupedLane[];
  queryStatesDsl(query: TurnRetryDslQueryFilter | string): readonly TurnRetryStateDescriptor[];
  bulkResetStates(stateIds: readonly string[]): TurnRetryBulkMutationResult;
  bulkClearGuards(stateIds: readonly string[]): TurnRetryBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): TurnRetryWorkspaceSnapshot;
  importSnapshot(snapshot: TurnRetryWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
