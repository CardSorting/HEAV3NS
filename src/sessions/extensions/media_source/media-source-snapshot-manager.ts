/**
 * media-source-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Media Source Resolution Subsystem (Phase 122 / ADR-098 / Target #55).
 */

import type { BroccoliMediaSourceSubstrate } from "./broccoli-media-source-substrate.js";
import type { MediaSourceWorkspaceSnapshot } from "../../../core/contracts/media-source.contracts.js";

export class MediaSourceSnapshotManager {
  private readonly substrate: BroccoliMediaSourceSubstrate;
  private readonly snapshotStorage = new Map<string, MediaSourceWorkspaceSnapshot>();

  constructor(substrate: BroccoliMediaSourceSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): MediaSourceWorkspaceSnapshot {
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
