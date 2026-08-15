import type {
  GatewayChannelSession,
  GatewayPlatformType,
  IBroccoliGatewaySubstrate,
} from "../../../core/contracts/gateway.contracts.js";

/**
 * Zero-GC in-memory storage substrate for gateway channel sessions in Broccolidb.
 */
export class BroccoliGatewaySubstrate implements IBroccoliGatewaySubstrate {
  private readonly channels = new Map<string, GatewayChannelSession>();

  registerChannel(channel: GatewayChannelSession): void {
    this.channels.set(channel.channelId, channel);
  }

  getChannel(channelId: string): GatewayChannelSession | undefined {
    return this.channels.get(channelId);
  }

  listChannels(platform?: GatewayPlatformType): readonly GatewayChannelSession[] {
    const list = Array.from(this.channels.values());
    if (platform) {
      return list.filter((c) => c.platform === platform);
    }
    return list;
  }

  recordInbound(channelId: string, platform: GatewayPlatformType): void {
    const existing = this.channels.get(channelId);
    if (existing) {
      this.channels.set(channelId, {
        ...existing,
        totalMessagesInbound: existing.totalMessagesInbound + 1,
        lastActiveTimestampMs: Date.now(),
      });
    } else {
      this.channels.set(channelId, {
        channelId,
        platform,
        sessionKey: `sess-${platform}-${channelId}`,
        totalMessagesInbound: 1,
        totalMessagesOutbound: 0,
        lastActiveTimestampMs: Date.now(),
      });
    }
  }

  recordOutbound(channelId: string, platform: GatewayPlatformType): void {
    const existing = this.channels.get(channelId);
    if (existing) {
      this.channels.set(channelId, {
        ...existing,
        totalMessagesOutbound: existing.totalMessagesOutbound + 1,
        lastActiveTimestampMs: Date.now(),
      });
    } else {
      this.channels.set(channelId, {
        channelId,
        platform,
        sessionKey: `sess-${platform}-${channelId}`,
        totalMessagesInbound: 0,
        totalMessagesOutbound: 1,
        lastActiveTimestampMs: Date.now(),
      });
    }
  }

  clear(): void {
    this.channels.clear();
  }
}
