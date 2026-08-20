/**
 * SkillCustomForgeEngine.
 * Part of LUMI's Evolutionary Skill Tree Architecture (ADR-014 / SKILL-001).
 *
 * Provides intuitive, approachable custom SKILL creation:
 * - Natural Language One-Shot Synthesis (Prompt -> Complete SKILL.md)
 * - Interactive 5-Step Guided Wizard Questionnaire
 * - Modular Skill Power-Up Packs (Retry Resilience, Zero-GC Buffer, Audit Logs, Rate Limiter)
 * - Zero-Boilerplate Clone & Modify Forking
 * - Proactive Skill Linter & 1-Click Auto-Fix Engine ("Skill Doctor")
 */

import * as crypto from "node:crypto";
import type {
  SkillCustomTweakSpec,
  SkillForgeOptions,
  SkillNodeLintIssue,
  SkillNodeLintReport,
  SkillNodeManifest,
  SkillPowerUpPack,
  SkillSupportFile,
  SkillTier,
  SkillWizardAnswers,
  SkillWizardQuestion,
} from "../../../core/contracts/skills.contracts.js";
import { DeterministicSkillTreeParser } from "./deterministic-skill-tree-parser.js";

export class SkillCustomForgeEngine {
  private readonly parser: DeterministicSkillTreeParser;

  constructor(parser = new DeterministicSkillTreeParser()) {
    this.parser = parser;
  }

  // ---------------------------------------------------------------------------
  // 1. Natural Language One-Shot Skill Synthesis
  // ---------------------------------------------------------------------------

  public synthesizeFromPrompt(prompt: string, options: SkillForgeOptions = {}): SkillNodeManifest {
    const lower = prompt.toLowerCase();

    // 1. Infer Category
    let category = options.category || "workflow";
    if (lower.includes("perf") || lower.includes("speed") || lower.includes("gc") || lower.includes("memory") || lower.includes("optim")) {
      category = "performance";
    } else if (lower.includes("sec") || lower.includes("vuln") || lower.includes("audit") || lower.includes("auth") || lower.includes("firewall")) {
      category = "security";
    } else if (lower.includes("debug") || lower.includes("trace") || lower.includes("fix") || lower.includes("bug") || lower.includes("error")) {
      category = "debugging";
    } else if (lower.includes("arch") || lower.includes("refactor") || lower.includes("pattern") || lower.includes("solid")) {
      category = "architecture";
    } else if (lower.includes("test") || lower.includes("assert") || lower.includes("e2e") || lower.includes("coverage")) {
      category = "testing";
    } else if (lower.includes("data") || lower.includes("sql") || lower.includes("etl") || lower.includes("analyt")) {
      category = "data_analysis";
    }

    // 2. Infer Tier
    let tier: SkillTier = options.tier || "novice";
    if (lower.includes("expert") || lower.includes("sovereign") || lower.includes("autonomous") || lower.includes("kernel")) {
      tier = "sovereign";
    } else if (lower.includes("master") || lower.includes("advanced") || lower.includes("deep") || lower.includes("complex")) {
      tier = "master";
    } else if (lower.includes("intermediate") || lower.includes("adept") || lower.includes("standard")) {
      tier = "adept";
    }

    // 3. Infer ID and Name
    const cleanIdBase = prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
    const skillId = options.targetSkillId || `skill-${cleanIdBase || Date.now()}`;
    const skillName = options.name || this.generateSkillName(prompt, category);

    // 4. Extract Custom Rules & Guidelines from Prompt
    const extractedRules = this.extractActionRules(prompt);

    // 5. Generate Markdown Body
    const body = this.composeSkillBody({
      id: skillId,
      name: skillName,
      description: prompt.slice(0, 140),
      category,
      tier,
      rules: extractedRules,
    });

    const contentHash = crypto.createHash("sha256").update(body).digest("hex");

    let manifest: SkillNodeManifest = {
      id: skillId,
      name: skillName,
      description: prompt.length > 140 ? `${prompt.slice(0, 137)}...` : prompt,
      category,
      tier,
      version: "1.0.0",
      author: "LUMI Skill Forge",
      prerequisites: [],
      relatedSkills: [],
      tags: [category, tier, "custom_forge"],
      masteryScore: tier === "sovereign" ? 95 : tier === "master" ? 80 : tier === "adept" ? 50 : 25,
      fitnessScore: 0.85,
      useCount: 0,
      lastUsedTick: 0,
      createdTick: 0,
      lifecycleState: "active",
      provenance: "user_created",
      pinned: false,
      location: `skills/${skillId}/SKILL.md`,
      body,
      contentHash,
      supportFiles: [],
      competencies: {
        syntaxAccuracy: 90,
        executionReliability: 85,
        recoveryResilience: 80,
        speedEfficiency: 85,
      },
    };

    // Apply any specified power-up packs
    if (options.appliedPacks && options.appliedPacks.length > 0) {
      for (const packId of options.appliedPacks) {
        manifest = this.applyPowerUpPack(manifest, packId);
      }
    }

    return manifest;
  }

