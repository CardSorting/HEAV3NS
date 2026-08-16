/**
 * title-insights-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback
 * for Title Generation & Conversation Insights Substrate (Target #42 / Phase 109 / ADR-085).
 */

import type { BroccoliTitleInsightsSubstrate } from "./broccoli-title-insights-substrate.js";
import type { TitleInsightsWorkspaceSnapshot } from "../../../core/contracts/title-insights.contracts.js";

export class TitleInsightsSnapshotManager {
  private readonly snapshots = new Map<string, TitleInsightsWorkspaceSnapshot>();
  private readonly substrate: BroccoliTitleInsightsSubstrate;

  constructor(substrate: BroccoliTitleInsightsSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): TitleInsightsWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.snapshots.set(snapshotId, snapshot);
    return snapshot;
  }

  public restoreSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return false;
    }
    this.substrate.restoreSnapshot(snapshot);
    return true;
  }

  public deleteSnapshot(snapshotId: string): boolean {
    return this.snapshots.delete(snapshotId);
  }

  public hasSnapshot(snapshotId: string): boolean {
    return this.snapshots.has(snapshotId);
  }

  public getSnapshotCount(): number {
    return this.snapshots.size;
  }

  public clearAllSnapshots(): void {
    this.snapshots.clear();
  }
}
