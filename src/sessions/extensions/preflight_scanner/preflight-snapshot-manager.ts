/**
 * preflight-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Pre-Exec Security Scanner Subsystem (Phase 113 / ADR-089 / Target #46).
 */

import type { BroccoliPreflightSubstrate } from "./broccoli-preflight-substrate.js";
import type { PreflightWorkspaceSnapshot } from "../../../core/contracts/preflight-scanner.contracts.js";

export class PreflightSnapshotManager {
  private readonly substrate: BroccoliPreflightSubstrate;
  private readonly snapshotStorage = new Map<string, PreflightWorkspaceSnapshot>();

  constructor(substrate: BroccoliPreflightSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): PreflightWorkspaceSnapshot {
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
