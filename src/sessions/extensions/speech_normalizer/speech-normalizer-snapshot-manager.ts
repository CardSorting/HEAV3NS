/**
 * speech-normalizer-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Speech Text Normalizer and Pronunciation Lexicon Subsystem (Phase 115 / ADR-091 / Target #48).
 */

import type { BroccoliSpeechNormalizerSubstrate } from "./broccoli-speech-normalizer-substrate.js";
import type { SpeechWorkspaceSnapshot } from "../../../core/contracts/speech-normalizer.contracts.js";

export class SpeechNormalizerSnapshotManager {
  private readonly substrate: BroccoliSpeechNormalizerSubstrate;
  private readonly snapshotStorage = new Map<string, SpeechWorkspaceSnapshot>();

  constructor(substrate: BroccoliSpeechNormalizerSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): SpeechWorkspaceSnapshot {
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
