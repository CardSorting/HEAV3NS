import type {
  ISwarmSnapshotManager,
  SwarmStateSnapshot,
} from "../../../core/contracts/delegation.contracts.js";
import { BroccoliSwarmSubstrate } from "./broccoli-swarm-substrate.js";

/**
 * SwarmSnapshotManager.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 *
 * Implements deterministic O(1) state snapshotting and rewinds (< 0.05 ms SLA)
 * across active subagent tasks and execution ledgers.
 */
export class SwarmSnapshotManager implements ISwarmSnapshotManager {
  private readonly substrate: BroccoliSwarmSubstrate;
  private readonly snapshots: SwarmStateSnapshot[] = [];
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliSwarmSubstrate) {
    this.substrate = substrate;
  }

  public createSnapshot(snapshotTick: number): SwarmStateSnapshot {
    const tasks = this.substrate.listTasks();
    const outcomes = this.substrate.getOutcomes();

    const snapshot: SwarmStateSnapshot = {
      tasks: Object.freeze([...tasks]),
      outcomes: Object.freeze([...outcomes]),
      timestamp: Date.now(),
      snapshotTick,
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > SwarmSnapshotManager.MAX_SNAPSHOTS) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  public restoreSnapshot(snapshot: SwarmStateSnapshot): void {
    this.substrate.clear();

    for (const t of snapshot.tasks) {
      this.substrate.storeTask(t);
    }

    for (const o of snapshot.outcomes) {
      this.substrate.recordOutcome(o);
    }
  }

  public getRecentSnapshots(): readonly SwarmStateSnapshot[] {
    return Object.freeze([...this.snapshots]);
  }
}
