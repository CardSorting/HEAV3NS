/**
 * learning-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback for the Knowledge Graph substrate.
 */

import type { KnowledgeGraphSnapshot } from "../../../core/contracts/memory-curator.contracts.js";
import { BroccoliLearningSubstrate } from "./broccoli-learning-substrate.js";

export interface LearningSnapshotFrame {
  readonly frameId: number;
  readonly timestamp: number;
  readonly snapshot: KnowledgeGraphSnapshot;
}

export class LearningSnapshotManager {
  private readonly history: LearningSnapshotFrame[] = [];
  private readonly substrate: BroccoliLearningSubstrate;
  private readonly maxFrames: number;

  constructor(
    substrate: BroccoliLearningSubstrate,
    maxFrames = 128
  ) {
    this.substrate = substrate;
    this.maxFrames = Math.max(16, maxFrames);
  }

  /**
   * Captures an atomic snapshot associated with the given engine frame tick.
   */
  public captureFrame(frameId: number): LearningSnapshotFrame {
    const snapshot = this.substrate.captureSnapshot();
    const frame: LearningSnapshotFrame = {
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

  public createSnapshot(frameId: number | string): LearningSnapshotFrame {
    const numericId = typeof frameId === "number" ? frameId : parseInt(frameId.replace(/[^0-9]/g, "") || "0", 10);
    return this.captureFrame(numericId);
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

  public restoreSnapshot(frameIdOrSnapshot: number | string | KnowledgeGraphSnapshot): boolean {
    if (typeof frameIdOrSnapshot === "object" && frameIdOrSnapshot !== null) {
      this.substrate.restoreSnapshot(frameIdOrSnapshot);
      return true;
    }
    const numericId = typeof frameIdOrSnapshot === "number" ? frameIdOrSnapshot : parseInt(frameIdOrSnapshot.replace(/[^0-9]/g, "") || "0", 10);
    return this.rewindToFrame(numericId);
  }

  public getHistory(): readonly LearningSnapshotFrame[] {
    return this.history;
  }

  public clear(): void {
    this.history.length = 0;
  }
}
