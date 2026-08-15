import { AbstractPlatformAdapter } from "../abstract-platform-adapter.js";
import type { GatewayPlatformType } from "../../../../core/contracts/gateway.contracts.js";

/**
 * Telegram Bot API Protocol Adapter (4096-character chunk limit).
 */
export class TelegramProtocolAdapter extends AbstractPlatformAdapter {
  readonly platform: GatewayPlatformType = "telegram";
  readonly maxChunkLength = 4096;

  async sendChunk(
    channelId: string,
    chunk: string,
    threadId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Virtualized / live adapter simulation
    return {
      success: true,
      messageId: `tg-msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
  }
}
