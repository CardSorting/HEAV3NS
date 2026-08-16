/**
 * billing-usage-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Dollar-Denominated Billing Usage Subsystem (Phase 132 / ADR-108 / Target #65).
 */

import type { BroccoliBillingUsageSubstrate } from "./broccoli-billing-usage-substrate.js";
import type { BillingUsageWorkspaceSnapshot } from "../../../core/contracts/billing-usage.contracts.js";

export class BillingUsageSnapshotManager {
  private readonly substrate: BroccoliBillingUsageSubstrate;
  private readonly snapshotStorage = new Map<string, BillingUsageWorkspaceSnapshot>();

  constructor(substrate: BroccoliBillingUsageSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): BillingUsageWorkspaceSnapshot {
    const snapshot = this.substrate.createSnapshot(snapshotId);
    this.snapshotStorage.set(snapshotId, snapshot);
    return snapshot;
  }

  public restoreSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshotStorage.get(snapshotId);
    if (!snapshot) {
      return false;
    }
    this.substrate.restoreSnapshot(snapshot);
    return true;
  }

  public deleteSnapshot(snapshotId: string): boolean {
    return this.snapshotStorage.delete(snapshotId);
  }

  public clearAllSnapshots(): void {
    this.snapshotStorage.clear();
  }

  public hasSnapshot(snapshotId: string): boolean {
    return this.snapshotStorage.has(snapshotId);
  }

  public getSnapshotCount(): number {
    return this.snapshotStorage.size;
  }
}
