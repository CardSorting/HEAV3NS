/**
 * compression-snapshot-manager.ts
 *
 * High-performance frame snapshot manager for Context Compression & Trajectory Compaction
 * enabling frame-perfect state capture and O(1) state rewind (< 0.05 ms SLA) (Phase 86 / ADR-038).
 */

import { performance } from "node:perf_hooks";
import type {
  CompressionStateSnapshot,
  ICompressionSnapshotManager,
} from "../../../core/contracts/compression.contracts.js";
import { BroccoliCompressionSubstrate } from "./broccoli-compression-substrate.js";

export class CompressionSnapshotManager implements ICompressionSnapshotManager {
  private readonly substrate: BroccoliCompressionSubstrate;
  private readonly frameSnapshots: Map<number, CompressionStateSnapshot>;
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliCompressionSubstrate) {
    this.substrate = substrate;
    this.frameSnapshots = new Map<number, CompressionStateSnapshot>();
  }

  createSnapshot(tick: number): CompressionStateSnapshot {
    return this.captureSnapshot(tick);
  }

  restoreSnapshot(snapshot: CompressionStateSnapshot): void {
    this.substrate.importSnapshot(snapshot);
  }

  /**
   * Captures a deep workspace snapshot pinned to an execution frame.
   */
  captureSnapshot(frameIndex: number): CompressionStateSnapshot {
    const snapshot = this.substrate.exportSnapshot(frameIndex);
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > CompressionSnapshotManager.MAX_SNAPSHOTS) {
      const oldestKey = Array.from(this.frameSnapshots.keys()).sort((a, b) => a - b)[0];
      this.frameSnapshots.delete(oldestKey);
    }

    return snapshot;
  }

  /**
   * Restores workspace state to a captured execution frame in < 0.05 ms SLA.
   */
  restoreFrameSnapshot(frameIndex: number): { success: boolean; durationMs: number; error?: string } {
    const startedAt = performance.now();
    const snapshot = this.frameSnapshots.get(frameIndex);

    if (!snapshot) {
      return {
        success: false,
        durationMs: Number((performance.now() - startedAt).toFixed(4)),
        error: `Frame snapshot #${frameIndex} not found in ring buffer`,
      };
    }

    this.substrate.importSnapshot(snapshot);
    const duration = Number((performance.now() - startedAt).toFixed(4));

    return {
      success: true,
      durationMs: duration,
    };
  }

  getSnapshot(frameIndex: number): CompressionStateSnapshot | undefined {
    return this.frameSnapshots.get(frameIndex);
  }

  clear(): void {
    this.frameSnapshots.clear();
  }
}
