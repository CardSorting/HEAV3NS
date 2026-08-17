/**
 * email-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback for the Native Email Subsystem (Phase 93 / ADR-123).
 */

import type { EmailSubstrateSnapshot } from "../../../core/contracts/email.contracts.js";
import { BroccoliEmailSubstrate } from "./broccoli-email-substrate.js";

export class EmailSnapshotManager {
  private substrate: BroccoliEmailSubstrate;
  private snapshots: Map<number, EmailSubstrateSnapshot>;

  constructor(substrate: BroccoliEmailSubstrate) {
    this.substrate = substrate;
    this.snapshots = new Map<number, EmailSubstrateSnapshot>();
  }

  captureFrame(frameIndex: number): void {
    const snapshot = this.substrate.exportSnapshot();
    this.snapshots.set(frameIndex, snapshot);
  }

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

  getSnapshot(frameIndex: number): EmailSubstrateSnapshot | undefined {
    return this.snapshots.get(frameIndex);
  }

  clear(): void {
    this.snapshots.clear();
  }
}
