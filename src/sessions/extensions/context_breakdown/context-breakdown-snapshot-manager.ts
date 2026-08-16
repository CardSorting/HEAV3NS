/**
 * context-breakdown-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Context Window Token Composition Breakdown Subsystem (Phase 127 / ADR-103 / Target #60).
 */

import type { BroccoliContextBreakdownSubstrate } from "./broccoli-context-breakdown-substrate.js";
import type { ContextBreakdownWorkspaceSnapshot } from "../../../core/contracts/context-breakdown.contracts.js";

export class ContextBreakdownSnapshotManager {
  private readonly substrate: BroccoliContextBreakdownSubstrate;
  private readonly snapshotStorage = new Map<string, ContextBreakdownWorkspaceSnapshot>();

  constructor(substrate: BroccoliContextBreakdownSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): ContextBreakdownWorkspaceSnapshot {
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
