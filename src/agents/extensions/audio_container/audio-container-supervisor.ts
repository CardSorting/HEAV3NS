/**
 * audio-container-supervisor.ts
 *
 * Master supervisor coordinating audio container sniffing, format repair,
 * in-memory audio caching, and metadata tracking (Phase 114 / ADR-090 / Target #47).
 */

import { createHash } from "node:crypto";
import type { BroccoliAudioContainerSubstrate } from "../../../sessions/extensions/audio_container/broccoli-audio-container-substrate.js";
import type { DeterministicAudioSniffer } from "./deterministic-audio-sniffer.js";
import type {
  AudioCacheEntry,
  AudioSniffResult,
  AudioContainerId,
  AudioMimeType,
} from "../../../core/contracts/audio-container.contracts.js";

export class AudioContainerSupervisor {
  private readonly substrate: BroccoliAudioContainerSubstrate;
  private readonly sniffer: DeterministicAudioSniffer;

  constructor(
    substrate: BroccoliAudioContainerSubstrate,
    sniffer: DeterministicAudioSniffer
  ) {
    this.substrate = substrate;
    this.sniffer = sniffer;
  }

  /**
   * Sniff raw audio buffer or base64 string.
   */
  public sniffAudio(
    data: Uint8Array | Buffer | string,
    claimedPathOrExt?: string
  ): AudioSniffResult {
    const buffer = typeof data === "string" ? Buffer.from(data, "base64") : data;
    this.substrate.recordSniff();

    const result = this.sniffer.sniffAndRepair(buffer, claimedPathOrExt);
    if (result.isRepaired) {
      this.substrate.recordRepair();
    }
    return result;
  }

  /**
   * Repair filename extension based on actual binary content.
   */
  public repairFilename(
    data: Uint8Array | Buffer | string,
    filename: string
  ): string {
    const buffer = typeof data === "string" ? Buffer.from(data, "base64") : data;
    return this.sniffer.repairFilename(buffer, filename);
  }

  /**
   * Cache audio payload with container verification and repair.
   */
  public cacheAudio(params: {
    pathOrUrl: string;
    data: Uint8Array | Buffer | string;
    metadata?: Record<string, unknown>;
  }): AudioCacheEntry {
    const buffer = typeof params.data === "string"
      ? Buffer.from(params.data, "base64")
      : Buffer.isBuffer(params.data)
      ? params.data
      : Buffer.from(params.data);

    const sniffResult = this.sniffAudio(buffer, params.pathOrUrl);
    const containerId: AudioContainerId = sniffResult.containerId ?? "ogg";
    const extension = sniffResult.canonicalExtension;
    const mimeType: AudioMimeType = sniffResult.mimeType ?? "audio/ogg";

    const hash = createHash("sha256").update(buffer).digest("hex");
    const cacheKey = `audio_${hash.slice(0, 16)}`;

    const entry: AudioCacheEntry = {
      cacheKey,
      originalPathOrUrl: params.pathOrUrl,
      containerId,
      extension,
      mimeType,
      sizeBytes: buffer.length,
      timestamp: Date.now(),
      payloadBase64: buffer.toString("base64"),
      metadata: params.metadata,
    };

    this.substrate.putCacheEntry(entry);
    return entry;
  }

  public getCacheEntry(cacheKey: string): AudioCacheEntry | undefined {
    return this.substrate.getCacheEntry(cacheKey);
  }

  public listCacheEntries(): readonly AudioCacheEntry[] {
    return this.substrate.listCacheEntries();
  }

  public deleteCacheEntry(cacheKey: string): boolean {
    return this.substrate.deleteCacheEntry(cacheKey);
  }

  public getMetrics() {
    return this.substrate.getMetrics();
  }

  public clear(): void {
    this.substrate.clear();
  }
}
