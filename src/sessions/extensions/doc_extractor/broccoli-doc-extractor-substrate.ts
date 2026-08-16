/**
 * broccoli-doc-extractor-substrate.ts
 *
 * In-memory Broccolidb repository storing extracted document caches,
 * opaque write block ledgers, and extraction telemetry (Phase 116 / ADR-092 / Target #49).
 */

import type {
  CachedExtractedDoc,
  DocExtractorMetrics,
  DocExtractorWorkspaceSnapshot,
  DocumentFormat,
} from "../../../core/contracts/doc-extractor.contracts.js";

export class BroccoliDocExtractorSubstrate {
  private readonly documentCache = new Map<string, CachedExtractedDoc>();
  private totalExtractions = 0;
  private totalCharsExtracted = 0;
  private totalOpaqueBlocks = 0;

  // Cache Operations
  public recordExtraction(path: string, format: DocumentFormat, charCount: number): void {
    this.totalExtractions++;
    this.totalCharsExtracted += charCount;
    this.documentCache.set(path, {
      path,
      format,
      charCount,
      extractedAt: Date.now(),
    });
  }

  public getCachedDoc(path: string): CachedExtractedDoc | undefined {
    return this.documentCache.get(path);
  }

  public hasCachedDoc(path: string): boolean {
    return this.documentCache.has(path);
  }

  public listCachedDocs(): readonly CachedExtractedDoc[] {
    return Array.from(this.documentCache.values());
  }

  public recordOpaqueBlock(): void {
    this.totalOpaqueBlocks++;
  }

  public getMetrics(): DocExtractorMetrics {
    return {
      totalExtractions: this.totalExtractions,
      totalCharsExtracted: this.totalCharsExtracted,
      totalOpaqueBlocks: this.totalOpaqueBlocks,
      cacheSize: this.documentCache.size,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): DocExtractorWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      extractedCache: Array.from(this.documentCache.values()),
      metrics: {
        totalExtractions: this.totalExtractions,
        totalCharsExtracted: this.totalCharsExtracted,
        totalOpaqueBlocks: this.totalOpaqueBlocks,
      },
    };
  }

  public restoreSnapshot(snapshot: DocExtractorWorkspaceSnapshot): void {
    this.documentCache.clear();
    for (const entry of snapshot.extractedCache) {
      this.documentCache.set(entry.path, entry);
    }
    this.totalExtractions = snapshot.metrics.totalExtractions;
    this.totalCharsExtracted = snapshot.metrics.totalCharsExtracted;
    this.totalOpaqueBlocks = snapshot.metrics.totalOpaqueBlocks;
  }

  public clear(): void {
    this.documentCache.clear();
    this.totalExtractions = 0;
    this.totalCharsExtracted = 0;
    this.totalOpaqueBlocks = 0;
  }
}
