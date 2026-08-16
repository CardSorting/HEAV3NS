/**
 * skill-linter-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Skill Tree Linter Subsystem (Phase 135 / ADR-111 / Target #68).
 */

import type { BroccoliSkillLinterSubstrate } from "./broccoli-skill-linter-substrate.js";
import type { SkillLinterWorkspaceSnapshot } from "../../../core/contracts/skill-linter.contracts.js";

export class SkillLinterSnapshotManager {
  private readonly substrate: BroccoliSkillLinterSubstrate;
  private readonly snapshotStorage = new Map<string, SkillLinterWorkspaceSnapshot>();

  constructor(substrate: BroccoliSkillLinterSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): SkillLinterWorkspaceSnapshot {
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
