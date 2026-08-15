import type {
  GatewayPlatformType,
  IGatewayPlatformAdapter,
} from "../../../core/contracts/gateway.contracts.js";

/**
 * Base Abstract Platform Protocol Adapter.
 *
 * Implements bounded text chunking and character limit partitioning.
 */
export abstract class AbstractPlatformAdapter implements IGatewayPlatformAdapter {
  abstract readonly platform: GatewayPlatformType;
  abstract readonly maxChunkLength: number;

  formatMessageChunks(rawText: string): readonly string[] {
    if (!rawText) return [];
    if (rawText.length <= this.maxChunkLength) {
      return [rawText];
    }

    const chunks: string[] = [];
    let remaining = rawText;

    while (remaining.length > 0) {
      if (remaining.length <= this.maxChunkLength) {
        chunks.push(remaining);
        break;
      }

      // Find natural split boundary (newline or whitespace)
      let splitIdx = remaining.lastIndexOf("\n", this.maxChunkLength);
      if (splitIdx === -1 || splitIdx < this.maxChunkLength * 0.5) {
        splitIdx = remaining.lastIndexOf(" ", this.maxChunkLength);
      }
      if (splitIdx === -1 || splitIdx < this.maxChunkLength * 0.3) {
        splitIdx = this.maxChunkLength;
      }

      chunks.push(remaining.substring(0, splitIdx).trimEnd());
      remaining = remaining.substring(splitIdx).trimStart();
    }

    return chunks;
  }

  abstract sendChunk(
    channelId: string,
    chunk: string,
    threadId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }>;
}
