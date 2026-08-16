/**
 * broccoli-clarify-substrate.ts
 *
 * In-memory Broccolidb substrate for clarify inquiry queues and resolution ledgers (Phase 85 / ADR-037).
 */

import type {
  ClarifyInquiry,
  ClarifyResolution,
  ClarifyWorkspaceSnapshot,
} from "../../../core/contracts/clarify.contracts.js";

export class BroccoliClarifySubstrate {
  private inquiries: Map<string, ClarifyInquiry>;
  private resolutions: Map<string, ClarifyResolution>;
  private activeInquiryId?: string;
  private totalInquiries: number;
  private resolvedCount: number;

  constructor() {
    this.inquiries = new Map<string, ClarifyInquiry>();
    this.resolutions = new Map<string, ClarifyResolution>();
    this.totalInquiries = 0;
    this.resolvedCount = 0;
  }

  /**
   * Records a new inquiry in the ledger.
   */
  recordInquiry(inquiry: ClarifyInquiry): void {
    this.inquiries.set(inquiry.id, inquiry);
    this.activeInquiryId = inquiry.id;
    this.totalInquiries++;
  }

  /**
   * Records resolution of an inquiry.
   */
  recordResolution(resolution: ClarifyResolution): void {
    this.resolutions.set(resolution.inquiryId, resolution);
    if (this.activeInquiryId === resolution.inquiryId) {
      this.activeInquiryId = undefined;
    }
    this.resolvedCount++;
  }

  /**
   * Retrieves an inquiry by ID.
   */
  getInquiry(id: string): ClarifyInquiry | undefined {
    return this.inquiries.get(id);
  }

  /**
   * Retrieves a resolution by inquiry ID.
   */
  getResolution(inquiryId: string): ClarifyResolution | undefined {
    return this.resolutions.get(inquiryId);
  }

  /**
   * Lists historical inquiries.
   */
  listInquiries(limit: number = 20): readonly ClarifyInquiry[] {
    const all = Array.from(this.inquiries.values());
    return all.slice(-limit);
  }

  /**
   * Exports full state snapshot.
   */
  exportSnapshot(): ClarifyWorkspaceSnapshot {
    return {
      activeInquiryId: this.activeInquiryId,
      totalInquiries: this.totalInquiries,
      resolvedCount: this.resolvedCount,
      timestamp: Date.now(),
    };
  }

  /**
   * Restores state from a snapshot.
   */
  importSnapshot(snapshot: ClarifyWorkspaceSnapshot): void {
    this.activeInquiryId = snapshot.activeInquiryId;
    this.totalInquiries = snapshot.totalInquiries;
    this.resolvedCount = snapshot.resolvedCount;
  }

  /**
   * Clears all stored inquiries and resolutions.
   */
  clear(): void {
    this.inquiries.clear();
    this.resolutions.clear();
    this.activeInquiryId = undefined;
    this.totalInquiries = 0;
    this.resolvedCount = 0;
  }
}
