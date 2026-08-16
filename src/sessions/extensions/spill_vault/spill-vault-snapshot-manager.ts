/**
 * spill-vault-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Spill-Safe File Vault and Turn Budget Governor Subsystem (Phase 117 / ADR-093 / Target #50).
 */

import type { BroccoliSpillVaultSubstrate } from "./broccoli-spill-vault-substrate.js";
import type { SpillVaultWorkspaceSnapshot } from "../../../core/contracts/spill-vault.contracts.js";

export class SpillVaultSnapshotManager {
  private readonly substrate: BroccoliSpillVaultSubstrate;
  private readonly snapshotStorage = new Map<string, SpillVaultWorkspaceSnapshot>();

  constructor(substrate: BroccoliSpillVaultSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): SpillVaultWorkspaceSnapshot {
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
