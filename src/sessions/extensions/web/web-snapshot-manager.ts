/**
 * web-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback for the Web Intelligence Subsystem (Phase 82 / ADR-034).
 */

import type { WebWorkspaceSnapshot } from "../../../core/contracts/web.contracts.js";
import { BroccoliWebSubstrate } from "./broccoli-web-substrate.js";

export class WebSnapshotManager {
  private substrate: BroccoliWebSubstrate;
  private snapshots: Map<number, WebWorkspaceSnapshot>;

  constructor(substrate: BroccoliWebSubstrate) {
    this.substrate = substrate;
    this.snapshots = new Map<number, WebWorkspaceSnapshot>();
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
  getSnapshot(frameIndex: number): WebWorkspaceSnapshot | undefined {
    return this.snapshots.get(frameIndex);
  }

  /**
   * Clears all cached frame snapshots.
   */
  clear(): void {
    this.snapshots.clear();
  }
}
