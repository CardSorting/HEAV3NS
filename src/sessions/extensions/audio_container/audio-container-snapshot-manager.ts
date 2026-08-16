/**
 * audio-container-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Audio Container and Cache Subsystem (Phase 114 / ADR-090 / Target #47).
 */

import type { BroccoliAudioContainerSubstrate } from "./broccoli-audio-container-substrate.js";
import type { AudioWorkspaceSnapshot } from "../../../core/contracts/audio-container.contracts.js";

export class AudioContainerSnapshotManager {
  private readonly substrate: BroccoliAudioContainerSubstrate;
  private readonly snapshotStorage = new Map<string, AudioWorkspaceSnapshot>();

  constructor(substrate: BroccoliAudioContainerSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): AudioWorkspaceSnapshot {
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
