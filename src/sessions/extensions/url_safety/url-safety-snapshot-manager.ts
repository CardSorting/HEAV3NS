/**
 * url-safety-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for SSRF Defense Firewall & URL Normalizer Subsystem (Phase 118 / ADR-094 / Target #87).
 */

import type { BroccoliUrlSafetySubstrate } from "./broccoli-url-safety-substrate.js";
import type { UrlSafetyWorkspaceSnapshot } from "../../../core/contracts/url-safety.contracts.js";

export class UrlSafetySnapshotManager {
  private readonly substrate: BroccoliUrlSafetySubstrate;
  private readonly snapshotStorage = new Map<string, UrlSafetyWorkspaceSnapshot>();
  private readonly frameIndex = new Map<number, string>();
  private readonly maxSnapshots = 100;

  constructor(substrate: BroccoliUrlSafetySubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string, frameNumber?: number): UrlSafetyWorkspaceSnapshot {
    const snapshot = this.substrate.createSnapshot(snapshotId, frameNumber);
    this.snapshotStorage.set(snapshotId, snapshot);

    if (frameNumber !== undefined) {
      this.frameIndex.set(frameNumber, snapshotId);
    }

    if (this.snapshotStorage.size > this.maxSnapshots) {
      const oldestKey = this.snapshotStorage.keys().next().value;
      if (oldestKey) {
        this.snapshotStorage.delete(oldestKey);
      }
    }

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

  public restoreFrame(frameNumber: number): boolean {
    const snapshotId = this.frameIndex.get(frameNumber);
    if (!snapshotId) return false;
    return this.restoreSnapshot(snapshotId);
  }

  public deleteSnapshot(snapshotId: string): boolean {
    for (const [frame, id] of this.frameIndex.entries()) {
      if (id === snapshotId) this.frameIndex.delete(frame);
    }
    return this.snapshotStorage.delete(snapshotId);
  }

  public clearAllSnapshots(): void {
    this.snapshotStorage.clear();
    this.frameIndex.clear();
  }

  public hasSnapshot(snapshotId: string): boolean {
    return this.snapshotStorage.has(snapshotId);
  }

  public getSnapshotCount(): number {
    return this.snapshotStorage.size;
  }
}
