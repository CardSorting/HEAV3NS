/**
 * Fault Recovery & Error Taxonomy Contracts
 *
 * Defines typed schemas and interfaces for Intelligent Provider Error Classification,
 * Deterministic Jittered Backoff, and Automated Fault Recovery (K_err).
 */

export type FaultCategory =
  | "auth_transient"
  | "auth_permanent"
  | "rate_limit"
  | "upstream_rate_limit"
  | "billing_exhausted"
  | "context_overflow"
  | "payload_oversize"
  | "model_unavailable"
  | "overloaded_server"
  | "network_timeout"
  | "ssl_failure"
  | "schema_rejected"
  | "content_policy_blocked"
  | "unknown";

export type RecoveryDirectiveType =
  | "retry_backoff"
  | "rotate_credential"
  | "fallback_model"
  | "compress_context"
  | "strip_schema"
  | "abort_fail_fast";

export interface ClassifiedFault {
  readonly category: FaultCategory;
  readonly directive: RecoveryDirectiveType;
  readonly statusCode?: number;
  readonly provider?: string;
  readonly model?: string;
  readonly errorCode?: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly suggestedBackoffMs: number;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type JitterMode = "none" | "full" | "equal" | "decorrelated";

export interface BackoffPolicySpec {
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly multiplier: number;
  readonly jitterMode: JitterMode;
  readonly maxAttempts: number;
}

export interface ProviderHealthRecord {
  readonly provider: string;
  readonly totalRequests: number;
  readonly totalFaults: number;
  readonly consecutiveFailures: number;
  readonly lastFaultCategory?: FaultCategory;
  readonly lastFaultTimestamp: number;
  readonly isCoolingDown: boolean;
  readonly cooldownUntilTimestamp: number;
}

export interface FaultTaxonomyStateSnapshot {
  readonly providerHealth: readonly ProviderHealthRecord[];
  readonly totalClassifiedFaults: number;
  readonly snapshotTick: number;
}

export interface IDeterministicErrorClassifier {
  classify(
    error: unknown,
    options?: {
      provider?: string;
      model?: string;
      statusCode?: number;
      headers?: Record<string, string | string[] | undefined>;
    }
  ): ClassifiedFault;
}

export interface IJitteredBackoffGovernor {
  calculateBackoffMs(attempt: number, policy?: Partial<BackoffPolicySpec>, retryAfterHeader?: string | number): number;
}

export interface IBroccoliFaultSubstrate {
  recordFault(provider: string, category: FaultCategory, cooldownMs?: number): void;
  recordSuccess(provider: string): void;
  getProviderHealth(provider: string): ProviderHealthRecord | undefined;
  listProviderHealth(): readonly ProviderHealthRecord[];
  getTotalFaultCount(): number;
  clear(): void;
}

export interface IFaultSnapshotManager {
  createSnapshot(tick: number): FaultTaxonomyStateSnapshot;
  restoreSnapshot(snapshot: FaultTaxonomyStateSnapshot): void;
}

export interface IFaultRecoverySupervisor {
  evaluateRecovery(
    error: unknown,
    context?: {
      provider?: string;
      model?: string;
      attemptCount?: number;
      statusCode?: number;
      headers?: Record<string, string | string[] | undefined>;
    }
  ): ClassifiedFault;
}