  // ---------------------------------------------------------------------------
  // 2. Interactive 5-Step Guided Wizard
  // ---------------------------------------------------------------------------

  public getWizardQuestions(): readonly SkillWizardQuestion[] {
    return [
      {
        step: 1,
        id: "domain_category",
        title: "Skill Domain & Purpose",
        subtitle: "What operational domain does this capability specialize in?",
        options: [
          { id: "performance", label: "Performance & Zero-GC", description: "Memory bounds, allocator optimization, hot path acceleration" },
          { id: "architecture", label: "Architecture & Refactoring", description: "Modular boundaries, clean interfaces, SOLID enforcement" },
          { id: "debugging", label: "Root Cause Diagnostics", description: "Stack unwinding, trace inspection, anomaly pinpointing" },
          { id: "security", label: "Security Sentinel", description: "Input sanitization, AST traversal, vulnerability defense" },
          { id: "testing", label: "Rigorous Verification", description: "Assertion suites, invariant fuzzing, property-based tests" },
          { id: "workflow", label: "Workflow Automation", description: "Multi-step tool sequences, batch synthesis, pipeline triage" },
        ],
      },
      {
        step: 2,
        id: "execution_mode",
        title: "Execution Mode & Automation",
        subtitle: "How autonomously should the agent execute this skill?",
        options: [
          { id: "autonomous_scripting", label: "Autonomous Pipeline", description: "Execute steps directly with minimal turn-taking" },
          { id: "interactive_guide", label: "Interactive Checkpoints", description: "Step-by-step verification with user confirmation" },
          { id: "strict_verification", label: "Axiomatic Strictness", description: "Assert all preconditions before mutating any state" },
          { id: "socratic_mentoring", label: "Socratic Mentor", description: "Explain trade-offs and rationale alongside code changes" },
        ],
      },
      {
        step: 3,
        id: "initial_tier",
        title: "Target Mastery Tier",
        subtitle: "What is the initial baseline competence required for this skill?",
        options: [
          { id: "novice", label: "Novice (Foundational)", description: "Guided execution with strict guardrails and explanations" },
          { id: "adept", label: "Adept (Production-Ready)", description: "Standard reliable execution with error recovery" },
          { id: "master", label: "Master (High-Complexity)", description: "Handles edge cases, architectural patterns, and cross-cutting concerns" },
          { id: "sovereign", label: "Sovereign (Kernel-Grade)", description: "Ultra-fast, zero-GC, deterministic, and self-healing" },
        ],
      },
      {
        step: 4,
        id: "safety_level",
        title: "Safety & Sandboxing Rules",
        subtitle: "What sandboxing constraints apply during skill execution?",
        options: [
          { id: "read_only_safe", label: "Read-Only Non-Destructive", description: "Cannot modify project files without explicit user approval" },
          { id: "mutation_allowed", label: "Anchored Project Mutations", description: "Can modify project code using line-anchored atomic mutators" },
          { id: "strict_zero_gc", label: "Zero-GC Slab Invariant", description: "Disallow dynamic heap allocations during turn loops" },
          { id: "air_gapped_isolated", label: "Air-Gapped Isolation", description: "No external network access or telemetry egress allowed" },
        ],
      },
      {
        step: 5,
        id: "power_ups",
        title: "Skill Power-Up Packs",
        subtitle: "Select modular add-ons to boost resilience and performance",
        isMultiSelect: true,
        options: [
          { id: "retry_resilience", label: "Retry Resilience", description: "Exponential backoff, jitter, and automatic recovery handlers" },
          { id: "zero_gc_buffer", label: "Zero-GC Memory Buffers", description: "Pre-allocated typed array slabs for high-throughput loops" },
          { id: "audit_logging", label: "Forensic Audit Logging", description: "Full transaction history and plain-English provenance reports" },
          { id: "adversarial_security", label: "Adversarial Input Firewall", description: "Deep parameter sanitization and AST safety bounds" },
        ],
      },
    ];
  }

