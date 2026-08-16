/**
 * deadline-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Unified Deadline & ESTOP Subsystem (Phase 125 / ADR-101 / Target #58).
 */

import type { BroccoliDeadlineSubstrate } from "./broccoli-deadline-substrate.js";
import type { DeadlineWorkspaceSnapshot } from "../../../core/contracts/deadline.contracts.js";

export class DeadlineSnapshotManager {
  private readonly substrate: BroccoliDeadlineSubstrate;
  private readonly snapshotStorage = new Map<string, DeadlineWorkspaceSnapshot>();

  constructor(substrate: BroccoliDeadlineSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): DeadlineWorkspaceSnapshot {
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
