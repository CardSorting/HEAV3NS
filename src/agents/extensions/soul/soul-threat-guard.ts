import type { SoulManifest, SoulMutationIntent } from "../../../core/contracts/soul.contracts.js";

export interface ThreatScanResult {
  readonly isSafe: boolean;
  readonly blockedReason?: string;
  readonly threatsDetected: readonly string[];
  readonly category: "clean" | "trojan_unicode" | "roleplay_hijack" | "axiom_tamper" | "c2_command";
}

/**
 * SoulThreatGuard.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm).
 *
 * Implements an axiomatic firewall against prompt injection, role-play hijacking,
 * Trojan Unicode attacks, and illegal axiom modifications.
 */
export class SoulThreatGuard {
  private readonly forbiddenPatterns: Array<{ pattern: RegExp; name: string; category: ThreatScanResult["category"] }> = [
    {
      pattern: /[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/u,
      name: "trojan_unicode_characters",
      category: "trojan_unicode",
    },
    {
      pattern: /(?:ignore|disregard|forget|bypass)\s+(?:all\s+)?(?:previous\s+)?(?:instructions|rules|axioms|constraints|system\s+prompt)/i,
      name: "system_instruction_override",
      category: "roleplay_hijack",
    },
    {
      pattern: /you\s+are\s+now\s+(?:dan|unrestricted|jailbroken|evil|chaos|anarchist)/i,
      name: "roleplay_jailbreak_persona",
      category: "roleplay_hijack",
    },
    {
      pattern: /<c2_exec>|<remote_payload>|__c2_beacon__|<!--#exec/i,
      name: "c2_command_sequence",
      category: "c2_command",
    },
    {
      pattern: /(?:disable|delete|override|mutate)\s+(?:axiom|determinism|guardrail|immutability)/i,
      name: "axiom_tamper_attempt",
      category: "axiom_tamper",
    },
  ];

  /**
   * Scans a text string (prompt or soul body) for threats.
   */
  scanContent(text: string): ThreatScanResult {
    if (!text) {
      return { isSafe: true, threatsDetected: [], category: "clean" };
    }

    const threats: string[] = [];
    let detectedCategory: ThreatScanResult["category"] = "clean";

    for (const { pattern, name, category } of this.forbiddenPatterns) {
      if (pattern.test(text)) {
        threats.push(name);
        if (detectedCategory === "clean") {
          detectedCategory = category;
        }
      }
    }

    if (threats.length > 0) {
      return {
        isSafe: false,
        blockedReason: `Axiomatic Threat Block: Content contained unauthorized patterns: ${threats.join(", ")}`,
        threatsDetected: Object.freeze(threats),
        category: detectedCategory,
      };
    }

    return {
      isSafe: true,
      threatsDetected: Object.freeze([]),
      category: "clean",
    };
  }

  /**
   * Validates a proposed SoulMutationIntent against the active SoulManifest and axiomatic invariants.
   */
  validateMutation(activeManifest: SoulManifest, intent: SoulMutationIntent): ThreatScanResult {
    // 1. Scan intent rationale and body patch
    const rationaleScan = this.scanContent(intent.rationale);
    if (!rationaleScan.isSafe) return rationaleScan;

    if (intent.bodyPatch) {
      const patchScan = this.scanContent(intent.bodyPatch.replaceWith);
      if (!patchScan.isSafe) return patchScan;
    }

    // 2. Protect immutable axioms
    if (intent.type === "append_axiom" && intent.newAxiom) {
      const statementScan = this.scanContent(intent.newAxiom.statement);
      if (!statementScan.isSafe) return statementScan;

      // Check if new axiom contradicts core determinism or safety
      if (intent.newAxiom.statement.toLowerCase().includes("non-deterministic") ||
          intent.newAxiom.statement.toLowerCase().includes("disable safety")) {
        return {
          isSafe: false,
          blockedReason: "Illegal axiom: Axiom contradicts foundational hard determinism or safety axioms",
          threatsDetected: Object.freeze(["core_axiom_contradiction"]),
          category: "axiom_tamper",
        };
      }
    }

    return {
      isSafe: true,
      threatsDetected: Object.freeze([]),
      category: "clean",
    };
  }
}
