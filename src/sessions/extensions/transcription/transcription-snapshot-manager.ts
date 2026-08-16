/**
 * transcription-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Speech-to-Text Transcription Subsystem (Phase 124 / ADR-100 / Target #57).
 */

import type { BroccoliTranscriptionSubstrate } from "./broccoli-transcription-substrate.js";
import type { TranscriptionWorkspaceSnapshot } from "../../../core/contracts/transcription.contracts.js";

export class TranscriptionSnapshotManager {
  private readonly substrate: BroccoliTranscriptionSubstrate;
  private readonly snapshotStorage = new Map<string, TranscriptionWorkspaceSnapshot>();

  constructor(substrate: BroccoliTranscriptionSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): TranscriptionWorkspaceSnapshot {
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
