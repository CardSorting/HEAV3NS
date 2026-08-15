import type {
  GatewayStateSnapshot,
  IGatewaySnapshotManager,
  IBroccoliGatewaySubstrate,
  IGatewayDeliveryLedger,
} from "../../../core/contracts/gateway.contracts.js";

/**
 * Frame-perfect binary snapshot and rollback manager for messaging gateway.
 */
export class GatewaySnapshotManager implements IGatewaySnapshotManager {
  private substrate: IBroccoliGatewaySubstrate;
  private ledger: IGatewayDeliveryLedger;

  constructor(substrate: IBroccoliGatewaySubstrate, ledger: IGatewayDeliveryLedger) {
    this.substrate = substrate;
    this.ledger = ledger;
  }

  setSubstrate(substrate: IBroccoliGatewaySubstrate): void {
    this.substrate = substrate;
  }

  setLedger(ledger: IGatewayDeliveryLedger): void {
    this.ledger = ledger;
  }

  createSnapshot(tick: number): GatewayStateSnapshot {
    const channels = this.substrate.listChannels();
    const history = this.ledger.getHistory(500);
    const pending = this.ledger.getPending();

    return {
      channels: channels.map((c) => ({ ...c })),
      pendingDeliveryCount: pending.length,
      deliveryLedgerSnapshot: history.map((item) => ({ ...item, chunks: [...item.chunks] })),
      snapshotTick: tick,
    };
  }

  restoreSnapshot(snapshot: GatewayStateSnapshot): void {
    this.substrate.clear();
    for (const ch of snapshot.channels) {
      this.substrate.registerChannel({ ...ch });
    }

    this.ledger.clear();
    for (const item of snapshot.deliveryLedgerSnapshot) {
      const enqueued = this.ledger.enqueue(
        {
          id: item.id,
          platform: item.platform,
          channelId: item.channelId,
          content: item.content,
          threadId: item.threadId,
          error: item.error,
          deliveredTimestampMs: item.deliveredTimestampMs,
        },
        item.chunks
      );
      this.ledger.markStatus(enqueued.id, item.status, item.error);
    }
  }
}
