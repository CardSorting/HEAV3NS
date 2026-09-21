/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 176: Zero-Dependency Broccoli JoyRide Decision Log
 *
 * Lifted from external source workspace/codemarie-new/src/core/joyride/JoyRideDecisionLog.ts.
 * Maintains a bounded in-process ring-buffer log of cache decisions (hit, miss, evicted, degraded),
 * enabling zero-GC Maintainer diagnostics and high-resolution audit trails. Zero external npm dependencies.
 */

export type DecisionType = "hit" | "miss" | "evicted" | "degraded" | "rejected";

export interface JoyRideCacheDecision {
  auditEventId: string;
  key: string;
  decision: DecisionType;
  timestamp: number;
  reason?: string;
}

export class BroccoliJoyRideDecisionLog {
  private readonly maxCapacity: number;
  private readonly decisions: JoyRideCacheDecision[] = [];

  constructor(maxCapacity: number = 128) {
    this.maxCapacity = maxCapacity;
  }

  /**
   * Records a new cache decision into the bounded ring buffer.
   */
  public recordDecision(key: string, decision: DecisionType, reason?: string): JoyRideCacheDecision {
    const entry: JoyRideCacheDecision = {
      auditEventId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      key,
      decision,
      timestamp: Date.now(),
      reason,
    };

    this.decisions.push(entry);
    if (this.decisions.length > this.maxCapacity) {
      this.decisions.splice(0, this.decisions.length - this.maxCapacity);
    }

    return entry;
  }

  /**
   * Returns recent decision log entries up to specified limit.
   */
  public getDecisionLog(limit = 32): readonly JoyRideCacheDecision[] {
    return this.decisions.slice(-limit);
  }

  /**
   * Explains a specific decision by audit event ID.
   */
  public explainDecision(auditEventId: string): JoyRideCacheDecision | undefined {
    return this.decisions.find((d) => d.auditEventId === auditEventId);
  }

  /**
   * Returns total log length.
   */
  public size(): number {
    return this.decisions.length;
  }

  /**
   * Clears decision log.
   */
  public clear(): void {
    this.decisions.length = 0;
  }
}
