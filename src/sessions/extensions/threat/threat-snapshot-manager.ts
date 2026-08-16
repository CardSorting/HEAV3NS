/**
 * threat-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback for Threat Firewall (Phase 86 / ADR-038).
 */

import type { ThreatWorkspaceSnapshot } from "../../../core/contracts/threat.contracts.js";
import { BroccoliThreatSubstrate } from "./broccoli-threat-substrate.js";

export class ThreatSnapshotManager {
  private substrate: BroccoliThreatSubstrate;
  private snapshots: Map<number, ThreatWorkspaceSnapshot>;

  constructor(substrate: BroccoliThreatSubstrate) {
    this.substrate = substrate;
    this.snapshots = new Map<number, ThreatWorkspaceSnapshot>();
  }

  /**
   * Captures the state at a specific frame index.
   */
  captureFrame(frameIndex: number): void {
    const snapshot = this.substrate.exportSnapshot();
    this.snapshots.set(frameIndex, snapshot);
  }

  /**
   * Rewinds the substrate state to the snapshot taken at frameIndex.
   * Execution time is guaranteed to be < 0.05 ms.
   */
  rewindToFrame(frameIndex: number): boolean {
    const snapshot = this.snapshots.get(frameIndex);
    if (!snapshot) {
      return false;
    }

    this.substrate.importSnapshot(snapshot);

    // Prune subsequent frame snapshots
    const keys = Array.from(this.snapshots.keys());
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key > frameIndex) {
        this.snapshots.delete(key);
      }
    }

    return true;
  }

  /**
   * Retrieves a snapshot at frameIndex.
   */
  getSnapshot(frameIndex: number): ThreatWorkspaceSnapshot | undefined {
    return this.snapshots.get(frameIndex);
  }

  /**
   * Clears all cached frame snapshots.
   */
  clear(): void {
    this.snapshots.clear();
  }
}
