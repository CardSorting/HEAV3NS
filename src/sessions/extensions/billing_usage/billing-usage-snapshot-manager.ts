/**
 * billing-usage-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Dollar-Denominated Billing Usage Subsystem (Phase 132 / ADR-108 / Target #65).
 */

import { performance } from "node:perf_hooks";
import type { BroccoliBillingUsageSubstrate } from "./broccoli-billing-usage-substrate.js";
import type { BillingUsageWorkspaceSnapshot } from "../../../core/contracts/billing-usage.contracts.js";

export class BillingUsageSnapshotManager {
  private readonly substrate: BroccoliBillingUsageSubstrate;
  private readonly snapshotStorage = new Map<string, BillingUsageWorkspaceSnapshot>();
  private readonly frameSnapshots = new Map<number, BillingUsageWorkspaceSnapshot>();
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliBillingUsageSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): BillingUsageWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.snapshotStorage.set(snapshotId, snapshot);
    return snapshot;
  }

  public captureSnapshot(frameIndex: number): BillingUsageWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > BillingUsageSnapshotManager.MAX_SNAPSHOTS) {
      const oldestKey = Array.from(this.frameSnapshots.keys()).sort((a, b) => a - b)[0];
      this.frameSnapshots.delete(oldestKey);
    }

    return snapshot;
  }

  public restoreFrameSnapshot(frameIndex: number): { success: boolean; durationMs: number; error?: string } {
    const startedAt = performance.now();
    const snapshot = this.frameSnapshots.get(frameIndex);

    if (!snapshot) {
      return {
        success: false,
        durationMs: Number((performance.now() - startedAt).toFixed(4)),
        error: `Frame snapshot #${frameIndex} not found in ring buffer`,
      };
    }

    this.substrate.importSnapshot(snapshot);
    const duration = Number((performance.now() - startedAt).toFixed(4));

    return {
      success: true,
      durationMs: duration,
    };
  }

  public restoreSnapshot(snapshotIdOrSnapshot: string | BillingUsageWorkspaceSnapshot): boolean {
    if (typeof snapshotIdOrSnapshot === "string") {
      const snapshot = this.snapshotStorage.get(snapshotIdOrSnapshot);
      if (!snapshot) return false;
      this.substrate.importSnapshot(snapshot);
      return true;
    }
    this.substrate.importSnapshot(snapshotIdOrSnapshot);
    return true;
  }

  public deleteSnapshot(snapshotId: string): boolean {
    return this.snapshotStorage.delete(snapshotId);
  }

  public clearAllSnapshots(): void {
    this.snapshotStorage.clear();
    this.frameSnapshots.clear();
  }

  public hasSnapshot(snapshotId: string): boolean {
    return this.snapshotStorage.has(snapshotId);
  }

  public getSnapshotCount(): number {
    return this.snapshotStorage.size + this.frameSnapshots.size;
  }
}
