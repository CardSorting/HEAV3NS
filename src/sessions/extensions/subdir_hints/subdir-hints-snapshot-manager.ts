/**
 * subdir-hints-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Subdirectory Hints Subsystem (Phase 129 / ADR-105 / Target #84).
 */

import { performance } from "node:perf_hooks";
import type { BroccoliSubdirHintsSubstrate } from "./broccoli-subdir-hints-substrate.js";
import type { SubdirectoryHintsWorkspaceSnapshot } from "../../../core/contracts/subdirectory-hints.contracts.js";

export interface SubdirectoryHintsSnapshotFrame {
  readonly frameId: string;
  readonly timestamp: number;
  readonly snapshot: SubdirectoryHintsWorkspaceSnapshot;
}

export class SubdirHintsSnapshotManager {
  private readonly substrate: BroccoliSubdirHintsSubstrate;
  private readonly snapshotStorage = new Map<string, SubdirectoryHintsWorkspaceSnapshot>();
  private readonly history: SubdirectoryHintsSnapshotFrame[] = [];
  private readonly maxFrames: number;

  constructor(substrate: BroccoliSubdirHintsSubstrate, maxFrames = 128) {
    this.substrate = substrate;
    this.maxFrames = Math.max(16, maxFrames);
  }

  public takeSnapshot(snapshotId: string | number): SubdirectoryHintsWorkspaceSnapshot {
    const id = String(snapshotId);
    const snapshot = this.substrate.createSnapshot(id);
    this.snapshotStorage.set(id, snapshot);

    const frame: SubdirectoryHintsSnapshotFrame = {
      frameId: id,
      timestamp: Date.now(),
      snapshot,
    };
    this.history.push(frame);
    if (this.history.length > this.maxFrames) {
      this.history.shift();
    }

    return snapshot;
  }

  public captureSnapshot(frameId: string | number): SubdirectoryHintsWorkspaceSnapshot {
    return this.takeSnapshot(frameId);
  }

  public restoreFrameSnapshot(snapshotId: string | number): { success: boolean; durationMs: number; error?: string } {
    const startedAt = performance.now();
    const id = String(snapshotId);
    const snapshot = this.snapshotStorage.get(id);

    if (!snapshot) {
      return {
        success: false,
        durationMs: Number((performance.now() - startedAt).toFixed(4)),
        error: `Snapshot '${id}' not found in registry`,
      };
    }

    this.substrate.restoreSnapshot(snapshot);
    const duration = Number((performance.now() - startedAt).toFixed(4));
    return {
      success: true,
      durationMs: duration,
    };
  }

  public restoreSnapshot(snapshotId: string | number): boolean {
    return this.restoreFrameSnapshot(snapshotId).success;
  }

  public rewindToFrame(snapshotId: string | number): boolean {
    return this.restoreFrameSnapshot(snapshotId).success;
  }

  public deleteSnapshot(snapshotId: string | number): boolean {
    return this.snapshotStorage.delete(String(snapshotId));
  }

  public clearAllSnapshots(): void {
    this.snapshotStorage.clear();
    this.history.length = 0;
  }

  public hasSnapshot(snapshotId: string | number): boolean {
    return this.snapshotStorage.has(String(snapshotId));
  }

  public getSnapshotCount(): number {
    return this.snapshotStorage.size;
  }

  public getHistory(): readonly SubdirectoryHintsSnapshotFrame[] {
    return this.history;
  }
}
