/**
 * url-safety-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for SSRF Defense Firewall & URL Normalizer Subsystem (Phase 118 / ADR-094 / Target #51).
 */

import type { BroccoliUrlSafetySubstrate } from "./broccoli-url-safety-substrate.js";
import type { UrlSafetyWorkspaceSnapshot } from "../../../core/contracts/url-safety.contracts.js";

export class UrlSafetySnapshotManager {
  private readonly substrate: BroccoliUrlSafetySubstrate;
  private readonly snapshotStorage = new Map<string, UrlSafetyWorkspaceSnapshot>();

  constructor(substrate: BroccoliUrlSafetySubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): UrlSafetyWorkspaceSnapshot {
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
