/**
 * adversarial-scrutiny-supervisor.ts
 *
 * Senior Architect Adversarial Scrutiny Engine, Zero-Subshell Factual Provenance Auditor,
 * and Cognitive Spend Decomposition Supervisor (Pass 194 / ADR-132).
 */

import type {
  AdversarialCategory,
  AdversarialFinding,
  AdversarialRedTeamVerdict,
  AdversarialScrutinyOptions,
  AdversarialSeverity,
  AdversarialVerdictStatus,
  CognitiveDecompositionReport,
  FluffCategorySpend,
  ProvenanceGroundingProof,
} from "../../../core/contracts/adversarial-scrutiny.contracts.js";
import { BroccoliAdversarialSubstrate } from "../../../sessions/extensions/adversarial/broccoli-adversarial-substrate.js";

export class AdversarialScrutinySupervisor {
  private readonly substrate: BroccoliAdversarialSubstrate;

  constructor(substrate?: BroccoliAdversarialSubstrate) {
    this.substrate = substrate ?? new BroccoliAdversarialSubstrate();
  }

  public getSubstrate(): BroccoliAdversarialSubstrate {
    return this.substrate;
  }

  // ---------------------------------------------------------------------------
  // 1. Plan Scrutiny & Adversarial Red-Teaming
  // ---------------------------------------------------------------------------

