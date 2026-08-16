/**
 * turn-retry.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Turn Retry State Machine,
 * One-Shot Recovery Guards & Adaptive Payload Restart Subsystem
 * (Phase 131 / ADR-107 / Target #64).
 */

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

export interface TurnRetryStateDescriptor {
  stateId: string;
  turnIndex: number;
  attemptIndex: number;
  timestamp: number;
  guards: TurnRetryGuards;
  restartSignals: TurnRestartSignals;
  history: Array<{
    timestamp: number;
    action: "guard_triggered" | "signal_set" | "reset";
    key: string;
    details?: string;
  }>;
}

export interface TurnRetryConfig {
  maxRetriesPerTurn: number;
  maxCompressionAttempts: number;
  allowedRecoveryBranches: TurnRecoveryBranch[];
}

export interface TurnRetryMetrics {
  totalStatesCreated: number;
  totalGuardsTriggered: number;
  totalSignalsEmitted: number;
  guardTriggerCounts: Record<string, number>;
  signalTriggerCounts: Record<string, number>;
}

export interface TurnRetryWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: TurnRetryConfig;
  metrics: TurnRetryMetrics;
  activeState?: TurnRetryStateDescriptor;
  archivedStates: TurnRetryStateDescriptor[];
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
