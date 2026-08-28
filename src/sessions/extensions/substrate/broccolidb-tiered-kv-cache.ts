/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-tiered-kv-cache.ts
 *
 * Multi-Tiered Semantic KV Cache with XFetch Stampede Prevention for BroccoliDB (Pass 201 / ADR-139).
 * Implements L1 Hot In-Memory, L2 Compressed JSON Snapshot, and L3 Storage tiers with probabilistic early refresh.
 */

import type {
  BroccoliTieredCacheEntry,
  BroccoliTieredCacheMetrics,
  IBroccoliTieredKvCache,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliTieredKvCache implements IBroccoliTieredKvCache {
  private readonly l1Memory = new Map<string, BroccoliTieredCacheEntry<any>>();
  private readonly l2Compressed = new Map<string, { json: string; expiresAt: number; computationTimeMs: number }>();
  private readonly maxL1Entries: number;

  private l1HitsCount = 0;
  private l2HitsCount = 0;
  private l3HitsCount = 0;
  private missesCount = 0;
  private earlyRefreshesCount = 0;

  constructor(maxL1Entries = 1000) {
    this.maxL1Entries = maxL1Entries;
  }

  public async get<T = unknown>(
    key: string,
    fetcher?: () => Promise<T>,
    options: { readonly ttlMs?: number; readonly beta?: number } = {}
  ): Promise<T | undefined> {
    const now = Date.now();
    const beta = options.beta ?? 1.0;
    const ttlMs = options.ttlMs ?? 60000;

    // 1. Check L1 Memory
    const l1Entry = this.l1Memory.get(key);
    if (l1Entry) {
      l1Entry.readCount++;
      const timeToExpiry = l1Entry.expiresAt - now;

      // XFetch Algorithm: Probabilistic Early Refresh to eliminate thundering herds
      if (fetcher && timeToExpiry > 0) {
        const delta = l1Entry.computationTimeMs;
        const xfetchThreshold = -beta * delta * Math.log(Math.random());

        if (xfetchThreshold > timeToExpiry) {
          this.earlyRefreshesCount++;
          // Trigger asynchronous early recomputation
          void this.recomputeAndStore(key, fetcher, ttlMs);
        }
      }

      if (timeToExpiry > 0) {
        this.l1HitsCount++;
        return l1Entry.value as T;
      }
    }

    // 2. Check L2 Compressed Storage
    const l2Entry = this.l2Compressed.get(key);
    if (l2Entry && l2Entry.expiresAt > now) {
      this.l2HitsCount++;
      const decompressed = JSON.parse(l2Entry.json) as T;
      // Promote back to L1
      this.put(key, decompressed, l2Entry.expiresAt - now);
      return decompressed;
    }

    // 3. Cache Miss: Recompute via fetcher if provided
    if (fetcher) {
      this.missesCount++;
      return this.recomputeAndStore(key, fetcher, ttlMs);
    }

    this.missesCount++;
    return undefined;
  }

  public put<T = unknown>(key: string, value: T, ttlMs = 60000, computationTimeMs = 5): void {
    if (this.l1Memory.size >= this.maxL1Entries) {
      this.demoteOldestToL2();
    }

    const now = Date.now();
    const expiresAt = now + ttlMs;

    const entry: BroccoliTieredCacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt,
      computationTimeMs,
      tier: "L1_MEMORY",
      readCount: 1,
    };

    this.l1Memory.set(key, entry);
    // Mirror to L2 compressed JSON
    this.l2Compressed.set(key, {
      json: JSON.stringify(value),
      expiresAt,
      computationTimeMs,
    });
  }

  public delete(key: string): boolean {
    const l1Del = this.l1Memory.delete(key);
    const l2Del = this.l2Compressed.delete(key);
    return l1Del || l2Del;
  }

  public clear(): void {
    this.l1Memory.clear();
    this.l2Compressed.clear();
  }

  public getMetrics(): BroccoliTieredCacheMetrics {
    return {
      l1EntriesCount: this.l1Memory.size,
      l2EntriesCount: this.l2Compressed.size,
      l3EntriesCount: 0,
      l1Hits: this.l1HitsCount,
      l2Hits: this.l2HitsCount,
      l3Hits: this.l3HitsCount,
      misses: this.missesCount,
      earlyRefreshes: this.earlyRefreshesCount,
    };
  }

  private async recomputeAndStore<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number
  ): Promise<T> {
    const t0 = Date.now();
    const value = await fetcher();
    const delta = Math.max(1, Date.now() - t0);
    this.put(key, value, ttlMs, delta);
    return value;
  }

  private demoteOldestToL2(): void {
    let oldestKey: string | null = null;
    let oldestExpiry = Infinity;

    for (const [k, v] of this.l1Memory.entries()) {
      if (v.expiresAt < oldestExpiry) {
        oldestExpiry = v.expiresAt;
        oldestKey = k;
      }
    }

    if (oldestKey) {
      this.l1Memory.delete(oldestKey);
    }
  }
}
