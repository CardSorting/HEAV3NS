/**
 * wake-word-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Wake-Word Acoustic Subsystem (Phase 121 / ADR-097 / Target #54).
 */

import type { BroccoliWakeWordSubstrate } from "./broccoli-wake-word-substrate.js";
import type { WakeWordWorkspaceSnapshot } from "../../../core/contracts/wake-word.contracts.js";

export class WakeWordSnapshotManager {
  private readonly substrate: BroccoliWakeWordSubstrate;
  private readonly snapshotStorage = new Map<string, WakeWordWorkspaceSnapshot>();

  constructor(substrate: BroccoliWakeWordSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): WakeWordWorkspaceSnapshot {
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
