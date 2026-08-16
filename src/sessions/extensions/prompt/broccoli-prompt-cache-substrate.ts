/**
 * broccoli-prompt-cache-substrate.ts
 *
 * In-memory Broccolidb repository for active prompt cache plans and byte-stable envelopes (Phase 93 / ADR-045).
 */

import type {
  ByteStablePromptEnvelope,
  PromptCacheWorkspaceSnapshot,
  ReasoningSanitizationResult,
} from "../../../core/contracts/prompt-cache.contracts.js";

export class BroccoliPromptCacheSubstrate {
  private latestEnvelope?: ByteStablePromptEnvelope;
  private sanitizationHistory: ReasoningSanitizationResult[];

  constructor() {
    this.latestEnvelope = undefined;
    this.sanitizationHistory = [];
  }

  setLatestEnvelope(envelope: ByteStablePromptEnvelope): void {
    this.latestEnvelope = envelope;
  }

  getLatestEnvelope(): ByteStablePromptEnvelope | undefined {
    return this.latestEnvelope;
  }

  recordSanitization(result: ReasoningSanitizationResult): void {
    this.sanitizationHistory.push(result);
    if (this.sanitizationHistory.length > 500) {
      this.sanitizationHistory.shift();
    }
  }

  getSanitizationHistory(): readonly ReasoningSanitizationResult[] {
    return this.sanitizationHistory;
  }

  exportSnapshot(): PromptCacheWorkspaceSnapshot {
    return {
      envelopeHash: this.latestEnvelope ? this.latestEnvelope.systemPromptHash : "",
      totalBreakpoints: this.latestEnvelope ? this.latestEnvelope.breakpoints.length : 0,
      activeBreakpoints: this.latestEnvelope ? [...this.latestEnvelope.breakpoints] : [],
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: PromptCacheWorkspaceSnapshot): void {
    if (snapshot.envelopeHash.length > 0) {
      this.latestEnvelope = {
        staticPrefixBytes: 0,
        systemPromptHash: snapshot.envelopeHash,
        dynamicSuffixBytes: 0,
        totalPromptBytes: 0,
        breakpoints: [...snapshot.activeBreakpoints],
      };
    } else {
      this.latestEnvelope = undefined;
    }
  }

  clear(): void {
    this.latestEnvelope = undefined;
    this.sanitizationHistory = [];
  }
}
