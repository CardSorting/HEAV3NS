import { AbstractPlatformAdapter } from "../abstract-platform-adapter.js";
import type { GatewayPlatformType } from "../../../../core/contracts/gateway.contracts.js";

/**
 * Slack Block Kit Protocol Adapter (3000-character chunk limit).
 */
export class SlackProtocolAdapter extends AbstractPlatformAdapter {
  readonly platform: GatewayPlatformType = "slack";
  readonly maxChunkLength = 3000;

  async sendChunk(
    channelId: string,
    chunk: string,
    threadId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return {
      success: true,
      messageId: `slack-msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
  }
}
