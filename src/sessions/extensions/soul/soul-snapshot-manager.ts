import type { SoulSnapshot, SoulManifest } from "../../../core/contracts/soul.contracts.js";
import { BroccoliSoulSubstrate } from "./broccoli-soul-substrate.js";
import { DeterministicSoulParser } from "../../../tooling/extensions/soul/deterministic-soul-parser.js";

/**
 * SoulSnapshotManager.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm).
 *
 * Coordinates frame-level binary state snapshots of the active soul substrate,
 * enabling deterministic O(1) rollbacks without filesystem thrashing.
 */
export class SoulSnapshotManager {
  private readonly substrate: BroccoliSoulSubstrate;
  private readonly parser: DeterministicSoulParser;
  private readonly snapshotHistory: SoulSnapshot[] = [];
  private readonly maxSnapshots = 50;

  constructor(
    substrate: BroccoliSoulSubstrate,
    parser = new DeterministicSoulParser()
  ) {
    this.substrate = substrate;
    this.parser = parser;
  }

  /**
   * Captures an immutable snapshot of the active soul manifest at the current frame tick.
   */
  createSnapshot(frameIndex?: number): SoulSnapshot {
    const manifest = this.substrate.getActiveManifest();
    const frame = frameIndex ?? this.substrate.getCurrentTick();
    const checksum = this.parser.computeSoulHash(manifest);

    const snapshot: SoulSnapshot = Object.freeze({
      frameIndex: frame,
      timestamp: Date.now(),
      manifest,
      checksum,
    });

    this.snapshotHistory.push(snapshot);
    if (this.snapshotHistory.length > this.maxSnapshots) {
      this.snapshotHistory.shift();
    }

    return snapshot;
  }

  /**
   * Restores the active soul substrate state to a previously captured snapshot or frame index.
   */
  restoreSnapshot(snapshotOrFrame: SoulSnapshot | number): boolean {
    let targetSnapshot: SoulSnapshot | undefined;
    if (typeof snapshotOrFrame === "number") {
      targetSnapshot = this.snapshotHistory.find((s) => s.frameIndex === snapshotOrFrame);
    } else {
      targetSnapshot = snapshotOrFrame;
    }

    if (!targetSnapshot) return false;

    const computedChecksum = this.parser.computeSoulHash(targetSnapshot.manifest);
    if (computedChecksum !== targetSnapshot.checksum) {
      return false; // Snapshot corrupted
    }

    this.substrate.setActiveManifest(targetSnapshot.manifest);
    return true;
  }

  /**
   * Rolls back the last mutation in O(1) time by popping the previous snapshot.
   */
  rollbackLastMutation(): { success: boolean; rolledBackTo?: SoulManifest; error?: string } {
    if (this.snapshotHistory.length < 2) {
      return { success: false, error: "No previous snapshot available for rollback" };
    }

    // Pop the current state snapshot
    this.snapshotHistory.pop();
    // Retrieve the previous snapshot
    const targetSnapshot = this.snapshotHistory[this.snapshotHistory.length - 1];
    if (!targetSnapshot) {
      return { success: false, error: "Failed to access previous snapshot" };
    }

    const restored = this.restoreSnapshot(targetSnapshot);
    if (!restored) {
      return { success: false, error: "Snapshot integrity checksum verification failed" };
    }

    return {
      success: true,
      rolledBackTo: targetSnapshot.manifest,
    };
  }

  getSnapshotCount(): number {
    return this.snapshotHistory.length;
  }

  clear(): void {
    this.snapshotHistory.length = 0;
  }
}
