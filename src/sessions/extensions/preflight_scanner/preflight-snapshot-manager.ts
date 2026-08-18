/**
 * preflight-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Pre-Exec Security Scanner Subsystem (Phase 113 / ADR-089 / Target #79).
 */

import { performance } from "node:perf_hooks";
import type { BroccoliPreflightSubstrate } from "./broccoli-preflight-substrate.js";
import type { PreflightWorkspaceSnapshot } from "../../../core/contracts/preflight-scanner.contracts.js";

export interface PreflightSnapshotFrame {
  readonly frameId: number;
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly snapshot: PreflightWorkspaceSnapshot;
}

export class PreflightSnapshotManager {
  private readonly substrate: BroccoliPreflightSubstrate;
  private readonly history: PreflightSnapshotFrame[] = [];
  private readonly snapshotStorage = new Map<string, PreflightWorkspaceSnapshot>();
  private readonly maxFrames: number;

  constructor(substrate: BroccoliPreflightSubstrate, maxFrames = 128) {
    this.substrate = substrate;
    this.maxFrames = Math.max(16, maxFrames);
  }

  public takeSnapshot(snapshotId: string): PreflightWorkspaceSnapshot {
    const snapshot = this.substrate.createSnapshot(snapshotId);
    this.snapshotStorage.set(snapshotId, snapshot);

    const frame: PreflightSnapshotFrame = {
      frameId: this.history.length + 1,
      snapshotId,
      timestamp: Date.now(),
      snapshot,
    };
    this.history.push(frame);
    if (this.history.length > this.maxFrames) {
      this.history.shift();
    }

    return snapshot;
  }

  public captureSnapshot(frameId: number): PreflightWorkspaceSnapshot {
    const snapshotId = `frame-${frameId}-${Date.now()}`;
    const snapshot = this.substrate.createSnapshot(snapshotId);
    const frame: PreflightSnapshotFrame = {
      frameId,
      snapshotId,
      timestamp: Date.now(),
      snapshot,
    };
    this.history.push(frame);
    if (this.history.length > this.maxFrames) {
      this.history.shift();
    }
    return snapshot;
  }

  public restoreFrameSnapshot(frameId: number): { success: boolean; durationMs: number; error?: string } {
    const startedAt = performance.now();
    const frame = this.history.find((f) => f.frameId === frameId);

    if (!frame) {
      return {
        success: false,
        durationMs: Number((performance.now() - startedAt).toFixed(4)),
        error: `Frame #${frameId} not found in ring buffer`,
      };
    }

    this.substrate.restoreSnapshot(frame.snapshot);
    const duration = Number((performance.now() - startedAt).toFixed(4));

    return {
      success: true,
      durationMs: duration,
    };
  }

  public restoreSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshotStorage.get(snapshotId);
    if (!snapshot) {
      return false;
    }
    this.substrate.restoreSnapshot(snapshot);
    return true;
  }

  public deleteSnapshot(snapshotId: string): boolean {
    return this.snapshotStorage.delete(snapshotId);
  }

  public clearAllSnapshots(): void {
    this.snapshotStorage.clear();
    this.history.length = 0;
  }

  public hasSnapshot(snapshotId: string): boolean {
    return this.snapshotStorage.has(snapshotId);
  }

  public getSnapshotCount(): number {
    return this.snapshotStorage.size;
  }

  public getHistory(): readonly PreflightSnapshotFrame[] {
    return this.history;
  }
}
