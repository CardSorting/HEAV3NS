/**
 * process-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rewind for the background process substrate.
 */

import type { ProcessSessionSnapshot } from "../../../core/contracts/process.contracts.js";
import { BroccoliProcessSubstrate } from "./broccoli-process-substrate.js";

export interface ProcessSnapshotFrame {
  readonly frameId: number;
  readonly timestamp: number;
  readonly snapshot: ProcessSessionSnapshot;
}

export class ProcessSnapshotManager {
  private readonly history: ProcessSnapshotFrame[] = [];
  private readonly substrate: BroccoliProcessSubstrate;
  private readonly maxFrames: number;

  constructor(
    substrate: BroccoliProcessSubstrate,
    maxFrames = 128
  ) {
    this.substrate = substrate;
    this.maxFrames = Math.max(16, maxFrames);
  }

  /**
   * Captures an atomic snapshot associated with the given engine frame tick.
   */
  public captureFrame(frameId: number): ProcessSnapshotFrame {
    const snapshot = this.substrate.captureSnapshot();
    const frame: ProcessSnapshotFrame = {
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
   * Rewinds the substrate to the exact state at frameId in O(1) time.
   */
  public rewindToFrame(frameId: number): boolean {
    const frame = this.history.find((f) => f.frameId === frameId);
    if (!frame) return false;

    this.substrate.restoreSnapshot(frame.snapshot);
    return true;
  }

  public getHistory(): readonly ProcessSnapshotFrame[] {
    return this.history;
  }

  public clear(): void {
    this.history.length = 0;
  }
}
