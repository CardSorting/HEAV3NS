/**
 * doc-extractor-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Structured Document Extractor and Opaque Write Guard Subsystem (Phase 116 / ADR-092 / Target #49).
 */

import type { BroccoliDocExtractorSubstrate } from "./broccoli-doc-extractor-substrate.js";
import type { DocExtractorWorkspaceSnapshot } from "../../../core/contracts/doc-extractor.contracts.js";

export class DocExtractorSnapshotManager {
  private readonly substrate: BroccoliDocExtractorSubstrate;
  private readonly snapshotStorage = new Map<string, DocExtractorWorkspaceSnapshot>();

  constructor(substrate: BroccoliDocExtractorSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): DocExtractorWorkspaceSnapshot {
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
