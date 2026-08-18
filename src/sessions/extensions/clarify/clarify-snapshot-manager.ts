/**
 * clarify-snapshot-manager.ts
 *
 * High-performance frame snapshot manager for the Clarification & Intent Disambiguation Subsystem
 * enabling frame-perfect state capture and O(1) state rewind (< 0.05 ms SLA) (Phase 85 / ADR-037).
 */

import { performance } from "node:perf_hooks";
import type { ClarifyWorkspaceSnapshot } from "../../../core/contracts/clarify.contracts.js";
import { BroccoliClarifySubstrate } from "./broccoli-clarify-substrate.js";

export class ClarifySnapshotManager {
  private readonly substrate: BroccoliClarifySubstrate;
  private readonly frameSnapshots: Map<number, ClarifyWorkspaceSnapshot>;
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliClarifySubstrate) {
    this.substrate = substrate;
    this.frameSnapshots = new Map<number, ClarifyWorkspaceSnapshot>();
  }

  /**
   * Captures a deep workspace snapshot pinned to a specific execution frame.
   */
  captureSnapshot(frameIndex: number): ClarifyWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > ClarifySnapshotManager.MAX_SNAPSHOTS) {
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

  getSnapshot(frameIndex: number): ClarifyWorkspaceSnapshot | undefined {
    return this.frameSnapshots.get(frameIndex);
  }

  clear(): void {
    this.frameSnapshots.clear();
  }
}
