/**
 * auth-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback (< 0.05 ms SLA)
 * for Identity Federation & Token Lease Subsystem (Phase 98 / ADR-052 / Target #69).
 */

import { performance } from "node:perf_hooks";
import type { AuthWorkspaceSnapshot } from "../../../core/contracts/identity-federation.contracts.js";
import type { BroccoliAuthSubstrate } from "./broccoli-auth-substrate.js";

export class AuthSnapshotManager {
  private readonly substrate: BroccoliAuthSubstrate;
  private readonly frameSnapshots = new Map<number, AuthWorkspaceSnapshot>();
  private readonly namedSnapshots = new Map<string, AuthWorkspaceSnapshot>();
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliAuthSubstrate) {
    this.substrate = substrate;
  }

  public captureSnapshot(frameIndex: number): AuthWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > AuthSnapshotManager.MAX_SNAPSHOTS) {
      const oldestKey = Array.from(this.frameSnapshots.keys()).sort((a, b) => a - b)[0];
      this.frameSnapshots.delete(oldestKey);
    }

    return snapshot;
  }

  public captureFrame(frameIndex: number): void {
    this.captureSnapshot(frameIndex);
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

  public rewindToFrame(frameIndex: number): boolean {
    const res = this.restoreFrameSnapshot(frameIndex);
    return res.success;
  }

  public takeSnapshot(name: string): AuthWorkspaceSnapshot {
    const snap = this.substrate.exportSnapshot();
    this.namedSnapshots.set(name, snap);
    return snap;
  }

  public restoreSnapshot(name: string): boolean {
    const snap = this.namedSnapshots.get(name);
    if (!snap) return false;
    this.substrate.importSnapshot(snap);
    return true;
  }

  public getSnapshot(frameIndex: number): AuthWorkspaceSnapshot | undefined {
    return this.frameSnapshots.get(frameIndex);
  }

  public clear(): void {
    this.frameSnapshots.clear();
    this.namedSnapshots.clear();
  }
}
