/**
 * Frame-Perfect Snapshot Manager for Goal Subsystem
 * Subsystem: Target #74 / ADR-117
 */

import type { GoalStateSnapshot } from "../../../core/contracts/goal.contracts.js";
import { BroccoliGoalSubstrate } from "./broccoli-goal-substrate.js";

export class GoalSnapshotManager {
  private readonly substrate: BroccoliGoalSubstrate;
  private readonly snapshots: Map<string, GoalStateSnapshot> = new Map();

  constructor(substrate: BroccoliGoalSubstrate) {
    this.substrate = substrate;
  }

  createSnapshot(snapshotId: string): GoalStateSnapshot {
    const snap = this.substrate.createStateSnapshot();
    this.snapshots.set(snapshotId, snap);
    return snap;
  }

  captureSnapshot(snapshotId: string): GoalStateSnapshot {
    return this.createSnapshot(snapshotId);
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
