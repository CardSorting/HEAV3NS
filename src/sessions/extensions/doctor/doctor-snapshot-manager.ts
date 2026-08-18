/**
 * doctor-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback (< 0.05 ms SLA)
 * for Diagnostic Doctor Subsystem (Phase 97 / ADR-049 / Target #68).
 */

import { performance } from "node:perf_hooks";
import type { DoctorWorkspaceSnapshot } from "../../../core/contracts/diagnostic-doctor.contracts.js";
import type { BroccoliDoctorSubstrate } from "./broccoli-doctor-substrate.js";

export class DoctorSnapshotManager {
  private readonly substrate: BroccoliDoctorSubstrate;
  private readonly frameSnapshots = new Map<number, DoctorWorkspaceSnapshot>();
  private readonly namedSnapshots = new Map<string, DoctorWorkspaceSnapshot>();
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliDoctorSubstrate) {
    this.substrate = substrate;
  }

  public captureSnapshot(frameIndex: number): DoctorWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > DoctorSnapshotManager.MAX_SNAPSHOTS) {
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

  public takeSnapshot(name: string): DoctorWorkspaceSnapshot {
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

  public getSnapshot(frameIndex: number): DoctorWorkspaceSnapshot | undefined {
    return this.frameSnapshots.get(frameIndex);
  }

  public clear(): void {
    this.frameSnapshots.clear();
    this.namedSnapshots.clear();
  }
}