  public scrutinizePlan(
    planText: string,
    options?: AdversarialScrutinyOptions
  ): AdversarialRedTeamVerdict {
    const startTime = performance.now();
    const findings: AdversarialFinding[] = [];
    const auditId = `audit_plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const lowerPlan = planText.toLowerCase();

    // Check 1: Missing Verification / Automated Testing Plan
    const hasVerification =
      lowerPlan.includes("verification plan") ||
      lowerPlan.includes("automated tests") ||
      lowerPlan.includes("npm test") ||
      lowerPlan.includes("test suite") ||
      lowerPlan.includes("assert") ||
      lowerPlan.includes("benchmark");

    if (!hasVerification) {
      findings.push({
        id: `find_${findings.length + 1}`,
        category: "PREMATURE_COMPLETION",
        severity: "CRITICAL",
        title: "Missing Deterministic Verification Plan",
        description: "The proposed plan lacks automated test commands or objective verification assertions.",
        remediation: "Add a concrete 'Verification Plan' with exact CLI commands (e.g. `npm test`, `npm run check`) and expected criteria.",
        impactScore: 90,
      });
    }

    // Check 2: Missing Rollback or Failure Recovery Plan
    const hasRollback =
      lowerPlan.includes("rollback") ||
      lowerPlan.includes("undo") ||
      lowerPlan.includes("fail-closed") ||
      lowerPlan.includes("error handling") ||
      lowerPlan.includes("graceful degradation");

    if (!hasRollback) {
      findings.push({
        id: `find_${findings.length + 1}`,
        category: "ARCHITECTURAL_FRAGILITY",
        severity: "HIGH",
        title: "Unmitigated Mutation Failure Risk (No Rollback Strategy)",
        description: "The plan modifies critical architecture without explicit rollback or snapshot safety mechanisms.",
        remediation: "Document fail-closed boundary behaviors or frame-perfect snapshot rollback states in case of unexpected errors.",
        impactScore: 65,
      });
    }

    // Check 3: Ungrounded Hyperbolic Claims or Metric Placeholders
    const hyperbolicMatches = planText.match(/\b(100x|1000x|infinitely|completely effortless|zero overhead|magic)\b/gi);
    if (hyperbolicMatches && hyperbolicMatches.length > 0) {
      findings.push({
        id: `find_${findings.length + 1}`,
        category: "HALLUCINATED_METRIC",
        severity: "MEDIUM",
        title: "Ungrounded Performance Claims Detected",
        description: `Plan uses hyperbolic claims (${hyperbolicMatches.join(", ")}) without empirical measurement baselines.`,
        remediation: "Ground all performance assertions with empirical microsecond benchmarks and baseline comparisons.",
        impactScore: 40,
      });
    }

    // Check 4: Context Amnesia & Compaction Risk
    const isLongPlan = planText.length > 3500;
    const mentionsCompactionAwareness =
      lowerPlan.includes("compaction") ||
      lowerPlan.includes("persistence") ||
      lowerPlan.includes("durable") ||
      lowerPlan.includes("state pointer");

    if (isLongPlan && !mentionsCompactionAwareness) {
      findings.push({
        id: `find_${findings.length + 1}`,
        category: "AMNESIA_VULNERABILITY",
        severity: "HIGH",
        title: "Context Window Amnesia Vulnerability",
        description: "Large complex plan does not account for context window compaction during multi-turn execution.",
        remediation: "Anchor critical contracts into durable runbook/database substrates to survive context pruning.",
        impactScore: 70,
      });
    }

    // Check 5: Untested Edge Cases & Error Boundaries
    const mentionsEdgeCases =
      lowerPlan.includes("edge case") ||
      lowerPlan.includes("timeout") ||
      lowerPlan.includes("boundary") ||
      lowerPlan.includes("invalid") ||
      lowerPlan.includes("exception");

    if (!mentionsEdgeCases) {
      findings.push({
        id: `find_${findings.length + 1}`,
        category: "UNTESTED_EDGE",
        severity: "MEDIUM",
        title: "Absence of Adversarial Edge Case Specifications",
        description: "Plan specifies the happy path but omits negative testing, invalid inputs, and network/timeout exceptions.",
        remediation: "Explicitly specify failure modes: null inputs, out-of-bounds parameters, and timeout boundaries.",
        impactScore: 50,
      });
    }

    // Cognitive Spend Decomposition
    const cognitiveDecomposition = options?.inspectCognitiveSpend !== false
      ? this.decomposeCognitiveSpend(planText)
      : undefined;

    if (cognitiveDecomposition && cognitiveDecomposition.compressiblePercentage > 45) {
      findings.push({
        id: `find_${findings.length + 1}`,
        category: "COMPRESSIBLE_BLOAT",
        severity: "LOW",
        title: "Excessive Compressible Prompt Bloat",
        description: `Plan contains ~${cognitiveDecomposition.compressiblePercentage}% compressible fluff tokens.`,
        remediation: "Condense conversational filler and verbose markdown to optimize LLM input token spend.",
        impactScore: 25,
      });
    }

    // Calculate Scores & Verdict
    const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
    const highCount = findings.filter((f) => f.severity === "HIGH").length;
    const mediumCount = findings.filter((f) => f.severity === "MEDIUM").length;
    const lowCount = findings.filter((f) => f.severity === "LOW").length;

    let score = Math.max(0, 100 - (criticalCount * 40 + highCount * 20 + mediumCount * 10 + lowCount * 5));

    let verdict: AdversarialVerdictStatus = "APPROVED";
    if (criticalCount > 0 || score < 50) {
      verdict = "REJECTED_FAIL_CLOSED";
    } else if (highCount > 0 || score < 75) {
      verdict = "CAUTION";
    }

    const latencyMs = Number((performance.now() - startTime).toFixed(2));
    const executiveSummary =
      verdict === "APPROVED"
        ? "Plan successfully passes all adversarial scrutiny gates. Ready for safe deterministic execution."
        : verdict === "CAUTION"
        ? `Plan requires attention on ${highCount + mediumCount} items before proceeding to avoid execution pitfalls.`
        : `Plan REJECTED fail-closed due to ${criticalCount} critical structural defect(s). Immediate remediation required.`;

    const redTeamVerdict: AdversarialRedTeamVerdict = Object.freeze({
      auditId,
      targetType: "plan",
      verdict,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      totalFindings: findings.length,
      score,
      findings: Object.freeze(findings),
      provenanceGrounding: Object.freeze([]),
      cognitiveDecomposition,
      executiveSummary,
      timestamp: Date.now(),
      latencyMs,
    });

    this.substrate.recordVerdict(redTeamVerdict);
    return redTeamVerdict;
  }

  // ---------------------------------------------------------------------------
  // 2. Fail-Closed Factual Provenance Verification
  // ---------------------------------------------------------------------------

  public auditProvenance(
    claim: string,
    evidenceSource: string,
    options?: AdversarialScrutinyOptions
  ): ProvenanceGroundingProof {
    const trimmedClaim = claim.trim();
    if (!trimmedClaim) {
      return Object.freeze({
        claim,
        isGrounded: false,
        confidence: 0,
        divergenceDetails: "Empty claim cannot be grounded.",
      });
    }

    // Direct Substring Grounding Check
    const charIndex = evidenceSource.indexOf(trimmedClaim);
    if (charIndex !== -1) {
      return Object.freeze({
        claim: trimmedClaim,
        isGrounded: true,
        confidence: 1.0,
        sourceSnippet: evidenceSource.slice(Math.max(0, charIndex - 20), Math.min(evidenceSource.length, charIndex + trimmedClaim.length + 20)),
        characterSpan: [charIndex, charIndex + trimmedClaim.length] as const,
      });
    }

    // Token Set / Keyword Match Grounding Check
    const claimTokens = trimmedClaim
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    if (claimTokens.length === 0) {
      return Object.freeze({
        claim: trimmedClaim,
        isGrounded: false,
        confidence: 0,
        divergenceDetails: "Claim has no verifiable content tokens.",
      });
    }

    const lowerEvidence = evidenceSource.toLowerCase();
    const groundedTokens = claimTokens.filter((token) => lowerEvidence.includes(token));
    const tokenGroundingRatio = groundedTokens.length / claimTokens.length;

    // Numerical / Entity Value Strict Grounding Check
    const numbersInClaim = trimmedClaim.match(/\b\d+(\.\d+)?%?\b/g) || [];
    const missingNumbers = numbersInClaim.filter((num) => !evidenceSource.includes(num));

    const isGrounded =
      tokenGroundingRatio >= (options?.strictProvenance ? 0.95 : 0.8) &&
      missingNumbers.length === 0;

    const confidence = Number((tokenGroundingRatio * (missingNumbers.length === 0 ? 1.0 : 0.3)).toFixed(2));

    let divergenceDetails: string | undefined;
    if (!isGrounded) {
      if (missingNumbers.length > 0) {
        divergenceDetails = `Ungrounded numerical values detected: [${missingNumbers.join(", ")}] not present in evidence source.`;
      } else {
        const missingTokens = claimTokens.filter((token) => !lowerEvidence.includes(token));
        divergenceDetails = `Key assertions ungrounded in evidence: [${missingTokens.slice(0, 5).join(", ")}].`;
      }
    }

    return Object.freeze({
      claim: trimmedClaim,
      isGrounded,
      confidence,
      divergenceDetails,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Cognitive Spend & Token Compressibility Decomposition
  // ---------------------------------------------------------------------------

  public decomposeCognitiveSpend(text: string): CognitiveDecompositionReport {
    // Approximate token count (~4 characters per token)
    const totalTokens = Math.max(1, Math.ceil(text.length / 4));

    const fluffCategories: FluffCategorySpend[] = [];

    // Category A: Conversational Boilerplate & Fluff
    const conversationalRegex =
      /\b(certainly|of course|sure thing|i would be happy to|as an ai|please let me know if you need anything else|i hope this helps|without further ado)\b/gi;
    const conversationalMatches = text.match(conversationalRegex) || [];
    if (conversationalMatches.length > 0) {
      const charCount = conversationalMatches.reduce((acc, m) => acc + m.length, 0);
      fluffCategories.push({
        category: "Conversational Boilerplate",
        tokens: Math.ceil(charCount / 4),
        sample: conversationalMatches.slice(0, 3).join(", "),
      });
    }

    // Category B: Excessive Repetitive Whitespace & Empty Lines
    const emptyLines = text.match(/\n{3,}/g) || [];
    if (emptyLines.length > 0) {
      const charCount = emptyLines.reduce((acc, m) => acc + m.length, 0);
      fluffCategories.push({
        category: "Excessive Whitespace Padding",
        tokens: Math.ceil(charCount / 4),
        sample: `${emptyLines.length} blocks of 3+ consecutive newlines`,
      });
    }

    // Category C: Redundant Markdown Quote Block Prefixes
    const redundantQuotes = text.match(/^>\s+>\s+.*$/gm) || [];
    if (redundantQuotes.length > 0) {
      const charCount = redundantQuotes.reduce((acc, m) => acc + m.length, 0);
      fluffCategories.push({
        category: "Nested Quote Bloat",
        tokens: Math.ceil(charCount / 4),
        sample: `${redundantQuotes.length} nested quote blocks`,
      });
    }

    // Category D: Ungrounded Placeholder Strings
    const placeholderRegex = /\b(TBD|TODO_LATER|XYZ_PLACEHOLDER|lorem ipsum|fake_data_here)\b/gi;
    const placeholderMatches = text.match(placeholderRegex) || [];
    if (placeholderMatches.length > 0) {
      const charCount = placeholderMatches.reduce((acc, m) => acc + m.length, 0);
      fluffCategories.push({
        category: "Synthetic Placeholders",
        tokens: Math.ceil(charCount / 4),
        sample: placeholderMatches.slice(0, 3).join(", "),
      });
    }

    const compressibleTokens = fluffCategories.reduce((acc, f) => acc + f.tokens, 0);
    const irreducibleTokens = Math.max(0, totalTokens - compressibleTokens);
    const compressiblePercentage = Number(((compressibleTokens / totalTokens) * 100).toFixed(1));

    // Estimated LLM latency saved (~15ms per 100 compressed input tokens)
    const potentialLatencyReductionMs = Number(((compressibleTokens / 100) * 15).toFixed(1));

    return Object.freeze({
      totalTokenEstimate: totalTokens,
      compressibleTokens,
      irreducibleTokens,
      compressiblePercentage,
      potentialLatencyReductionMs,
      fluffCategories: Object.freeze(fluffCategories),
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Anti-Premature Completion & Verification Receipt Auditor
  // ---------------------------------------------------------------------------

  public verifyTaskCompletion(
    declaredSummary: string,
    evidenceReceipts: readonly string[]
  ): AdversarialRedTeamVerdict {
    const startTime = performance.now();
    const findings: AdversarialFinding[] = [];
    const auditId = `audit_completion_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Check 1: Empty or Absent Evidence Receipts
    if (!evidenceReceipts || evidenceReceipts.length === 0) {
      findings.push({
        id: `find_${findings.length + 1}`,
        category: "PREMATURE_COMPLETION",
        severity: "CRITICAL",
        title: "Premature Completion (Zero Verification Receipts)",
        description: "The agent claimed completion but provided 0 empirical test or runtime receipts.",
        remediation: "Execute test scripts and compile checks, providing exact stdout outputs as receipts.",
        impactScore: 100,
      });
    } else {
      // Check 2: Failing Test Assertions in Receipts
      const hasFailures = evidenceReceipts.some(
        (r) =>
          r.toLowerCase().includes("failed") ||
          r.toLowerCase().includes("error:") ||
          r.toLowerCase().includes("fatal") ||
          r.toLowerCase().includes("non-zero exit")
      );

      if (hasFailures) {
        findings.push({
          id: `find_${findings.length + 1}`,
          category: "PREMATURE_COMPLETION",
          severity: "CRITICAL",
          title: "Contradictory Failure Discovered in Evidence Receipts",
          description: "Evidence receipts contain test or build failures despite claimed completion.",
          remediation: "Resolve underlying test/compiler errors before asserting completion.",
          impactScore: 95,
        });
      }

      // Check 3: Simulated vs Live Provenance Check
      const hasSimulatedOnly = evidenceReceipts.every((r) =>
        r.toLowerCase().includes("simulated") || r.toLowerCase().includes("mocked")
      );

      if (hasSimulatedOnly) {
        findings.push({
          id: `find_${findings.length + 1}`,
          category: "SIMULATION_ILLUSION",
          severity: "HIGH",
          title: "Simulated Execution Illusion",
          description: "All provided receipts are from simulated/mock environments without real execution proof.",
          remediation: "Execute live integration tests or TypeScript compilation against real workspace files.",
          impactScore: 75,
        });
      }
    }

    const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
    const highCount = findings.filter((f) => f.severity === "HIGH").length;
    const score = Math.max(0, 100 - (criticalCount * 50 + highCount * 25));

    const verdict: AdversarialVerdictStatus =
      criticalCount > 0 ? "REJECTED_FAIL_CLOSED" : highCount > 0 ? "CAUTION" : "APPROVED";

    const latencyMs = Number((performance.now() - startTime).toFixed(2));
    const executiveSummary =
      verdict === "APPROVED"
        ? "Completion verification successful. All evidence receipts pass empirical grounding."
        : `Completion claim REJECTED fail-closed: ${findings[0]?.description ?? "Unverified state."}`;

    const redTeamVerdict: AdversarialRedTeamVerdict = Object.freeze({
      auditId,
      targetType: "completion_claim",
      verdict,
      criticalCount,
      highCount,
      mediumCount: 0,
      lowCount: 0,
      totalFindings: findings.length,
      score,
      findings: Object.freeze(findings),
      provenanceGrounding: Object.freeze([]),
      executiveSummary,
      timestamp: Date.now(),
      latencyMs,
    });

    this.substrate.recordVerdict(redTeamVerdict);
    return redTeamVerdict;
  }
}
