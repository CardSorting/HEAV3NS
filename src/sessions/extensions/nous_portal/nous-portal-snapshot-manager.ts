/**
 * Frame-Perfect Snapshot Manager for Native Nous Portal Subsystem
 * Subsystem: Target #73 / ADR-116
 */

import type { NousPortalStateSnapshot } from "../../../core/contracts/nous-portal.contracts.js";
import { BroccoliNousPortalSubstrate } from "./broccoli-nous-portal-substrate.js";

export class NousPortalSnapshotManager {
  private readonly substrate: BroccoliNousPortalSubstrate;
  private readonly snapshots: Map<string, NousPortalStateSnapshot> = new Map();

  constructor(substrate: BroccoliNousPortalSubstrate) {
    this.substrate = substrate;
  }

  createSnapshot(snapshotId: string): NousPortalStateSnapshot {
    const snap = this.substrate.createStateSnapshot();
    this.snapshots.set(snapshotId, snap);
    return snap;
  }

  restoreSnapshot(snapshotId: string): boolean {
    const snap = this.snapshots.get(snapshotId);
    if (!snap) return false;
    this.substrate.restoreStateSnapshot(snap);
    return true;
  }

  hasSnapshot(snapshotId: string): boolean {
    return this.snapshots.has(snapshotId);
  }

  deleteSnapshot(snapshotId: string): boolean {
    return this.snapshots.delete(snapshotId);
  }

  clear(): void {
    this.snapshots.clear();
  }
}
