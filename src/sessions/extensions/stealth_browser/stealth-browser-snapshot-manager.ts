/**
 * stealth-browser-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Camoufox Stealth Browser Subsystem (Phase 111 / ADR-087 / Target #44).
 */

import type { BroccoliStealthBrowserSubstrate } from "./broccoli-stealth-browser-substrate.js";
import type { StealthBrowserWorkspaceSnapshot } from "../../../core/contracts/stealth-browser.contracts.js";

export class StealthBrowserSnapshotManager {
  private readonly substrate: BroccoliStealthBrowserSubstrate;
  private readonly snapshotStorage = new Map<string, StealthBrowserWorkspaceSnapshot>();

  constructor(substrate: BroccoliStealthBrowserSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): StealthBrowserWorkspaceSnapshot {
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
