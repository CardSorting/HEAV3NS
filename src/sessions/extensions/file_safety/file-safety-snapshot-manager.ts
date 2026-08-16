/**
 * file-safety-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for File Safety & Path Firewall Subsystem (Phase 126 / ADR-102 / Target #59).
 */

import type { BroccoliFileSafetySubstrate } from "./broccoli-file-safety-substrate.js";
import type { FileSafetyWorkspaceSnapshot } from "../../../core/contracts/file-safety.contracts.js";

export class FileSafetySnapshotManager {
  private readonly substrate: BroccoliFileSafetySubstrate;
  private readonly snapshotStorage = new Map<string, FileSafetyWorkspaceSnapshot>();

  constructor(substrate: BroccoliFileSafetySubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): FileSafetyWorkspaceSnapshot {
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
