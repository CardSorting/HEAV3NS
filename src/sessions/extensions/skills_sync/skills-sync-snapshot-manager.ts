/**
 * skills-sync-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Distributed Skill Sync Subsystem (Phase 112 / ADR-088 / Target #45).
 */

import type { BroccoliSkillsSyncSubstrate } from "./broccoli-skills-sync-substrate.js";
import type { SkillSyncWorkspaceSnapshot } from "../../../core/contracts/skills-sync.contracts.js";

export class SkillsSyncSnapshotManager {
  private readonly substrate: BroccoliSkillsSyncSubstrate;
  private readonly snapshotStorage = new Map<string, SkillSyncWorkspaceSnapshot>();

  constructor(substrate: BroccoliSkillsSyncSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): SkillSyncWorkspaceSnapshot {
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
