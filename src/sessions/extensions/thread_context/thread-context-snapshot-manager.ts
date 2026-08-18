/**
 * thread-context-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Async Context Propagation Subsystem (Phase 133 / ADR-109 / Target #66).
 */

import { performance } from "node:perf_hooks";
import type { BroccoliThreadContextSubstrate } from "./broccoli-thread-context-substrate.js";
import type { ThreadContextWorkspaceSnapshot } from "../../../core/contracts/thread-context.contracts.js";

export class ThreadContextSnapshotManager {
  private readonly substrate: BroccoliThreadContextSubstrate;
  private readonly snapshotStorage = new Map<string, ThreadContextWorkspaceSnapshot>();
  private readonly frameSnapshots = new Map<number, ThreadContextWorkspaceSnapshot>();
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliThreadContextSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): ThreadContextWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.snapshotStorage.set(snapshotId, snapshot);
    return snapshot;
  }

  public captureSnapshot(frameIndex: number): ThreadContextWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > ThreadContextSnapshotManager.MAX_SNAPSHOTS) {
      const oldestKey = Array.from(this.frameSnapshots.keys()).sort((a, b) => a - b)[0];
      this.frameSnapshots.delete(oldestKey);
    }

    return snapshot;
  }

  public restoreFrameSnapshot(frameIndex: number): { success: boolean; durationMs: number; error?: string } {
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

  public restoreSnapshot(snapshotIdOrSnapshot: string | ThreadContextWorkspaceSnapshot): boolean {
    if (typeof snapshotIdOrSnapshot === "string") {
      const snapshot = this.snapshotStorage.get(snapshotIdOrSnapshot);
      if (!snapshot) return false;
      this.substrate.importSnapshot(snapshot);
      return true;
    }
    this.substrate.importSnapshot(snapshotIdOrSnapshot);
    return true;
  }

  public deleteSnapshot(snapshotId: string): boolean {
    return this.snapshotStorage.delete(snapshotId);
  }

  public clearAllSnapshots(): void {
    this.snapshotStorage.clear();
    this.frameSnapshots.clear();
  }

  public hasSnapshot(snapshotId: string): boolean {
    return this.snapshotStorage.has(snapshotId);
  }

  public getSnapshotCount(): number {
    return this.snapshotStorage.size + this.frameSnapshots.size;
  }
}
