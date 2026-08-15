import type {
  FaultCategory,
  IBroccoliFaultSubstrate,
  ProviderHealthRecord,
} from "../../../core/contracts/fault.contracts.js";

/**
 * In-Memory Broccolidb Fault Substrate.
 *
 * Tracks provider error frequencies, consecutive failures, and cooldown states
 * in zero-GC memory structures.
 */
export class BroccoliFaultSubstrate implements IBroccoliFaultSubstrate {
  private readonly healthMap: Map<string, ProviderHealthRecord> = new Map();
  private totalFaultsCount: number = 0;

  recordFault(provider: string, category: FaultCategory, cooldownMs: number = 60000): void {
    this.totalFaultsCount++;
    const now = Date.now();
    const existing = this.healthMap.get(provider) ?? {
      provider,
      totalRequests: 0,
      totalFaults: 0,
      consecutiveFailures: 0,
      lastFaultTimestamp: 0,
      isCoolingDown: false,
      cooldownUntilTimestamp: 0,
    };

    const consecutiveFailures = existing.consecutiveFailures + 1;
    const isCoolingDown = consecutiveFailures >= 3 || category === "rate_limit" || category === "billing_exhausted";
    const cooldownUntil = isCoolingDown ? now + cooldownMs : existing.cooldownUntilTimestamp;

    this.healthMap.set(provider, {
      provider,
      totalRequests: existing.totalRequests + 1,
      totalFaults: existing.totalFaults + 1,
      consecutiveFailures,
      lastFaultCategory: category,
      lastFaultTimestamp: now,
      isCoolingDown,
      cooldownUntilTimestamp: cooldownUntil,
    });
  }

  recordSuccess(provider: string): void {
    const existing = this.healthMap.get(provider);
    if (existing) {
      this.healthMap.set(provider, {
        ...existing,
        totalRequests: existing.totalRequests + 1,
        consecutiveFailures: 0,
        isCoolingDown: false,
        cooldownUntilTimestamp: 0,
      });
    } else {
      this.healthMap.set(provider, {
        provider,
        totalRequests: 1,
        totalFaults: 0,
        consecutiveFailures: 0,
        lastFaultTimestamp: 0,
        isCoolingDown: false,
        cooldownUntilTimestamp: 0,
      });
    }
  }

  getProviderHealth(provider: string): ProviderHealthRecord | undefined {
    const record = this.healthMap.get(provider);
    if (!record) return undefined;

    // Check if cooldown expired
    if (record.isCoolingDown && Date.now() > record.cooldownUntilTimestamp) {
      const refreshed: ProviderHealthRecord = {
        ...record,
        isCoolingDown: false,
        cooldownUntilTimestamp: 0,
      };
      this.healthMap.set(provider, refreshed);
      return refreshed;
    }

    return record;
  }

  listProviderHealth(): readonly ProviderHealthRecord[] {
    return Array.from(this.healthMap.values()).map((r) => this.getProviderHealth(r.provider)!);
  }

  getTotalFaultCount(): number {
    return this.totalFaultsCount;
  }

  setTotalFaultCount(count: number): void {
    this.totalFaultsCount = count;
  }

  clear(): void {
    this.healthMap.clear();
    this.totalFaultsCount = 0;
  }
}
