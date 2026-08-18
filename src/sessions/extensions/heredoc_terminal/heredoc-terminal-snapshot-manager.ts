/**
 * heredoc-terminal-snapshot-manager.ts
 *
 * Frame-perfect snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Heredoc & Terminal Subsystem (Phase 110 / ADR-086 / Target #86).
 */

import type { BroccoliHeredocTerminalSubstrate } from "./broccoli-heredoc-terminal-substrate.js";
import type { HeredocTerminalWorkspaceSnapshot } from "../../../core/contracts/heredoc-terminal.contracts.js";

export class HeredocTerminalSnapshotManager {
  private readonly substrate: BroccoliHeredocTerminalSubstrate;
  private readonly snapshots = new Map<string, HeredocTerminalWorkspaceSnapshot>();
  private readonly frameSnapshots = new Map<number, HeredocTerminalWorkspaceSnapshot>();
  private readonly maxSnapshots: number;

  constructor(substrate: BroccoliHeredocTerminalSubstrate, maxSnapshots = 100) {
    this.substrate = substrate;
    this.maxSnapshots = maxSnapshots;
  }

  public captureSnapshot(frameNumber?: number): HeredocTerminalWorkspaceSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    const snapshotId = snapshot.snapshotId;

    if (frameNumber !== undefined) {
      this.frameSnapshots.set(frameNumber, snapshot);
      if (this.frameSnapshots.size > this.maxSnapshots) {
        const oldest = Math.min(...Array.from(this.frameSnapshots.keys()));
        this.frameSnapshots.delete(oldest);
      }
    }

    this.snapshots.set(snapshotId, snapshot);
    if (this.snapshots.size > this.maxSnapshots) {
      const first = this.snapshots.keys().next().value;
      if (first) this.snapshots.delete(first);
    }

    return snapshot;
  }

  public takeSnapshot(snapshotId: string): HeredocTerminalWorkspaceSnapshot {
    const snapshot = this.substrate.createSnapshot(snapshotId);
    this.snapshots.set(snapshotId, snapshot);
    return snapshot;
  }

  public restoreSnapshot(snapshotId: string): boolean {
    const snap = this.snapshots.get(snapshotId);
    if (!snap) return false;
    this.substrate.importSnapshot(snap);
    return true;
  }

  public restoreFrameSnapshot(frameNumber: number): { success: boolean; latencyMs: number } {
    const start = performance.now();
    const snap = this.frameSnapshots.get(frameNumber);
    if (!snap) {
      return { success: false, latencyMs: performance.now() - start };
    }
    this.substrate.importSnapshot(snap);
    return { success: true, latencyMs: performance.now() - start };
  }

  public deleteSnapshot(snapshotId: string): boolean {
    return this.snapshots.delete(snapshotId);
  }

  public clearAllSnapshots(): void {
    this.snapshots.clear();
    this.frameSnapshots.clear();
  }

  public hasSnapshot(snapshotId: string): boolean {
    return this.snapshots.has(snapshotId);
  }

  public getSnapshotCount(): number {
    return this.snapshots.size;
  }
}
