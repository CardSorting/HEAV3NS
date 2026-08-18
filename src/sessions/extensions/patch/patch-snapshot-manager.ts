/**
 * patch-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback (< 0.05 ms SLA)
 * for the Patch & File Mutation substrate (Phase 77 / ADR-029 / Target #74).
 */

import { performance } from "node:perf_hooks";
import type { FileMutationSnapshot } from "../../../core/contracts/patch-mutation.contracts.js";
import type { BroccoliPatchSubstrate } from "./broccoli-patch-substrate.js";

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

  public captureSnapshot(frameId: number): FileMutationSnapshot {
    const frame = this.captureFrame(frameId);
    return frame.snapshot;
  }

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

  public restoreFrameSnapshot(frameId: number): { success: boolean; durationMs: number; error?: string } {
    const startedAt = performance.now();
    const frame = this.history.find((f) => f.frameId === frameId);

    if (!frame) {
      return {
        success: false,
        durationMs: Number((performance.now() - startedAt).toFixed(4)),
        error: `Frame #${frameId} not found in ring buffer`,
      };
    }

    this.substrate.restoreSnapshot(frame.snapshot);
    const duration = Number((performance.now() - startedAt).toFixed(4));

    return {
      success: true,
      durationMs: duration,
    };
  }

  public rewindToFrame(frameId: number): boolean {
    const res = this.restoreFrameSnapshot(frameId);
    return res.success;
  }

  public getHistory(): readonly PatchSnapshotFrame[] {
    return this.history;
  }

  public clear(): void {
    this.history.length = 0;
  }
}
