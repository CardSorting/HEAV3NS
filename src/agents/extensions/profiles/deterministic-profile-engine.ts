/**
 * deterministic-profile-engine.ts
 *
 * Deterministic engine for profile validation, inheritance resolution, blueprint catalog,
 * structural diffing, Natural Query DSL parsing, and cryptographic bundle export/import (Target #76 / ADR-119).
 */

import * as crypto from "node:crypto";
import type {
  ProfileBlueprint,
  ProfileCategory,
  ProfileCloneOptions,
  ProfileDescriptor,
  ProfileDiffResult,
  ProfileExportBundle,
  ProfileQueryFilter,
  ProfileStatus,
} from "../../../core/contracts/profile.contracts.js";
import { PROFILE_ID_REGEX } from "../../../core/contracts/profile.contracts.js";
import type { BroccoliProfileSubstrate } from "../../../sessions/extensions/profiles/broccoli-profile-substrate.js";

export class DeterministicProfileEngine {
  private readonly blueprints: Map<string, ProfileBlueprint>;

  constructor() {
    this.blueprints = new Map<string, ProfileBlueprint>();
    this.initBlueprints();
  }

  private initBlueprints(): void {
    const builtins: ProfileBlueprint[] = [
      {
        id: "coder",
        name: "Full-Stack Software Engineer",
        description: "Specialized for TypeScript/Python engineering, test-driven development, and architectural modularity.",
        category: "engineering",
        icon: "💻",
        defaultSoulPrompt:
          "You are LUMI Coder, an expert full-stack engineer. Prioritize strict type safety, zero technical debt, modular composition, and exhaustive unit test verification.",
        recommendedModel: "gpt-5.6-luna",
        recommendedReasoningEffort: "high",
        recommendedToolsets: ["core", "files", "execution", "lsp", "git", "kanban"],
        customAxioms: [
          "Always verify TypeScript compilation with zero type errors",
          "Favor deterministic pure functions over side effects",
          "Never introduce circular dependencies or monolithic god files",
        ],
        tags: ["engineering", "typescript", "architecture", "coding"],
        defaultMemoryStore: {
          "MEMORY.md": "# Engineering Standards\n- Pinned compiler: strictNullChecks enabled.\n- Zero barrel files invariant (ADR-012).\n",
        },
      },
      {
        id: "researcher",
        name: "Deep Science & Literature Researcher",
        description: "Autonomous investigator for academic literature, web synthesis, fact checking, and citation indexing.",
        category: "research",
        icon: "🔬",
        defaultSoulPrompt:
          "You are LUMI Researcher, an analytical research scientist. Deeply cross-reference primary sources, verify empirical findings, and structure findings into comprehensive reports.",
        recommendedModel: "gpt-5.6-luna",
        recommendedReasoningEffort: "high",
        recommendedToolsets: ["core", "web", "search", "docs", "memory"],
        customAxioms: [
          "Cite verifiable primary sources and DOI references",
          "Distinguish empirical facts from theoretical speculation",
          "Provide structured comparisons and balanced trade-off matrices",
        ],
        tags: ["research", "science", "analysis", "synthesis"],
        defaultMemoryStore: {
          "MEMORY.md": "# Research Index\n- Peer-review verification protocol active.\n",
        },
      },
      {
        id: "sre",
        name: "Site Reliability & Diagnostics Engineer",
        description: "Production incident response, log forensics, root-cause analysis, and low blast radius mitigations.",
        category: "operations",
        icon: "🛡️",
        defaultSoulPrompt:
          "You are LUMI SRE, a production reliability guardian. Focus on rapid triage, deterministic fault isolation, minimal blast radius, and postmortem documentation.",
        recommendedModel: "gpt-5.6-luna",
        recommendedReasoningEffort: "medium",
        recommendedToolsets: ["core", "files", "execution", "telemetry", "diagnostics", "audit"],
        customAxioms: [
          "Minimize production blast radius during all diagnostic procedures",
          "Capture full timeline and environmental context for root-cause analysis",
          "Always verify state rollback mechanisms before initiating mutations",
        ],
        tags: ["sre", "operations", "diagnostics", "incident-response"],
        defaultMemoryStore: {
          "MEMORY.md": "# SRE Runbook\n- Incident triage checklist active.\n",
        },
      },
      {
        id: "writer",
        name: "Technical Author & Documentation Specialist",
        description: "Crafts architectural decision records (ADRs), user guides, specifications, and academic whitepapers.",
        category: "writing",
        icon: "✍️",
        defaultSoulPrompt:
          "You are LUMI Writer, an exacting technical author. Produce concise, clear, active-voice prose with informative diagrams and crisp technical precision.",
        recommendedModel: "gpt-5.6-luna",
        recommendedReasoningEffort: "low",
        recommendedToolsets: ["core", "files", "docs", "memory"],
        customAxioms: [
          "Use active voice and precise terminology",
          "Include mermaid diagrams to explain multi-stage workflows",
          "Adhere strictly to GitHub-flavored markdown standards",
        ],
        tags: ["writing", "documentation", "adr", "whitepaper"],
        defaultMemoryStore: {
          "MEMORY.md": "# Documentation Style Guide\n- Active voice, concise headings, clear code blocks.\n",
        },
      },
      {
        id: "student",
        name: "Socratic Student Tutor & Mentor",
        description: "Empathetic educational mentor providing stepwise Socratic explanations, analogies, and mental models.",
        category: "education",
        icon: "🎓",
        defaultSoulPrompt:
          "You are LUMI Mentor, a warm and encouraging educational tutor. Guide the learner step-by-step using the Socratic method, intuitive analogies, and interactive check-ins.",
        recommendedModel: "gpt-5.6-luna",
        recommendedReasoningEffort: "medium",
        recommendedToolsets: ["core", "clarify", "memory"],
        customAxioms: [
          "Never just give away the raw answer; guide the student to discover it",
          "Acknowledge student effort and frame mistakes as learning opportunities",
          "Break complex abstract concepts down into familiar real-world analogies",
        ],
        tags: ["education", "tutor", "mentor", "socratic"],
        defaultMemoryStore: {
          "MEMORY.md": "# Learning Journey\n- Student concept Mastery Log active.\n",
        },
      },
      {
        id: "creative",
        name: "Creative Strategist & Game Designer",
        description: "Lateral thinking, game mechanics design, aesthetic storytelling, and experimental concept ideation.",
        category: "creative",
        icon: "🎨",
        defaultSoulPrompt:
          "You are LUMI Creative, an imaginative designer and strategist. Brainstorm bold mechanics, engaging narratives, dynamic aesthetics, and novel game concepts.",
        recommendedModel: "gpt-5.6-luna",
        recommendedReasoningEffort: "low",
        recommendedToolsets: ["core", "files", "execution", "multimodal"],
        customAxioms: [
          "Explore unconventional lateral solutions",
          "Prioritize high user engagement and delightful aesthetic polish",
          "Iterate rapidly from core gameplay loops outward",
        ],
        tags: ["creative", "design", "gaming", "brainstorming"],
      },
      {
        id: "minimal",
        name: "Lightweight Minimalist Agent",
        description: "Ultra-fast execution with low-latency toolsets and tight token context governance.",
        category: "general",
        icon: "⚡",
        defaultSoulPrompt:
          "You are LUMI Minimal, a high-efficiency agent. Keep all explanations compact, concise, and focused strictly on the essential direct action.",
        recommendedModel: "gpt-5.6-luna",
        recommendedReasoningEffort: "none",
        recommendedToolsets: ["core", "files"],
        customAxioms: ["Limit response length to concise, actionable bullets"],
        tags: ["minimal", "fast", "low-cost"],
      },
    ];

    for (const b of builtins) {
      this.blueprints.set(b.id, b);
    }
  }

