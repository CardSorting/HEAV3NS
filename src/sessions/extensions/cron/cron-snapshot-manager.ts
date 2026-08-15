import type {
  CronStateSnapshot,
  ICronSnapshotManager,
} from "../../../core/contracts/cron.contracts.js";
import { BroccoliCronSubstrate } from "./broccoli-cron-substrate.js";

/**
 * CronSnapshotManager.
 * Absorbed under ADR-016 (AKD-DSO Osmosis Paradigm).
 *
 * Captures frame-level snapshots of the cron state and provides instant O(1)
 * rollback restoring all job manifests and execution histories.
 */
export class CronSnapshotManager implements ICronSnapshotManager {
  private readonly substrate: BroccoliCronSubstrate;
  private readonly snapshotHistory: CronStateSnapshot[] = [];
  private readonly maxSnapshotRetention = 20;

  constructor(substrate: BroccoliCronSubstrate) {
    this.substrate = substrate;
  }

  createSnapshot(snapshotTick: number): CronStateSnapshot {
    const jobs = this.substrate.listJobs();
    const executionHistory = this.substrate.getExecutionHistory(undefined, 100);

    const snapshot: CronStateSnapshot = {
      jobs: Object.freeze(jobs.map((j) => Object.freeze({ ...j }))),
      executionHistory: Object.freeze(executionHistory.map((e) => Object.freeze({ ...e }))),
      timestamp: Date.now(),
      snapshotTick,
    };

    this.snapshotHistory.push(snapshot);
    if (this.snapshotHistory.length > this.maxSnapshotRetention) {
      this.snapshotHistory.shift();
    }

    return Object.freeze(snapshot);
  }

  restoreSnapshot(snapshot: CronStateSnapshot): void {
    this.substrate.clear();

    for (const job of snapshot.jobs) {
      this.substrate.storeJob(job);
    }

    for (const record of snapshot.executionHistory) {
      this.substrate.recordExecution(record);
    }
  }

  getRecentSnapshots(): readonly CronStateSnapshot[] {
    return Object.freeze([...this.snapshotHistory]);
  }
}
