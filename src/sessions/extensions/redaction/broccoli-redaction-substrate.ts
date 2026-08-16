/**
 * broccoli-redaction-substrate.ts
 *
 * In-memory Broccolidb repository for secret redaction matches and path safety events (Phase 95 / ADR-047).
 */

import type {
  PathSafetyDecision,
  RedactionMatch,
  SecretRedactionWorkspaceSnapshot,
} from "../../../core/contracts/secret-redaction.contracts.js";

export class BroccoliRedactionSubstrate {
  private matches: RedactionMatch[];
  private blockedAccessAttempts: PathSafetyDecision[];

  constructor() {
    this.matches = [];
    this.blockedAccessAttempts = [];
  }

  recordMatches(matches: readonly RedactionMatch[]): void {
    for (let i = 0; i < matches.length; i++) {
      this.matches.push(matches[i]);
    }
    if (this.matches.length > 1000) {
      this.matches.splice(0, this.matches.length - 1000);
    }
  }

  recordBlockedAccess(decision: PathSafetyDecision): void {
    this.blockedAccessAttempts.push(decision);
    if (this.blockedAccessAttempts.length > 500) {
      this.blockedAccessAttempts.shift();
    }
  }

  getMatches(): readonly RedactionMatch[] {
    return this.matches;
  }

  getBlockedAccessAttempts(): readonly PathSafetyDecision[] {
    return this.blockedAccessAttempts;
  }

  exportSnapshot(): SecretRedactionWorkspaceSnapshot {
    return {
      totalRedactions: this.matches.length,
      activeMatches: [...this.matches],
      blockedAccessAttempts: [...this.blockedAccessAttempts],
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: SecretRedactionWorkspaceSnapshot): void {
    this.matches = [...snapshot.activeMatches];
    this.blockedAccessAttempts = [...snapshot.blockedAccessAttempts];
  }

  clear(): void {
    this.matches = [];
    this.blockedAccessAttempts = [];
  }
}
