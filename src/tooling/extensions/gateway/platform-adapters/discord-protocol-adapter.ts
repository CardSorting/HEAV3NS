import { AbstractPlatformAdapter } from "../abstract-platform-adapter.js";
import type { GatewayPlatformType } from "../../../../core/contracts/gateway.contracts.js";

/**
 * Discord Bot / Webhook Protocol Adapter (2000-character chunk limit).
 */
export class DiscordProtocolAdapter extends AbstractPlatformAdapter {
  readonly platform: GatewayPlatformType = "discord";
  readonly maxChunkLength = 2000;

  async sendChunk(
    channelId: string,
    chunk: string,
    threadId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return {
      success: true,
      messageId: `discord-msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
  }
}
