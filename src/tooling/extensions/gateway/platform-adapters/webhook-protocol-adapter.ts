import * as crypto from "node:crypto";
import { AbstractPlatformAdapter } from "../abstract-platform-adapter.js";
import type { GatewayPlatformType } from "../../../../core/contracts/gateway.contracts.js";

/**
 * Generic Webhook Protocol Adapter with HMAC SHA-256 verification.
 */
export class WebhookProtocolAdapter extends AbstractPlatformAdapter {
  readonly platform: GatewayPlatformType = "webhook";
  readonly maxChunkLength = 65536;

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!payload || !signature || !secret) return false;
    try {
      const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      const sigNormalized = signature.replace(/^sha256=/, "");
      return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sigNormalized));
    } catch {
      return false;
    }
  }

  async sendChunk(
    channelId: string,
    chunk: string,
    threadId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return {
      success: true,
      messageId: `webhook-delivery-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
  }
}
