/**
 * broccoli-transcription-substrate.ts
 *
 * In-memory Broccolidb repository storing audio SHA-256 hash transcript cache ledgers,
 * provider usage metrics, and diarization segment records (Phase 124 / ADR-100 / Target #57).
 */

import type {
  CachedTranscriptRecord,
  TranscriptionConfig,
  TranscriptionMetrics,
  TranscriptionResult,
  TranscriptionWorkspaceSnapshot,
} from "../../../core/contracts/transcription.contracts.js";
import { DEFAULT_TRANSCRIPTION_CONFIG } from "../../../core/contracts/transcription.contracts.js";

export class BroccoliTranscriptionSubstrate {
  private config: TranscriptionConfig = { ...DEFAULT_TRANSCRIPTION_CONFIG };
  private readonly cache: Map<string, CachedTranscriptRecord> = new Map();
  private totalTranscriptions = 0;
  private totalAudioDurationMs = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly providerUsage: Map<string, number> = new Map();

  public setConfig(config: Partial<TranscriptionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): TranscriptionConfig {
    return { ...this.config };
  }

  public getCachedTranscript(audioHash: string): TranscriptionResult | undefined {
    const record = this.cache.get(audioHash);
    if (!record) {
      this.cacheMisses++;
      return undefined;
    }
    this.cacheHits++;
    record.hitCount++;
    return {
      ...record.result,
      cached: true,
    };
  }

  public storeTranscript(audioHash: string, result: TranscriptionResult): void {
    this.totalTranscriptions++;
    this.totalAudioDurationMs += result.durationMs;

    const count = this.providerUsage.get(result.provider) ?? 0;
    this.providerUsage.set(result.provider, count + 1);

    this.cache.set(audioHash, {
      audioHash,
      result: { ...result, cached: false },
      timestamp: Date.now(),
      hitCount: 1,
    });
  }

  public hasCachedTranscript(audioHash: string): boolean {
    return this.cache.has(audioHash);
  }

  public getCacheRecord(audioHash: string): CachedTranscriptRecord | undefined {
    const rec = this.cache.get(audioHash);
    return rec ? { ...rec } : undefined;
  }

  public getAllCacheRecords(): readonly CachedTranscriptRecord[] {
    return Array.from(this.cache.values());
  }

  public getMetrics(): TranscriptionMetrics {
    const providerUsageObj: Record<string, number> = {};
    for (const [provider, count] of this.providerUsage.entries()) {
      providerUsageObj[provider] = count;
    }

    return {
      totalTranscriptions: this.totalTranscriptions,
      totalAudioDurationMs: this.totalAudioDurationMs,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      providerUsage: providerUsageObj,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): TranscriptionWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      cache: Array.from(this.cache.values()).map((rec) => ({
        ...rec,
        result: { ...rec.result },
      })),
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: TranscriptionWorkspaceSnapshot): void {
    this.cache.clear();
    for (const rec of snapshot.cache) {
      this.cache.set(rec.audioHash, {
        ...rec,
        result: { ...rec.result },
      });
    }

    this.totalTranscriptions = snapshot.metrics.totalTranscriptions;
    this.totalAudioDurationMs = snapshot.metrics.totalAudioDurationMs;
    this.cacheHits = snapshot.metrics.cacheHits;
    this.cacheMisses = snapshot.metrics.cacheMisses;

    this.providerUsage.clear();
    for (const [p, count] of Object.entries(snapshot.metrics.providerUsage)) {
      this.providerUsage.set(p, count);
    }
  }

  public clear(): void {
    this.cache.clear();
    this.totalTranscriptions = 0;
    this.totalAudioDurationMs = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.providerUsage.clear();
  }
}