  public buildFromWizard(answers: SkillWizardAnswers): SkillNodeManifest {
    const category = answers.domainOrCategory || "workflow";
    const tier: SkillTier = answers.initialTier || "adept";
    const skillName = answers.name || `${category.charAt(0).toUpperCase() + category.slice(1)} Mastery Guide`;
    const skillId = answers.targetSkillId || `skill-${category}-${Date.now().toString(36)}`;

    const rules: string[] = [];
    if (answers.executionMode === "strict_verification") {
      rules.push("Assert all system invariants before modifying any code.");
    } else if (answers.executionMode === "socratic_mentoring") {
      rules.push("Provide plain-English explanations of design choices.");
    }
    if (answers.safetyLevel === "strict_zero_gc") {
      rules.push("Enforce zero dynamic heap allocations on hot turn loops.");
    }
    if (answers.customRules) {
      rules.push(...answers.customRules);
    }

    const body = this.composeSkillBody({
      id: skillId,
      name: skillName,
      description: `Custom skill engineered for ${category} operations with ${tier} mastery.`,
      category,
      tier,
      rules,
    });

    const contentHash = crypto.createHash("sha256").update(body).digest("hex");

    let manifest: SkillNodeManifest = {
      id: skillId,
      name: skillName,
      description: `Engineered skill for ${category} under ${answers.executionMode} execution.`,
      category,
      tier,
      version: "1.0.0",
      author: "LUMI Wizard Engine",
      prerequisites: [],
      relatedSkills: [],
      tags: [category, tier, answers.executionMode, "wizard_built"],
      masteryScore: tier === "sovereign" ? 95 : tier === "master" ? 80 : tier === "adept" ? 50 : 25,
      fitnessScore: 0.9,
      useCount: 0,
      lastUsedTick: 0,
      createdTick: 0,
      lifecycleState: "active",
      provenance: "user_created",
      pinned: false,
      location: `skills/${skillId}/SKILL.md`,
      body,
      contentHash,
      supportFiles: [],
      competencies: {
        syntaxAccuracy: 95,
        executionReliability: 90,
        recoveryResilience: 85,
        speedEfficiency: 90,
      },
    };

    if (answers.appliedPacks) {
      for (const packId of answers.appliedPacks) {
        manifest = this.applyPowerUpPack(manifest, packId);
      }
    }

    return manifest;
  }

  // ---------------------------------------------------------------------------
  // 3. Modular Skill Power-Up Packs
  // ---------------------------------------------------------------------------

