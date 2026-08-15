import type { SoulManifest } from "../../../core/contracts/soul.contracts.js";

/**
 * SoulPromptComposer.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm).
 *
 * Pre-compiles a structured, byte-stable Slot #1 identity segment from the active SoulManifest,
 * maximizing prefix cache hits across long-running turns.
 */
export class SoulPromptComposer {
  /**
   * Composes a byte-stable, markdown-formatted identity prompt string from a SoulManifest.
   */
  composeIdentityPrompt(manifest: SoulManifest): string {
    const sections: string[] = [];

    // 1. Identity & Archetype Header
    sections.push(`# Agent Identity & Archetype: ${manifest.name} (${manifest.archetype})`);
    sections.push(`${manifest.rawBody.trim()}`);

    // 2. Operational Axioms (Strict Invariants)
    if (manifest.axioms.length > 0) {
      sections.push("\n## Immutable Operational Axioms");
      const sortedAxioms = [...manifest.axioms].sort((a, b) => a.priority - b.priority);
      for (const axiom of sortedAxioms) {
        sections.push(`- [P${axiom.priority}] ${axiom.statement}`);
      }
    }

    // 3. Dynamic Behavioral Traits
    if (manifest.traits.length > 0) {
      sections.push("\n## Active Personality & Behavioral Traits");
      for (const trait of manifest.traits) {
        sections.push(`- **${trait.name}** (Weight: ${trait.weight.toFixed(2)}): ${trait.description}`);
      }
    }

    // 4. Communication & Style Constraints
    sections.push("\n## Communication & Style Rules");
    sections.push(`- **Tone**: ${manifest.style.tone}`);
    sections.push(`- **Verbosity**: ${manifest.style.verbosity}`);
    sections.push(`- **Code Preference**: ${manifest.style.codePreference}`);
    sections.push(`- **Mathematical Rigor**: ${manifest.style.mathematicalRigor}`);

    return sections.join("\n").trim();
  }
}
