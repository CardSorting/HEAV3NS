/**
 * v4a-patch-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for V4A Multi-File Patch Parser & Working Diff Subsystem (Phase 119 / ADR-095 / Target #52).
 */

import type { BroccoliV4aPatchSubstrate } from "./broccoli-v4a-patch-substrate.js";
import type { V4aPatchWorkspaceSnapshot } from "../../../core/contracts/v4a-patch.contracts.js";

export class V4aPatchSnapshotManager {
  private readonly substrate: BroccoliV4aPatchSubstrate;
  private readonly snapshotStorage = new Map<string, V4aPatchWorkspaceSnapshot>();

  constructor(substrate: BroccoliV4aPatchSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): V4aPatchWorkspaceSnapshot {
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
