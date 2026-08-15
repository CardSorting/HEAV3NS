import type {
  BackoffPolicySpec,
  IJitteredBackoffGovernor,
} from "../../../core/contracts/fault.contracts.js";

/**
 * Deterministic Jittered Backoff Governor.
 *
 * Implements exponential backoff with full, equal, and decorrelated jitter modes
 * using a deterministic seedable PRNG to prevent thundering-herd spikes while
 * guaranteeing repeatable test execution and turn replay.
 */
export class JitteredBackoffGovernor implements IJitteredBackoffGovernor {
  private static readonly DEFAULT_POLICY: BackoffPolicySpec = {
    initialDelayMs: 500,
    maxDelayMs: 30000,
    multiplier: 2.0,
    jitterMode: "full",
    maxAttempts: 5,
  };

  private seed: number;

  constructor(initialSeed: number = 1337) {
    this.seed = initialSeed >>> 0;
  }

  /**
   * Deterministic Mulberry32 PRNG returning [0, 1).
   */
  private nextRandom(): number {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Parse a Retry-After header value into milliseconds.
   */
  parseRetryAfterMs(headerValue?: string | number): number | undefined {
    if (headerValue === undefined || headerValue === null) {
      return undefined;
    }

    if (typeof headerValue === "number") {
      return headerValue > 0 ? headerValue * 1000 : 0;
    }

    const trimmed = String(headerValue).trim();
    if (!trimmed) return undefined;

    // Check if numeric seconds
    const numericSeconds = Number.parseFloat(trimmed);
    if (!Number.isNaN(numericSeconds) && /^\d+(\.\d+)?$/.test(trimmed)) {
      return Math.max(0, numericSeconds * 1000);
    }

    // Check if HTTP Date
    const parsedDate = Date.parse(trimmed);
    if (!Number.isNaN(parsedDate)) {
      const diffMs = parsedDate - Date.now();
      return Math.max(0, diffMs);
    }

    return undefined;
  }

  calculateBackoffMs(
    attempt: number,
    policySpec?: Partial<BackoffPolicySpec>,
    retryAfterHeader?: string | number
  ): number {
    const policy: BackoffPolicySpec = {
      ...JitteredBackoffGovernor.DEFAULT_POLICY,
      ...policySpec,
    };

    // If Retry-After header is provided and valid, prioritize it
    const explicitMs = this.parseRetryAfterMs(retryAfterHeader);
    if (explicitMs !== undefined) {
      return Math.min(explicitMs, policy.maxDelayMs);
    }

    const clampedAttempt = Math.max(1, attempt);
    const rawBackoff = policy.initialDelayMs * Math.pow(policy.multiplier, clampedAttempt - 1);
    const cappedBackoff = Math.min(rawBackoff, policy.maxDelayMs);

    switch (policy.jitterMode) {
      case "none":
        return cappedBackoff;
      case "full": {
        // Uniform [0, cappedBackoff]
        const rand = this.nextRandom();
        return Math.floor(rand * cappedBackoff);
      }
      case "equal": {
        // cappedBackoff / 2 + Uniform [0, cappedBackoff / 2]
        const half = cappedBackoff / 2;
        const rand = this.nextRandom();
        return Math.floor(half + rand * half);
      }
      case "decorrelated": {
        // Uniform [initialDelayMs, cappedBackoff * 3]
        const rand = this.nextRandom();
        const delay = policy.initialDelayMs + rand * (cappedBackoff * 3 - policy.initialDelayMs);
        return Math.min(Math.floor(delay), policy.maxDelayMs);
      }
    }
  }
}
