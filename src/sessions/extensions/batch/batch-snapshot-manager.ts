/**
 * batch-snapshot-manager.ts
 *
 * High-performance frame snapshot manager for the Batch Evaluation & Benchmark Runner Subsystem
 * enabling frame-perfect state capture and O(1) state rewind (< 0.05 ms SLA) (Phase 84 / ADR-036).
 */

import { performance } from "node:perf_hooks";
import type { BatchWorkspaceSnapshot } from "../../../core/contracts/batch.contracts.js";
import { BroccoliBatchSubstrate } from "./broccoli-batch-substrate.js";

export class BatchSnapshotManager {
  private readonly substrate: BroccoliBatchSubstrate;
  private readonly frameSnapshots: Map<number, BatchWorkspaceSnapshot>;
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliBatchSubstrate) {
    this.substrate = substrate;
    this.frameSnapshots = new Map<number, BatchWorkspaceSnapshot>();
  }

  /**
   * Captures a deep workspace snapshot pinned to a specific execution frame.
   */
  captureSnapshot(frameIndex: number): BatchWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > BatchSnapshotManager.MAX_SNAPSHOTS) {
      const oldestKey = Array.from(this.frameSnapshots.keys()).sort((a, b) => a - b)[0];
      this.frameSnapshots.delete(oldestKey);
    }

    return snapshot;
  }

  /**
   * Restores workspace state to a captured execution frame in < 0.05 ms SLA.
   */
  restoreSnapshot(frameIndex: number): { success: boolean; durationMs: number; error?: string } {
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

  getSnapshot(frameIndex: number): BatchWorkspaceSnapshot | undefined {
    return this.frameSnapshots.get(frameIndex);
  }

  clear(): void {
    this.frameSnapshots.clear();
  }
}
