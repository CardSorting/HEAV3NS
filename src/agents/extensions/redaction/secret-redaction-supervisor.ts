/**
 * secret-redaction-supervisor.ts
 *
 * Master supervisor coordinating secret redaction, query masking, and path safety gating (Phase 95 / ADR-047).
 */

import type {
  PathSafetyDecision,
  RedactionMatch,
  RedactionResult,
} from "../../../core/contracts/secret-redaction.contracts.js";
import { DeterministicSecretRedactor } from "../../../tooling/extensions/redaction/deterministic-secret-redactor.js";
import { BroccoliRedactionSubstrate } from "../../../sessions/extensions/redaction/broccoli-redaction-substrate.js";

export class SecretRedactionSupervisor {
  private redactor: DeterministicSecretRedactor;
  private substrate: BroccoliRedactionSubstrate;

  constructor(
    redactor: DeterministicSecretRedactor,
    substrate: BroccoliRedactionSubstrate
  ) {
    this.redactor = redactor;
    this.substrate = substrate;
  }

  /**
   * Scans and sanitizes secrets from text, persisting matches to the Broccolidb substrate.
   */
  redactText(text: string): RedactionResult {
    const result = this.redactor.redact(text);
    if (result.matches.length > 0) {
      this.substrate.recordMatches(result.matches);
    }
    return result;
  }

  /**
   * Evaluates path safety and logs blocked attempts to the substrate.
   */
  evaluatePathSafety(targetPath: string, mode: "read" | "write" = "read"): PathSafetyDecision {
    const decision = this.redactor.evaluatePathSafety(targetPath, mode);
    if (decision.action !== "allow") {
      this.substrate.recordBlockedAccess(decision);
    }
    return decision;
  }

  /**
   * Retrieves all recorded redaction matches.
   */
  getMatches(): readonly RedactionMatch[] {
    return this.substrate.getMatches();
  }

  /**
   * Retrieves all blocked path access attempts.
   */
  getBlockedAccessAttempts(): readonly PathSafetyDecision[] {
    return this.substrate.getBlockedAccessAttempts();
  }
}