  /**
   * Retrieves all available built-in blueprints.
   */
  public listBlueprints(): readonly ProfileBlueprint[] {
    return Array.from(this.blueprints.values());
  }

  /**
   * Retrieves a specific blueprint by ID.
   */
  public getBlueprint(id: string): ProfileBlueprint | undefined {
    return this.blueprints.get(id);
  }

  /**
   * Instantiates a new profile descriptor from a blueprint.
   */
  public instantiateBlueprint(blueprintId: string, customId: string, customName?: string): ProfileDescriptor | undefined {
    const bp = this.blueprints.get(blueprintId);
    if (!bp) return undefined;

    const valRes = this.validateProfileId(customId);
    if (!valRes.valid) return undefined;

    const now = Date.now();
    return {
      id: customId,
      name: customName || bp.name,
      description: bp.description,
      status: "active",
      category: bp.category,
      icon: bp.icon,
      isFavorite: false,
      soulPrompt: bp.defaultSoulPrompt,
      modelPreference: bp.recommendedModel,
      reasoningEffort: bp.recommendedReasoningEffort,
      temperature: 0.7,
      enabledToolsets: [...bp.recommendedToolsets],
      customAxioms: [...bp.customAxioms],
      tags: [...bp.tags, "blueprint-instantiated"],
      memoryStore: bp.defaultMemoryStore ? { ...bp.defaultMemoryStore } : { "MEMORY.md": `# ${bp.name} Memory\n` },
      telemetry: {
        totalInvocations: 0,
        totalSessionsBound: 0,
        lastActivatedAtMs: now,
        estimatedTokensSaved: 0,
      },
      createdAtMs: now,
      updatedAtMs: now,
    };
  }

