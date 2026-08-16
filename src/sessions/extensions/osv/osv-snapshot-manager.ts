/**
 * osv-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for OSV Malware Scanner Subsystem (Phase 128 / ADR-104 / Target #61).
 */

import type { BroccoliOsvSubstrate } from "./broccoli-osv-substrate.js";
import type { OsvScannerWorkspaceSnapshot } from "../../../core/contracts/osv-scanner.contracts.js";

export class OsvScannerSnapshotManager {
  private readonly substrate: BroccoliOsvSubstrate;
  private readonly snapshotStorage = new Map<string, OsvScannerWorkspaceSnapshot>();

  constructor(substrate: BroccoliOsvSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): OsvScannerWorkspaceSnapshot {
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
