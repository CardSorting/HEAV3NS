/**
 * Credential Pool & Rate Governor Contracts
 *
 * Defines typed contracts, schemas, and interfaces for the Deterministic
 * Token-Bucket Credential Pool Rotation & Circuit Breaker subsystem (K_cred).
 */

export type CredentialStatus = "healthy" | "cooldown" | "exhausted" | "dead";
export type CredentialRotationStrategy = "round_robin" | "least_utilized" | "priority_failover";

export interface TokenBucketState {
  readonly maxTokens: number;
  readonly remainingTokens: number;
  readonly refillRatePerMinute: number;
  readonly maxRequests: number;
  readonly remainingRequests: number;
  readonly lastRefillTimestampMs: number;
}

export interface CredentialAccount {
  readonly id: string;
  readonly provider: string;
  readonly accountLabel: string;
  readonly apiKeyMasked: string;
  readonly status: CredentialStatus;
  readonly priority: number;
  readonly weight: number;
  readonly totalRequestsServed: number;
  readonly totalTokensConsumed: number;
  readonly consecutiveFailures: number;
  readonly cooldownUntilTimestampMs?: number;
  readonly deadReason?: string;
  readonly tokenBucket: TokenBucketState;
  readonly createdTimestampMs: number;
}

export interface CredentialStateSnapshot {
  readonly accounts: readonly CredentialAccount[];
  readonly activeAccountId?: string;
  readonly strategy: CredentialRotationStrategy;
  readonly totalRotations: number;
  readonly snapshotTick: number;
}

export interface ICredentialPool {
  addAccount(account: Omit<CredentialAccount, "totalRequestsServed" | "totalTokensConsumed" | "consecutiveFailures" | "status" | "tokenBucket" | "createdTimestampMs">): CredentialAccount;
  removeAccount(accountId: string): void;
  getAccount(accountId: string): CredentialAccount | undefined;
  listAccounts(provider?: string): readonly CredentialAccount[];
  selectAccount(provider: string, requiredTokens?: number): { account?: CredentialAccount; reason?: string };
  recordUsage(accountId: string, tokensUsed: number): void;
  recordSuccess(accountId: string): void;
  recordFailure(accountId: string, errorReason: string, isRateLimit?: boolean): { newStatus: CredentialStatus; cooldownMs?: number };
}

export interface IBroccoliCredentialSubstrate {
  addAccount(account: CredentialAccount): void;
  updateAccount(account: CredentialAccount): void;
  removeAccount(accountId: string): void;
  getAccount(accountId: string): CredentialAccount | undefined;
  listAccounts(provider?: string): readonly CredentialAccount[];
  clear(): void;
}

export interface ICredentialSnapshotManager {
  createSnapshot(tick: number): CredentialStateSnapshot;
  restoreSnapshot(snapshot: CredentialStateSnapshot): void;
}
