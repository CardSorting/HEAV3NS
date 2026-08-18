/**
 * execution-snapshot-manager.ts
 *
 * High-performance frame snapshot manager for Sandboxed Code Execution & Tool Calling
 * enabling frame-perfect state capture and O(1) state rewind (< 0.05 ms SLA) (Phase 82 / ADR-034).
 */

import { performance } from "node:perf_hooks";
import type { ExecutionWorkspaceSnapshot } from "../../../core/contracts/execution.contracts.js";
import { BroccoliExecutionSubstrate } from "./broccoli-execution-substrate.js";

export class ExecutionSnapshotManager {
  private readonly substrate: BroccoliExecutionSubstrate;
  private readonly frameSnapshots: Map<number, ExecutionWorkspaceSnapshot>;
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliExecutionSubstrate) {
    this.substrate = substrate;
    this.frameSnapshots = new Map<number, ExecutionWorkspaceSnapshot>();
  }

  /**
   * Captures a deep workspace snapshot pinned to an execution frame.
   */
  captureSnapshot(frameIndex: number): ExecutionWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > ExecutionSnapshotManager.MAX_SNAPSHOTS) {
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

  getSnapshot(frameIndex: number): ExecutionWorkspaceSnapshot | undefined {
    return this.frameSnapshots.get(frameIndex);
  }

  clear(): void {
    this.frameSnapshots.clear();
  }
}
