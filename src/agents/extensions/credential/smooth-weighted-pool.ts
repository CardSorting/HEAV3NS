/**
 * LUMI-NEW: Smooth Weighted Round-Robin (SWRR) Credential Fleet & Quota Guard
 *
 * Implements:
 * 1. NGINX / LiteLLM Smooth Weighted Round-Robin (SWRR) algorithm.
 * 2. 4th-Degree Polynomial Soft-Draining Quota Guard (40 req / 3 hr).
 * 3. Session-Sticky Prompt Cache Preservation (15-min KV cache TTL).
 * 4. 6-State Axiomatic Circuit Breaker with Anti-Flapping Hysteresis.
 * 5. Continuous mathematical token bucket (RPM & TPM) refills.
 */

export type PooledTokenStatus =
  | 'healthy'
  | 'soft_draining'
  | 'cooldown'
  | 'half_open'
  | 'exhausted'
  | 'dead';

export interface TokenBucketState {
  maxTokens: number;
  remainingTokens: number;
  refillRatePerMinute: number;
  maxRequests: number;
  remainingRequests: number;
  lastRefillTimestampMs: number;
}

export interface PooledTokenAccount {
  id: string;
  accessToken: string;
  refreshToken?: string;
  accountId?: string;
  email?: string;
  baseWeight: number;
  effectiveWeight: number;
  currentWeight: number;
  priority: number;
  status: PooledTokenStatus;
  consecutiveFailures: number;
  consecutiveCanaryPasses: number;
  cooldownUntilTimestampMs?: number;
  totalRequestsServed: number;
  totalTokensConsumed: number;
  maxRequestsPerWindow: number;
  windowDurationMs: number;
  requestHistoryTimestampsMs: number[];
  tokenBucket: TokenBucketState;
  createdTimestampMs: number;
}

export interface AccountSelectionResult {
  account?: PooledTokenAccount;
  sticky: boolean;
  reason?: string;
  activeFleetSize: number;
}

export interface TokenIngestInput {
  id?: string;
  accessToken: string;
  refreshToken?: string;
  accountId?: string;
  email?: string;
  weight?: number;
  priority?: number;
  maxRequestsPerWindow?: number;
  windowDurationHours?: number;
  maxTokensPerMinute?: number;
  maxRequestsPerMinute?: number;
}

export class SmoothWeightedPool {
  private accounts: Map<string, PooledTokenAccount> = new Map();
  private sessionAffinityMap: Map<string, { accountId: string; lastSeenMs: number }> = new Map();
  private readonly sessionTtlMs: number;
  private readonly maxSessionAffinities: number;

  constructor(sessionTtlMs = 15 * 60 * 1000, maxSessionAffinities = 10_000) {
    this.sessionTtlMs = this.boundedNumber(sessionTtlMs, 15 * 60 * 1000, 1_000, 24 * 60 * 60 * 1000);
    this.maxSessionAffinities = Math.floor(this.boundedNumber(maxSessionAffinities, 10_000, 1, 100_000));
  }