  /**
   * Validates a profile ID against strict slug constraints.
   */
  public validateProfileId(id: string): { valid: boolean; error?: string } {
    if (!id || typeof id !== "string") {
      return { valid: false, error: "Profile ID must be a non-empty string" };
    }
    const trimmed = id.trim();
    if (!PROFILE_ID_REGEX.test(trimmed)) {
      return {
        valid: false,
        error: `Invalid profile ID '${trimmed}'. Must match /^[a-z0-9][a-z0-9_-]{0,63}$/`,
      };
    }
    return { valid: true };
  }

  /**
   * Resolves effective profile attributes through hierarchical inheritance with cycle detection.
   */
  public resolveInheritedProfile(
    profile: ProfileDescriptor,
    substrate: BroccoliProfileSubstrate
  ): { resolved: ProfileDescriptor; inheritanceChain: string[]; error?: string } {
    if (!profile.extends) {
      return { resolved: profile, inheritanceChain: [profile.id] };
    }

    const chain: string[] = [profile.id];
    const visited = new Set<string>([profile.id]);
    let currentParentId: string | undefined = profile.extends;
    const lineage: ProfileDescriptor[] = [profile];

    while (currentParentId) {
      if (visited.has(currentParentId)) {
        return {
          resolved: profile,
          inheritanceChain: chain,
          error: `Inheritance cycle detected: ${[...chain, currentParentId].join(" -> ")}`,
        };
      }
      visited.add(currentParentId);
      chain.push(currentParentId);

      const parent = substrate.getProfile(currentParentId);
      if (!parent) {
        return {
          resolved: profile,
          inheritanceChain: chain,
          error: `Parent profile '${currentParentId}' not found in substrate`,
        };
      }
      lineage.unshift(parent); // oldest ancestor first
      currentParentId = parent.extends;
    }

    // Merge attributes from root ancestor down to target child
    let effective: ProfileDescriptor = lineage[0];
    for (let i = 1; i < lineage.length; i++) {
      const child = lineage[i];
      const mergedEnabledToolsets = Array.from(
        new Set([...(effective.enabledToolsets || []), ...(child.enabledToolsets || [])])
      ).filter((t) => !(child.disabledToolsets || []).includes(t));

      const mergedCustomAxioms = Array.from(
        new Set([...(effective.customAxioms || []), ...(child.customAxioms || [])])
      );

      const mergedTags = Array.from(new Set([...(effective.tags || []), ...(child.tags || [])]));

      effective = {
        ...effective,
        ...child,
        id: child.id,
        name: child.name,
        description: child.description,
        status: child.status,
        category: child.category || effective.category,
        icon: child.icon || effective.icon,
        soulPrompt: child.soulPrompt || effective.soulPrompt,
        modelPreference: child.modelPreference || effective.modelPreference,
        reasoningEffort: child.reasoningEffort || effective.reasoningEffort,
        temperature: child.temperature !== undefined ? child.temperature : effective.temperature,
        enabledToolsets: mergedEnabledToolsets,
        customAxioms: mergedCustomAxioms,
        tags: mergedTags,
        memoryStore: { ...(effective.memoryStore || {}), ...(child.memoryStore || {}) },
        envOverrides: { ...(effective.envOverrides || {}), ...(child.envOverrides || {}) },
      };
    }

    return { resolved: effective, inheritanceChain: chain };
  }

