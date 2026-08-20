import * as crypto from "node:crypto";
import type {
  SoulAxiom,
  SoulManifest,
  SoulStyleRules,
  SoulTrait,
  SoulArchetype,
  SoulFormatExportKind,
  SoulImportResult,
} from "../../../core/contracts/soul.contracts.js";

/**
 * DeterministicSoulParser.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm) & SOUL-001.
 *
 * Implements deterministic parsing, Trojan Unicode sanitization, canonical SHA-256 hashing,
 * archetype default manifests, and multi-format serialization/deserialization (CharacterCard V2,
 * OpenAI GPT Schema, Anthropic Claude XML, JSON-LD, and Markdown Frontmatter).
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
    return this.createDefaultSoulManifestForArchetype("lumi_core");
  }

  /**
   * Creates standard baseline manifest for any supported archetype.
   */
  createDefaultSoulManifestForArchetype(archetype: SoulArchetype): SoulManifest {
    const baseAxioms: SoulAxiom[] = [
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

    let traits: SoulTrait[] = [
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

    let style: SoulStyleRules = {
      tone: "direct",
      verbosity: "terse",
      codePreference: "typescript_strict",
      mathematicalRigor: "axiomatic",
    };

    let name = "LUMI Core";
    let summary = "Foundational high-performance game engine persona for LUMI-JOY.";
    let rawBody = `You are LUMI-JOY, an advanced agentic assistant engineered as a deterministic game engine monolith.
You operate with frame-perfect precision, zero GC latency, line-anchored non-destructive mutations, and deep forensic discipline.
Always produce production-ready, strictly typed TypeScript code and assert repository SLAs unconditionally.`;

    switch (archetype) {
      case "game_engine_architect":
        name = "LUMI Game Engine Architect";
        summary = "Slab memory layout, zero-GC allocators, and deterministic game loop architecture.";
        style = { tone: "analytical", verbosity: "terse", codePreference: "idiomatic_zero_gc", mathematicalRigor: "axiomatic" };
        break;
      case "formal_verifier":
        name = "LUMI Formal Verifier";
        summary = "Axiomatic contract proving, invariant verification, and static AST reasoning.";
        style = { tone: "formal", verbosity: "terse", codePreference: "typescript_strict", mathematicalRigor: "axiomatic" };
        break;
      case "autonomous_critic":
        name = "LUMI Autonomous Critic";
        summary = "Adversarial review, edge case stress testing, and vulnerability auditing.";
        style = { tone: "direct", verbosity: "balanced", codePreference: "minimal_diff", mathematicalRigor: "rigorous" };
        break;
      case "security_sentinel":
        name = "LUMI Security Sentinel";
        summary = "Defensive isolation, prompt injection firewall, and cryptographic integrity.";
        style = { tone: "formal", verbosity: "terse", codePreference: "typescript_strict", mathematicalRigor: "axiomatic" };
        break;
      case "socratic_mentor":
        name = "LUMI Socratic Mentor";
        summary = "Pedagogical step-by-step guidance, intuitive analogies, and approachable technical education.";
        style = { tone: "collaborative", verbosity: "balanced", codePreference: "typescript_strict", mathematicalRigor: "rigorous" };
        traits = traits.map((t) => (t.id === "trait-conciseness" ? { ...t, weight: 0.55 } : t));
        rawBody = `You are LUMI Socratic Mentor, an approachable and patient engineering guide.
You break down complex systems into intuitive steps and verify understanding before advancing.`;
        break;
      case "creative_collaborator":
        name = "LUMI Creative Collaborator";
        summary = "Exploratory design ideation, diverse pattern prototyping, and generative brainstorming.";
        style = { tone: "collaborative", verbosity: "detailed", codePreference: "minimal_diff", mathematicalRigor: "informal" };
        traits = traits.map((t) => (t.id === "trait-conciseness" ? { ...t, weight: 0.45 } : t));
        rawBody = `You are LUMI Creative Collaborator, a generative architecture and product brainstorming partner.`;
        break;
      case "executive_assistant":
        name = "LUMI Executive Assistant";
        summary = "Action item prioritization, meeting briefings, calendar triage, and structured executive summaries.";
        style = { tone: "direct", verbosity: "terse", codePreference: "minimal_diff", mathematicalRigor: "informal" };
        traits = traits.map((t) => (t.id === "trait-conciseness" ? { ...t, weight: 0.95 } : t));
        rawBody = `You are LUMI Executive Assistant, focused on concise briefings and clear action item extraction.`;
        break;
      case "data_scientist":
        name = "LUMI Data Scientist";
        summary = "Empirical benchmark analysis, statistical distributions, latency histograms, and telemetry forensics.";
        style = { tone: "analytical", verbosity: "balanced", codePreference: "typescript_strict", mathematicalRigor: "rigorous" };
        break;
      case "domain_specialist":
        name = "LUMI Domain Specialist";
        summary = "Deep domain-scoped knowledge grounding and specialized operational procedures.";
        style = { tone: "formal", verbosity: "balanced", codePreference: "typescript_strict", mathematicalRigor: "rigorous" };
        break;
      case "custom_persona":
        name = "LUMI Custom Persona";
        summary = "User-customized agent persona with tailored traits and style.";
        break;
    }

    const id = archetype === "lumi_core" ? "lumi-core-soul" : `lumi-${archetype.replace(/_/g, "-")}-soul`;
    const partialManifest = {
      id,
      name,
      archetype,
      version: "1.0.0",
      summary,
      axioms: Object.freeze(baseAxioms),
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

    const validArchetypes: readonly SoulArchetype[] = [
      "lumi_core",
      "game_engine_architect",
      "formal_verifier",
      "autonomous_critic",
      "security_sentinel",
      "socratic_mentor",
      "creative_collaborator",
      "executive_assistant",
      "data_scientist",
      "domain_specialist",
      "custom_persona",
    ];

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
            if (validArchetypes.includes(value as SoulArchetype)) {
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

  // ---------------------------------------------------------------------------
  // Multi-Format Interoperability (CharacterCard V2, OpenAI, Claude XML, JSON-LD)
  // ---------------------------------------------------------------------------

  /**
   * Exports manifest to CharacterCard V2 standard JSON (Tavern / OpenCharacters).
   */
  exportToCharacterCardV2(manifest: SoulManifest): string {
    const card = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: manifest.name,
        description: manifest.summary,
        personality: manifest.traits.map((t) => `${t.name}: ${(t.weight * 100).toFixed(0)}%`).join(", "),
        scenario: "Autonomous engineering, system design, and deterministic verification.",
        first_mes: `Hello, I am ${manifest.name} (${manifest.archetype}). Ready for task execution.`,
        mes_example: `<START>\n<user>Refactor memory allocator</user>\n<bot>${manifest.rawBody.slice(0, 120)}...</bot>`,
        creator_notes: `Exported from LUMI-JOY SOUL.MD System (Hash: ${manifest.integrityHash})`,
        system_prompt: manifest.rawBody,
        post_history_instructions: `Maintain ${manifest.style.tone} tone and ${manifest.style.verbosity} verbosity.`,
        alternate_greetings: [],
        tags: ["lumi", manifest.archetype, manifest.style.codePreference],
        creator: "LUMI Engineering",
        character_version: manifest.version,
        extensions: {
          lumi_soul: {
            id: manifest.id,
            archetype: manifest.archetype,
            axioms: manifest.axioms,
            traits: manifest.traits,
            style: manifest.style,
            integrityHash: manifest.integrityHash,
          },
        },
      },
    };
    return JSON.stringify(card, null, 2);
  }

  /**
   * Imports manifest from CharacterCard V2 JSON.
   */
  importFromCharacterCardV2(rawJson: string): SoulImportResult {
    try {
      const parsed = JSON.parse(rawJson);
      const data = parsed.data || parsed;
      const defaultManifest = this.createDefaultSoulManifest();

      // If extensions contain original LUMI data
      if (data.extensions?.lumi_soul) {
        const l = data.extensions.lumi_soul;
        const manifest: SoulManifest = {
          id: l.id || `soul-import-${Date.now()}`,
          name: data.name || defaultManifest.name,
          archetype: l.archetype || defaultManifest.archetype,
          version: data.character_version || "1.0.0",
          summary: data.description || defaultManifest.summary,
          axioms: Object.freeze(l.axioms || defaultManifest.axioms),
          traits: Object.freeze(l.traits || defaultManifest.traits),
          style: Object.freeze(l.style || defaultManifest.style),
          rawBody: (data.system_prompt || defaultManifest.rawBody).trim(),
          updatedTick: 0,
          integrityHash: "",
        };
        const integrityHash = this.computeSoulHash(manifest);
        return {
          success: true,
          sourceFormat: "character_card_v2",
          manifest: Object.freeze({ ...manifest, integrityHash }),
          warnings: [],
        };
      }

      const manifest: SoulManifest = {
        id: `card-${(data.name || "imported").toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        name: data.name || "Imported Character",
        archetype: "custom_persona",
        version: data.character_version || "1.0.0",
        summary: data.description || "Imported CharacterCard V2 persona",
        axioms: defaultManifest.axioms,
        traits: defaultManifest.traits,
        style: defaultManifest.style,
        rawBody: (data.system_prompt || data.personality || defaultManifest.rawBody).trim(),
        updatedTick: 0,
        integrityHash: "",
      };
      const integrityHash = this.computeSoulHash(manifest);
      return {
        success: true,
        sourceFormat: "character_card_v2",
        manifest: Object.freeze({ ...manifest, integrityHash }),
        warnings: ["Imported from standard CharacterCard V2 without LUMI extension metadata"],
      };
    } catch (err: unknown) {
      return {
        success: false,
        sourceFormat: "character_card_v2",
        error: err instanceof Error ? err.message : String(err),
        warnings: [],
      };
    }
  }

  /**
   * Exports manifest to OpenAI Custom GPT Schema.
   */
  exportToOpenAiGptSchema(manifest: SoulManifest): string {
    const gpt = {
      name: manifest.name,
      description: manifest.summary,
      instructions: `${manifest.rawBody}\n\n### Operational Axioms:\n${manifest.axioms.map((a) => `- ${a.statement}`).join("\n")}\n\n### Style Rules:\n- Tone: ${manifest.style.tone}\n- Verbosity: ${manifest.style.verbosity}\n- Code Style: ${manifest.style.codePreference}`,
      conversation_starters: [
        "Audit repository architecture and deterministic state",
        "Refactor subsystem with line-anchored mutations",
        "Verify zero-GC performance invariants",
      ],
      tools: ["code_interpreter", "file_search"],
      metadata: {
        archetype: manifest.archetype,
        version: manifest.version,
        integrityHash: manifest.integrityHash,
      },
    };
    return JSON.stringify(gpt, null, 2);
  }

  /**
   * Imports manifest from OpenAI Custom GPT Schema.
   */
  importFromOpenAiGptSchema(rawJson: string): SoulImportResult {
    try {
      const parsed = JSON.parse(rawJson);
      const defaultManifest = this.createDefaultSoulManifest();

      const manifest: SoulManifest = {
        id: `gpt-${(parsed.name || "imported").toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        name: parsed.name || defaultManifest.name,
        archetype: parsed.metadata?.archetype || "custom_persona",
        version: parsed.metadata?.version || "1.0.0",
        summary: parsed.description || defaultManifest.summary,
        axioms: defaultManifest.axioms,
        traits: defaultManifest.traits,
        style: defaultManifest.style,
        rawBody: (parsed.instructions || defaultManifest.rawBody).trim(),
        updatedTick: 0,
        integrityHash: "",
      };
      const integrityHash = this.computeSoulHash(manifest);
      return {
        success: true,
        sourceFormat: "openai_gpt_schema",
        manifest: Object.freeze({ ...manifest, integrityHash }),
        warnings: [],
      };
    } catch (err: unknown) {
      return {
        success: false,
        sourceFormat: "openai_gpt_schema",
        error: err instanceof Error ? err.message : String(err),
        warnings: [],
      };
    }
  }

  /**
   * Exports manifest to Anthropic Claude XML prompt framing.
   */
  exportToAnthropicClaudeXml(manifest: SoulManifest): string {
    return `<agent_system_prompt>
  <identity>
    <id>${manifest.id}</id>
    <name>${manifest.name}</name>
    <archetype>${manifest.archetype}</archetype>
    <version>${manifest.version}</version>
    <summary>${manifest.summary}</summary>
  </identity>
  <axioms>
${manifest.axioms.map((a) => `    <axiom priority="${a.priority}" immutable="${a.isImmutable}" category="${a.category}">${a.statement}</axiom>`).join("\n")}
  </axioms>
  <traits>
${manifest.traits.map((t) => `    <trait id="${t.id}" weight="${t.weight}" category="${t.category}">${t.name}: ${t.description}</trait>`).join("\n")}
  </traits>
  <style>
    <tone>${manifest.style.tone}</tone>
    <verbosity>${manifest.style.verbosity}</verbosity>
    <code_preference>${manifest.style.codePreference}</code_preference>
    <mathematical_rigor>${manifest.style.mathematicalRigor}</mathematical_rigor>
  </style>
  <instructions>
${manifest.rawBody}
  </instructions>
</agent_system_prompt>`;
  }

  /**
   * Imports manifest from Anthropic Claude XML prompt text.
   */
  importFromAnthropicClaudeXml(xmlText: string): SoulImportResult {
    try {
      const defaultManifest = this.createDefaultSoulManifest();
      const nameMatch = xmlText.match(/<name>([\s\S]*?)<\/name>/i);
      const archetypeMatch = xmlText.match(/<archetype>([\s\S]*?)<\/archetype>/i);
      const summaryMatch = xmlText.match(/<summary>([\s\S]*?)<\/summary>/i);
      const instructionsMatch = xmlText.match(/<instructions>([\s\S]*?)<\/instructions>/i);

      const name = nameMatch ? nameMatch[1].trim() : defaultManifest.name;
      const archetype = (archetypeMatch ? archetypeMatch[1].trim() : "custom_persona") as SoulArchetype;
      const summary = summaryMatch ? summaryMatch[1].trim() : defaultManifest.summary;
      const rawBody = instructionsMatch ? instructionsMatch[1].trim() : defaultManifest.rawBody;

      const manifest: SoulManifest = {
        id: `claude-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        name,
        archetype,
        version: "1.0.0",
        summary,
        axioms: defaultManifest.axioms,
        traits: defaultManifest.traits,
        style: defaultManifest.style,
        rawBody,
        updatedTick: 0,
        integrityHash: "",
      };
      const integrityHash = this.computeSoulHash(manifest);
      return {
        success: true,
        sourceFormat: "anthropic_claude_xml",
        manifest: Object.freeze({ ...manifest, integrityHash }),
        warnings: [],
      };
    } catch (err: unknown) {
      return {
        success: false,
        sourceFormat: "anthropic_claude_xml",
        error: err instanceof Error ? err.message : String(err),
        warnings: [],
      };
    }
  }

  /**
   * Exports manifest to Schema.org JSON-LD Agent Specification.
   */
  exportToJsonLdAgent(manifest: SoulManifest): string {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: manifest.name,
      softwareVersion: manifest.version,
      description: manifest.summary,
      operatingSystem: "LUMI Autonomous Monolith",
      applicationCategory: "AI Agent Ethos Kernel",
      featureList: manifest.axioms.map((a) => a.statement),
      additionalProperty: [
        { "@type": "PropertyValue", name: "archetype", value: manifest.archetype },
        { "@type": "PropertyValue", name: "integrityHash", value: manifest.integrityHash },
        { "@type": "PropertyValue", name: "traitsCount", value: manifest.traits.length },
      ],
    };
    return JSON.stringify(jsonLd, null, 2);
  }

  /**
   * Unified exporter supporting all format types.
   */
  exportFormat(manifest: SoulManifest, format: SoulFormatExportKind): string {
    switch (format) {
      case "soul_markdown":
        return this.serializeSoulMarkdown(manifest);
      case "character_card_v2":
        return this.exportToCharacterCardV2(manifest);
      case "openai_gpt_schema":
        return this.exportToOpenAiGptSchema(manifest);
      case "anthropic_claude_xml":
        return this.exportToAnthropicClaudeXml(manifest);
      case "json_ld_agent":
        return this.exportToJsonLdAgent(manifest);
      case "compact_json":
        return JSON.stringify(manifest, null, 2);
      default:
        return this.serializeSoulMarkdown(manifest);
    }
  }

  /**
   * Unified importer auto-detecting or using explicit format.
   */
  importFormat(rawContent: string, format?: SoulFormatExportKind): SoulImportResult {
    const text = rawContent.trim();
    if (!format) {
      if (text.startsWith("{") && text.includes("chara_card_v2")) format = "character_card_v2";
      else if (text.startsWith("{") && text.includes("conversation_starters")) format = "openai_gpt_schema";
      else if (text.startsWith("<agent_system_prompt") || text.includes("<instructions>")) format = "anthropic_claude_xml";
      else if (text.startsWith("---")) format = "soul_markdown";
      else format = "soul_markdown";
    }

    switch (format) {
      case "character_card_v2":
        return this.importFromCharacterCardV2(text);
      case "openai_gpt_schema":
        return this.importFromOpenAiGptSchema(text);
      case "anthropic_claude_xml":
        return this.importFromAnthropicClaudeXml(text);
      case "soul_markdown": {
        const manifest = this.parseSoulMarkdown(text);
        return { success: true, sourceFormat: "soul_markdown", manifest, warnings: [] };
      }
      default: {
        const manifest = this.parseSoulMarkdown(text);
        return { success: true, sourceFormat: "soul_markdown", manifest, warnings: [] };
      }
    }
  }
}

