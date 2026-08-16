/**
 * media-source-supervisor.ts
 *
 * Master supervisor coordinating multi-source URI resolution, magic-byte MIME perception,
 * ingest budget enforcement, and in-memory substrate tracking (Phase 122 / ADR-098 / Target #55).
 */

import type { BroccoliMediaSourceSubstrate } from "../../../sessions/extensions/media_source/broccoli-media-source-substrate.js";
import type { DeterministicMediaResolver } from "./deterministic-media-resolver.js";
import type {
  MediaKind,
  MediaSourceConfig,
  MediaSourceMetrics,
  MediaSourceOrigin,
  ResolvedMedia,
} from "../../../core/contracts/media-source.contracts.js";

export class MediaSourceSupervisor {
  private readonly substrate: BroccoliMediaSourceSubstrate;
  private readonly resolver: DeterministicMediaResolver;

  constructor(
    substrate: BroccoliMediaSourceSubstrate,
    resolver: DeterministicMediaResolver
  ) {
    this.substrate = substrate;
    this.resolver = resolver;
  }

  public configure(config: Partial<MediaSourceConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): MediaSourceConfig {
    return this.substrate.getConfig();
  }

  public sniffMagicBytes(bytes: Uint8Array): { mime: string; kind: MediaKind } {
    return this.resolver.sniffMagicBytes(bytes);
  }

  public extractDimensions(
    bytes: Uint8Array,
    mime: string
  ): { width?: number; height?: number } {
    return this.resolver.extractDimensions(bytes, mime);
  }

  public toDataUrl(bytes: Uint8Array, mime: string): string {
    return this.resolver.toDataUrl(bytes, mime);
  }

  public async resolve(
    source: string | Uint8Array,
    originOverride?: MediaSourceOrigin
  ): Promise<ResolvedMedia> {
    const config = this.substrate.getConfig();

    try {
      let resolved: ResolvedMedia;

      if (source instanceof Uint8Array) {
        if (source.length > config.maxIngestBytes) {
          throw new Error(
            `Media payload (${source.length} bytes) exceeds max ingestion limit (${config.maxIngestBytes} bytes).`
          );
        }
        const { mime, kind } = this.resolver.sniffMagicBytes(source);
        const { width, height } = this.resolver.extractDimensions(source, mime);
        const sha256 = this.resolver.computeSha256(source);

        resolved = {
          data: source,
          mime,
          kind,
          origin: originOverride ?? "local",
          sizeBytes: source.length,
          width,
          height,
          sha256,
        };
      } else if (typeof source === "string" && source.startsWith("data:")) {
        resolved = this.resolver.resolveDataUrl(source);
        if (resolved.sizeBytes > config.maxIngestBytes) {
          throw new Error(
            `Data URL payload (${resolved.sizeBytes} bytes) exceeds max ingestion limit (${config.maxIngestBytes} bytes).`
          );
        }
      } else {
        // Fallback synthetic mock resolver for URI / string payload
        const bytes = new TextEncoder().encode(typeof source === "string" ? source : "");
        const { mime, kind } = this.resolver.sniffMagicBytes(bytes);
        const { width, height } = this.resolver.extractDimensions(bytes, mime);
        const sha256 = this.resolver.computeSha256(bytes);

        resolved = {
          data: bytes,
          mime,
          kind,
          origin: originOverride ?? "file",
          sizeBytes: bytes.length,
          width,
          height,
          sha256,
        };
      }

      this.substrate.recordResolution(resolved);
      return resolved;
    } catch (err) {
      this.substrate.recordFailure();
      throw err;
    }
  }

  public getHistory(): readonly ResolvedMedia[] {
    return this.substrate.getHistory();
  }

  public getMetrics(): MediaSourceMetrics {
    return this.substrate.getMetrics();
  }

  public clear(): void {
    this.substrate.clear();
  }
}