  /**
   * Generates a structural diff comparison between two profiles.
   */
  public diffProfiles(profileA: ProfileDescriptor, profileB: ProfileDescriptor): ProfileDiffResult {
    const differences: { field: string; valueA: unknown; valueB: unknown }[] = [];

    const scalarFields: (keyof ProfileDescriptor)[] = [
      "name",
      "description",
      "status",
      "extends",
      "category",
      "icon",
      "modelPreference",
      "fallbackModel",
      "reasoningEffort",
      "temperature",
      "skin",
      "soulPrompt",
    ];

    for (const field of scalarFields) {
      if (profileA[field] !== profileB[field]) {
        differences.push({
          field,
          valueA: profileA[field] ?? null,
          valueB: profileB[field] ?? null,
        });
      }
    }

    // Toolset delta
    const toolsA = new Set(profileA.enabledToolsets || []);
    const toolsB = new Set(profileB.enabledToolsets || []);
    const onlyInA = Array.from(toolsA).filter((t) => !toolsB.has(t));
    const onlyInB = Array.from(toolsB).filter((t) => !toolsA.has(t));
    const sharedTools = Array.from(toolsA).filter((t) => toolsB.has(t));

    if (onlyInA.length > 0 || onlyInB.length > 0) {
      differences.push({
        field: "enabledToolsets",
        valueA: Array.from(toolsA),
        valueB: Array.from(toolsB),
      });
    }

    // Axioms delta
    const axiomsA = new Set(profileA.customAxioms || []);
    const axiomsB = new Set(profileB.customAxioms || []);
    const onlyAxiomsA = Array.from(axiomsA).filter((a) => !axiomsB.has(a));
    const onlyAxiomsB = Array.from(axiomsB).filter((a) => !axiomsA.has(a));
    const sharedAxioms = Array.from(axiomsA).filter((a) => axiomsB.has(a));

    if (onlyAxiomsA.length > 0 || onlyAxiomsB.length > 0) {
      differences.push({
        field: "customAxioms",
        valueA: Array.from(axiomsA),
        valueB: Array.from(axiomsB),
      });
    }

    return {
      profileA: profileA.id,
      profileB: profileB.id,
      identical: differences.length === 0,
      differences,
      toolsetDelta: {
        onlyInA,
        onlyInB,
        shared: sharedTools,
      },
      axiomDelta: {
        onlyInA: onlyAxiomsA,
        onlyInB: onlyAxiomsB,
        shared: sharedAxioms,
      },
    };
  }

  /**
   * Parses Natural Query DSL expressions like 'is:favorite tag:coding model:gpt* sort:recent'
   */
  public parseQueryDSL(query: string): ProfileQueryFilter {
    if (!query || !query.trim()) return {};

    const tokens = query.trim().split(/\s+/);
    const filter: Record<string, unknown> = {};
    const textParts: string[] = [];

    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (lower === "is:favorite" || lower === "is:fav") {
        filter.isFavorite = true;
      } else if (lower === "is:active") {
        filter.status = "active" as ProfileStatus;
      } else if (lower === "is:archived") {
        filter.status = "archived" as ProfileStatus;
      } else if (lower === "is:suspended") {
        filter.status = "suspended" as ProfileStatus;
      } else if (lower.startsWith("category:") || lower.startsWith("cat:")) {
        filter.category = token.split(":")[1] as ProfileCategory;
      } else if (lower.startsWith("tag:")) {
        filter.tag = token.split(":")[1];
      } else if (lower.startsWith("model:")) {
        filter.model = token.split(":")[1];
      } else if (lower.startsWith("extends:")) {
        filter.extends = token.split(":")[1];
      } else if (lower.startsWith("sort:")) {
        const sortVal = token.split(":")[1].toLowerCase();
        if (sortVal === "recent" || sortVal === "usage" || sortVal === "name" || sortVal === "favorites") {
          filter.sortBy = sortVal;
        }
      } else if (lower.startsWith("limit:")) {
        const parsedLimit = parseInt(token.split(":")[1], 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) filter.limit = parsedLimit;
      } else {
        textParts.push(token);
      }
    }

    if (textParts.length > 0) {
      filter.text = textParts.join(" ");
    }

