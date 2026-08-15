import type {
  GatewayDeliveryStatus,
  GatewayOutboundPayload,
  IGatewayDeliveryLedger,
} from "../../../core/contracts/gateway.contracts.js";

/**
 * Bounded Delivery Ledger for Outbound Gateway Payloads.
 *
 * Enforces a strict 500-item maximum capacity with automatic backpressure pruning.
 */
export class GatewayDeliveryLedger implements IGatewayDeliveryLedger {
  private readonly maxCapacity: number;
  private readonly items = new Map<string, GatewayOutboundPayload>();
  private readonly insertionOrder: string[] = [];

  constructor(maxCapacity = 500) {
    this.maxCapacity = maxCapacity;
  }

  enqueue(
    payload: Omit<GatewayOutboundPayload, "chunks" | "status" | "attempts" | "timestampMs">,
    chunks: readonly string[]
  ): GatewayOutboundPayload {
    if (this.insertionOrder.length >= this.maxCapacity) {
      const oldestId = this.insertionOrder.shift();
      if (oldestId) {
        this.items.delete(oldestId);
      }
    }

    const item: GatewayOutboundPayload = {
      ...payload,
      chunks,
      status: "queued",
      attempts: 0,
      timestampMs: Date.now(),
    };

    this.items.set(item.id, item);
    this.insertionOrder.push(item.id);
    return item;
  }

  markStatus(payloadId: string, status: GatewayDeliveryStatus, error?: string): void {
    const existing = this.items.get(payloadId);
    if (!existing) return;

    const updated: GatewayOutboundPayload = {
      ...existing,
      status,
      attempts: existing.attempts + 1,
      deliveredTimestampMs: status === "delivered" ? Date.now() : existing.deliveredTimestampMs,
      error: error || (status === "delivered" ? undefined : existing.error),
    };

    this.items.set(payloadId, updated);
  }

  getPending(): readonly GatewayOutboundPayload[] {
    return Array.from(this.items.values()).filter(
      (item) => item.status === "queued" || item.status === "retrying" || item.status === "sending"
    );
  }

  getHistory(limit = 50): readonly GatewayOutboundPayload[] {
    const list = Array.from(this.items.values());
    return list.slice(Math.max(0, list.length - limit));
  }

  clear(): void {
    this.items.clear();
    this.insertionOrder.length = 0;
  }
}