  public listPowerUpPacks(): readonly SkillPowerUpPack[] {
    return [
      {
        id: "retry_resilience",
        name: "Retry Resilience & Fault Tolerance",
        tagLine: "Automatic exponential backoff, jitter, and error recovery",
        description: "Equips the skill with robust retry mechanisms, transient error catchers, and fallback strategies.",
        category: "resilience",
        masteryScoreDelta: 10,
        addedRules: [
          "Wrap fallible I/O in exponential backoff retry loops (max 3 attempts).",
          "Log transient failures with timestamp and error signature.",
          "Fallback to safe degraded mode upon terminal failure.",
        ],
        tags: ["resilience", "retry", "fault_tolerant"],
      },
      {
        id: "zero_gc_buffer",
        name: "Zero-GC Memory Slab Buffering",
        tagLine: "Pre-allocated contiguous buffers for zero allocation overhead",
        description: "Enforces 16 MB slab invariants and eliminates garbage collector pressure on hot turn execution.",
        category: "performance",
        masteryScoreDelta: 15,
        addedRules: [
          "Never allocate heap objects inside hot evaluation loops.",
          "Use pre-allocated Uint8Array / Float64Array slabs for numeric transformations.",
          "Recycle reusable scratch buffers across frames.",
        ],
        tags: ["zero_gc", "memory_slab", "high_throughput"],
      },
      {
        id: "audit_logging",
        name: "Forensic Audit Logging & Provenance",
        tagLine: "Cryptographic state hashes and step-by-step transaction logs",
        description: "Tracks all skill invocations, argument fingerprints, and execution outcomes with tamper-evident audit rows.",
        category: "observability",
        masteryScoreDelta: 5,
        addedRules: [
          "Record forensic audit row with SHA-256 state before and after execution.",
          "Generate plain-English explanation for every mutated record.",
        ],
        tags: ["audit_trail", "provenance", "transparency"],
      },
      {
        id: "adversarial_security",
        name: "Adversarial Input Firewall & AST Guard",
        tagLine: "Zero-trust argument validation and code execution sandboxing",
        description: "Validates all model inputs against path traversal, shell injection, and unbounded AST structures.",
        category: "security",
        masteryScoreDelta: 12,
        addedRules: [
          "Sanitize all file paths to prevent directory traversal outside workspace.",
          "Disallow raw eval/Function execution without AST validation.",
          "Enforce timeout boundaries on sub-process invocations.",
        ],
        tags: ["security", "sandbox", "zero_trust"],
      },
      {
        id: "rate_limit_guard",
        name: "Token Budgeting & Concurrency Throttle",
        tagLine: "Prevents runaway tool calling and budget exhaustion",
        description: "Implements leaky-bucket rate limiting and maximum turn execution ceilings.",
        category: "governance",
        masteryScoreDelta: 8,
        addedRules: [
          "Enforce max tool calls per turn budget.",
          "Throttle external network requests to prevent API rate limiting.",
        ],
        tags: ["rate_limit", "token_budget", "governance"],
      },
      {
        id: "pedantic_types",
        name: "Pedantic TypeScript Invariants",
        tagLine: "Strict typing and exhaustive pattern matching",
        description: "Eliminates `any` casts, enforces immutable `readonly` arrays, and verifies exhaustive enum handling.",
        category: "performance",
        masteryScoreDelta: 8,
        addedRules: [
          "Enforce strict TypeScript compiler options (noImplicitAny, strictNullChecks).",
          "Ensure all public contracts export readonly collections.",
        ],
        tags: ["typescript", "strict_types", "code_quality"],
      },
    ];
  }

