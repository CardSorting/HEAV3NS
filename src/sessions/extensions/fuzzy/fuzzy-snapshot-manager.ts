/**
 * fuzzy-snapshot-manager.ts
 *
 * Frame-perfect binary snapshots and instant O(1) state rollback for the
 * fuzzy matching substrate (Phase 103 / ADR-057).
 */

import type { FuzzyWorkspaceSnapshot } from "../../../core/contracts/fuzzy-matcher.contracts.js";
import { BroccoliFuzzySubstrate } from "./broccoli-fuzzy-substrate.js";

export class FuzzySnapshotManager {
  private substrate: BroccoliFuzzySubstrate;
  private snapshots: Map<number, FuzzyWorkspaceSnapshot>;

  constructor(substrate: BroccoliFuzzySubstrate) {
    this.substrate = substrate;
    this.snapshots = new Map<number, FuzzyWorkspaceSnapshot>();
  }

  captureFrame(frameId: number): FuzzyWorkspaceSnapshot {
    const snap = this.substrate.toSnapshot();
    this.snapshots.set(frameId, snap);
    return snap;
  }

  rewindToFrame(frameId: number): boolean {
    const snap = this.snapshots.get(frameId);
    if (!snap) return false;
    this.substrate.restoreSnapshot(snap);
    return true;
  }

  clearSnapshots(): void {
    this.snapshots.clear();
  }

  getSnapshotCount(): number {
    return this.snapshots.size;
  }
}
