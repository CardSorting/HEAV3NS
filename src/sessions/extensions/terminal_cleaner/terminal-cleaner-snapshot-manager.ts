/**
 * terminal-cleaner-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Terminal Cleaner Subsystem (Phase 136 / ADR-112 / Target #69).
 */

import type { BroccoliTerminalCleanerSubstrate } from "./broccoli-terminal-cleaner-substrate.js";
import type { TerminalCleanerWorkspaceSnapshot } from "../../../core/contracts/terminal-cleaner.contracts.js";

export class TerminalCleanerSnapshotManager {
  private readonly substrate: BroccoliTerminalCleanerSubstrate;
  private readonly snapshotStorage = new Map<string, TerminalCleanerWorkspaceSnapshot>();

  constructor(substrate: BroccoliTerminalCleanerSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): TerminalCleanerWorkspaceSnapshot {
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
