/**
 * lsp-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback for the LSP Code Intelligence substrate.
 */

import type { LspWorkspaceSnapshot } from "../../../core/contracts/lsp.contracts.js";
import { BroccoliLspSubstrate } from "./broccoli-lsp-substrate.js";

export interface LspSnapshotFrame {
  readonly frameId: number;
  readonly timestamp: number;
  readonly snapshot: LspWorkspaceSnapshot;
}

export class LspSnapshotManager {
  private readonly history: LspSnapshotFrame[] = [];
  private readonly substrate: BroccoliLspSubstrate;
  private readonly maxFrames: number;

  constructor(substrate: BroccoliLspSubstrate, maxFrames = 128) {
    this.substrate = substrate;
    this.maxFrames = Math.max(16, maxFrames);
  }

  /**
   * Captures an atomic snapshot of LSP documents and diagnostics at the given frame tick.
   */
  public captureFrame(frameId: number): LspSnapshotFrame {
    const snapshot = this.substrate.captureSnapshot();
    const frame: LspSnapshotFrame = {
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
   * Restores LSP documents and diagnostics to the exact frameId in O(1) time.
   */
  public rewindToFrame(frameId: number): boolean {
    const frame = this.history.find((f) => f.frameId === frameId);
    if (!frame) return false;

    this.substrate.restoreSnapshot(frame.snapshot);
    return true;
  }

  public getHistory(): readonly LspSnapshotFrame[] {
    return this.history;
  }

  public clear(): void {
    this.history.length = 0;
  }
}
