/**
 * env-probe-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Toolchain Environment Probe Subsystem (Phase 134 / ADR-110 / Target #67).
 */

import type { BroccoliEnvProbeSubstrate } from "./broccoli-env-probe-substrate.js";
import type { EnvProbeWorkspaceSnapshot } from "../../../core/contracts/env-probe.contracts.js";

export class EnvProbeSnapshotManager {
  private readonly substrate: BroccoliEnvProbeSubstrate;
  private readonly snapshotStorage = new Map<string, EnvProbeWorkspaceSnapshot>();

  constructor(substrate: BroccoliEnvProbeSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): EnvProbeWorkspaceSnapshot {
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
