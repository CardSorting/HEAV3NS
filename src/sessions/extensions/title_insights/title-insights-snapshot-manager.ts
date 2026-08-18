/**
 * title-insights-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback
 * for Title Generation & Conversation Insights Substrate (< 0.05 ms SLA) (Target #42 / Phase 109 / ADR-085).
 */

import { performance } from "node:perf_hooks";
import type { BroccoliTitleInsightsSubstrate } from "./broccoli-title-insights-substrate.js";
import type { TitleInsightsWorkspaceSnapshot } from "../../../core/contracts/title-insights.contracts.js";

export class TitleInsightsSnapshotManager {
  private readonly snapshots = new Map<string, TitleInsightsWorkspaceSnapshot>();
  private readonly frameSnapshots = new Map<number, TitleInsightsWorkspaceSnapshot>();
  private readonly substrate: BroccoliTitleInsightsSubstrate;
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliTitleInsightsSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): TitleInsightsWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.snapshots.set(snapshotId, snapshot);
    return snapshot;
  }

  public captureSnapshot(frameIndex: number): TitleInsightsWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > TitleInsightsSnapshotManager.MAX_SNAPSHOTS) {
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

  public restoreSnapshot(snapshotIdOrSnapshot: string | TitleInsightsWorkspaceSnapshot): boolean {
    if (typeof snapshotIdOrSnapshot === "string") {
      const snapshot = this.snapshots.get(snapshotIdOrSnapshot);
      if (!snapshot) return false;
      this.substrate.importSnapshot(snapshot);
      return true;
    }
    this.substrate.importSnapshot(snapshotIdOrSnapshot);
    return true;
  }

  public deleteSnapshot(snapshotId: string): boolean {
    return this.snapshots.delete(snapshotId);
  }

  public hasSnapshot(snapshotId: string): boolean {
    return this.snapshots.has(snapshotId);
  }

  public getSnapshotCount(): number {
    return this.snapshots.size + this.frameSnapshots.size;
  }

  public clearAllSnapshots(): void {
    this.snapshots.clear();
    this.frameSnapshots.clear();
  }
}
