/**
 * verification-evidence.contracts.ts
 *
 * Core data contracts for Deterministic Coding Verification Evidence Ledger,
 * Stop-Gate Policy & Session Insights Subsystem (Phase 92 / ADR-044).
 */

export type EvidenceKind = "test" | "build" | "typecheck" | "lint" | "manual";

export type EvidenceScope = "file" | "package" | "workspace";

export interface VerificationEvidenceRecord {
  readonly id: string;
  readonly frameIndex: number;
  readonly command: string;
  readonly kind: EvidenceKind;
  readonly scope: EvidenceScope;
  readonly passed: boolean;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly outputSummary: string;
  readonly verifiedPaths: readonly string[];
  readonly timestamp: number;
}

export interface VerificationStopGateEvaluation {
  readonly shouldNudge: boolean;
  readonly reason: string;
  readonly unverifiedModifiedFiles: readonly string[];
  readonly latestEvidence?: VerificationEvidenceRecord;
}

export interface SessionInsightsReport {
  readonly totalFrames: number;
  readonly totalEvidenceCount: number;
  readonly passedEvidenceCount: number;
  readonly failedEvidenceCount: number;
  readonly evidenceByKind: Record<EvidenceKind, number>;
  readonly unverifiedCodeFiles: readonly string[];
}

export interface VerificationEvidenceWorkspaceSnapshot {
  readonly totalRecords: number;
  readonly records: readonly VerificationEvidenceRecord[];
  readonly modifiedCodeFiles: readonly string[];
  readonly timestamp: number;
}