  private boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.min(maximum, Math.max(minimum, value))
      : fallback;
  }

  private validateOptionalText(value: unknown, field: string, maxLength: number): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
      throw new TypeError(`${field} must be a non-empty string no longer than ${maxLength} characters`);
    }
    return value;
  }

  private setSessionAffinity(sessionId: string, accountId: string, nowMs: number): void {
    if (sessionId.length > 256) return;
    if (this.sessionAffinityMap.size >= this.maxSessionAffinities && !this.sessionAffinityMap.has(sessionId)) {
      for (const [candidateId, affinity] of this.sessionAffinityMap) {
        if (nowMs - affinity.lastSeenMs >= this.sessionTtlMs) {
          this.sessionAffinityMap.delete(candidateId);
        }
      }
      if (this.sessionAffinityMap.size >= this.maxSessionAffinities) {
        const oldestSessionId = this.sessionAffinityMap.keys().next().value as string | undefined;
        if (oldestSessionId) this.sessionAffinityMap.delete(oldestSessionId);
      }
    }
    this.sessionAffinityMap.delete(sessionId);
    this.sessionAffinityMap.set(sessionId, { accountId, lastSeenMs: nowMs });
  }

  /**
   * Registers or updates a token account in the fleet.
   */
  public addTokenAccount(input: TokenIngestInput): PooledTokenAccount {
    if (!input || typeof input !== 'object') throw new TypeError('Token record must be an object');
    const accessToken = this.validateOptionalText(input.accessToken, 'accessToken', 32_768);
    if (!accessToken) throw new TypeError('accessToken is required');
    const suppliedId = this.validateOptionalText(input.id, 'id', 128);
    const id = suppliedId ?? `codex_sh_${crypto.randomUUID()}`;
    if (!/^[A-Za-z0-9._:-]+$/.test(id)) {
      throw new TypeError('id may contain only letters, digits, dot, underscore, colon, and hyphen');
    }
    const baseWeight = Math.floor(this.boundedNumber(input.weight, 1, 1, 1_000));
    const priority = Math.floor(this.boundedNumber(input.priority, 10, 0, 1_000));
    const maxRequestsPerWindow = Math.floor(this.boundedNumber(input.maxRequestsPerWindow, 40, 1, 1_000_000));
    const windowDurationHours = this.boundedNumber(input.windowDurationHours, 3, 1 / 60, 24 * 30);
    const windowDurationMs = windowDurationHours * 3_600_000;
    const maxTokens = Math.floor(this.boundedNumber(input.maxTokensPerMinute, 200_000, 1, 100_000_000));
    const maxRequests = Math.floor(this.boundedNumber(input.maxRequestsPerMinute, 500, 1, 1_000_000));

    const existing = this.accounts.get(id);
    const account: PooledTokenAccount = {
      id,
      accessToken,
      refreshToken: this.validateOptionalText(input.refreshToken, 'refreshToken', 32_768) ?? existing?.refreshToken,
      accountId: this.validateOptionalText(input.accountId, 'accountId', 256) ?? existing?.accountId,
      email: this.validateOptionalText(input.email, 'email', 320) ?? existing?.email,
      baseWeight,
      effectiveWeight: baseWeight,
      currentWeight: 0,
      priority,
      status: 'healthy',
      consecutiveFailures: 0,
      consecutiveCanaryPasses: 0,
      totalRequestsServed: existing?.totalRequestsServed ?? 0,
      totalTokensConsumed: existing?.totalTokensConsumed ?? 0,
      maxRequestsPerWindow,
      windowDurationMs,
      requestHistoryTimestampsMs: existing?.requestHistoryTimestampsMs ?? [],
      tokenBucket: existing?.tokenBucket ?? {
        maxTokens,
        remainingTokens: maxTokens,
        refillRatePerMinute: maxTokens,
        maxRequests,
        remainingRequests: maxRequests,
        lastRefillTimestampMs: Date.now(),
      },
      createdTimestampMs: existing?.createdTimestampMs ?? Date.now(),
    };

    this.accounts.set(id, account);
    return account;
  }

  public removeTokenAccount(id: string): boolean {
    const removed = this.accounts.delete(id);
    if (removed) {
      for (const [sessionId, affinity] of this.sessionAffinityMap) {
        if (affinity.accountId === id) this.sessionAffinityMap.delete(sessionId);
      }
    }
    return removed;
  }

  public resetCooldown(id: string): boolean {
    const acc = this.accounts.get(id);
    if (!acc) return false;
    acc.status = 'healthy';
    acc.consecutiveFailures = 0;
    acc.cooldownUntilTimestampMs = undefined;
    acc.effectiveWeight = acc.baseWeight;
    acc.tokenBucket.remainingRequests = Math.max(acc.tokenBucket.remainingRequests, 10);
    acc.tokenBucket.remainingTokens = Math.max(acc.tokenBucket.remainingTokens, 5000);
    return true;
  }

  public resetAllCooldowns(): number {
    let count = 0;
    for (const acc of this.accounts.values()) {
      if (acc.status === 'cooldown' || acc.status === 'dead' || acc.status === 'exhausted') {
        acc.status = 'healthy';
        acc.consecutiveFailures = 0;
        acc.cooldownUntilTimestampMs = undefined;
        acc.effectiveWeight = acc.baseWeight;
        acc.tokenBucket.remainingRequests = Math.max(acc.tokenBucket.remainingRequests, 10);
        acc.tokenBucket.remainingTokens = Math.max(acc.tokenBucket.remainingTokens, 5000);
        count++;
      }
    }
    return count;
  }

  public getAccount(id: string): PooledTokenAccount | undefined {
    return this.accounts.get(id);
  }

  public listAccounts(): PooledTokenAccount[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Continuous mathematical refill of token bucket.
   */
  private refillBucket(bucket: TokenBucketState, nowMs: number): TokenBucketState {
    const elapsedMs = Math.max(0, nowMs - bucket.lastRefillTimestampMs);
    if (elapsedMs === 0) return bucket;

    const elapsedMinutes = elapsedMs / 60000;
    const tokensToAdd = Math.floor(elapsedMinutes * bucket.refillRatePerMinute);
    const requestsToAdd = Math.floor(elapsedMinutes * bucket.maxRequests);

    return {
      ...bucket,
      remainingTokens: Math.min(bucket.maxTokens, bucket.remainingTokens + tokensToAdd),
      remainingRequests: Math.min(bucket.maxRequests, bucket.remainingRequests + requestsToAdd),
      lastRefillTimestampMs: nowMs,
    };
  }

  /**
   * Evaluates and updates the account's sliding window quota and effective weight.
   */
  private updateAccountQuotaAndWeight(account: PooledTokenAccount, nowMs: number): void {
    // 1. Purge expired timestamps from sliding window
    const cutoff = nowMs - account.windowDurationMs;
    account.requestHistoryTimestampsMs = account.requestHistoryTimestampsMs.filter((ts) => ts > cutoff);

    // 2. Cooldown recovery check
    if (account.status === 'cooldown' && account.cooldownUntilTimestampMs && nowMs >= account.cooldownUntilTimestampMs) {
      account.status = 'half_open';
      account.consecutiveCanaryPasses = 0;
    }

    if (account.status === 'dead') {
      account.effectiveWeight = 0;
      return;
    }

    if (account.status === 'cooldown') {
      account.effectiveWeight = 0;
      return;
    }

    // 3. Sliding window saturation check
    const activeRequests = account.requestHistoryTimestampsMs.length;
    const cap = account.maxRequestsPerWindow;
    const ratio = activeRequests / cap;

    if (ratio >= 1.0) {
      account.status = 'exhausted';
      account.effectiveWeight = 0;
      return;
    }

    // If previously exhausted and window opened up, recover
    if (account.status === 'exhausted' && ratio < 0.9) {
      account.status = 'healthy';
    }

    // 4. Smooth 4th-degree polynomial soft-draining derating curve
    if (ratio >= 0.85) {
      account.status = 'soft_draining';
      const derateMultiplier = Math.max(0.1, 1 - Math.pow(ratio, 4));
      account.effectiveWeight = Math.max(1, Math.floor(account.baseWeight * derateMultiplier));
    } else if (account.status !== 'half_open') {
      account.status = 'healthy';
      account.effectiveWeight = account.baseWeight;
    }
  }

  /**
   * Selects an account using Smooth Weighted Round-Robin (SWRR) with Session Affinity.
   */
  public selectAccount(sessionId?: string, requiredTokens = 100, nowMs = Date.now()): AccountSelectionResult {
    const all = Array.from(this.accounts.values());
    if (all.length === 0) {
      return { reason: 'No token accounts registered in pool', sticky: false, activeFleetSize: 0 };
    }

    // Update all accounts
    for (const acc of all) {
      this.updateAccountQuotaAndWeight(acc, nowMs);
      acc.tokenBucket = this.refillBucket(acc.tokenBucket, nowMs);
    }

    // 1. Check Session Sticky Anchor (KV Cache Preservation)
    if (sessionId) {
      const affinity = this.sessionAffinityMap.get(sessionId);
      if (affinity && nowMs - affinity.lastSeenMs < this.sessionTtlMs) {
        const stickyAcc = this.accounts.get(affinity.accountId);
        if (
          stickyAcc &&
          (stickyAcc.status === 'healthy' || stickyAcc.status === 'soft_draining') &&
          stickyAcc.tokenBucket.remainingTokens >= requiredTokens &&
          stickyAcc.tokenBucket.remainingRequests >= 1
        ) {
          affinity.lastSeenMs = nowMs;
          this.setSessionAffinity(sessionId, stickyAcc.id, nowMs);
          return { account: stickyAcc, sticky: true, activeFleetSize: all.length };
        }
      }
    }

    // 2. Filter eligible candidates
    const eligible = all.filter((acc) => {
      if (acc.status === 'dead' || acc.status === 'cooldown' || acc.status === 'exhausted') {
        return false;
      }
      if (acc.accessToken.startsWith('ey_sample_')) {
        return false; // Skip mock placeholder tokens
      }
      return acc.tokenBucket.remainingTokens >= requiredTokens && acc.tokenBucket.remainingRequests >= 1;
    });

    if (eligible.length === 0) {
      return {
        reason: 'All accounts in pool are in cooldown, exhausted, or token-bucket constrained',
        sticky: false,
        activeFleetSize: all.length,
      };
    }

    // 3. Smooth Weighted Round-Robin (SWRR) Selection Step
    let totalEffectiveWeight = 0;
    let selected: PooledTokenAccount = eligible[0];
    let maxCurrentWeight = -Infinity;

    for (const acc of eligible) {
      acc.currentWeight += acc.effectiveWeight;
      totalEffectiveWeight += acc.effectiveWeight;

      if (acc.currentWeight > maxCurrentWeight) {
        maxCurrentWeight = acc.currentWeight;
        selected = acc;
      }
    }

    selected.currentWeight -= totalEffectiveWeight;

    // Anchor session to selected shard
    if (sessionId) {
      this.setSessionAffinity(sessionId, selected.id, nowMs);
    }

    return {
      account: selected,
      sticky: false,
      activeFleetSize: eligible.length,
    };
  }

  /**
   * Commits token consumption and updates the sliding-window ledger.
   */
  public recordUsage(accountId: string, tokensUsed: number, nowMs = Date.now(), sessionId?: string): void {
    const acc = this.accounts.get(accountId);
    if (!acc) return;

    const safeTokensUsed = Math.floor(this.boundedNumber(tokensUsed, 0, 0, 100_000_000));
    acc.totalRequestsServed += 1;
    acc.totalTokensConsumed += safeTokensUsed;
    acc.requestHistoryTimestampsMs.push(nowMs);

    acc.tokenBucket.remainingTokens = Math.max(0, acc.tokenBucket.remainingTokens - safeTokensUsed);
    acc.tokenBucket.remainingRequests = Math.max(0, acc.tokenBucket.remainingRequests - 1);

    if (sessionId) {
      this.setSessionAffinity(sessionId, accountId, nowMs);
    }

    this.updateAccountQuotaAndWeight(acc, nowMs);
  }

  /**
   * Records a successful upstream turn, handling anti-flapping canary passes.
   */
  public recordSuccess(accountId: string): void {
    const acc = this.accounts.get(accountId);
    if (!acc) return;

    acc.consecutiveFailures = 0;

    if (acc.status === 'half_open') {
      acc.consecutiveCanaryPasses += 1;
      // Anti-flapping hysteresis: requires 3 passes to return to healthy
      if (acc.consecutiveCanaryPasses >= 3) {
        acc.status = 'healthy';
        acc.effectiveWeight = acc.baseWeight;
      }
    }
  }

  /**
   * Handles upstream failures, classifying 429 rate-limits, 401 revocations, and cooldowns.
   */
  public recordFailure(
    accountId: string,
    statusCode: number,
    errorText: string,
    retryAfterSeconds?: number,
    nowMs = Date.now()
  ): { newStatus: PooledTokenStatus; cooldownMs: number; canRetryNext: boolean } {
    const acc = this.accounts.get(accountId);
    if (!acc) {
      return { newStatus: 'dead', cooldownMs: 0, canRetryNext: true };
    }

    acc.consecutiveFailures += 1;
    acc.consecutiveCanaryPasses = 0;

    const lowerErr = errorText.toLowerCase();
    const isRevoked =
      statusCode === 401 &&
      (lowerErr.includes('token_revoked') ||
        lowerErr.includes('invalidated') ||
        lowerErr.includes('invalid_grant') ||
        lowerErr.includes('session has ended'));

    if (isRevoked) {
      acc.status = 'dead';
      acc.effectiveWeight = 0;
      return { newStatus: 'dead', cooldownMs: Infinity, canRetryNext: true };
    }

    const isRateLimit = statusCode === 429 || lowerErr.includes('rate_limit') || lowerErr.includes('quota');
    const baseCooldownMs = retryAfterSeconds
      ? this.boundedNumber(retryAfterSeconds, 30, 1, 3_600) * 1000
      : isRateLimit
        ? 30_000
        : Math.min(5 * 60_000, 1_000 * (2 ** Math.min(acc.consecutiveFailures, 8)));
    const jitter = Math.floor(Math.random() * 5000);
    const cooldownMs = Math.max(10_000, baseCooldownMs + jitter);

    acc.status = 'cooldown';
    acc.cooldownUntilTimestampMs = nowMs + cooldownMs;
    acc.effectiveWeight = 0;

    return { newStatus: 'cooldown', cooldownMs, canRetryNext: true };
  }

  /**
   * Updates an account's tokens upon single-flight OAuth refresh.
   */
  public updateRefreshedTokens(accountId: string, accessToken: string, refreshToken?: string): void {
    const acc = this.accounts.get(accountId);
    if (!acc) return;

    acc.accessToken = accessToken;
    if (refreshToken) acc.refreshToken = refreshToken;
    acc.status = 'healthy';
    acc.consecutiveFailures = 0;
    acc.effectiveWeight = acc.baseWeight;
    acc.cooldownUntilTimestampMs = undefined;
  }
}
