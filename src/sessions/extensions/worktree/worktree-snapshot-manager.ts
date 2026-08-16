/**
 * worktree-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Git Worktree Subsystem (Phase 123 / ADR-099 / Target #56).
 */

import type { BroccoliWorktreeSubstrate } from "./broccoli-worktree-substrate.js";
import type { WorktreeWorkspaceSnapshot } from "../../../core/contracts/worktree.contracts.js";

export class WorktreeSnapshotManager {
  private readonly substrate: BroccoliWorktreeSubstrate;
  private readonly snapshotStorage = new Map<string, WorktreeWorkspaceSnapshot>();

  constructor(substrate: BroccoliWorktreeSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): WorktreeWorkspaceSnapshot {
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
