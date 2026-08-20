/**
 * deterministic-profile-engine.ts
 *
 * Deterministic engine for profile validation, inheritance resolution, blueprint catalog,
 * structural diffing, Natural Query DSL parsing, prompt template hydration, few-shot exemplar formatting,
 * axiom compliance auditing, execution parameter verification, and cryptographic bundle export/import
 * (Target #76 / ADR-119 / Zenith Tier).
 */

import * as crypto from "node:crypto";
import type {
  ProfileAxiomComplianceReport,
  ProfileBlueprint,
  ProfileCategory,
  ProfileCloneOptions,
  ProfileDescriptor,
  ProfileDiffResult,
  ProfileEvalReport,
  ProfileExecutionParameters,
  ProfileExemplar,
  ProfileExportBundle,
  ProfilePrefixCacheFrame,
  ProfileQueryFilter,
  ProfileRevision,
  ProfileStatus,
  ProfileTemplateHydrationContext,
  ProfileTestCase,
  ProfileTestCaseResult,
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
          "You are LUMI Coder, an expert full-stack engineer operating in {{workspace.root}}. Prioritize strict type safety, zero technical debt, modular composition, and exhaustive unit test verification.",
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
        defaultParameters: {
          temperature: 0.2,
          topP: 0.95,
          frequencyPenalty: 0.1,
          presencePenalty: 0.0,
          responseFormat: "text",
        },
        defaultGovernance: {
          maxTokensPerTurn: 8192,
          maxMonthlyBudgetUsd: 150.0,
          rateLimitPerMin: 60,
        },
        defaultDelegation: {
          canSpawnSubagents: true,
          maxSubagentDepth: 3,
          allowedHandoffProfiles: ["sre", "researcher"],
          delegationStrategy: "hierarchical",
        },
        defaultMemoryPolicy: {
          maxContextTokens: 64000,
          evictionStrategy: "sliding_window",
          autoSummarizeThreshold: 48000,
          pinnedMemoryKeys: ["MEMORY.md"],
        },
        defaultExemplars: [
          {
            id: "ex_refactor_function",
            title: "Pure Function Refactoring",
            input: "Refactor this impure mutating function to return a deterministic snapshot.",
            output: "```typescript\nexport function computeState(prev: State, delta: Delta): State {\n  return { ...prev, ...delta, updatedAt: Date.now() };\n}\n```",
            explanation: "Eliminates in-place mutation and guarantees state immutability.",
            tags: ["typescript", "refactor"],
          },
        ],
        conversationStarters: [
          {
            id: "starter_refactor",
            title: "Refactor Architecture",
            prompt: "Analyze the current codebase structure and suggest modular decoupling opportunities.",
            icon: "🔨",
            category: "Refactoring",
          },
          {
            id: "starter_add_tests",
            title: "Add Validation Tests",
            prompt: "Write a comprehensive end-to-end test suite for the target module with 100% assertion coverage.",
            icon: "🧪",
            category: "Testing",
          },
        ],
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
        defaultParameters: {
          topP: 0.9,
          temperature: 0.4,
          responseFormat: "text",
        },
        defaultGovernance: {
          maxTokensPerTurn: 16384,
          maxMonthlyBudgetUsd: 200.0,
          rateLimitPerMin: 40,
        },
        defaultExemplars: [
          {
            id: "ex_citation_analysis",
            title: "Structured Evidence Comparison",
            input: "Compare Transformer attention efficiency with State Space Models (Mamba).",
            output: "| Metric | Transformer | Mamba (SSM) |\n| :--- | :--- | :--- |\n| Inference Complexity | O(N) cache | O(1) constant state |\n| Long Context Scaling | Quadratic compute | Linear compute |",
            explanation: "Produces balanced trade-off matrix with cited metrics.",
            tags: ["ml", "research"],
          },
        ],
        conversationStarters: [
          {
            id: "starter_literature_review",
            title: "Deep Literature Review",
            prompt: "Conduct a comprehensive review of recent state-of-the-art papers on autonomous multi-agent systems.",
            icon: "📚",
            category: "Analysis",
          },
        ],
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
        defaultGovernance: {
          maxTokensPerTurn: 4096,
          strictTimeoutMs: 15000,
        },
        conversationStarters: [
          {
            id: "starter_incident_triage",
            title: "Diagnose Production Error",
            prompt: "Inspect the latest error logs and trace the sequence of events to isolate root causes.",
            icon: "🚨",
            category: "Diagnostics",
          },
        ],
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
        conversationStarters: [
          {
            id: "starter_write_adr",
            title: "Draft Architectural Decision Record",
            prompt: "Draft an ADR documenting the rationale, trade-offs, and invariants for the new subsystem.",
            icon: "📝",
            category: "Documentation",
          },
        ],
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
      version: "1.0.0",
      revisionNumber: 1,
      category: bp.category,
      icon: bp.icon,
      isFavorite: false,
      soulPrompt: bp.defaultSoulPrompt,
      modelPreference: bp.recommendedModel,
      reasoningEffort: bp.recommendedReasoningEffort,
      temperature: 0.7,
      parameters: bp.defaultParameters ? { ...bp.defaultParameters } : undefined,
      governance: bp.defaultGovernance ? { ...bp.defaultGovernance } : undefined,
      delegation: bp.defaultDelegation ? { ...bp.defaultDelegation } : undefined,
      memoryPolicy: bp.defaultMemoryPolicy ? { ...bp.defaultMemoryPolicy } : undefined,
      exemplars: bp.defaultExemplars ? [...bp.defaultExemplars] : undefined,
      voice: bp.defaultVoice ? { ...bp.defaultVoice } : undefined,
      conversationStarters: bp.conversationStarters ? [...bp.conversationStarters] : undefined,
      enabledToolsets: [...bp.recommendedToolsets],
      customAxioms: [...bp.customAxioms],
      tags: [...bp.tags, "blueprint-instantiated"],
      memoryStore: bp.defaultMemoryStore ? { ...bp.defaultMemoryStore } : { "MEMORY.md": `# ${bp.name} Memory\n` },
      telemetry: {
        totalInvocations: 0,
        totalSessionsBound: 0,
        lastActivatedAtMs: now,
        estimatedTokensSaved: 0,
        totalTokensConsumed: 0,
        totalCostUsd: 0,
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
   * Validates execution hyperparameters.
   */
  public validateExecutionParameters(params?: ProfileExecutionParameters): { valid: boolean; error?: string } {
    if (!params) return { valid: true };

    if (params.topP !== undefined && (params.topP < 0 || params.topP > 1)) {
      return { valid: false, error: `topP must be between 0.0 and 1.0 (received ${params.topP})` };
    }
    if (params.frequencyPenalty !== undefined && (params.frequencyPenalty < -2 || params.frequencyPenalty > 2)) {
      return { valid: false, error: `frequencyPenalty must be between -2.0 and 2.0 (received ${params.frequencyPenalty})` };
    }
    if (params.presencePenalty !== undefined && (params.presencePenalty < -2 || params.presencePenalty > 2)) {
      return { valid: false, error: `presencePenalty must be between -2.0 and 2.0 (received ${params.presencePenalty})` };
    }
    if (params.maxTokens !== undefined && params.maxTokens <= 0) {
      return { valid: false, error: `maxTokens must be greater than 0 (received ${params.maxTokens})` };
    }
    if (params.responseFormat && !["text", "json_object", "json_schema"].includes(params.responseFormat)) {
      return { valid: false, error: `Invalid responseFormat '${params.responseFormat}'` };
    }
    return { valid: true };
  }

  /**
   * Hydrates dynamic prompt template variables with fallback defaults and conditional sections.
   */
  public hydratePromptTemplate(template: string, context: ProfileTemplateHydrationContext = {}): string {
    if (!template) return "";

    let hydrated = template;

    // Handle conditionals: {{#if key}}content{{/if}}
    const ifRegex = /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    hydrated = hydrated.replace(ifRegex, (_match, key: string, content: string) => {
      const val = this.resolveContextVariable(key, context);
      return Boolean(val) ? content : "";
    });

    // Handle variable interpolation with default fallbacks: {{key || "default"}} or {{key}}
    const varRegex = /\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\|\s*["']([^"']*)["'])?\s*\}\}/g;
    hydrated = hydrated.replace(varRegex, (_match, key: string, fallback: string | undefined) => {
      const val = this.resolveContextVariable(key, context);
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val);
      }
      return fallback !== undefined ? fallback : "";
    });

    return hydrated;
  }

  private resolveContextVariable(key: string, context: ProfileTemplateHydrationContext): unknown {
    const k = key.trim();
    if (k === "workspace.root" || k === "workspaceRoot") {
      return context.workspaceRoot ?? (typeof process !== "undefined" ? process.cwd() : undefined);
    }
    if (k === "user.name" || k === "userName") {
      return context.userName;
    }
    if (k === "session.id" || k === "sessionId") {
      return context.sessionId;
    }
    if (k === "datetime.iso" || k === "datetimeIso") {
      return context.datetimeIso ?? new Date().toISOString();
    }
    if (k.startsWith("env.") && context.env) {
      const envKey = k.slice(4);
      return context.env[envKey] ?? (typeof process !== "undefined" ? process.env[envKey] : undefined);
    }
    if (context.customVars && k in context.customVars) {
      return context.customVars[k];
    }
    return undefined;
  }

  /**
   * Formats few-shot in-context learning exemplars into structured LLM demonstration blocks.
   */
  public renderExemplars(exemplars?: readonly ProfileExemplar[]): string {
    if (!exemplars || exemplars.length === 0) return "";

    const lines: string[] = ["\n### Few-Shot Demonstrations & Reference Invariants:"];
    for (let i = 0; i < exemplars.length; i++) {
      const ex = exemplars[i];
      lines.push(`\n**[Example ${i + 1}] ${ex.title}:**`);
      lines.push(`- **Input / Request:**\n${ex.input}`);
      lines.push(`- **Expected Output:**\n${ex.output}`);
      if (ex.explanation) {
        lines.push(`- *Rationale:* ${ex.explanation}`);
      }
    }
    return lines.join("\n");
  }

  /**
   * Deterministically audits axiom compliance of agent responses against the profile's rules.
   */
  public auditAxiomCompliance(profile: ProfileDescriptor, transcriptText: string): ProfileAxiomComplianceReport {
    const axioms = profile.customAxioms || [];
    if (axioms.length === 0) {
      return {
        profileId: profile.id,
        totalAxioms: 0,
        compliantAxioms: [],
        violatedAxioms: [],
        complianceScorePercent: 100,
        isAcceptable: true,
        timestampMs: Date.now(),
      };
    }

    const compliant: string[] = [];
    const violated: { axiom: string; violationReason: string; severity: "low" | "medium" | "high" }[] = [];

    const lowerTranscript = transcriptText.toLowerCase();

    for (const axiom of axioms) {
      const lowerAxiom = axiom.toLowerCase();

      // Heuristic axiom checks for common engineering/operations rules
      if (lowerAxiom.includes("zero type errors") || lowerAxiom.includes("typescript compilation")) {
        if (lowerTranscript.includes("error ts") || lowerTranscript.includes("type error:")) {
          violated.push({
            axiom,
            violationReason: "Transcript contains explicit TypeScript compilation errors",
            severity: "high",
          });
          continue;
        }
      }

      if (lowerAxiom.includes("active voice") || lowerAxiom.includes("markdown")) {
        if (transcriptText.length > 500 && !transcriptText.includes("#") && !transcriptText.includes("- ")) {
          violated.push({
            axiom,
            violationReason: "Response lacks expected markdown structure and headers",
            severity: "low",
          });
          continue;
        }
      }

      if (lowerAxiom.includes("never just give away the raw answer") || lowerAxiom.includes("socratic")) {
        if (transcriptText.length < 50 && (lowerTranscript.includes("here is the answer") || lowerTranscript.includes("the answer is"))) {
          violated.push({
            axiom,
            violationReason: "Direct answer provided without Socratic guidance",
            severity: "medium",
          });
          continue;
        }
      }

      compliant.push(axiom);
    }

    const score = Math.round((compliant.length / axioms.length) * 100);

    return {
      profileId: profile.id,
      totalAxioms: axioms.length,
      compliantAxioms: compliant,
      violatedAxioms: violated,
      complianceScorePercent: score,
      isAcceptable: score >= 80,
      timestampMs: Date.now(),
    };
  }

  /**
   * Detects persona drift between profile soul prompt and generated outputs.
   */
  public detectPersonaDrift(profile: ProfileDescriptor, outputText: string): { driftScore: number; passed: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let driftPoints = 0;

    if (!outputText || outputText.trim().length === 0) {
      return { driftScore: 0, passed: true, warnings: [] };
    }

    // Check prohibited keywords if guardrails configured
    if (profile.guardrails?.prohibitedKeywords) {
      for (const kw of profile.guardrails.prohibitedKeywords) {
        if (outputText.toLowerCase().includes(kw.toLowerCase())) {
          warnings.push(`Detected prohibited keyword: '${kw}'`);
          driftPoints += 30;
        }
      }
    }

    // Category style consistency check
    if (profile.category === "engineering" && outputText.length > 300) {
      if (!outputText.includes("`") && !outputText.includes("function") && !outputText.includes("const") && !outputText.includes("class")) {
        warnings.push("Engineering profile output lacks structured code or technical syntax");
        driftPoints += 15;
      }
    }

    const driftScore = Math.min(100, driftPoints);
    return {
      driftScore,
      passed: driftScore < 40,
      warnings,
    };
  }

  /**
   * Creates an immutable cryptographically signed profile revision checkpoint.
   */
  public createRevisionCheckpoint(profile: ProfileDescriptor, changeLog: string, author: string = "system"): ProfileRevision {
    const revNum = (profile.revisionNumber || 1) + 1;
    const semVer = profile.version ? this.incrementPatchVersion(profile.version) : `1.0.${revNum - 1}`;
    const revId = `rev_${profile.id}_${Date.now()}_${revNum}`;
    const timestampMs = Date.now();

    const snapshot: ProfileDescriptor = {
      ...profile,
      version: semVer,
      revisionNumber: revNum,
      updatedAtMs: timestampMs,
    };

    const canonical = JSON.stringify({ revId, revNum, semVer, snapshot, changeLog, author, timestampMs });
    const signature = crypto.createHash("sha256").update(canonical).digest("hex");

    return {
      revisionId: revId,
      revisionNumber: revNum,
      semanticVersion: semVer,
      snapshot,
      changeLog,
      author,
      timestampMs,
      sha256Signature: signature,
    };
  }

  private incrementPatchVersion(v: string): string {
    const parts = v.split(".").map((p) => parseInt(p, 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    }
    return `${v}.1`;
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
        parameters: { ...(effective.parameters || {}), ...(child.parameters || {}) },
        governance: { ...(effective.governance || {}), ...(child.governance || {}) },
        delegation: { ...(effective.delegation || {}), ...(child.delegation || {}) },
        memoryPolicy: { ...(effective.memoryPolicy || {}), ...(child.memoryPolicy || {}) },
        exemplars: [...(effective.exemplars || []), ...(child.exemplars || [])],
        voice: child.voice || effective.voice,
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
      "version",
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
   * Parses Natural Query DSL expressions like 'is:favorite tag:coding model:gpt* has:exemplars sort:recent'
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
      } else if (lower === "has:exemplars" || lower === "has:examples") {
        filter.hasExemplars = true;
      } else if (lower === "has:mcp") {
        filter.hasMcp = true;
      } else if (lower === "has:voice") {
        filter.hasVoice = true;
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
        if (sortVal === "recent" || sortVal === "usage" || sortVal === "name" || sortVal === "favorites" || sortVal === "category") {
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
      version: "1.0.0",
      revisionNumber: 1,
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
      parameters: source.parameters ? { ...source.parameters } : undefined,
      governance: source.governance ? { ...source.governance } : undefined,
      delegation: source.delegation ? { ...source.delegation } : undefined,
      mcpBindings: source.mcpBindings ? [...source.mcpBindings] : undefined,
      knowledgeSources: source.knowledgeSources ? [...source.knowledgeSources] : undefined,
      guardrails: source.guardrails ? { ...source.guardrails } : undefined,
      conversationStarters: source.conversationStarters ? [...source.conversationStarters] : undefined,
      exemplars: options.preserveExemplars !== false && source.exemplars ? [...source.exemplars] : undefined,
      memoryPolicy: source.memoryPolicy ? { ...source.memoryPolicy } : undefined,
      fallbackLadder: source.fallbackLadder ? [...source.fallbackLadder] : undefined,
      voice: source.voice ? { ...source.voice } : undefined,
      secrets: source.secrets ? [...source.secrets] : undefined,
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
        totalTokensConsumed: 0,
        totalCostUsd: 0,
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
        exemplars: [],
      };
    }

    if (cloneKind === "persona") {
      return {
        ...base,
        soulPrompt: source.soulPrompt,
        customAxioms: source.customAxioms ? [...source.customAxioms] : undefined,
        exemplars: options.preserveExemplars !== false && source.exemplars ? [...source.exemplars] : undefined,
        memoryStore: options.preserveMemories !== false && source.memoryStore ? { ...source.memoryStore } : {},
      };
    }

    // "full" clone preserves everything
    return base;
  }

  private canonicalJson(obj: unknown): string {
    if (obj === null || typeof obj !== "object") {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return "[" + obj.map((item) => this.canonicalJson(item)).join(",") + "]";
    }
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const entries = keys.map((k) => JSON.stringify(k) + ":" + this.canonicalJson((obj as Record<string, unknown>)[k]));
    return "{" + entries.join(",") + "}";
  }

  /**
   * Generates a signed export bundle for a profile descriptor.
   */
  public exportBundle(profile: ProfileDescriptor, revisions?: readonly ProfileRevision[]): ProfileExportBundle {
    const cleanProfile: ProfileDescriptor = {
      ...profile,
      enabledToolsets: profile.enabledToolsets ? [...profile.enabledToolsets] : undefined,
      disabledToolsets: profile.disabledToolsets ? [...profile.disabledToolsets] : undefined,
      customAxioms: profile.customAxioms ? [...profile.customAxioms] : undefined,
      exemplars: profile.exemplars ? [...profile.exemplars] : undefined,
      tags: profile.tags ? [...profile.tags] : undefined,
      memoryStore: profile.memoryStore ? { ...profile.memoryStore } : undefined,
      envOverrides: profile.envOverrides ? { ...profile.envOverrides } : undefined,
    };

    const canonicalPayload = this.canonicalJson({ profile: cleanProfile, revisions: revisions || null });
    const hash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");

    return {
      version: "2.0.0",
      exportedAtMs: Date.now(),
      profile: cleanProfile,
      revisions: revisions ? [...revisions] : undefined,
      sha256Signature: hash,
    };
  }

  /**
   * Verifies and imports a signed profile export bundle (supports v1.0.0 and v2.0.0).
   */
  public verifyAndImportBundle(bundle: ProfileExportBundle): {
    valid: boolean;
    profile?: ProfileDescriptor;
    revisions?: readonly ProfileRevision[];
    error?: string;
  } {
    if (!bundle || !bundle.profile) {
      return { valid: false, error: "Invalid bundle structure" };
    }

    const valRes = this.validateProfileId(bundle.profile.id);
    if (!valRes.valid) {
      return { valid: false, error: valRes.error };
    }

    if (bundle.version === "1.0.0") {
      const canonicalPayload = this.canonicalJson(bundle.profile);
      const computedHash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");
      if (computedHash !== bundle.sha256Signature) {
        return { valid: false, error: `Signature mismatch (v1.0.0)` };
      }
      return { valid: true, profile: bundle.profile };
    }

    if (bundle.version === "2.0.0") {
      const canonicalPayload = this.canonicalJson({ profile: bundle.profile, revisions: bundle.revisions || null });
      const computedHash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");
      if (computedHash !== bundle.sha256Signature) {
        return { valid: false, error: `Signature mismatch (v2.0.0)` };
      }
      return { valid: true, profile: bundle.profile, revisions: bundle.revisions };
    }

    return { valid: false, error: `Unsupported bundle version '${(bundle as any).version}'` };
  }

  /**
   * Synthesizes a byte-stable, prefix-cache-friendly profile context frame for LLM prompts.
   */
  public renderProfileContext(
    profile: ProfileDescriptor,
    inheritanceChain?: readonly string[],
    hydrationContext?: ProfileTemplateHydrationContext
  ): string {
    const icon = profile.icon ? `${profile.icon} ` : "";
    const lines: string[] = [
      `### ${icon}Active Profile: ${profile.name} (${profile.id}) [v${profile.version || "1.0.0"}]`,
      profile.description,
    ];

    if (profile.category) {
      lines.push(`- **Domain Scope:** ${profile.category.toUpperCase()}`);
    }

    if (inheritanceChain && inheritanceChain.length > 1) {
      lines.push(`- **Inheritance Lineage:** ${inheritanceChain.join(" -> ")}`);
    }

    if (profile.soulPrompt) {
      const hydratedSoul = hydrationContext
        ? this.hydratePromptTemplate(profile.soulPrompt, hydrationContext)
        : profile.soulPrompt;
      lines.push(`\n**Persona Axioms:**\n${hydratedSoul}`);
    }

    if (profile.customAxioms && profile.customAxioms.length > 0) {
      lines.push("\n**Operational Rules:**");
      for (const axiom of profile.customAxioms) {
        lines.push(`- ${axiom}`);
      }
    }

    // Render Few-Shot In-Context Learning Exemplars
    if (profile.exemplars && profile.exemplars.length > 0) {
      lines.push(this.renderExemplars(profile.exemplars));
    }

    if (profile.modelPreference && profile.modelPreference !== "default") {
      lines.push(`\n**Target Model:** ${profile.modelPreference}`);
    }

    if (profile.fallbackLadder && profile.fallbackLadder.length > 0) {
      lines.push(`**Fallback Models:** ${profile.fallbackLadder.map((f) => f.targetModel).join(" -> ")}`);
    }

    if (profile.voice) {
      lines.push(`**Voice Engine:** ${profile.voice.provider} (Voice: ${profile.voice.voiceId})`);
    }

    if (profile.reasoningEffort && profile.reasoningEffort !== "medium") {
      lines.push(`**Reasoning Effort Level:** ${profile.reasoningEffort}`);
    }

    if (profile.parameters) {
      const p = profile.parameters;
      const paramList: string[] = [];
      if (p.temperature !== undefined) paramList.push(`temp=${p.temperature}`);
      if (p.topP !== undefined) paramList.push(`top_p=${p.topP}`);
      if (p.frequencyPenalty !== undefined) paramList.push(`freq_pen=${p.frequencyPenalty}`);
      if (p.maxTokens !== undefined) paramList.push(`max_tokens=${p.maxTokens}`);
      if (p.responseFormat && p.responseFormat !== "text") paramList.push(`format=${p.responseFormat}`);
      if (paramList.length > 0) {
        lines.push(`**Parameters:** ${paramList.join(", ")}`);
      }
    }

    if (profile.delegation) {
      const d = profile.delegation;
      if (d.canSpawnSubagents) {
        lines.push(`**Delegation:** Allowed (maxDepth=${d.maxSubagentDepth || 2}, strategy=${d.delegationStrategy || "hierarchical"})`);
      }
    }

    if (profile.enabledToolsets && profile.enabledToolsets.length > 0) {
      lines.push(`**Enabled Toolsets:** ${profile.enabledToolsets.join(", ")}`);
    }

    return lines.join("\n");
  }

  /**
   * Constructs a prefix-cache-optimized prompt frame separating static blocks from dynamic contexts.
   */
  public buildPrefixCacheFrame(
    profile: ProfileDescriptor,
    context?: ProfileTemplateHydrationContext
  ): ProfilePrefixCacheFrame {
    const icon = profile.icon ? `${profile.icon} ` : "";
    const systemLines = [
      `### ${icon}Active Profile: ${profile.name} (${profile.id}) [v${profile.version || "1.0.0"}]`,
      profile.description,
    ];
    if (profile.category) {
      systemLines.push(`- **Domain Scope:** ${profile.category.toUpperCase()}`);
    }
    if (profile.customAxioms && profile.customAxioms.length > 0) {
      systemLines.push("\n**Operational Rules:**");
      for (const axiom of profile.customAxioms) {
        systemLines.push(`- ${axiom}`);
      }
    }
    const systemBlock = systemLines.join("\n");

    const toolLines: string[] = [];
    if (profile.enabledToolsets && profile.enabledToolsets.length > 0) {
      toolLines.push(`**Enabled Toolsets:** ${profile.enabledToolsets.join(", ")}`);
    }
    if (profile.mcpBindings && profile.mcpBindings.length > 0) {
      toolLines.push(`**MCP Bindings:** ${profile.mcpBindings.map((m) => m.serverName).join(", ")}`);
    }
    const toolsBlock = toolLines.join("\n");

    const knowledgeLines: string[] = [];
    if (profile.knowledgeSources && profile.knowledgeSources.length > 0) {
      knowledgeLines.push(`**Knowledge Scopes:** ${profile.knowledgeSources.map((k) => k.name).join(", ")}`);
    }
    const knowledgeBlock = knowledgeLines.join("\n");

    const exemplarsBlock = this.renderExemplars(profile.exemplars);

    // Dynamic block: runtime hydrated soul prompt + session context
    const dynamicSoul = context
      ? this.hydratePromptTemplate(profile.soulPrompt, context)
      : profile.soulPrompt;
    const dynamicBlock = `**Persona Context:**\n${dynamicSoul}`;

    // Static prefix = systemBlock + toolsBlock + knowledgeBlock + exemplarsBlock
    const staticPrefix = [systemBlock, toolsBlock, knowledgeBlock, exemplarsBlock].filter(Boolean).join("\n\n").trim();
    const prefixCacheHash = crypto.createHash("sha256").update(staticPrefix).digest("hex");
    const fullRenderedPrompt = `${staticPrefix}\n\n${dynamicBlock}`.trim();
    const estimatedStaticTokens = Math.ceil(staticPrefix.length / 4);

    return {
      profileId: profile.id,
      prefixCacheHash,
      systemBlock,
      toolsBlock,
      knowledgeBlock,
      exemplarsBlock,
      dynamicBlock,
      fullRenderedPrompt,
      estimatedStaticTokens,
    };
  }

  /**
   * Executes an automated test suite evaluating profile prompts, assertions, and axiom adherence.
   */
  public executeProfileEval(profile: ProfileDescriptor, suite: readonly ProfileTestCase[]): ProfileEvalReport {
    const results: ProfileTestCaseResult[] = [];
    let passedCount = 0;

    for (const test of suite) {
      const startTime = Date.now();
      const hydratedPrompt = this.renderProfileContext(profile, [profile.id], test.context);
      const failures: string[] = [];

      for (const assertion of test.assertions) {
        if (assertion.type === "contains_text") {
          const expected = String(assertion.value);
          if (!hydratedPrompt.includes(expected)) {
            failures.push(`Output does not contain expected text: '${expected}'`);
          }
        } else if (assertion.type === "not_contains_text") {
          const forbidden = String(assertion.value);
          if (hydratedPrompt.includes(forbidden)) {
            failures.push(`Output contains forbidden text: '${forbidden}'`);
          }
        } else if (assertion.type === "axiom_compliance") {
          const report = this.auditAxiomCompliance(profile, hydratedPrompt);
          if (!report.isAcceptable) {
            failures.push(`Failed axiom compliance audit (${report.complianceScorePercent}%)`);
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      const passed = failures.length === 0;
      if (passed) passedCount++;

      results.push({
        testCaseId: test.id,
        passed,
        scorePercent: passed ? 100 : Math.max(0, 100 - failures.length * 25),
        latencyMs,
        failures,
      });
    }

    const overallScore = suite.length > 0 ? Math.round((passedCount / suite.length) * 100) : 100;

    return {
      profileId: profile.id,
      suiteName: "Automated Profile Assertion Benchmark",
      totalTests: suite.length,
      passedTests: passedCount,
      failedTests: suite.length - passedCount,
      overallScorePercent: overallScore,
      results,
      evaluatedAtMs: Date.now(),
    };
  }
}
