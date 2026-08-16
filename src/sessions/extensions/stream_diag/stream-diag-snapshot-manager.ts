/**
 * stream-diag-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Stream Diagnostics Subsystem (Phase 130 / ADR-106 / Target #63).
 */

import type { BroccoliStreamDiagSubstrate } from "./broccoli-stream-diag-substrate.js";
import type { StreamDiagWorkspaceSnapshot } from "../../../core/contracts/stream-diag.contracts.js";

export class StreamDiagSnapshotManager {
  private readonly substrate: BroccoliStreamDiagSubstrate;
  private readonly snapshotStorage = new Map<string, StreamDiagWorkspaceSnapshot>();

  constructor(substrate: BroccoliStreamDiagSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): StreamDiagWorkspaceSnapshot {
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
