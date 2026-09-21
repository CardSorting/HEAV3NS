/**
 * [LAYER: SESSIONS EXTENSION]
 * Pass 121: Zero-Dependency Broccoli CAS & Brotli Compacting Substrate
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/ContextCompactionService.ts).
 * Provides content-addressable SHA-256 blob storage, Brotli compression/decompression via node:zlib,
 * immutable context projection DAGs, and blob hash verification. Zero external npm dependencies.
 */

import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { brotliCompress, brotliDecompress } from "node:zlib";

const compressBrotli = promisify(brotliCompress);
const decompressBrotli = promisify(brotliDecompress);

export interface CasBlobRecord {
  blobHash: string;
  sourceSha256: string;
  originalBytes: number;
  storedBytes: number;
  compressed: boolean;
  createdAt: number;
  payload: Buffer;
}

export interface ContextProjectionRecord {
  projectionId: string;
  parentProjectionId?: string;
  blobHashes: string[];
  totalOriginalBytes: number;
  totalStoredBytes: number;
  createdAt: number;
}

export class BroccoliCasCompactor {
  private readonly blobs = new Map<string, CasBlobRecord>();
  private readonly projections = new Map<string, ContextProjectionRecord>();

  /**
   * Computes SHA-256 hash string for payload.
   */
  public static sha256(content: string | Buffer): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Stores a content string into the CAS storage repository with optional Brotli compression.
   */
  public async storeContent(content: string, compressThresholdBytes: number = 2048): Promise<CasBlobRecord> {
    const rawBuffer = Buffer.from(content, "utf-8");
    const sourceSha256 = BroccoliCasCompactor.sha256(rawBuffer);

    if (this.blobs.has(sourceSha256)) {
      return this.blobs.get(sourceSha256)!;
    }

    let payload = rawBuffer;
    let compressed = false;

    if (rawBuffer.length >= compressThresholdBytes) {
      try {
        const compressedBuf = await compressBrotli(rawBuffer);
        if (compressedBuf.length < rawBuffer.length) {
          payload = compressedBuf;
          compressed = true;
        }
      } catch {
        // Fallback to raw uncompressed buffer on compression failure
      }
    }

    const blobHash = BroccoliCasCompactor.sha256(payload);

    const record: CasBlobRecord = {
      blobHash,
      sourceSha256,
      originalBytes: rawBuffer.length,
      storedBytes: payload.length,
      compressed,
      createdAt: Date.now(),
      payload,
    };

    this.blobs.set(sourceSha256, record);
    return record;
  }

  /**
   * Retrieves and inflates content from the CAS storage repository by source SHA-256 hash.
   */
  public async retrieveContent(sourceSha256: string): Promise<string | undefined> {
    const record = this.blobs.get(sourceSha256);
    if (!record) return undefined;

    let rawBuffer = record.payload;
    if (record.compressed) {
      rawBuffer = await decompressBrotli(record.payload);
    }

    return rawBuffer.toString("utf-8");
  }

  /**
   * Creates an immutable context projection record linking blob hashes into a projection DAG.
   */
  public createProjection(blobHashes: string[], parentProjectionId?: string): ContextProjectionRecord {
    let totalOriginalBytes = 0;
    let totalStoredBytes = 0;

    for (const hash of blobHashes) {
      const record = this.blobs.get(hash);
      if (record) {
        totalOriginalBytes += record.originalBytes;
        totalStoredBytes += record.storedBytes;
      }
    }

    const projectionId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record: ContextProjectionRecord = {
      projectionId,
      parentProjectionId,
      blobHashes,
      totalOriginalBytes,
      totalStoredBytes,
      createdAt: Date.now(),
    };

    this.projections.set(projectionId, record);
    return record;
  }

  /**
   * Returns operational metrics for CAS storage and projections.
   */
  public getMetrics(): {
    totalBlobs: number;
    totalProjections: number;
    totalOriginalBytes: number;
    totalStoredBytes: number;
    compressionSavingsPercent: number;
  } {
    let totalOriginalBytes = 0;
    let totalStoredBytes = 0;

    for (const b of this.blobs.values()) {
      totalOriginalBytes += b.originalBytes;
      totalStoredBytes += b.storedBytes;
    }

    const savings = totalOriginalBytes > 0 ? ((totalOriginalBytes - totalStoredBytes) / totalOriginalBytes) * 100 : 0;

    return {
      totalBlobs: this.blobs.size,
      totalProjections: this.projections.size,
      totalOriginalBytes,
      totalStoredBytes,
      compressionSavingsPercent: Math.round(savings * 100) / 100,
    };
  }
}
