/**
 * turn-retry-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Turn Retry State Machine Subsystem (Phase 131 / ADR-107 / Target #64).
 */

import type { BroccoliTurnRetrySubstrate } from "./broccoli-turn-retry-substrate.js";
import type { TurnRetryWorkspaceSnapshot } from "../../../core/contracts/turn-retry.contracts.js";

export class TurnRetrySnapshotManager {
  private readonly substrate: BroccoliTurnRetrySubstrate;
  private readonly snapshotStorage = new Map<string, TurnRetryWorkspaceSnapshot>();

  constructor(substrate: BroccoliTurnRetrySubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): TurnRetryWorkspaceSnapshot {
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