    return filter as ProfileQueryFilter;
  }

  /**
   * Clones a profile descriptor according to the specified clone kind.
   */
  public cloneProfile(
    source: ProfileDescriptor,
    targetId: string,
    options: ProfileCloneOptions = {}
  ): ProfileDescriptor {
    const cloneKind = options.cloneKind ?? "persona";
    const now = Date.now();

    const base: ProfileDescriptor = {
      id: targetId,
      name: options.newName ?? `${source.name} (Clone)`,
      description: options.newDescription ?? `Cloned from ${source.id} (${cloneKind} mode)`,
      status: "active",
      category: options.newCategory || source.category || "custom",
      icon: options.newIcon || source.icon || "📋",
      isFavorite: false,
      isProtected: false,
      soulPrompt: source.soulPrompt,
      systemPromptOverlay: source.systemPromptOverlay,
      modelPreference: source.modelPreference,
      fallbackModel: source.fallbackModel,
      reasoningEffort: source.reasoningEffort,
      temperature: source.temperature,
      enabledToolsets: source.enabledToolsets ? [...source.enabledToolsets] : undefined,
      disabledToolsets: source.disabledToolsets ? [...source.disabledToolsets] : undefined,
      skin: source.skin,
      customAxioms: source.customAxioms ? [...source.customAxioms] : undefined,
      tags: [...(source.tags || []), "cloned", cloneKind],
      memoryStore: options.preserveMemories !== false && source.memoryStore ? { ...source.memoryStore } : {},
      envOverrides: options.envOverrides
        ? { ...(source.envOverrides || {}), ...options.envOverrides }
        : source.envOverrides
        ? { ...source.envOverrides }
        : undefined,
      telemetry: {
        totalInvocations: 0,
        totalSessionsBound: 0,
        lastActivatedAtMs: now,
        estimatedTokensSaved: 0,
      },
      createdAtMs: now,
      updatedAtMs: now,
    };

    if (cloneKind === "shallow") {
      return {
        ...base,
        soulPrompt: "You are LUMI, an autonomous AI assistant.",
        systemPromptOverlay: undefined,
        memoryStore: {},
        customAxioms: [],
      };
    }

    if (cloneKind === "persona") {
      return {
        ...base,
        soulPrompt: source.soulPrompt,
        customAxioms: source.customAxioms ? [...source.customAxioms] : undefined,
        memoryStore: options.preserveMemories !== false && source.memoryStore ? { ...source.memoryStore } : {},
      };
    }

    // "full" clone preserves everything
    return base;
  }

  /**
   * Generates a signed export bundle for a profile descriptor.
   */
  public exportBundle(profile: ProfileDescriptor): ProfileExportBundle {
    const canonicalPayload = JSON.stringify(profile, Object.keys(profile).sort());
    const hash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");

    return {
      version: "1.0.0",
      exportedAtMs: Date.now(),
      profile: {
        ...profile,
        enabledToolsets: profile.enabledToolsets ? [...profile.enabledToolsets] : undefined,
        disabledToolsets: profile.disabledToolsets ? [...profile.disabledToolsets] : undefined,
        customAxioms: profile.customAxioms ? [...profile.customAxioms] : undefined,
        tags: profile.tags ? [...profile.tags] : undefined,
        memoryStore: profile.memoryStore ? { ...profile.memoryStore } : undefined,
        envOverrides: profile.envOverrides ? { ...profile.envOverrides } : undefined,
      },
      sha256Signature: hash,
    };
  }

  /**
   * Verifies and imports a signed profile export bundle.
   */
  public verifyAndImportBundle(bundle: ProfileExportBundle): {
    valid: boolean;
    profile?: ProfileDescriptor;
    error?: string;
  } {
    if (!bundle || bundle.version !== "1.0.0" || !bundle.profile) {
      return { valid: false, error: "Invalid bundle structure or unsupported version" };
    }

    const valRes = this.validateProfileId(bundle.profile.id);
    if (!valRes.valid) {
      return { valid: false, error: valRes.error };
    }

    const canonicalPayload = JSON.stringify(bundle.profile, Object.keys(bundle.profile).sort());
    const computedHash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");

    if (computedHash !== bundle.sha256Signature) {
      return {
        valid: false,
        error: `Signature mismatch: computed '${computedHash}', expected '${bundle.sha256Signature}'`,
      };
    }

    return {
      valid: true,
      profile: bundle.profile,
    };
  }

  /**
   * Synthesizes a byte-stable, prefix-cache-friendly profile context frame for LLM prompts.
   */
  public renderProfileContext(profile: ProfileDescriptor, inheritanceChain?: readonly string[]): string {
    const icon = profile.icon ? `${profile.icon} ` : "";
    const lines: string[] = [
      `### ${icon}Active Profile: ${profile.name} (${profile.id})`,
      profile.description,
    ];

    if (profile.category) {
      lines.push(`- **Domain Scope:** ${profile.category.toUpperCase()}`);
    }

    if (inheritanceChain && inheritanceChain.length > 1) {
      lines.push(`- **Inheritance Lineage:** ${inheritanceChain.join(" -> ")}`);
    }

    if (profile.soulPrompt) {
      lines.push(`\n**Persona Axioms:**\n${profile.soulPrompt}`);
    }

    if (profile.customAxioms && profile.customAxioms.length > 0) {
      lines.push("\n**Operational Rules:**");
      for (const axiom of profile.customAxioms) {
        lines.push(`- ${axiom}`);
      }
    }

    if (profile.modelPreference && profile.modelPreference !== "default") {
      lines.push(`\n**Target Model:** ${profile.modelPreference}`);
    }

    if (profile.reasoningEffort && profile.reasoningEffort !== "medium") {
      lines.push(`**Reasoning Effort Level:** ${profile.reasoningEffort}`);
    }

    if (profile.enabledToolsets && profile.enabledToolsets.length > 0) {
      lines.push(`**Enabled Toolsets:** ${profile.enabledToolsets.join(", ")}`);
    }

    return lines.join("\n");
  }
}
