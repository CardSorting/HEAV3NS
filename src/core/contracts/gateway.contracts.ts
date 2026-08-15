/**
 * Unified Multi-Platform Messaging Gateway Contracts
 *
 * Defines contracts, protocols, and interfaces for multi-platform
 * messaging (Telegram, Discord, Slack, Webhook, REST) and streaming delivery (K_gw).
 */

export type GatewayPlatformType = "telegram" | "discord" | "slack" | "webhook" | "rest_api";
export type GatewayDeliveryStatus = "queued" | "sending" | "delivered" | "failed" | "retrying";

export interface GatewayMessageEnvelope {
  readonly id: string;
  readonly platform: GatewayPlatformType;
  readonly channelId: string;
  readonly senderId: string;
  readonly senderName?: string;
  readonly content: string;
  readonly rawPayload?: Record<string, unknown>;
  readonly threadId?: string;
  readonly timestampMs: number;
}

export interface GatewayOutboundPayload {
  readonly id: string;
  readonly platform: GatewayPlatformType;
  readonly channelId: string;
  readonly content: string;
  readonly chunks: readonly string[];
  readonly threadId?: string;
  readonly status: GatewayDeliveryStatus;
  readonly attempts: number;
  readonly timestampMs: number;
  readonly deliveredTimestampMs?: number;
  readonly error?: string;
}

export interface GatewayChannelSession {
  readonly channelId: string;
  readonly platform: GatewayPlatformType;
  readonly sessionKey: string;
  readonly totalMessagesInbound: number;
  readonly totalMessagesOutbound: number;
  readonly lastActiveTimestampMs: number;
  readonly activeThreadId?: string;
}

export interface GatewayStateSnapshot {
  readonly channels: readonly GatewayChannelSession[];
  readonly pendingDeliveryCount: number;
  readonly deliveryLedgerSnapshot: readonly GatewayOutboundPayload[];
  readonly snapshotTick: number;
}

export interface IGatewayPlatformAdapter {
  readonly platform: GatewayPlatformType;
  formatMessageChunks(rawText: string): readonly string[];
  sendChunk(channelId: string, chunk: string, threadId?: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
  verifyWebhookSignature?(payload: string, signature: string, secret: string): boolean;
}

export interface IBroccoliGatewaySubstrate {
  registerChannel(channel: GatewayChannelSession): void;
  getChannel(channelId: string): GatewayChannelSession | undefined;
  listChannels(platform?: GatewayPlatformType): readonly GatewayChannelSession[];
  recordInbound(channelId: string, platform: GatewayPlatformType): void;
  recordOutbound(channelId: string, platform: GatewayPlatformType): void;
  clear(): void;
}

export interface IGatewayDeliveryLedger {
  enqueue(payload: Omit<GatewayOutboundPayload, "chunks" | "status" | "attempts" | "timestampMs">, chunks: readonly string[]): GatewayOutboundPayload;
  markStatus(payloadId: string, status: GatewayDeliveryStatus, error?: string): void;
  getPending(): readonly GatewayOutboundPayload[];
  getHistory(limit?: number): readonly GatewayOutboundPayload[];
  clear(): void;
}

export interface IGatewaySnapshotManager {
  createSnapshot(tick: number): GatewayStateSnapshot;
  restoreSnapshot(snapshot: GatewayStateSnapshot): void;
}

export interface IGatewayDispatcher {
  handleInboundMessage(envelope: GatewayMessageEnvelope): Promise<{ dispatched: boolean; turnId?: string; error?: string }>;
  broadcastMessage(platform: GatewayPlatformType, channelId: string, text: string, threadId?: string): Promise<GatewayOutboundPayload>;
}
