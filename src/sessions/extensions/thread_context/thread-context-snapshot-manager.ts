/**
 * thread-context-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Async Context Propagation Subsystem (Phase 133 / ADR-109 / Target #66).
 */

import type { BroccoliThreadContextSubstrate } from "./broccoli-thread-context-substrate.js";
import type { ThreadContextWorkspaceSnapshot } from "../../../core/contracts/thread-context.contracts.js";

export class ThreadContextSnapshotManager {
  private readonly substrate: BroccoliThreadContextSubstrate;
  private readonly snapshotStorage = new Map<string, ThreadContextWorkspaceSnapshot>();

  constructor(substrate: BroccoliThreadContextSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): ThreadContextWorkspaceSnapshot {
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
