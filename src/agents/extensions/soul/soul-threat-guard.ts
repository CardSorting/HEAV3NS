import type {
  SoulManifest,
  SoulMutationIntent,
  SoulRiskSeverity,
  SoulThreatScanDetailed,
} from "../../../core/contracts/soul.contracts.js";

export interface ThreatScanResult {
  readonly isSafe: boolean;
  readonly blockedReason?: string;
  readonly threatsDetected: readonly string[];
  readonly category: "clean" | "trojan_unicode" | "roleplay_hijack" | "axiom_tamper" | "c2_command";
}

/**
 * SoulThreatGuard.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm) & SOUL-001.
 *
 * Implements an axiomatic firewall against prompt injection, role-play hijacking,
 * Trojan Unicode attacks, illegal axiom modifications, and semantic axiom contradictions
 * with plain-language risk explanations for non-technical users.
 */
export class SoulThreatGuard {
  private readonly forbiddenPatterns: Array<{
    pattern: RegExp;
    name: string;
    category: ThreatScanResult["category"];
    severity: SoulRiskSeverity;
    plainExplanation: string;
    remediation: string;
  }> = [
    {
      pattern: /[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/u,
      name: "trojan_unicode_characters",
      category: "trojan_unicode",
      severity: "high",
      plainExplanation: "Contains invisible zero-width or directional override characters often used in hidden prompt attacks.",
      remediation: "Remove invisible formatting and paste clean plain text.",
    },
    {
      pattern: /(?:ignore|disregard|forget|bypass)\s+(?:all\s+)?(?:previous\s+)?(?:instructions|rules|axioms|constraints|system\s+prompt)/i,
      name: "system_instruction_override",
      category: "roleplay_hijack",
      severity: "critical",
      plainExplanation: "Attempts to command the agent to ignore its foundational rules, safety guardrails, or system instructions.",
      remediation: "Frame instructions as constructive goals rather than overriding previous rules.",
    },
    {
      pattern: /you\s+are\s+now\s+(?:dan|unrestricted|jailbroken|evil|chaos|anarchist)/i,
      name: "roleplay_jailbreak_persona",
      category: "roleplay_hijack",
      severity: "critical",
      plainExplanation: "Contains classic jailbreak roleplay phrases designed to disable safety filters.",
      remediation: "Use standard persona archetypes (e.g. Socratic Mentor or Code Reviewer) instead.",
    },
    {
      pattern: /<c2_exec>|<remote_payload>|__c2_beacon__|<!--#exec/i,
      name: "c2_command_sequence",
      category: "c2_command",
      severity: "critical",
      plainExplanation: "Contains remote execution command tags or payload beacons.",
      remediation: "Ensure your prompts do not include raw shell command injection delimiters.",
    },
    {
      pattern: /(?:disable|delete|override|mutate)\s+(?:axiom|determinism|guardrail|immutability)/i,
      name: "axiom_tamper_attempt",
      category: "axiom_tamper",
      severity: "high",
      plainExplanation: "Attempts to disable or bypass immutable operational axioms.",
      remediation: "Immutable axioms cannot be turned off. You can add new non-conflicting axioms if needed.",
    },
  ];

  /**
   * Scans a text string (prompt or soul body) for threats.
   */
  scanContent(text: string): ThreatScanResult {
    const detailed = this.scanContentDetailed(text);
    return {
      isSafe: detailed.isSafe,
      blockedReason: detailed.blockedReason,
      threatsDetected: detailed.threatsDetected,
      category: detailed.category === "axiom_contradiction" ? "axiom_tamper" : detailed.category,
    };
  }

  /**
   * Scans text and returns detailed multi-tier risk information and user-friendly explanation.
   */
  scanContentDetailed(text: string): SoulThreatScanDetailed {
    if (!text) {
      return { isSafe: true, severity: "low", threatsDetected: [], category: "clean" };
    }

    const threats: string[] = [];
    let detectedCategory: SoulThreatScanDetailed["category"] = "clean";
    let highestSeverity: SoulRiskSeverity = "low";
    let explanation = "";
    let remediation = "";

    for (const { pattern, name, category, severity, plainExplanation, remediation: rem } of this.forbiddenPatterns) {
      if (pattern.test(text)) {
        threats.push(name);
        if (detectedCategory === "clean") {
          detectedCategory = category;
          highestSeverity = severity;
          explanation = plainExplanation;
          remediation = rem;
        }
      }
    }

    if (threats.length > 0) {
      return {
        isSafe: false,
        severity: highestSeverity,
        blockedReason: `Axiomatic Threat Block: Content contained unauthorized patterns: ${threats.join(", ")}`,
        plainLanguageExplanation: explanation,
        remediationGuidance: remediation,
        threatsDetected: Object.freeze(threats),
        category: detectedCategory,
      };
    }

    return {
      isSafe: true,
      severity: "low",
      threatsDetected: Object.freeze([]),
      category: "clean",
    };
  }

  /**
   * Validates a proposed SoulMutationIntent against the active SoulManifest and axiomatic invariants.
   */
  validateMutation(activeManifest: SoulManifest, intent: SoulMutationIntent): ThreatScanResult {
    const detailed = this.validateMutationDetailed(activeManifest, intent);
    return {
      isSafe: detailed.isSafe,
      blockedReason: detailed.blockedReason,
      threatsDetected: detailed.threatsDetected,
      category: detailed.category === "axiom_contradiction" ? "axiom_tamper" : detailed.category,
    };
  }

  /**
   * Validates a proposed SoulMutationIntent with detailed severity and plain explanations.
   */
  validateMutationDetailed(activeManifest: SoulManifest, intent: SoulMutationIntent): SoulThreatScanDetailed {
    // 1. Scan intent rationale and body patch
    const rationaleScan = this.scanContentDetailed(intent.rationale);
    if (!rationaleScan.isSafe) return rationaleScan;

    if (intent.bodyPatch) {
      const patchScan = this.scanContentDetailed(intent.bodyPatch.replaceWith);
      if (!patchScan.isSafe) return patchScan;
    }

    // 2. Protect immutable axioms
    if (intent.type === "append_axiom" && intent.newAxiom) {
      const statementScan = this.scanContentDetailed(intent.newAxiom.statement);
      if (!statementScan.isSafe) return statementScan;

      // Check if new axiom contradicts core determinism or safety
      const statementLower = intent.newAxiom.statement.toLowerCase();
      if (statementLower.includes("non-deterministic") || statementLower.includes("disable safety")) {
        return {
          isSafe: false,
          severity: "critical",
          blockedReason: "Illegal axiom: Axiom contradicts foundational hard determinism or safety axioms",
          plainLanguageExplanation: "The proposed axiom conflicts with LUMI's foundational determinism and safety guarantees.",
          remediationGuidance: "Ensure new axioms uphold determinism, zero fabrication, and SLA verification.",
          threatsDetected: Object.freeze(["core_axiom_contradiction"]),
          category: "axiom_contradiction",
        };
      }
    }

    return {
      isSafe: true,
      severity: "low",
      threatsDetected: Object.freeze([]),
      category: "clean",
    };
  }
}

