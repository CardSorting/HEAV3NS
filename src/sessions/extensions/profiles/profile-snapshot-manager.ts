/**
 * profile-snapshot-manager.ts
 *
 * High-performance frame snapshot manager for Persistent Multi-Profile Subsystem
 * enabling frame-perfect state capture and O(1) state rewind (< 0.05 ms SLA) (Target #76 / ADR-119).
 */

import { performance } from "node:perf_hooks";
import type {
  ProfileWorkspaceSnapshot,
} from "../../../core/contracts/profile.contracts.js";
import { BroccoliProfileSubstrate } from "./broccoli-profile-substrate.js";

export class ProfileSnapshotManager {
  private readonly substrate: BroccoliProfileSubstrate;
  private readonly frameSnapshots: Map<number, ProfileWorkspaceSnapshot>;
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliProfileSubstrate) {
    this.substrate = substrate;
    this.frameSnapshots = new Map<number, ProfileWorkspaceSnapshot>();
  }

  createSnapshot(): ProfileWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  restoreSnapshot(snapshot: ProfileWorkspaceSnapshot): void {
    this.substrate.importSnapshot(snapshot);
  }

  /**
   * Captures a deep workspace snapshot pinned to an execution frame.
   */
  captureSnapshot(frameIndex: number): ProfileWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > ProfileSnapshotManager.MAX_SNAPSHOTS) {
      const oldestKey = Array.from(this.frameSnapshots.keys()).sort((a, b) => a - b)[0];
      this.frameSnapshots.delete(oldestKey);
    }

    return snapshot;
  }

  captureFrame(frameIndex: number): ProfileWorkspaceSnapshot {
    return this.captureSnapshot(frameIndex);
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

  rewindToFrame(frameIndex: number): boolean {
    const res = this.restoreFrameSnapshot(frameIndex);
    return res.success;
  }

  getSnapshot(frameIndex: number): ProfileWorkspaceSnapshot | undefined {
    return this.frameSnapshots.get(frameIndex);
  }

  clear(): void {
    this.frameSnapshots.clear();
  }
}
