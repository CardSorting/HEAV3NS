/**
 * turn-retry-snapshot-manager.ts
 *
 * High-performance frame snapshot manager for Turn Retry State Machine
 * enabling frame-perfect state capture and O(1) state rewind (< 0.05 ms SLA) (Phase 131 / ADR-107).
 */

import { performance } from "node:perf_hooks";
import type { TurnRetryWorkspaceSnapshot } from "../../../core/contracts/turn-retry.contracts.js";
import { BroccoliTurnRetrySubstrate } from "./broccoli-turn-retry-substrate.js";

export class TurnRetrySnapshotManager {
  private readonly substrate: BroccoliTurnRetrySubstrate;
  private readonly frameSnapshots: Map<number, TurnRetryWorkspaceSnapshot>;
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliTurnRetrySubstrate) {
    this.substrate = substrate;
    this.frameSnapshots = new Map<number, TurnRetryWorkspaceSnapshot>();
  }

  /**
   * Captures a deep workspace snapshot pinned to an execution frame.
   */
  captureSnapshot(frameIndex: number): TurnRetryWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > TurnRetrySnapshotManager.MAX_SNAPSHOTS) {
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

  getSnapshot(frameIndex: number): TurnRetryWorkspaceSnapshot | undefined {
    return this.frameSnapshots.get(frameIndex);
  }

  clear(): void {
    this.frameSnapshots.clear();
  }
}
