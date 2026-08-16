/**
 * doc-extractor-supervisor.ts
 *
 * Master supervisor coordinating structured document extraction,
 * opaque document write protections, in-memory caching, and aggregate telemetry
 * (Phase 116 / ADR-092 / Target #49).
 */

import type { BroccoliDocExtractorSubstrate } from "../../../sessions/extensions/doc_extractor/broccoli-doc-extractor-substrate.js";
import type { DeterministicDocExtractor } from "./deterministic-doc-extractor.js";
import type {
  CachedExtractedDoc,
  DocExtractorMetrics,
  DocumentExtractionOptions,
  DocumentExtractionResult,
  OpaqueWriteCheckResult,
} from "../../../core/contracts/doc-extractor.contracts.js";

export class DocExtractorSupervisor {
  private readonly substrate: BroccoliDocExtractorSubstrate;
  private readonly extractor: DeterministicDocExtractor;

  constructor(
    substrate: BroccoliDocExtractorSubstrate,
    extractor: DeterministicDocExtractor
  ) {
    this.substrate = substrate;
    this.extractor = extractor;
  }

  /**
   * Extract clean text representation from a document file and record in cache.
   */
  public extractDocument(
    filePath: string,
    data: Uint8Array | Buffer | string,
    options: DocumentExtractionOptions = {}
  ): DocumentExtractionResult {
    const result = this.extractor.extractDocument(filePath, data, options);
    this.substrate.recordExtraction(filePath, result.format, result.charCount);
    return result;
  }

  /**
   * Fast pure-string check if a path has a binary extension.
   */
  public hasBinaryExtension(filePath: string): boolean {
    return this.extractor.hasBinaryExtension(filePath);
  }

  /**
   * Fast check if a path is an opaque document format (.docx, .xlsx, .pptx, etc.).
   */
  public isOpaqueDocument(filePath: string): boolean {
    return this.extractor.isOpaqueDocument(filePath);
  }

  /**
   * Verify if a write operation targeting filePath is safe from destroying opaque containers.
   */
  public verifySafeWrite(filePath: string): OpaqueWriteCheckResult {
    const check = this.extractor.verifySafeWrite(filePath);
    if (!check.safe) {
      this.substrate.recordOpaqueBlock();
    }
    return check;
  }

  public getCachedDoc(filePath: string): CachedExtractedDoc | undefined {
    return this.substrate.getCachedDoc(filePath);
  }

  public listCachedDocs(): readonly CachedExtractedDoc[] {
    return this.substrate.listCachedDocs();
  }

  public getMetrics(): DocExtractorMetrics {
    return this.substrate.getMetrics();
  }

  public clear(): void {
    this.substrate.clear();
  }
}
