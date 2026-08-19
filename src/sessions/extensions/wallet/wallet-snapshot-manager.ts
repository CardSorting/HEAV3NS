/**
 * wallet-snapshot-manager.ts
 *
 * High-performance frame snapshot manager for Autonomous Agent Wallet & DeFi Subsystem
 * enabling frame-perfect state capture and O(1) state rewind (< 0.05 ms SLA) (Phase 91/93 / ADR-123 / ADR-043).
 */

import { performance } from "node:perf_hooks";
import type {
  WalletSubstrateSnapshot,
} from "../../../core/contracts/wallet.contracts.js";
import { BroccoliWalletSubstrate } from "./broccoli-wallet-substrate.js";

export class WalletSnapshotManager {
  private readonly substrate: BroccoliWalletSubstrate;
  private readonly frameSnapshots: Map<number, WalletSubstrateSnapshot>;
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: BroccoliWalletSubstrate) {
    this.substrate = substrate;
    this.frameSnapshots = new Map<number, WalletSubstrateSnapshot>();
  }

  createSnapshot(): WalletSubstrateSnapshot {
    return this.substrate.exportSnapshot();
  }

  restoreSnapshot(snapshot: WalletSubstrateSnapshot): void {
    this.substrate.importSnapshot(snapshot);
  }

  /**
   * Captures a deep workspace snapshot pinned to an execution frame.
   */
  captureSnapshot(frameIndex: number): WalletSubstrateSnapshot {
    const snapshot = this.substrate.exportSnapshot();
    this.frameSnapshots.set(frameIndex, snapshot);

    if (this.frameSnapshots.size > WalletSnapshotManager.MAX_SNAPSHOTS) {
      const oldestKey = Array.from(this.frameSnapshots.keys()).sort((a, b) => a - b)[0];
      this.frameSnapshots.delete(oldestKey);
    }

    return snapshot;
  }

  /**
   * Restores workspace state to a captured execution frame in < 0.05 ms SLA.
   */
  restoreFrameSnapshot(frameIndex: number): { success: boolean; durationMs: number; error?: string } {
    const startedAt = performance.now();
    const snapshot = this.frameSnapshots.get(frameIndex);

    if (!snapshot) {
      return {
        success: false,
        durationMs: Number((performance.now() - startedAt).toFixed(4)),
        error: `Frame snapshot #${frameIndex} not found in ring buffer`,
      };
    }

    this.substrate.importSnapshot(snapshot);
    const duration = Number((performance.now() - startedAt).toFixed(4));

    return {
      success: true,
      durationMs: duration,
    };
  }

  captureFrame(frameIndex: number): WalletSubstrateSnapshot {
    return this.captureSnapshot(frameIndex);
  }

  rewindToFrame(frameIndex: number): boolean {
    const res = this.restoreFrameSnapshot(frameIndex);
    return res.success;
  }

  getSnapshot(frameIndex: number): WalletSubstrateSnapshot | undefined {
    return this.frameSnapshots.get(frameIndex);
  }

  clear(): void {
    this.frameSnapshots.clear();
  }
}
