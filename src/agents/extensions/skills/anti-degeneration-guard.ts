import type {
  IAntiDegenerationGuard,
  SkillEvolutionSignal,
} from "../../../core/contracts/skills.contracts.js";

export class AntiDegenerationGuard implements IAntiDegenerationGuard {
  /**
   * Validates that proposed evolution content does not introduce degenerations,
   * negative tool refusals, or transient environment errors into the procedural memory.
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
      contentLower.includes("gave up after error")
    ) {
      violations.push(
        `Degeneration Violation (Untested Failure Trail): Proposed content encodes an unverified failure trail rather than a validated working solution.`
      );
    }

    return {
      allowed: violations.length === 0,
      violations: Object.freeze(violations),
    };
  }
}
