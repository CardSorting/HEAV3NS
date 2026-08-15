import type {
  GatewayDeliveryStatus,
  GatewayMessageEnvelope,
  GatewayOutboundPayload,
  GatewayPlatformType,
  IGatewayDispatcher,
  IGatewayPlatformAdapter,
} from "../../../core/contracts/gateway.contracts.js";
import { BroccoliGatewaySubstrate } from "../../../sessions/extensions/gateway/broccoli-gateway-substrate.js";
import { GatewayDeliveryLedger } from "../../../sessions/extensions/gateway/gateway-delivery-ledger.js";
import { TelegramProtocolAdapter } from "../../../tooling/extensions/gateway/platform-adapters/telegram-protocol-adapter.js";
import { DiscordProtocolAdapter } from "../../../tooling/extensions/gateway/platform-adapters/discord-protocol-adapter.js";
import { SlackProtocolAdapter } from "../../../tooling/extensions/gateway/platform-adapters/slack-protocol-adapter.js";
import { WebhookProtocolAdapter } from "../../../tooling/extensions/gateway/platform-adapters/webhook-protocol-adapter.js";

/**
 * Event-Driven Multi-Platform Gateway Dispatcher Engine.
 */
export class GatewayDispatcherEngine implements IGatewayDispatcher {
  private readonly substrate: BroccoliGatewaySubstrate;
  private readonly ledger: GatewayDeliveryLedger;
  private readonly adapters = new Map<GatewayPlatformType, IGatewayPlatformAdapter>();

  constructor(
    substrate: BroccoliGatewaySubstrate,
    ledger: GatewayDeliveryLedger,
    customAdapters: IGatewayPlatformAdapter[] = []
  ) {
    this.substrate = substrate;
    this.ledger = ledger;

    // Register standard platform adapters
    this.registerAdapter(new TelegramProtocolAdapter());
    this.registerAdapter(new DiscordProtocolAdapter());
    this.registerAdapter(new SlackProtocolAdapter());
    this.registerAdapter(new WebhookProtocolAdapter());

    for (const ad of customAdapters) {
      this.registerAdapter(ad);
    }
  }

  registerAdapter(adapter: IGatewayPlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  getAdapter(platform: GatewayPlatformType): IGatewayPlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  async handleInboundMessage(
    envelope: GatewayMessageEnvelope
  ): Promise<{ dispatched: boolean; turnId?: string; error?: string }> {
    if (!envelope || !envelope.content || !envelope.channelId) {
      return { dispatched: false, error: "Invalid message envelope: missing content or channelId" };
    }

    // Record inbound activity in substrate
    this.substrate.recordInbound(envelope.channelId, envelope.platform);

    const turnId = `gw-turn-${envelope.platform}-${Date.now()}`;
    return {
      dispatched: true,
      turnId,
    };
  }

  async broadcastMessage(
    platform: GatewayPlatformType,
    channelId: string,
    text: string,
    threadId?: string
  ): Promise<GatewayOutboundPayload> {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      const payloadId = `gw-out-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const item = this.ledger.enqueue(
        {
          id: payloadId,
          platform,
          channelId,
          content: text,
          threadId,
        },
        [text]
      );
      this.ledger.markStatus(payloadId, "failed", `No adapter registered for platform '${platform}'`);
      return {
        ...item,
        status: "failed",
        error: `No adapter registered for platform '${platform}'`,
      };
    }

    const chunks = adapter.formatMessageChunks(text);
    const payloadId = `gw-out-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const enqueued = this.ledger.enqueue(
      {
        id: payloadId,
        platform,
        channelId,
        content: text,
        threadId,
      },
      chunks
    );

    this.ledger.markStatus(payloadId, "sending");

    try {
      for (const chunk of chunks) {
        const sendResult = await adapter.sendChunk(channelId, chunk, threadId);
        if (!sendResult.success) {
          this.ledger.markStatus(payloadId, "failed", sendResult.error);
          return {
            ...enqueued,
            status: "failed",
            error: sendResult.error,
          };
        }
      }

      this.substrate.recordOutbound(channelId, platform);
      this.ledger.markStatus(payloadId, "delivered");

      return {
        ...enqueued,
        status: "delivered",
        deliveredTimestampMs: Date.now(),
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.ledger.markStatus(payloadId, "failed", errMsg);
      return {
        ...enqueued,
        status: "failed",
        error: errMsg,
      };
    }
  }
}
