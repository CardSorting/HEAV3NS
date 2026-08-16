/**
 * broccoli-audio-container-substrate.ts
 *
 * In-memory Broccolidb repository maintaining audio cache records, audio payload blobs,
 * container sniffer metrics, and repaired format ledgers (Phase 114 / ADR-090 / Target #47).
 */

import type {
  AudioCacheEntry,
  AudioWorkspaceSnapshot,
} from "../../../core/contracts/audio-container.contracts.js";

export class BroccoliAudioContainerSubstrate {
  private readonly cache = new Map<string, AudioCacheEntry>();
  private totalSniffs = 0;
  private totalRepairs = 0;
  private totalCachedBytes = 0;

  // Cache Operations
  public putCacheEntry(entry: AudioCacheEntry): void {
    const prev = this.cache.get(entry.cacheKey);
    if (prev) {
      this.totalCachedBytes -= prev.sizeBytes;
    }
    this.cache.set(entry.cacheKey, entry);
    this.totalCachedBytes += entry.sizeBytes;
  }

  public getCacheEntry(cacheKey: string): AudioCacheEntry | undefined {
    return this.cache.get(cacheKey);
  }

  public hasCacheEntry(cacheKey: string): boolean {
    return this.cache.has(cacheKey);
  }

  public listCacheEntries(): readonly AudioCacheEntry[] {
    return Array.from(this.cache.values());
  }

  public deleteCacheEntry(cacheKey: string): boolean {
    const entry = this.cache.get(cacheKey);
    if (entry) {
      this.totalCachedBytes -= entry.sizeBytes;
      return this.cache.delete(cacheKey);
    }
    return false;
  }

  // Telemetry & Metrics
  public recordSniff(): void {
    this.totalSniffs++;
  }

  public recordRepair(): void {
    this.totalRepairs++;
  }

  public getMetrics() {
    return {
      totalSniffs: this.totalSniffs,
      totalRepairs: this.totalRepairs,
      totalCachedBytes: this.totalCachedBytes,
      cacheEntryCount: this.cache.size,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): AudioWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      cachedEntries: Array.from(this.cache.values()),
      metrics: {
        totalSniffs: this.totalSniffs,
        totalRepairs: this.totalRepairs,
        totalCachedBytes: this.totalCachedBytes,
      },
    };
  }

  public restoreSnapshot(snapshot: AudioWorkspaceSnapshot): void {
    this.cache.clear();
    this.totalCachedBytes = 0;
    for (const entry of snapshot.cachedEntries) {
      this.cache.set(entry.cacheKey, entry);
      this.totalCachedBytes += entry.sizeBytes;
    }
    this.totalSniffs = snapshot.metrics.totalSniffs;
    this.totalRepairs = snapshot.metrics.totalRepairs;
  }

  public clear(): void {
    this.cache.clear();
    this.totalSniffs = 0;
    this.totalRepairs = 0;
    this.totalCachedBytes = 0;
  }
}
