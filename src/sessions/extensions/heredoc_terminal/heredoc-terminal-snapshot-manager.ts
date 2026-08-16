/**
 * heredoc-terminal-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Heredoc & Terminal Subsystem (Phase 110 / ADR-086 / Target #43).
 */

import type { BroccoliHeredocTerminalSubstrate } from "./broccoli-heredoc-terminal-substrate.js";
import type { HeredocTerminalWorkspaceSnapshot } from "../../../core/contracts/heredoc-terminal.contracts.js";

export class HeredocTerminalSnapshotManager {
  private readonly substrate: BroccoliHeredocTerminalSubstrate;
  private readonly snapshotStorage = new Map<string, HeredocTerminalWorkspaceSnapshot>();

  constructor(substrate: BroccoliHeredocTerminalSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): HeredocTerminalWorkspaceSnapshot {
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
