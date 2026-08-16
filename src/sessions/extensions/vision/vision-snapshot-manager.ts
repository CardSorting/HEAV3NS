/**
 * vision-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback for the Multimodal Vision Substrate.
 */

import type { VisionWorkspaceSnapshot } from "../../../core/contracts/vision.contracts.js";
import { BroccoliVisionSubstrate } from "./broccoli-vision-substrate.js";

export interface VisionSnapshotFrame {
  readonly frameId: number;
  readonly timestamp: number;
  readonly snapshot: VisionWorkspaceSnapshot;
}

export class VisionSnapshotManager {
  private readonly history: VisionSnapshotFrame[] = [];
  private readonly substrate: BroccoliVisionSubstrate;
  private readonly maxFrames: number;

  constructor(substrate: BroccoliVisionSubstrate, maxFrames = 128) {
    this.substrate = substrate;
    this.maxFrames = Math.max(16, maxFrames);
  }

  public captureFrame(frameId: number): VisionSnapshotFrame {
    const snapshot = this.substrate.captureSnapshot();
    const frame: VisionSnapshotFrame = {
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

  public rewindToFrame(frameId: number): boolean {
    const frame = this.history.find((f) => f.frameId === frameId);
    if (!frame) return false;

    this.substrate.restoreSnapshot(frame.snapshot);
    return true;
  }

  public getHistory(): readonly VisionSnapshotFrame[] {
    return this.history;
  }

  public clear(): void {
    this.history.length = 0;
  }
}
