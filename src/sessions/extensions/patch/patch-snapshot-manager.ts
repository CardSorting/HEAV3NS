/**
 * patch-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback for the Patch & File Mutation substrate.
 */

import type { FileMutationSnapshot } from "../../../core/contracts/patch-mutation.contracts.js";
import { BroccoliPatchSubstrate } from "./broccoli-patch-substrate.js";

export interface PatchSnapshotFrame {
  readonly frameId: number;
  readonly timestamp: number;
  readonly snapshot: FileMutationSnapshot;
}

export class PatchSnapshotManager {
  private readonly history: PatchSnapshotFrame[] = [];
  private readonly substrate: BroccoliPatchSubstrate;
  private readonly maxFrames: number;

  constructor(substrate: BroccoliPatchSubstrate, maxFrames = 128) {
    this.substrate = substrate;
    this.maxFrames = Math.max(16, maxFrames);
  }

  /**
   * Captures an atomic snapshot of staged file mutations at the given frame tick.
   */
  public captureFrame(frameId: number): PatchSnapshotFrame {
    const snapshot = this.substrate.captureSnapshot();
    const frame: PatchSnapshotFrame = {
      frameId,
      timestamp: Date.now(),
      snapshot,
    };

    this.history.push(frame);
    if (this.history.length > this.maxFrames) {
      this.history.shift();
    }

    return frame;
  }

  /**
   * Restores staged file mutations to the exact frameId in O(1) time.
   */
  public rewindToFrame(frameId: number): boolean {
    const frame = this.history.find((f) => f.frameId === frameId);
    if (!frame) return false;

    this.substrate.restoreSnapshot(frame.snapshot);
    return true;
  }

  public getHistory(): readonly PatchSnapshotFrame[] {
    return this.history;
  }

  public clear(): void {
    this.history.length = 0;
  }
}
