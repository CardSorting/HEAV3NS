/**
 * integrations-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback for the Enterprise Integrations Hub (Phase 96 / ADR-126).
 */

import type { IntegrationsSubstrateSnapshot } from "../../../core/contracts/integrations.contracts.js";
import { BroccoliIntegrationsSubstrate } from "./broccoli-integrations-substrate.js";

export class IntegrationsSnapshotManager {
  private substrate: BroccoliIntegrationsSubstrate;
  private snapshots: Map<number, IntegrationsSubstrateSnapshot>;

  constructor(substrate: BroccoliIntegrationsSubstrate) {
    this.substrate = substrate;
    this.snapshots = new Map<number, IntegrationsSubstrateSnapshot>();
  }

  captureFrame(frameIndex: number): void {
    const snapshot = this.substrate.exportSnapshot();
    this.snapshots.set(frameIndex, snapshot);
  }

  rewindToFrame(frameIndex: number): boolean {
    const snapshot = this.snapshots.get(frameIndex);
    if (!snapshot) {
      return false;
    }

    this.substrate.importSnapshot(snapshot);

    // Prune subsequent frame snapshots
    const keys = Array.from(this.snapshots.keys());
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key > frameIndex) {
        this.snapshots.delete(key);
      }
    }

    return true;
  }

  getSnapshot(frameIndex: number): IntegrationsSubstrateSnapshot | undefined {
    return this.snapshots.get(frameIndex);
  }

  clear(): void {
    this.snapshots.clear();
  }
}
