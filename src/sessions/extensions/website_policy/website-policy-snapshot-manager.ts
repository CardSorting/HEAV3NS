/**
 * website-policy-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Website Access Policy Subsystem (Phase 120 / ADR-096 / Target #53).
 */

import type { BroccoliWebsitePolicySubstrate } from "./broccoli-website-policy-substrate.js";
import type { WebsitePolicyWorkspaceSnapshot } from "../../../core/contracts/website-policy.contracts.js";

export class WebsitePolicySnapshotManager {
  private readonly substrate: BroccoliWebsitePolicySubstrate;
  private readonly snapshotStorage = new Map<string, WebsitePolicyWorkspaceSnapshot>();

  constructor(substrate: BroccoliWebsitePolicySubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): WebsitePolicyWorkspaceSnapshot {
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
