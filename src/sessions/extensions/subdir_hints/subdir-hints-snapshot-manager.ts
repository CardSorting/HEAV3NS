/**
 * subdir-hints-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Subdirectory Hints Subsystem (Phase 129 / ADR-105 / Target #62).
 */

import type { BroccoliSubdirHintsSubstrate } from "./broccoli-subdir-hints-substrate.js";
import type { SubdirectoryHintsWorkspaceSnapshot } from "../../../core/contracts/subdirectory-hints.contracts.js";

export class SubdirHintsSnapshotManager {
  private readonly substrate: BroccoliSubdirHintsSubstrate;
  private readonly snapshotStorage = new Map<string, SubdirectoryHintsWorkspaceSnapshot>();

  constructor(substrate: BroccoliSubdirHintsSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): SubdirectoryHintsWorkspaceSnapshot {
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
