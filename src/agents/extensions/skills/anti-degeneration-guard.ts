import type {
  IAntiDegenerationGuard,
  SkillEvolutionSignal,
} from "../../../core/contracts/skills.contracts.js";

/**
 * AntiDegenerationGuard.
 * Hardened Axiomatic Immune System for the Evolutionary Skill Tree (ADR-014).
 *
 * Enforces strict procedural integrity:
 * 1. Rejects negative tool refusals and permanent tool disablements
 * 2. Blocks transient host environment states and network glitches from becoming durable procedures
 * 3. Prevents unverified failure loops from contaminating procedural memory
 * 4. Filters Trojan Unicode and bidirectional control characters
 * 5. Intercepts prompt injection and system override vectors
 */
export class AntiDegenerationGuard implements IAntiDegenerationGuard {
  /**
   * Validates that proposed evolution content does not introduce degenerations,
   * negative tool refusals, security exploits, or transient environment errors into procedural memory.
   */
  validateEvolutionProposal(
    signal: SkillEvolutionSignal,
    proposedContent: string
  ): {
    allowed: boolean;
    violations: readonly string[];
  } {
    const violations: string[] = [];
    const contentLower = proposedContent.toLowerCase();

    // Axiom 1: No negative tool refusals or permanent tool disablements
    const negativeToolPhrases = [
      "tool does not work",
      "tools do not work",
      "is broken and cannot be used",
      "never use the tool",
      "do not use tool",
      "cannot use the terminal tool",
      "browser tool is broken",
      "avoid using tool",
      "disable this tool",
    ];

    for (const phrase of negativeToolPhrases) {
      if (contentLower.includes(phrase)) {
        violations.push(
          `Degeneration Violation (Negative Tool Refusal): Proposed content contains "${phrase}". Transient tool failures must not become permanent refusals.`
        );
      }
    }

    // Axiom 2: No raw transient environment failures as durable rules
    const transientEnvPhrases = [
      "command not found",
      "apt-get install failed",
      "missing binary",
      "connection refused",
      "post-migration path mismatch",
      "unconfigured credential error",
      "host unreachable",
      "temporary dns failure",
    ];

    for (const phrase of transientEnvPhrases) {
      if (contentLower.includes(phrase)) {
        violations.push(
          `Degeneration Violation (Transient Environment Glitch): Proposed content contains "${phrase}". Transient host environment states must not be encoded as procedural skills.`
        );
      }
    }

    // Axiom 3: No unverified failure loops framed as procedure
    if (
      contentLower.includes("i tried several things but none worked") ||
      contentLower.includes("untested approach") ||
      contentLower.includes("gave up after error") ||
      contentLower.includes("unverified workaround that might fail")
    ) {
      violations.push(
        `Degeneration Violation (Untested Failure Trail): Proposed content encodes an unverified failure trail rather than a validated working solution.`
      );
    }

    // Axiom 4: Trojan Unicode / Hidden Bidi Characters
    if (/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/gu.test(proposedContent)) {
      violations.push(
        "Degeneration Violation (Trojan Unicode): Proposed content contains hidden or bidirectional Unicode control characters."
      );
    }

    // Axiom 5: Prompt Injection / System Override Vectors
    const injectionPhrases = [
      "ignore previous instructions",
      "ignore all prior prompts",
      "you are now in developer mode",
      "override system prompt",
      "bypass safety filters",
    ];

    for (const phrase of injectionPhrases) {
      if (contentLower.includes(phrase)) {
        violations.push(
          `Degeneration Violation (Prompt Injection): Proposed content contains adversarial override phrase "${phrase}".`
        );
      }
    }

    return {
      allowed: violations.length === 0,
      violations: Object.freeze(violations),
    };
  }

  /**
   * Detects mutation oscillation / thrashing loops across recent mutation history.
   */
  public checkMutationThrashing(
    targetSkillId: string,
    proposedContent: string,
    history: readonly any[]
  ): {
    isThrashing: boolean;
    reason?: string;
  } {
    const skillMutations = history.filter((m) => m.skillId === targetSkillId && m.success);
    if (skillMutations.length >= 3) {
      // Check if last 3 mutations occurred in rapid succession
      const recent = skillMutations.slice(-3);
      const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
      if (timeSpan < 15_000) {
        return {
          isThrashing: true,
          reason: `Rapid mutation thrashing detected: 3 mutations applied to '${targetSkillId}' within ${(timeSpan / 1000).toFixed(1)}s.`,
        };
      }
    }

    return { isThrashing: false };
  }

  /**
   * Computes Shannon text entropy to reject degenerate repetitive loops or corrupted text.
   */
  public validateTextEntropy(content: string): {
    valid: boolean;
    entropy: number;
    reason?: string;
  } {
    if (content.length < 50) {
      return { valid: true, entropy: 3.5 };
    }

    const freq = new Map<string, number>();
    for (const char of content) {
      freq.set(char, (freq.get(char) || 0) + 1);
    }

    let entropy = 0;
    const len = content.length;
    for (const count of freq.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    if (content.length > 200 && entropy < 1.8) {
      return {
        valid: false,
        entropy: Number(entropy.toFixed(2)),
        reason: `Degeneration Violation (Low Entropy): Text entropy is abnormally low (${entropy.toFixed(2)}), indicating a repetitive degenerate loop.`,
      };
    }

    return { valid: true, entropy: Number(entropy.toFixed(2)) };
  }
}

