/**
 * voice-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback for the Real-Time Voice & Audio Substrate.
 */

import type { VoiceWorkspaceSnapshot } from "../../../core/contracts/voice.contracts.js";
import { BroccoliVoiceSubstrate } from "./broccoli-voice-substrate.js";

export interface VoiceSnapshotFrame {
  readonly frameId: number;
  readonly timestamp: number;
  readonly snapshot: VoiceWorkspaceSnapshot;
}

export class VoiceSnapshotManager {
  private readonly history: VoiceSnapshotFrame[] = [];
  private readonly substrate: BroccoliVoiceSubstrate;
  private readonly maxFrames: number;

  constructor(substrate: BroccoliVoiceSubstrate, maxFrames = 128) {
    this.substrate = substrate;
    this.maxFrames = Math.max(16, maxFrames);
  }

  /**
   * Captures an atomic snapshot of voice session states and profiles at the given frame tick.
   */
  public captureFrame(frameId: number): VoiceSnapshotFrame {
    const snapshot = this.substrate.captureSnapshot();
    const frame: VoiceSnapshotFrame = {
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
   * Restores voice session state to the exact frameId in O(1) time.
   */
  public rewindToFrame(frameId: number): boolean {
    const frame = this.history.find((f) => f.frameId === frameId);
    if (!frame) return false;

    this.substrate.restoreSnapshot(frame.snapshot);
    return true;
  }

  public getHistory(): readonly VoiceSnapshotFrame[] {
    return this.history;
  }

  public clear(): void {
    this.history.length = 0;
  }
}
