/**
 * adversarial-scrutiny.contracts.ts
 *
 * Core data contracts for Adversarial Scrutiny, Factual Provenance Verification,
 * Cognitive Spend Decomposition, and Senior Architect Red-Teaming (Pass 194 / ADR-132).
 */

export type AdversarialSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type AdversarialCategory =
  | "UNGROUNDED_PROVENANCE"
  | "SIMULATION_ILLUSION"
  | "PREMATURE_COMPLETION"
  | "COMPRESSIBLE_BLOAT"
  | "ARCHITECTURAL_FRAGILITY"
  | "AMNESIA_VULNERABILITY"
  | "UNTESTED_EDGE"
  | "HALLUCINATED_METRIC";

export interface AdversarialFinding {
  readonly id: string;
  readonly category: AdversarialCategory;
  readonly severity: AdversarialSeverity;
  readonly title: string;
  readonly description: string;
  readonly location?: string;
  readonly evidence?: string;
  readonly remediation: string;
  readonly impactScore: number; // 0 to 100
}

export interface ProvenanceGroundingProof {
  readonly claim: string;
  readonly isGrounded: boolean;
  readonly confidence: number; // 0 to 1.0
  readonly sourceSnippet?: string;
  readonly divergenceDetails?: string;
  readonly characterSpan?: readonly [number, number];
}

export interface FluffCategorySpend {
  readonly category: string;
  readonly tokens: number;
  readonly sample: string;
}

export interface CognitiveDecompositionReport {
  readonly totalTokenEstimate: number;
  readonly compressibleTokens: number;
  readonly irreducibleTokens: number;
  readonly compressiblePercentage: number;
  readonly potentialLatencyReductionMs: number;
  readonly fluffCategories: readonly FluffCategorySpend[];
}

export type AdversarialVerdictStatus =
  | "APPROVED"
  | "CAUTION"
  | "REJECTED_FAIL_CLOSED";

export interface AdversarialRedTeamVerdict {
  readonly auditId: string;
  readonly targetType: "plan" | "code" | "output" | "prompt" | "completion_claim";
  readonly verdict: AdversarialVerdictStatus;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly totalFindings: number;
  readonly score: number; // 0 (catastrophic) to 100 (flawless)
  readonly findings: readonly AdversarialFinding[];
  readonly provenanceGrounding: readonly ProvenanceGroundingProof[];
  readonly cognitiveDecomposition?: CognitiveDecompositionReport;
  readonly executiveSummary: string;
  readonly timestamp: number;
  readonly latencyMs: number;
}

export type AdversarialHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface AdversarialAuditMetrics {
  readonly totalAudits: number;
  readonly totalFindings: number;
  readonly criticalFindings: number;
  readonly rejectedAudits: number;
  readonly passedAudits: number;
  readonly averageAuditLatencyMs: number;
  readonly totalTokensAnalyzed: number;
  readonly totalCompressibleTokensSaved: number;
}

export interface AdversarialScrutinyOptions {
  readonly strictProvenance?: boolean;
  readonly failClosedOnUnverified?: boolean;
  readonly maxAllowableRiskScore?: number;
  readonly inspectCognitiveSpend?: boolean;
  readonly contextScope?: string;
}
