/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-plan-cache.ts
 *
 * Dynamic Adaptive Query Plan Cache for BroccoliDB (Pass 201 / ADR-139).
 * Profiles query execution telemetry, tracks average latency, detects cardinality drift (>20%),
 * and triggers adaptive plan invalidation.
 */

import type {
  BroccoliCachedPlan,
  BroccoliPlanCacheMetrics,
  BroccoliQueryPlan,
  IBroccoliAdaptivePlanCache,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliAdaptivePlanCache implements IBroccoliAdaptivePlanCache {
  private readonly plans = new Map<string, BroccoliCachedPlan>();
  private readonly maxPlans: number;
  private readonly driftThresholdPct: number; // e.g. 0.20 = 20%

  private totalHitsCount = 0;
  private totalMissesCount = 0;
  private invalidationsCount = 0;
  private driftReoptimizationsCount = 0;

  constructor(maxPlans = 500, driftThresholdPct = 0.20) {
    this.maxPlans = maxPlans;
    this.driftThresholdPct = driftThresholdPct;
  }

  public getPlan(fingerprint: string): BroccoliCachedPlan | undefined {
    const cached = this.plans.get(fingerprint);
    if (!cached) {
      this.totalMissesCount++;
      return undefined;
    }

    this.totalHitsCount++;
    cached.lastUsedAt = Date.now();
    return cached;
  }

  public setPlan(fingerprint: string, plan: BroccoliQueryPlan): BroccoliCachedPlan {
    if (this.plans.size >= this.maxPlans) {
      this.evictLeastRecentlyUsed();
    }

    const planId = `plan_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const cached: BroccoliCachedPlan = {
      planId,
      queryFingerprint: fingerprint,
      plan,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      executionCount: 0,
      totalExecutionTimeMicros: 0,
      averageExecutionTimeMicros: plan.estimatedCost * 10,
    };

    this.plans.set(fingerprint, cached);
    return cached;
  }

  public recordExecution(
    fingerprint: string,
    executionTimeMicros: number,
    actualRowCount?: number
  ): void {
    const cached = this.plans.get(fingerprint);
    if (!cached) return;

    cached.executionCount++;
    cached.totalExecutionTimeMicros += executionTimeMicros;
    cached.averageExecutionTimeMicros = cached.totalExecutionTimeMicros / cached.executionCount;

    // Check for cardinality drift (> 20%)
    if (actualRowCount !== undefined) {
      if (cached.lastRecordedRowCount !== undefined && cached.lastRecordedRowCount > 0) {
        const drift = Math.abs(actualRowCount - cached.lastRecordedRowCount) / cached.lastRecordedRowCount;
        if (drift > this.driftThresholdPct) {
          this.driftReoptimizationsCount++;
          // Invalidate drifted plan so optimizer re-evaluates
          this.plans.delete(fingerprint);
          return;
        }
      }
      cached.lastRecordedRowCount = actualRowCount;
    }
  }

  public invalidateTable(tableName: string): number {
    let count = 0;
    for (const [fp, cached] of Array.from(this.plans.entries())) {
      if (cached.plan.targetTable === tableName) {
        this.plans.delete(fp);
        count++;
      }
    }
    this.invalidationsCount += count;
    return count;
  }

  public clear(): void {
    this.plans.clear();
  }

  public getMetrics(): BroccoliPlanCacheMetrics {
    const totalRequests = this.totalHitsCount + this.totalMissesCount;
    const hitRatioPct = totalRequests > 0 ? (this.totalHitsCount / totalRequests) * 100 : 0;

    return {
      cachedPlansCount: this.plans.size,
      totalHits: this.totalHitsCount,
      totalMisses: this.totalMissesCount,
      hitRatioPct: Number(hitRatioPct.toFixed(2)),
      invalidationsCount: this.invalidationsCount,
      driftReoptimizationsCount: this.driftReoptimizationsCount,
    };
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, plan] of this.plans.entries()) {
      if (plan.lastUsedAt < oldestTime) {
        oldestTime = plan.lastUsedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.plans.delete(oldestKey);
    }
  }
}
