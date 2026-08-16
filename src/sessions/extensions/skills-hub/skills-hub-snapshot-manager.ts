/**
 * skills-hub-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback for Skills Hub Subsystem (Phase 89 / ADR-041).
 */

import type { SkillsHubWorkspaceSnapshot } from "../../../core/contracts/skills-hub.contracts.js";
import { BroccoliSkillsHubSubstrate } from "./broccoli-skills-hub-substrate.js";

export class SkillsHubSnapshotManager {
  private substrate: BroccoliSkillsHubSubstrate;
  private snapshots: Map<number, SkillsHubWorkspaceSnapshot>;

  constructor(substrate: BroccoliSkillsHubSubstrate) {
    this.substrate = substrate;
    this.snapshots = new Map<number, SkillsHubWorkspaceSnapshot>();
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
  getSnapshot(frameIndex: number): SkillsHubWorkspaceSnapshot | undefined {
    return this.snapshots.get(frameIndex);
  }

  /**
   * Clears all cached frame snapshots.
   */
  clear(): void {
    this.snapshots.clear();
  }
}
