/**
 * broccoli-spill-vault-substrate.ts
 *
 * In-memory Broccolidb repository storing persisted tool results,
 * session-isolated spill registries, and aggregate budget metrics (Phase 117 / ADR-093 / Target #50).
 */

import type {
  PersistedResultDescriptor,
  SpillVaultMetrics,
  SpillVaultWorkspaceSnapshot,
} from "../../../core/contracts/spill-vault.contracts.js";

export class BroccoliSpillVaultSubstrate {
  private readonly persistedStore = new Map<string, PersistedResultDescriptor>();
  private readonly sessionIndex = new Map<string, Set<string>>();
  private totalBytesSpilled = 0;
  private totalTurnBudgetEnforcements = 0;

  // Persisted Results Management
  public registerPersistedResult(desc: PersistedResultDescriptor): void {
    this.persistedStore.set(desc.resultId, desc);
    let sessionSet = this.sessionIndex.get(desc.sessionId);
    if (!sessionSet) {
      sessionSet = new Set<string>();
      this.sessionIndex.set(desc.sessionId, sessionSet);
    }
    sessionSet.add(desc.resultId);
    this.totalBytesSpilled += desc.originalSize;
  }

  public getPersistedResult(resultId: string): PersistedResultDescriptor | undefined {
    return this.persistedStore.get(resultId);
  }

  public hasPersistedResult(resultId: string): boolean {
    return this.persistedStore.has(resultId);
  }

  public listSessionResults(sessionId: string): readonly PersistedResultDescriptor[] {
    const ids = this.sessionIndex.get(sessionId);
    if (!ids) return [];
    const results: PersistedResultDescriptor[] = [];
    for (const id of ids) {
      const item = this.persistedStore.get(id);
      if (item) results.push(item);
    }
    return results;
  }

  public listAllResults(): readonly PersistedResultDescriptor[] {
    return Array.from(this.persistedStore.values());
  }

  public recordBudgetEnforcement(): void {
    this.totalTurnBudgetEnforcements++;
  }

  public getMetrics(): SpillVaultMetrics {
    return {
      totalPersistedResults: this.persistedStore.size,
      totalBytesSpilled: this.totalBytesSpilled,
      totalTurnBudgetEnforcements: this.totalTurnBudgetEnforcements,
      activeSessionCount: this.sessionIndex.size,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): SpillVaultWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      persistedResults: Array.from(this.persistedStore.values()),
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: SpillVaultWorkspaceSnapshot): void {
    this.persistedStore.clear();
    this.sessionIndex.clear();
    this.totalBytesSpilled = snapshot.metrics.totalBytesSpilled;
    this.totalTurnBudgetEnforcements = snapshot.metrics.totalTurnBudgetEnforcements;

    for (const desc of snapshot.persistedResults) {
      this.persistedStore.set(desc.resultId, desc);
      let sessionSet = this.sessionIndex.get(desc.sessionId);
      if (!sessionSet) {
        sessionSet = new Set<string>();
        this.sessionIndex.set(desc.sessionId, sessionSet);
      }
      sessionSet.add(desc.resultId);
    }
  }

  public clear(): void {
    this.persistedStore.clear();
    this.sessionIndex.clear();
    this.totalBytesSpilled = 0;
    this.totalTurnBudgetEnforcements = 0;
  }
}
