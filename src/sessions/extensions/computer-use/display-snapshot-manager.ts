/**
 * display-snapshot-manager.ts
 *
 * High-performance frame snapshot manager for Virtual Display & Computer Use
 * enabling frame-perfect state capture and O(1) state rewind (< 0.05 ms SLA) (Phase 88 / ADR-040).
 */

import { performance } from "node:perf_hooks";
import type { ComputerWorkspaceSnapshot } from "../../../core/contracts/computer-use.contracts.js";
import { BroccoliDisplaySubstrate } from "./broccoli-display-substrate.js";

export class DisplaySnapshotManager {
  private readonly substrate: BroccoliDisplaySubstrate;
  private readonly frameSnapshots: Map<number, ComputerWorkspaceSnapshot>;
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliDisplaySubstrate) {
    this.substrate = substrate;
    this.frameSnapshots = new Map<number, ComputerWorkspaceSnapshot>();
  }

  /**
   * Captures a deep workspace snapshot pinned to an execution frame.
   */
  captureSnapshot(frameIndex: number): ComputerWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > DisplaySnapshotManager.MAX_SNAPSHOTS) {
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

  getSnapshot(frameIndex: number): ComputerWorkspaceSnapshot | undefined {
    return this.frameSnapshots.get(frameIndex);
  }

  clear(): void {
    this.frameSnapshots.clear();
  }
}
