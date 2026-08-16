/**
 * broccoli-v4a-patch-substrate.ts
 *
 * In-memory Broccolidb repository storing applied V4A patch transactions,
 * modified file records, and aggregate engine metrics (Phase 119 / ADR-095 / Target #52).
 */

import type {
  V4aApplyResult,
  V4aPatchMetrics,
  V4aPatchWorkspaceSnapshot,
} from "../../../core/contracts/v4a-patch.contracts.js";

export class BroccoliV4aPatchSubstrate {
  private readonly patchHistory: V4aApplyResult[] = [];
  private totalPatchesParsed = 0;
  private totalPatchesApplied = 0;
  private totalHunksProcessed = 0;
  private totalFilesModified = 0;

  public recordParsedPatch(hunksCount: number): void {
    this.totalPatchesParsed++;
    this.totalHunksProcessed += hunksCount;
  }

  public recordAppliedPatch(result: V4aApplyResult): void {
    this.patchHistory.push(result);
    if (this.patchHistory.length > 500) {
      this.patchHistory.shift();
    }
    if (result.success) {
      this.totalPatchesApplied++;
      this.totalFilesModified += result.modifiedFiles.length;
    }
  }

  public getPatchHistory(): readonly V4aApplyResult[] {
    return this.patchHistory;
  }

  public getMetrics(): V4aPatchMetrics {
    return {
      totalPatchesParsed: this.totalPatchesParsed,
      totalPatchesApplied: this.totalPatchesApplied,
      totalHunksProcessed: this.totalHunksProcessed,
      totalFilesModified: this.totalFilesModified,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): V4aPatchWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      patchHistory: [...this.patchHistory],
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: V4aPatchWorkspaceSnapshot): void {
    this.patchHistory.length = 0;
    this.patchHistory.push(...snapshot.patchHistory);

    this.totalPatchesParsed = snapshot.metrics.totalPatchesParsed;
    this.totalPatchesApplied = snapshot.metrics.totalPatchesApplied;
    this.totalHunksProcessed = snapshot.metrics.totalHunksProcessed;
    this.totalFilesModified = snapshot.metrics.totalFilesModified;
  }

  public clear(): void {
    this.patchHistory.length = 0;
    this.totalPatchesParsed = 0;
    this.totalPatchesApplied = 0;
    this.totalHunksProcessed = 0;
    this.totalFilesModified = 0;
  }
}
