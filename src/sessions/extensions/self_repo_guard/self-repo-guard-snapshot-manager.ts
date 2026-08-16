/**
 * self-repo-guard-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Self-Repository Guard Subsystem (Phase 138 / ADR-114 / Target #71).
 */

import type { BroccoliSelfRepoGuardSubstrate } from "./broccoli-self-repo-guard-substrate.js";
import type { SelfRepoGuardWorkspaceSnapshot } from "../../../core/contracts/self-repo-guard.contracts.js";

export class SelfRepoGuardSnapshotManager {
  private readonly substrate: BroccoliSelfRepoGuardSubstrate;
  private readonly snapshotStorage = new Map<string, SelfRepoGuardWorkspaceSnapshot>();

  constructor(substrate: BroccoliSelfRepoGuardSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): SelfRepoGuardWorkspaceSnapshot {
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