  public applyPowerUpPack(manifest: SkillNodeManifest, packId: string): SkillNodeManifest {
    const pack = this.listPowerUpPacks().find((p) => p.id === packId);
    if (!pack) return manifest;

    const newTags = Array.from(new Set([...manifest.tags, ...pack.tags, `pack:${pack.id}`]));
    const newMastery = Math.min(100, manifest.masteryScore + pack.masteryScoreDelta);

    let updatedBody = manifest.body;
    const rulesHeader = "## 🛡️ Operational Guardrails & Rules";
    if (!updatedBody.includes(rulesHeader)) {
      updatedBody += `\n\n${rulesHeader}\n`;
    }

    for (const rule of pack.addedRules) {
      if (!updatedBody.includes(rule)) {
        updatedBody += `\n- [Power-Up: ${pack.name}] ${rule}`;
      }
    }

    const updatedSupportFiles: SkillSupportFile[] = [...(manifest.supportFiles || [])];
    if (pack.supportFiles) {
      for (const sf of pack.supportFiles) {
        if (!updatedSupportFiles.some((f) => f.relativePath === sf.relativePath)) {
          updatedSupportFiles.push(sf);
        }
      }
    }

    const contentHash = crypto.createHash("sha256").update(updatedBody).digest("hex");

    return {
      ...manifest,
      tags: Object.freeze(newTags),
      masteryScore: newMastery,
      body: updatedBody,
      contentHash,
      supportFiles: Object.freeze(updatedSupportFiles),
      updatedAtMs: Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Clone & Modify ("Forking")
  // ---------------------------------------------------------------------------

  public cloneAndModify(
    source: SkillNodeManifest,
    newId: string,
    tweaks: SkillCustomTweakSpec
  ): SkillNodeManifest {
    const newName = tweaks.name || `${source.name} (Custom)`;
    const newCategory = tweaks.category || source.category;
    const newTier = tweaks.tier || source.tier;
    const newDescription = tweaks.description || source.description;

    let updatedBody = source.body.replace(source.name, newName);

    if (tweaks.addedRules && tweaks.addedRules.length > 0) {
      updatedBody += `\n\n### 🔧 Custom Rules\n`;
      for (const rule of tweaks.addedRules) {
        updatedBody += `- ${rule}\n`;
      }
    }

    const newTags = Array.from(
      new Set([...source.tags, "forked", ...(tweaks.addedTags || [])])
    );
    const newPrereqs = Array.from(
      new Set([...source.prerequisites, ...(tweaks.addedPrerequisites || [])])
    );
    const newMastery = Math.min(
      100,
      Math.max(0, source.masteryScore + (tweaks.masteryDelta || 0))
    );

    const contentHash = crypto.createHash("sha256").update(updatedBody).digest("hex");

    return {
      ...source,
      id: newId,
      name: newName,
      description: newDescription,
      category: newCategory,
      tier: newTier,
      tags: Object.freeze(newTags),
      prerequisites: Object.freeze(newPrereqs),
      masteryScore: newMastery,
      provenance: "user_created",
      body: updatedBody,
      contentHash,
      location: `skills/${newId}/SKILL.md`,
      lineage: {
        generation: (source.lineage?.generation || 1) + 1,
        ancestorId: source.id,
        mutationCount: (source.lineage?.mutationCount || 0) + 1,
        createdAtMs: Date.now(),
      },
      updatedAtMs: Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Proactive Skill Linter & 1-Click Auto-Fix ("Skill Doctor")
  // ---------------------------------------------------------------------------

  public lintSkill(manifest: SkillNodeManifest): SkillNodeLintReport {
    const issues: SkillNodeLintIssue[] = [];

    // Issue 1: Empty or very short body
    if (!manifest.body || manifest.body.trim().length < 50) {
      issues.push({
        id: "issue-empty-instructions",
        severity: "error",
        title: "Missing Skill Instructions",
        description: "Skill body is empty or lacks actionable procedural guidance.",
        affectedField: "body",
        autoFixable: true,
        suggestedFix: "Synthesize default structured procedural action steps.",
      });
    }

    // Issue 2: Missing category
    if (!manifest.category || manifest.category.trim() === "") {
      issues.push({
        id: "issue-missing-category",
        severity: "warning",
        title: "Missing Operational Category",
        description: "Skill does not specify a valid domain category.",
        affectedField: "category",
        autoFixable: true,
        suggestedFix: "Assign default category based on skill tags and name.",
      });
    }

    // Issue 3: Missing guardrails or safety rules
    if (!manifest.body.includes("Guardrail") && !manifest.body.includes("Rule") && !manifest.body.includes("Safety")) {
      issues.push({
        id: "issue-missing-safety-guardrails",
        severity: "warning",
        title: "Missing Safety Invariants",
        description: "Skill does not define operational guardrails or error handling.",
        affectedField: "body",
        autoFixable: true,
        suggestedFix: "Append standard error recovery and invariant guardrails.",
      });
    }

    // Issue 4: Sovereign tier with low mastery score
    if (manifest.tier === "sovereign" && manifest.masteryScore < 70) {
      issues.push({
        id: "issue-tier-mastery-mismatch",
        severity: "warning",
        title: "Tier / Mastery Score Disconnect",
        description: `Skill is declared as 'sovereign' tier but has mastery score of only ${manifest.masteryScore}/100.`,
        affectedField: "masteryScore",
        autoFixable: true,
        suggestedFix: "Rebalance mastery score to >= 85 for sovereign competence.",
      });
    }

    const errorsCount = issues.filter((i) => i.severity === "error").length;
    const warningsCount = issues.filter((i) => i.severity === "warning").length;
    const isValid = errorsCount === 0;

    let cohesion = 100;
    cohesion -= errorsCount * 30;
    cohesion -= warningsCount * 15;
    cohesion = Math.max(10, Math.min(100, cohesion));

    let verdict = "Skill specification is optimal and production-ready.";
    if (errorsCount > 0) {
      verdict = `Critical errors detected (${errorsCount}). Action required before reliable autonomous execution.`;
    } else if (warningsCount > 0) {
      verdict = `Minor optimizations recommended (${warningsCount} warning(s)). Auto-fix available.`;
    }

    return {
      skillId: manifest.id,
      skillName: manifest.name,
      isValid,
      issuesCount: issues.length,
      warningsCount,
      errorsCount,
      issues: Object.freeze(issues),
      overallCohesionScore: cohesion,
      plainLanguageVerdict: verdict,
    };
  }

  public autoFixSkill(manifest: SkillNodeManifest): SkillNodeManifest {
    const report = this.lintSkill(manifest);
    if (report.issues.length === 0) return manifest;

    let fixedBody = manifest.body;
    let fixedCategory = manifest.category || "workflow";
    let fixedMastery = manifest.masteryScore;

    for (const issue of report.issues) {
      if (issue.id === "issue-empty-instructions") {
        fixedBody = this.composeSkillBody({
          id: manifest.id,
          name: manifest.name,
          description: manifest.description || "Synthesized procedural skill instructions.",
          category: fixedCategory,
          tier: manifest.tier,
          rules: ["Assert inputs before executing", "Handle transient exceptions gracefully"],
        });
      }

      if (issue.id === "issue-missing-category") {
        fixedCategory = manifest.tags[0] || "workflow";
      }

      if (issue.id === "issue-missing-safety-guardrails") {
        if (!fixedBody.includes("## 🛡️ Operational Guardrails")) {
          fixedBody += `\n\n## 🛡️ Operational Guardrails\n- Assert input integrity before applying changes.\n- Catch and log exceptions with full diagnostic context.\n- Maintain state rollbacks on execution failure.\n`;
        }
      }

      if (issue.id === "issue-tier-mastery-mismatch") {
        fixedMastery = 90;
      }
    }

    const contentHash = crypto.createHash("sha256").update(fixedBody).digest("hex");

    return {
      ...manifest,
      category: fixedCategory,
      masteryScore: fixedMastery,
      body: fixedBody,
      contentHash,
      updatedAtMs: Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private generateSkillName(prompt: string, category: string): string {
    const words = prompt.trim().split(/\s+/).slice(0, 4);
    const capitalized = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    return capitalized || `${category.toUpperCase()} Specialist`;
  }

  private extractActionRules(prompt: string): string[] {
    const rules: string[] = [];
    const sentences = prompt.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);

    for (const s of sentences) {
      const lower = s.toLowerCase();
      if (
        lower.startsWith("never") ||
        lower.startsWith("always") ||
        lower.startsWith("must") ||
        lower.startsWith("ensure") ||
        lower.startsWith("check") ||
        lower.includes("should")
      ) {
        rules.push(s);
      }
    }

    if (rules.length === 0) {
      rules.push("Execute with deterministic consistency and verify outputs.");
    }

    return rules;
  }

  private composeSkillBody(spec: {
    id: string;
    name: string;
    description: string;
    category: string;
    tier: SkillTier;
    rules: readonly string[];
  }): string {
    let md = `---
name: ${spec.id}
description: "${spec.description.replace(/"/g, '\\"')}"
category: ${spec.category}
tier: ${spec.tier}
version: 1.0.0
---

# ${spec.name}

${spec.description}

## 📋 Execution Protocol
1. **Analyze Input**: Validate preconditions and inspect operational context.
2. **Execute Actions**: Carry out procedures using deterministic tools.
3. **Verify Outcome**: Assert correctness and log diagnostic telemetry.

## 🛡️ Operational Guardrails & Rules
`;
    for (const rule of spec.rules) {
      md += `- ${rule}\n`;
    }

    return md;
  }
}
