/**
 * gateway-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rollback for the Native Gateway Subsystem (Phase 94 / ADR-124).
 */

import type { GatewayStateSnapshot, GatewaySubstrateSnapshot } from "../../../core/contracts/gateway.contracts.js";
import { BroccoliGatewaySubstrate } from "./broccoli-gateway-substrate.js";
import { GatewayDeliveryLedger } from "./gateway-delivery-ledger.js";

export class GatewaySnapshotManager {
  private substrate: BroccoliGatewaySubstrate;
  private ledger?: GatewayDeliveryLedger;
  private snapshots: Map<number, GatewaySubstrateSnapshot>;

  constructor(substrate: BroccoliGatewaySubstrate, ledger?: GatewayDeliveryLedger) {
    this.substrate = substrate;
    this.ledger = ledger;
    this.snapshots = new Map<number, GatewaySubstrateSnapshot>();
  }

  captureFrame(frameIndex: number): void {
    const snapshot = this.substrate.exportSnapshot();
    this.snapshots.set(frameIndex, snapshot);
  }

  createSnapshot(frameIndex: number): GatewayStateSnapshot {
    this.captureFrame(frameIndex);
    const snap = this.substrate.exportSnapshot();
    return {
      channels: this.substrate.listChannels(),
      totalInbound: snap.totalInbound,
      totalOutbound: snap.totalOutbound,
      timestampMs: snap.timestamp,
    };
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

  restoreSnapshot(snapshot: GatewayStateSnapshot | GatewaySubstrateSnapshot): void {
    if ("channels" in snapshot) {
      this.substrate.clear();
      for (const ch of snapshot.channels) {
        this.substrate.registerChannel(ch);
      }
    } else {
      this.substrate.importSnapshot(snapshot);
    }
  }

  getSnapshot(frameIndex: number): GatewaySubstrateSnapshot | undefined {
    return this.snapshots.get(frameIndex);
  }

  clear(): void {
    this.snapshots.clear();
  }
}
