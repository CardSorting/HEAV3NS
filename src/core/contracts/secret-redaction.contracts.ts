/**
 * secret-redaction.contracts.ts
 *
 * Core architectural contracts for Deterministic Secret Redaction, Query Masking,
 * and Sensitive Path Safety Substrate (Phase 95 / ADR-047).
 */

export type RedactionCategory =
  | "api_key"
  | "jwt"
  | "pem_key"
  | "connection_string"
  | "oauth_token"
  | "query_param"
  | "body_field"
  | "blocked_path";

export interface RedactionMatch {
  readonly category: RedactionCategory;
  readonly patternName: string;
  readonly originalLength: number;
  readonly maskedValue: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly timestamp: number;
}

export interface RedactionResult {
  readonly sanitizedText: string;
  readonly totalRedactions: number;
  readonly matches: readonly RedactionMatch[];
  readonly executionDurationMs: number;
}

export interface PathSafetyDecision {
  readonly action: "allow" | "deny" | "require_approval";
  readonly reason: string;
  readonly canonicalPath: string;
  readonly isSensitive: boolean;
}

export interface SecretRedactionWorkspaceSnapshot {
  readonly totalRedactions: number;
  readonly activeMatches: readonly RedactionMatch[];
  readonly blockedAccessAttempts: readonly PathSafetyDecision[];
  readonly timestamp: number;
}
