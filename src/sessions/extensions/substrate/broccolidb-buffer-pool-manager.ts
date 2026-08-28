/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-buffer-pool-manager.ts
 *
 * Fixed-frame in-memory Buffer Pool Manager with LRU-2 (Least Recently Used with K=2 backward distance)
 * page frame eviction, page pinning, dirty tracking, and asynchronous page flushers (Pass 201 / ADR-139).
 */

import type {
  BroccoliBufferPoolMetrics,
  BroccoliPageFrame,
  IBroccoliBufferPoolManager,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliBufferPoolManager implements IBroccoliBufferPoolManager {
  private readonly totalFrames: number;
  private readonly k: number; // K value for LRU-K (default K=2)
  private readonly frames: (BroccoliPageFrame<any> | null)[];
  private readonly pageTable = new Map<string, number>(); // pageId -> frameId
  private readonly freeFrameIds: number[] = [];
  private readonly loadingPages = new Map<string, Promise<BroccoliPageFrame<any>>>();

  private totalReadsCount = 0;
  private cacheHitsCount = 0;
  private cacheMissesCount = 0;
  private evictionsCount = 0;

  constructor(totalFrames = 64, k = 2) {
    if (!Number.isSafeInteger(totalFrames) || totalFrames <= 0) {
      throw new RangeError("totalFrames must be a positive integer");
    }
    if (!Number.isSafeInteger(k) || k <= 0) throw new RangeError("k must be a positive integer");
    this.totalFrames = totalFrames;
    this.k = k;
    this.frames = new Array(totalFrames).fill(null);
    for (let i = 0; i < totalFrames; i++) {
      this.freeFrameIds.push(i);
    }
  }

  public async fetchPage<T = unknown>(
    pageId: string,
    loader?: (pageId: string) => Promise<T>
  ): Promise<BroccoliPageFrame<T>> {
    this.totalReadsCount++;
    if (!pageId.trim()) throw new TypeError("pageId must be non-empty");
    const now = Date.now();

    // 1. Check if page is already resident in a frame
    const existingFrameId = this.pageTable.get(pageId);
    if (existingFrameId !== undefined) {
      this.cacheHitsCount++;
      const frame = this.frames[existingFrameId] as BroccoliPageFrame<T>;
      frame.pinCount++;
      this.recordAccess(frame, now);
      return frame;
    }

    const inFlight = this.loadingPages.get(pageId) as Promise<BroccoliPageFrame<T>> | undefined;
    if (inFlight) {
      const frame = await inFlight;
      this.cacheHitsCount++;
      frame.pinCount++;
      this.recordAccess(frame, Date.now());
      return frame;
    }

    // 2. Cache Miss: allocate a frame (or evict using LRU-K)
    this.cacheMissesCount++;
    const loadPromise = this.loadPage(pageId, loader, now);
    this.loadingPages.set(pageId, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.loadingPages.delete(pageId);
    }
  }

  private async loadPage<T>(
    pageId: string,
    loader: ((pageId: string) => Promise<T>) | undefined,
    now: number
  ): Promise<BroccoliPageFrame<T>> {
    const frameId = await this.allocateFrame();

    const oldFrame = this.frames[frameId];

    let initialData: T = ({} as T);
    try {
      if (loader) initialData = await loader(pageId);
    } catch (error) {
      if (!oldFrame) this.freeFrameIds.unshift(frameId);
      throw error;
    }

    if (oldFrame) {
      this.pageTable.delete(oldFrame.pageId);
      this.evictionsCount++;
    }

    const newFrame: BroccoliPageFrame<T> = {
      pageId,
      frameId,
      data: initialData,
      isDirty: false,
      pinCount: 1,
      lastAccessTimestamps: [now],
    };

    this.frames[frameId] = newFrame;
    this.pageTable.set(pageId, frameId);
    return newFrame;
  }

  public unpinPage(pageId: string, isDirty = false): void {
    const frameId = this.pageTable.get(pageId);
    if (frameId === undefined) return;

    const frame = this.frames[frameId];
    if (!frame) return;

    if (isDirty) {
      frame.isDirty = true;
    }

    if (frame.pinCount > 0) {
      frame.pinCount--;
    }
  }

  public async flushPage(
    pageId: string,
    writer?: (pageId: string, data: unknown) => Promise<void>
  ): Promise<boolean> {
    const frameId = this.pageTable.get(pageId);
    if (frameId === undefined) return false;

    const frame = this.frames[frameId];
    if (!frame || !frame.isDirty) return false;

    if (writer) {
      await writer(pageId, frame.data);
    }

    frame.isDirty = false;
    return true;
  }

  public async flushAllPages(
    writer?: (pageId: string, data: unknown) => Promise<void>
  ): Promise<number> {
    let flushedCount = 0;
    for (const frame of this.frames) {
      if (frame && frame.isDirty) {
        if (writer) {
          await writer(frame.pageId, frame.data);
        }
        frame.isDirty = false;
        flushedCount++;
      }
    }
    return flushedCount;
  }

  public getMetrics(): BroccoliBufferPoolMetrics {
    const activePages = this.pageTable.size;
    let pinnedPages = 0;
    let dirtyPages = 0;

    for (const frame of this.frames) {
      if (frame) {
        if (frame.pinCount > 0) pinnedPages++;
        if (frame.isDirty) dirtyPages++;
      }
    }

    const totalRequests = this.cacheHitsCount + this.cacheMissesCount;
    const hitRatioPct = totalRequests > 0 ? (this.cacheHitsCount / totalRequests) * 100 : 0;

    return {
      totalFrames: this.totalFrames,
      activePages,
      pinnedPages,
      dirtyPages,
      cacheHits: this.cacheHitsCount,
      cacheMisses: this.cacheMissesCount,
      hitRatioPct: Number(hitRatioPct.toFixed(2)),
      evictions: this.evictionsCount,
    };
  }

  public clear(): void {
    if (this.frames.some((frame) => frame && (frame.pinCount > 0 || frame.isDirty))) {
      throw new Error("Cannot clear a buffer pool containing pinned or dirty pages");
    }
    this.frames.fill(null);
    this.pageTable.clear();
    this.freeFrameIds.length = 0;
    for (let i = 0; i < this.totalFrames; i++) {
      this.freeFrameIds.push(i);
    }
  }

  private async allocateFrame(): Promise<number> {
    // 1. If there is a free frame
    if (this.freeFrameIds.length > 0) {
      return this.freeFrameIds.shift()!;
    }

    // 2. Select victim frame using LRU-K
    const victimFrameId = this.selectLruKVictim();
    if (victimFrameId === -1) {
      throw new Error(
        `Buffer pool exhaustion: all ${this.totalFrames} frames are pinned or dirty; flush dirty pages before eviction`
      );
    }
    return victimFrameId;
  }

  private selectLruKVictim(): number {
    const now = Date.now();
    let maxBackwardDistance = -1;
    let victimFrameId = -1;

    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i];
      // Dirty pages require an explicit writer-backed flush. Evicting one here
      // would acknowledge data that was never persisted.
      if (!frame || frame.pinCount > 0 || frame.isDirty) continue;

      // LRU-K backward distance: distance to K-th prior access
      let backwardDistance: number;
      if (frame.lastAccessTimestamps.length < this.k) {
        // Infinite backward distance for pages accessed fewer than K times
        backwardDistance = Infinity;
      } else {
        const kTimestamp = frame.lastAccessTimestamps[frame.lastAccessTimestamps.length - this.k];
        backwardDistance = now - kTimestamp;
      }

      if (backwardDistance > maxBackwardDistance) {
        maxBackwardDistance = backwardDistance;
        victimFrameId = i;
      }
    }

    return victimFrameId;
  }

  private recordAccess(frame: BroccoliPageFrame<any>, timestamp: number): void {
    frame.lastAccessTimestamps.push(timestamp);
    if (frame.lastAccessTimestamps.length > this.k * 2) {
      frame.lastAccessTimestamps.splice(0, frame.lastAccessTimestamps.length - this.k);
    }
  }
}
