/**
 * broccoli-media-source-substrate.ts
 *
 * In-memory Broccolidb repository storing resolved media descriptors,
 * hash audit ledgers, and MIME distribution telemetry (Phase 122 / ADR-098 / Target #55).
 */

import type {
  MediaSourceConfig,
  MediaSourceMetrics,
  MediaSourceWorkspaceSnapshot,
  ResolvedMedia,
} from "../../../core/contracts/media-source.contracts.js";
import { DEFAULT_MEDIA_SOURCE_CONFIG } from "../../../core/contracts/media-source.contracts.js";

export class BroccoliMediaSourceSubstrate {
  private config: MediaSourceConfig = { ...DEFAULT_MEDIA_SOURCE_CONFIG };
  private readonly history: ResolvedMedia[] = [];
  private readonly mediaCache: Map<string, ResolvedMedia> = new Map();
  private totalResolutions = 0;
  private totalBytesIngested = 0;
  private failedResolutions = 0;
  private readonly mimeCounts: Map<string, number> = new Map();

  public setConfig(config: Partial<MediaSourceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): MediaSourceConfig {
    return { ...this.config };
  }

  public recordResolution(media: ResolvedMedia): void {
    this.totalResolutions++;
    this.totalBytesIngested += media.sizeBytes;
    this.mediaCache.set(media.sha256, media);

    const count = this.mimeCounts.get(media.mime) ?? 0;
    this.mimeCounts.set(media.mime, count + 1);

    this.history.push(media);
    if (this.history.length > 500) {
      this.history.shift();
    }
  }

  public recordFailure(): void {
    this.failedResolutions++;
  }

  public getCachedMedia(sha256: string): ResolvedMedia | undefined {
    return this.mediaCache.get(sha256);
  }

  public getHistory(): readonly ResolvedMedia[] {
    return this.history;
  }

  public getMetrics(): MediaSourceMetrics {
    const counts: Record<string, number> = {};
    for (const [mime, cnt] of this.mimeCounts.entries()) {
      counts[mime] = cnt;
    }

    return {
      totalResolutions: this.totalResolutions,
      totalBytesIngested: this.totalBytesIngested,
      mimeCounts: counts,
      failedResolutions: this.failedResolutions,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): MediaSourceWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      history: [...this.history],
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: MediaSourceWorkspaceSnapshot): void {
    this.history.length = 0;
    this.history.push(...snapshot.history);

    this.mediaCache.clear();
    for (const m of snapshot.history) {
      this.mediaCache.set(m.sha256, m);
    }

    this.totalResolutions = snapshot.metrics.totalResolutions;
    this.totalBytesIngested = snapshot.metrics.totalBytesIngested;
    this.failedResolutions = snapshot.metrics.failedResolutions;

    this.mimeCounts.clear();
    for (const [mime, cnt] of Object.entries(snapshot.metrics.mimeCounts)) {
      this.mimeCounts.set(mime, cnt);
    }
  }

  public clear(): void {
    this.history.length = 0;
    this.mediaCache.clear();
    this.mimeCounts.clear();
    this.totalResolutions = 0;
    this.totalBytesIngested = 0;
    this.failedResolutions = 0;
  }
}
