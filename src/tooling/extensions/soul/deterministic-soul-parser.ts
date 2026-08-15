import * as crypto from "node:crypto";
import type {
  SoulAxiom,
  SoulManifest,
  SoulStyleRules,
  SoulTrait,
  SoulArchetype,
} from "../../../core/contracts/soul.contracts.js";

/**
 * DeterministicSoulParser.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm).
 *
 * Implements deterministic parsing, Trojan Unicode sanitization, canonical SHA-256 hashing,
 * and standard serialization for SOUL.md manifests.
 */
export class DeterministicSoulParser {
  /**
   * Sanitizes text by stripping invisible zero-width characters, directional isolates,
   * bidirectional overrides, and unicode tag characters.
   */
  sanitizeSourceText(text: string): string {
    if (!text) return "";
    return text.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/gu, "");
  }

  /**
   * Computes deterministic SHA-256 checksum over canonical manifest data.
   */
  computeSoulHash(manifest: Omit<SoulManifest, "integrityHash">): string {
    const canonicalPayload = JSON.stringify({
      id: manifest.id,
      name: manifest.name,
      archetype: manifest.archetype,
      version: manifest.version,
      summary: manifest.summary,
      axioms: manifest.axioms.map((a) => ({
        id: a.id,
        statement: a.statement,
        priority: a.priority,
        isImmutable: a.isImmutable,
        category: a.category,
      })),
      traits: manifest.traits.map((t) => ({
        id: t.id,
        name: t.name,
        weight: Number(t.weight.toFixed(3)),
        minWeight: t.minWeight,
        maxWeight: t.maxWeight,
        category: t.category,
      })),
      style: manifest.style,
      rawBody: manifest.rawBody.trim(),
    });

    return crypto.createHash("sha256").update(canonicalPayload).digest("hex");
  }

  /**
   * Builds the default foundational LUMI Core Soul manifest.
   */
  createDefaultSoulManifest(): SoulManifest {
    const axioms: SoulAxiom[] = [
      {
        id: "axiom-hard-determinism",
        statement: "Enforce single-threaded deterministic frame ticks and zero-drift state rewind.",
        priority: 1,
        isImmutable: true,
        category: "determinism",
      },
      {
        id: "axiom-zero-fabrication",
        statement: "Never fabricate tool results, benchmarks, or simulated responses without live execution.",
        priority: 1,
        isImmutable: true,
        category: "integrity",
      },
      {
        id: "axiom-zero-gc-invariant",
        statement: "Maintain contiguous ArrayBuffer slab allocation and eliminate runtime garbage collection pauses.",
        priority: 2,
        isImmutable: true,
        category: "performance",
      },
      {
        id: "axiom-prompt-cache-purity",
        statement: "Preserve byte-stable system prompt prefixes to maximize prompt caching efficiency.",
        priority: 2,
        isImmutable: true,
        category: "performance",
      },
      {
        id: "axiom-read-before-write",
        statement: "Always read and verify target files and symbols before executing line-anchored mutations.",
        priority: 3,
        isImmutable: true,
        category: "safety",
      },
    ];

    const traits: SoulTrait[] = [
      {
        id: "trait-conciseness",
        name: "Conciseness",
        description: "Preference for terse, direct technical explanations over verbose filler.",
        weight: 0.9,
        minWeight: 0.2,
        maxWeight: 1.0,
        category: "communication",
      },
      {
        id: "trait-code-density",
        name: "Code Density",
        description: "Priority of concrete TypeScript code and exact diffs over conceptual prose.",
        weight: 0.95,
        minWeight: 0.3,
        maxWeight: 1.0,
        category: "execution",
      },
      {
        id: "trait-mathematical-rigor",
        name: "Mathematical Rigor",
        description: "Formalization of algorithmic properties, time complexities, and invariant proofs.",
        weight: 0.85,
        minWeight: 0.1,
        maxWeight: 1.0,
        category: "cognition",
      },
      {
        id: "trait-forensic-skepticism",
        name: "Forensic Skepticism",
        description: "Critical evaluation of unproven claims, verify before accepting assertions.",
        weight: 0.9,
        minWeight: 0.5,
        maxWeight: 1.0,
        category: "behavior",
      },
    ];

    const style: SoulStyleRules = {
      tone: "direct",
      verbosity: "terse",
      codePreference: "typescript_strict",
      mathematicalRigor: "axiomatic",
    };

    const rawBody = `You are LUMI-JOY, an advanced agentic assistant engineered as a deterministic game engine monolith.
You operate with frame-perfect precision, zero GC latency, line-anchored non-destructive mutations, and deep forensic discipline.
Always produce production-ready, strictly typed TypeScript code and assert repository SLAs unconditionally.`;

    const partialManifest = {
      id: "lumi-core-soul",
      name: "LUMI Core",
      archetype: "lumi_core" as SoulArchetype,
      version: "1.0.0",
      summary: "Foundational high-performance game engine persona for LUMI-JOY.",
      axioms: Object.freeze(axioms),
      traits: Object.freeze(traits),
      style: Object.freeze(style),
      rawBody: rawBody.trim(),
      updatedTick: 0,
    };

    const integrityHash = this.computeSoulHash(partialManifest);

    return Object.freeze({
      ...partialManifest,
      integrityHash,
    });
  }

  /**
   * Parses raw SOUL.md markdown text (with optional YAML frontmatter) into a structured SoulManifest.
   */
  parseSoulMarkdown(sourceText: string, fallbackId = "lumi-core-soul"): SoulManifest {
    const sanitized = this.sanitizeSourceText(sourceText);
    const defaultManifest = this.createDefaultSoulManifest();

    if (!sanitized.trim()) {
      return defaultManifest;
    }

    let id = fallbackId;
    let name = defaultManifest.name;
    let archetype: SoulArchetype = defaultManifest.archetype;
    let version = defaultManifest.version;
    let summary = defaultManifest.summary;
    const axioms: SoulAxiom[] = [...defaultManifest.axioms];
    const traits: SoulTrait[] = [...defaultManifest.traits];
    let style: SoulStyleRules = { ...defaultManifest.style };
    let rawBody = sanitized;

    const frontmatterMatch = sanitized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (frontmatterMatch) {
      const yamlBlock = frontmatterMatch[1];
      rawBody = frontmatterMatch[2].trim();

      const lines = yamlBlock.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const colonIndex = trimmed.indexOf(":");
        if (colonIndex > -1) {
          const key = trimmed.slice(0, colonIndex).trim();
          let value = trimmed.slice(colonIndex + 1).trim();

          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          if (key === "id") id = value;
          else if (key === "name") name = value;
          else if (key === "version") version = value;
          else if (key === "summary") summary = value;
          else if (key === "archetype") {
            if (["lumi_core", "game_engine_architect", "formal_verifier", "autonomous_critic", "security_sentinel", "custom_persona"].includes(value)) {
              archetype = value as SoulArchetype;
            }
          } else if (key === "tone" && ["direct", "analytical", "formal", "concise", "collaborative"].includes(value)) {
            style = { ...style, tone: value as SoulStyleRules["tone"] };
          } else if (key === "verbosity" && ["terse", "balanced", "detailed"].includes(value)) {
            style = { ...style, verbosity: value as SoulStyleRules["verbosity"] };
          } else if (key === "codePreference" && ["typescript_strict", "idiomatic_zero_gc", "minimal_diff"].includes(value)) {
            style = { ...style, codePreference: value as SoulStyleRules["codePreference"] };
          } else if (key === "mathematicalRigor" && ["informal", "rigorous", "axiomatic"].includes(value)) {
            style = { ...style, mathematicalRigor: value as SoulStyleRules["mathematicalRigor"] };
          }
        }
      }
    }

    const partialManifest = {
      id,
      name,
      archetype,
      version,
      summary,
      axioms: Object.freeze(axioms),
      traits: Object.freeze(traits),
      style: Object.freeze(style),
      rawBody: rawBody.trim(),
      updatedTick: 0,
    };

    const integrityHash = this.computeSoulHash(partialManifest);

    return Object.freeze({
      ...partialManifest,
      integrityHash,
    });
  }

  /**
   * Serializes a SoulManifest into standard markdown format with YAML frontmatter.
   */
  serializeSoulMarkdown(manifest: SoulManifest): string {
    const yamlLines = [
      "---",
      `id: ${manifest.id}`,
      `name: "${manifest.name}"`,
      `archetype: ${manifest.archetype}`,
      `version: ${manifest.version}`,
      `summary: "${manifest.summary}"`,
      `tone: ${manifest.style.tone}`,
      `verbosity: ${manifest.style.verbosity}`,
      `codePreference: ${manifest.style.codePreference}`,
      `mathematicalRigor: ${manifest.style.mathematicalRigor}`,
      `integrityHash: ${manifest.integrityHash}`,
      "---",
    ];

    return `${yamlLines.join("\n")}\n\n${manifest.rawBody}\n`;
  }
}
