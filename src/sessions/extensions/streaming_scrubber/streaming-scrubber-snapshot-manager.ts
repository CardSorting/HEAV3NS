/**
 * streaming-scrubber-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Streaming Think Scrubber Subsystem (Phase 137 / ADR-113 / Target #70).
 */

import type { BroccoliStreamingScrubberSubstrate } from "./broccoli-streaming-scrubber-substrate.js";
import type { StreamingThinkScrubberWorkspaceSnapshot } from "../../../core/contracts/streaming-think-scrubber.contracts.js";

export class StreamingScrubberSnapshotManager {
  private readonly substrate: BroccoliStreamingScrubberSubstrate;
  private readonly snapshotStorage = new Map<string, StreamingThinkScrubberWorkspaceSnapshot>();

  constructor(substrate: BroccoliStreamingScrubberSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): StreamingThinkScrubberWorkspaceSnapshot {
    const snapshot = this.substrate.createSnapshot(snapshotId);
    this.snapshotStorage.set(snapshotId, snapshot);
    return snapshot;
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
  }

  public hasSnapshot(snapshotId: string): boolean {
    return this.snapshotStorage.has(snapshotId);
  }

  public getSnapshotCount(): number {
    return this.snapshotStorage.size;
  }
}
