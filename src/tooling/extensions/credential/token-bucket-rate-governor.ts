import type { TokenBucketState } from "../../../core/contracts/credential.contracts.js";

/**
 * Mathematical Continuous Token-Bucket Rate Governor.
 *
 * Implements fractional time-based token and request refill without discrete background polling.
 */
export class TokenBucketRateGovernor {
  createDefaultBucket(
    maxTokens = 200000,
    refillRatePerMinute = 200000,
    maxRequests = 500
  ): TokenBucketState {
    return {
      maxTokens,
      remainingTokens: maxTokens,
      refillRatePerMinute,
      maxRequests,
      remainingRequests: maxRequests,
      lastRefillTimestampMs: Date.now(),
    };
  }

  refillBucket(bucket: TokenBucketState, nowMs = Date.now()): TokenBucketState {
    const elapsedMs = Math.max(0, nowMs - bucket.lastRefillTimestampMs);
    if (elapsedMs === 0) {
      return bucket;
    }

    const elapsedMinutes = elapsedMs / 60000;
    const tokensToAdd = Math.floor(elapsedMinutes * bucket.refillRatePerMinute);
    const requestsToAdd = Math.floor(elapsedMinutes * bucket.maxRequests);

    const newTokens = Math.min(bucket.maxTokens, bucket.remainingTokens + tokensToAdd);
    const newRequests = Math.min(bucket.maxRequests, bucket.remainingRequests + requestsToAdd);

    return {
      ...bucket,
      remainingTokens: newTokens,
      remainingRequests: newRequests,
      lastRefillTimestampMs: nowMs,
    };
  }

  canConsume(bucket: TokenBucketState, requiredTokens = 1, requiredRequests = 1, nowMs = Date.now()): boolean {
    const updated = this.refillBucket(bucket, nowMs);
    return updated.remainingTokens >= requiredTokens && updated.remainingRequests >= requiredRequests;
  }

  consume(
    bucket: TokenBucketState,
    tokensToConsume: number,
    requestsToConsume = 1,
    nowMs = Date.now()
  ): { bucket: TokenBucketState; consumed: boolean } {
    const updated = this.refillBucket(bucket, nowMs);
    if (updated.remainingTokens >= tokensToConsume && updated.remainingRequests >= requestsToConsume) {
      return {
        bucket: {
          ...updated,
          remainingTokens: updated.remainingTokens - tokensToConsume,
          remainingRequests: updated.remainingRequests - requestsToConsume,
        },
        consumed: true,
      };
    }
    return { bucket: updated, consumed: false };
  }
}
