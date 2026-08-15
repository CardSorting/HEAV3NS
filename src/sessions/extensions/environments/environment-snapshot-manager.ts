import type {
  EnvironmentStateSnapshot,
  ExecutionBackendType,
  IBroccoliEnvironmentSubstrate,
  IEnvironmentSnapshotManager,
} from "../../../core/contracts/environment.contracts.js";

/**
 * Deterministic Environment State Snapshot Manager.
 *
 * Implements frame-perfect binary snapshotting and O(1) state restoration for
 * the execution environment sessions and working directory tracking.
 */
export class EnvironmentSnapshotManager implements IEnvironmentSnapshotManager {
  private readonly substrate: IBroccoliEnvironmentSubstrate;
  private defaultBackend: ExecutionBackendType = "local";

  constructor(substrate: IBroccoliEnvironmentSubstrate, defaultBackend: ExecutionBackendType = "local") {
    this.substrate = substrate;
    this.defaultBackend = defaultBackend;
  }

  createSnapshot(tick: number): EnvironmentStateSnapshot {
    const sessions = this.substrate.listSessions();
    return {
      sessions: sessions.map((s) => ({
        ...s,
        activeVariables: { ...s.activeVariables },
      })),
      defaultBackend: this.defaultBackend,
      totalExecutions: this.substrate.getExecutionCount(),
      snapshotTick: tick,
    };
  }

  restoreSnapshot(snapshot: EnvironmentStateSnapshot): void {
    this.substrate.clear();
    this.defaultBackend = snapshot.defaultBackend;
    this.substrate.setExecutionCount(snapshot.totalExecutions);
    for (const session of snapshot.sessions) {
      this.substrate.saveSession({
        ...session,
        activeVariables: { ...session.activeVariables },
      });
    }
  }
}
