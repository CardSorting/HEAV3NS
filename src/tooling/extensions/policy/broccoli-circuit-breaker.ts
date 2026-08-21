/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 119: Broccoli Tool Circuit Breaker & Token Bucket Rate Governor
 *
 * Lifted from /Users/bozoegg/Downloads/codemarie-new/broccolidb (core/policy).
 * Circuit breaker auto-trips on repeated tool failure loops. Rate governor enforces
 * token-per-minute limits. Zero external dependencies.
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitStatus {
  toolName: string;
  state: CircuitState;
  consecutiveFailures: number;
  lastTripTime?: number;
}

export class BroccoliCircuitBreaker {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly toolFailures = new Map<string, number>();
  private readonly toolTripTimes = new Map<string, number>();

  private readonly exemptTools = new Set([
    "run_command",
    "view_file",
    "write_file",
    "replace_file_content",
    "edit_file_anchored",
    "grep_search",
    "list_dir",
    "search_symbols",
  ]);

  constructor(failureThreshold: number = 3, cooldownMs: number = 30000) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
  }

  /**
   * Evaluates if a tool can be safely executed under circuit state rules.
   */
  public canExecute(toolName: string): boolean {
    if (this.exemptTools.has(toolName)) {
      return true; // Never block primary developer I/O tools
    }

    const tripTime = this.toolTripTimes.get(toolName);
    if (!tripTime) return true;

    if (Date.now() - tripTime > this.cooldownMs) {
      // Cooldown expired, move to half-open
      this.toolTripTimes.delete(toolName);
      this.toolFailures.set(toolName, 0);
      return true;
    }

    return false; // Circuit is OPEN
  }

  /**
   * Records a tool execution failure and trips the circuit if threshold exceeded.
   */
  public recordFailure(toolName: string): void {
    if (this.exemptTools.has(toolName)) {
      return; // Core interactive tools do not lock out on expected command errors
    }

    const count = (this.toolFailures.get(toolName) ?? 0) + 1;
    this.toolFailures.set(toolName, count);

    if (count >= this.failureThreshold) {
      this.toolTripTimes.set(toolName, Date.now());
    }
  }

  /**
   * Records a tool execution success, resetting failure counters.
   */
  public recordSuccess(toolName: string): void {
    this.toolFailures.delete(toolName);
    this.toolTripTimes.delete(toolName);
  }

  /**
   * Explicitly resets circuit breaker state for a tool or all tools.
   */
  public reset(toolName?: string): void {
    if (toolName) {
      this.toolFailures.delete(toolName);
      this.toolTripTimes.delete(toolName);
    } else {
      this.toolFailures.clear();
      this.toolTripTimes.clear();
    }
  }

  /**
   * Returns circuit status metrics for a tool.
   */
  public getStatus(toolName: string): CircuitStatus {
    const failures = this.toolFailures.get(toolName) ?? 0;
    const tripTime = this.toolTripTimes.get(toolName);

    let state: CircuitState = "closed";
    if (tripTime) {
      state = Date.now() - tripTime > this.cooldownMs ? "half_open" : "open";
    }

    return {
      toolName,
      state,
      consecutiveFailures: failures,
      lastTripTime: tripTime,
    };
  }
}

import { BroccoliTokenEstimator } from "./broccolidb-token-estimator.js";

/**
 * Token Bucket Rate Governor managing execution token allocation and backpressure.
 */
export class TokenBucketRateGovernor {
  private readonly capacity: number;
  private readonly fillRatePerSec: number;
  private tokens: number;
  private lastRefill: number;
  readonly tokenEstimator = new BroccoliTokenEstimator();

  constructor(capacity: number = 100, fillRatePerSec: number = 20) {
    this.capacity = capacity;
    this.fillRatePerSec = fillRatePerSec;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.fillRatePerSec);
    this.lastRefill = now;
  }

  /**
   * Consumes tokens if available, returning true if allowed.
   */
  public consume(cost: number = 1): boolean {
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }

  /**
   * Returns current token count.
   */
  public getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
