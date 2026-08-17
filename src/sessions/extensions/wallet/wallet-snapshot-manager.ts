/**
 * wallet-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback for the Native Wallet Subsystem (Phase 93 / ADR-123).
 */

import type { WalletSubstrateSnapshot } from "../../../core/contracts/wallet.contracts.js";
import { BroccoliWalletSubstrate } from "./broccoli-wallet-substrate.js";

export class WalletSnapshotManager {
  private substrate: BroccoliWalletSubstrate;
  private snapshots: Map<number, WalletSubstrateSnapshot>;

  constructor(substrate: BroccoliWalletSubstrate) {
    this.substrate = substrate;
    this.snapshots = new Map<number, WalletSubstrateSnapshot>();
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

  getSnapshot(frameIndex: number): WalletSubstrateSnapshot | undefined {
    return this.snapshots.get(frameIndex);
  }

  clear(): void {
    this.snapshots.clear();
  }
}
