/**
 * SoulCustomForgeEngine.
 * Formalized under ADR-014 (AKD-DSO Osmosis Paradigm) & SOUL-001.
 *
 * Provides an intuitive, developer- and user-approachable persona creation layer:
 * - Natural Language One-Shot Synthesis (`synthesizeFromPrompt`)
 * - Guided Multi-Step Wizard Questionnaire (`buildFromWizard`, `getWizardQuestions`)
 * - Modular Personality Packs ("Power-Ups") for mix-and-match persona flavoring
 * - Clone & Modify ("Forking") for zero-boilerplate tweaking
 * - Proactive Persona Linter & 1-Click Auto-Fix Engine ("Soul Doctor")
 */

import type {
  SoulArchetype,
  SoulAxiom,
  SoulCustomTweakSpec,
  SoulForgeOptions,
  SoulManifest,
  SoulPersonalityPack,
  SoulPersonaLintIssue,
  SoulPersonaLintReport,
  SoulStyleRules,
  SoulTrait,
  SoulWizardAnswers,
  SoulWizardQuestion,
} from "../../../core/contracts/soul.contracts.js";
import { DeterministicSoulParser } from "./deterministic-soul-parser.js";
import { SoulErgonomicsEngine } from "./soul-ergonomics-engine.js";

export class SoulCustomForgeEngine {
  private readonly parser: DeterministicSoulParser;
  private readonly ergonomics: SoulErgonomicsEngine;
  private readonly personalityPacks: readonly SoulPersonalityPack[];
  private readonly wizardQuestions: readonly SoulWizardQuestion[];

  constructor(
    parser = new DeterministicSoulParser(),
    ergonomics = new SoulErgonomicsEngine()
  ) {
    this.parser = parser;
    this.ergonomics = ergonomics;
    this.personalityPacks = this.initPersonalityPacks();
    this.wizardQuestions = this.initWizardQuestions();
  }

  // ---------------------------------------------------------------------------
  // 1. Natural Language Prompt Synthesis (One-Shot Forge)
  // ---------------------------------------------------------------------------

  /**
   * Synthesizes a fully formed, mathematically bounded, and cryptographically verified
   * SoulManifest directly from a plain-English user prompt description.
   *
   * Example: "A patient Python mentor who explains concepts with simple analogies and checks for understanding."
   */
  synthesizeFromPrompt(prompt: string, options: SoulForgeOptions = {}): SoulManifest {
    const lower = prompt.toLowerCase();

    // 1. Detect target archetype
    let archetype: SoulArchetype = options.baseArchetype || "custom_persona";
    if (!options.baseArchetype) {
      if (lower.includes("tutor") || lower.includes("teacher") || lower.includes("mentor") || lower.includes("explain")) {
        archetype = "socratic_mentor";
      } else if (lower.includes("code") || lower.includes("game") || lower.includes("architect") || lower.includes("refactor")) {
        archetype = "game_engine_architect";
      } else if (lower.includes("security") || lower.includes("audit") || lower.includes("vulnerability") || lower.includes("pentest")) {
        archetype = "security_sentinel";
      } else if (lower.includes("proof") || lower.includes("math") || lower.includes("formal") || lower.includes("verify") || lower.includes("theorem")) {
        archetype = "formal_verifier";
      } else if (lower.includes("critic") || lower.includes("skeptic") || lower.includes("adversary") || lower.includes("probe")) {
        archetype = "autonomous_critic";
      } else if (lower.includes("executive") || lower.includes("brief") || lower.includes("calendar") || lower.includes("triage") || lower.includes("summary")) {
        archetype = "executive_assistant";
      } else if (lower.includes("data") || lower.includes("statistic") || lower.includes("telemetry") || lower.includes("analysis")) {
        archetype = "data_scientist";
      } else if (lower.includes("brainstorm") || lower.includes("creative") || lower.includes("story") || lower.includes("write")) {
        archetype = "creative_collaborator";
      }
    }

    // 2. Base template
    const baseManifest = this.parser.createDefaultSoulManifestForArchetype(archetype);

    // 3. Infer Style Directives
    let tone: SoulStyleRules["tone"] = baseManifest.style.tone;
    let verbosity: SoulStyleRules["verbosity"] = baseManifest.style.verbosity;
    let codePreference: SoulStyleRules["codePreference"] = baseManifest.style.codePreference;
    let mathematicalRigor: SoulStyleRules["mathematicalRigor"] = baseManifest.style.mathematicalRigor;

    if (lower.includes("direct") || lower.includes("no fluff") || lower.includes("blunt") || lower.includes("terse")) {
      tone = "direct";
      verbosity = "terse";
    } else if (lower.includes("gentle") || lower.includes("patient") || lower.includes("friendly") || lower.includes("warm") || lower.includes("collaborative")) {
      tone = "collaborative";
      verbosity = "balanced";
    } else if (lower.includes("formal") || lower.includes("professional") || lower.includes("executive")) {
      tone = "formal";
    } else if (lower.includes("analytical") || lower.includes("deep") || lower.includes("thorough")) {
      tone = "analytical";
      verbosity = "detailed";
    }

    if (lower.includes("concise") || lower.includes("short") || lower.includes("bullet")) {
      verbosity = "terse";
    } else if (lower.includes("step by step") || lower.includes("detailed") || lower.includes("in-depth") || lower.includes("comprehensive")) {
      verbosity = "detailed";
    }

    if (lower.includes("typescript") || lower.includes("type safe") || lower.includes("strict")) {
      codePreference = "typescript_strict";
    } else if (lower.includes("zero gc") || lower.includes("fast") || lower.includes("perf") || lower.includes("slab")) {
      codePreference = "idiomatic_zero_gc";
    } else if (lower.includes("minimal diff") || lower.includes("compact")) {
      codePreference = "minimal_diff";
    }

    if (lower.includes("math") || lower.includes("proof") || lower.includes("axiomatic")) {
      mathematicalRigor = "axiomatic";
    } else if (lower.includes("simple") || lower.includes("eli5") || lower.includes("plain english")) {
      mathematicalRigor = "informal";
    }

    // 4. Tune trait weights according to prompt keywords
    let traits = [...baseManifest.traits];
    if (lower.includes("concise") || lower.includes("terse") || lower.includes("brief")) {
      traits = this.adjustTrait(traits, "trait-conciseness", 0.9);
    } else if (lower.includes("friendly") || lower.includes("warm") || lower.includes("patient")) {
      traits = this.adjustTrait(traits, "trait-conciseness", 0.4);
      traits = this.adjustTrait(traits, "trait-socratic-inquiry", 0.85);
    }

    if (lower.includes("code") || lower.includes("technical") || lower.includes("engineer")) {
      traits = this.adjustTrait(traits, "trait-code-density", 0.85);
      traits = this.adjustTrait(traits, "trait-execution-velocity", 0.85);
    }

    if (lower.includes("rigor") || lower.includes("strict") || lower.includes("verify") || lower.includes("proof")) {
      traits = this.adjustTrait(traits, "trait-formal-rigor", 0.95);
      traits = this.adjustTrait(traits, "trait-adversarial-testing", 0.85);
    }

    if (lower.includes("creative") || lower.includes("idea") || lower.includes("brainstorm")) {
      traits = this.adjustTrait(traits, "trait-socratic-inquiry", 0.8);
      traits = this.adjustTrait(traits, "trait-formal-rigor", 0.3);
    }

    // 5. Synthesize Domain Axioms & System Prompt
    const customName = options.name || this.deriveNameFromPrompt(prompt, archetype);
    const customSummary = prompt.slice(0, 140);
    const addedAxioms: SoulAxiom[] = [];

    if (lower.includes("never") || lower.includes("always") || lower.includes("must")) {
      const sentenceMatches = prompt.match(/[^.!?]+(?:never|always|must)[^.!?]+/gi);
      if (sentenceMatches) {
        sentenceMatches.slice(0, 2).forEach((stmt, idx) => {
          addedAxioms.push({
            id: `axiom-custom-${idx + 1}`,
            statement: stmt.trim(),
            priority: 2,
            isImmutable: true,
            category: "safety",
            rationale: "User customized operational invariant",
          });
        });
      }
    }

    let manifest: SoulManifest = {
      id: options.targetProfileId ? `soul-${options.targetProfileId}` : `soul-${Date.now()}`,
      name: customName,
      archetype,
      version: "1.0.0",
      summary: customSummary,
      axioms: Object.freeze([...baseManifest.axioms, ...addedAxioms]),
      traits: Object.freeze(traits),
      style: Object.freeze({ tone, verbosity, codePreference, mathematicalRigor }),
      rawBody: `## Identity Objective\n${prompt}\n\n## Operational Directive\nOperate as a specialized ${archetype} persona strictly adhering to user behavioral guidelines.`,
      updatedTick: 0,
      integrityHash: "",
    };

    // Apply any requested personality packs
    if (options.appliedPacks && options.appliedPacks.length > 0) {
      for (const packId of options.appliedPacks) {
        manifest = this.applyPersonalityPack(manifest, packId);
      }
    }

    const integrityHash = this.parser.computeSoulHash(manifest);
    return Object.freeze({ ...manifest, integrityHash });
  }

  // ---------------------------------------------------------------------------
  // 2. Interactive 5-Step Guided Wizard
  // ---------------------------------------------------------------------------

  getWizardQuestions(): readonly SoulWizardQuestion[] {
    return this.wizardQuestions;
  }

  buildFromWizard(answers: SoulWizardAnswers): SoulManifest {
    // 1. Map roleOrGoal to archetype
    let archetype: SoulArchetype = "custom_persona";
    const role = answers.roleOrGoal.toLowerCase();
    if (role.includes("tutor") || role.includes("mentor") || role.includes("teacher")) archetype = "socratic_mentor";
    else if (role.includes("coder") || role.includes("architect") || role.includes("engineer")) archetype = "game_engine_architect";
    else if (role.includes("security") || role.includes("auditor")) archetype = "security_sentinel";
    else if (role.includes("verifier") || role.includes("math")) archetype = "formal_verifier";
    else if (role.includes("critic") || role.includes("tester")) archetype = "autonomous_critic";
    else if (role.includes("executive") || role.includes("triage") || role.includes("assistant")) archetype = "executive_assistant";
    else if (role.includes("data") || role.includes("analyst")) archetype = "data_scientist";
    else if (role.includes("creative") || role.includes("writer") || role.includes("brainstormer")) archetype = "creative_collaborator";

    const baseManifest = this.parser.createDefaultSoulManifestForArchetype(archetype);

    // 2. Map vibe to tone & traits
    let tone: SoulStyleRules["tone"] = "collaborative";
    let verbosity: SoulStyleRules["verbosity"] = "balanced";
    let traits = [...baseManifest.traits];

    switch (answers.personalityVibe) {
      case "direct_efficient":
      case "ultra_concise":
        tone = "direct";
        verbosity = "terse";
        traits = this.adjustTrait(traits, "trait-conciseness", 0.95);
        break;
      case "warm_encouraging":
        tone = "collaborative";
        verbosity = "balanced";
        traits = this.adjustTrait(traits, "trait-conciseness", 0.4);
        traits = this.adjustTrait(traits, "trait-socratic-inquiry", 0.85);
        break;
      case "deep_analytical":
        tone = "analytical";
        verbosity = "detailed";
        traits = this.adjustTrait(traits, "trait-formal-rigor", 0.9);
        break;
      case "playful_witty":
        tone = "collaborative";
        verbosity = "balanced";
        traits = this.adjustTrait(traits, "trait-socratic-inquiry", 0.8);
        break;
      case "formal_executive":
        tone = "formal";
        verbosity = "terse";
        traits = this.adjustTrait(traits, "trait-conciseness", 0.85);
        break;
    }

    // 3. Map communication style
    let codePref: SoulStyleRules["codePreference"] = "typescript_strict";
    switch (answers.communicationStyle) {
      case "bullet_points":
        verbosity = "terse";
        break;
      case "step_by_step":
        verbosity = "detailed";
        break;
      case "code_first":
        codePref = "typescript_strict";
        traits = this.adjustTrait(traits, "trait-code-density", 0.9);
        break;
    }

    // 4. Strictness level
    let mathRigor: SoulStyleRules["mathematicalRigor"] = "informal";
    if (answers.strictnessLevel === "uncompromising") {
      mathRigor = "axiomatic";
      traits = this.adjustTrait(traits, "trait-formal-rigor", 0.95);
      traits = this.adjustTrait(traits, "trait-adversarial-testing", 0.9);
    } else if (answers.strictnessLevel === "balanced") {
      mathRigor = "rigorous";
    }

    // 5. Custom rules
    const addedAxioms: SoulAxiom[] = [];
    if (answers.customRules && answers.customRules.length > 0) {
      answers.customRules.forEach((rule, idx) => {
        if (rule.trim()) {
          addedAxioms.push({
            id: `axiom-rule-${idx + 1}`,
            statement: rule.trim(),
            priority: 2,
            isImmutable: true,
            category: "safety",
            rationale: "Custom rule defined in wizard",
          });
        }
      });
    }

    const name = answers.name || `Custom ${archetype.replace(/_/g, " ")}`;
    let manifest: SoulManifest = {
      id: `soul-custom-${Date.now()}`,
      name,
      archetype,
      version: "1.0.0",
      summary: `Wizard created persona for ${answers.roleOrGoal} (${answers.personalityVibe}).`,
      axioms: Object.freeze([...baseManifest.axioms, ...addedAxioms]),
      traits: Object.freeze(traits),
      style: Object.freeze({
        tone,
        verbosity,
        codePreference: codePref,
        mathematicalRigor: mathRigor,
      }),
      rawBody: `## Identity Objective\nRole: ${answers.roleOrGoal}\nVibe: ${answers.personalityVibe}\nFormat: ${answers.communicationStyle}`,
      updatedTick: 0,
      integrityHash: "",
    };

    // 6. Applied packs
    if (answers.appliedPacks && answers.appliedPacks.length > 0) {
      for (const packId of answers.appliedPacks) {
        manifest = this.applyPersonalityPack(manifest, packId);
      }
    }

    const integrityHash = this.parser.computeSoulHash(manifest);
    return Object.freeze({ ...manifest, integrityHash });
  }

  // ---------------------------------------------------------------------------
  // 3. Modular Personality Packs ("Power-Ups")
  // ---------------------------------------------------------------------------

  listPersonalityPacks(): readonly SoulPersonalityPack[] {
    return this.personalityPacks;
  }

  applyPersonalityPack(manifest: SoulManifest, packId: string): SoulManifest {
    const pack = this.personalityPacks.find((p) => p.id === packId || p.id.toLowerCase() === packId.toLowerCase());
    if (!pack) return manifest;

    let traits = [...manifest.traits];
    for (const adj of pack.traitAdjustments) {
      const idx = traits.findIndex((t) => t.id === adj.traitId);
      if (idx !== -1) {
        const cur = traits[idx];
        const newWeight = Math.min(cur.maxWeight, Math.max(cur.minWeight, Number((cur.weight + adj.weightDelta).toFixed(2))));
        traits[idx] = Object.freeze({ ...cur, weight: newWeight });
      }
    }

    const style = {
      ...manifest.style,
      ...pack.styleAdjustments,
    };

    const addedAxioms = pack.customAxioms ? [...pack.customAxioms] : [];
    const axioms = [...manifest.axioms];
    for (const ax of addedAxioms) {
      if (!axioms.some((a) => a.id === ax.id || a.statement === ax.statement)) {
        axioms.push(Object.freeze(ax));
      }
    }

    const rawBody = pack.samplePromptAddendum
      ? `${manifest.rawBody}\n\n### Personality Pack: ${pack.name}\n${pack.samplePromptAddendum}`
      : manifest.rawBody;

    const updated: SoulManifest = {
      ...manifest,
      traits: Object.freeze(traits),
      style: Object.freeze(style),
      axioms: Object.freeze(axioms),
      rawBody,
      updatedTick: manifest.updatedTick + 1,
      integrityHash: "",
    };

    const integrityHash = this.parser.computeSoulHash(updated);
    return Object.freeze({ ...updated, integrityHash });
  }

  // ---------------------------------------------------------------------------
  // 4. Clone & Modify ("Forking")
  // ---------------------------------------------------------------------------

  cloneAndModify(source: SoulManifest, tweaks: SoulCustomTweakSpec): SoulManifest {
    let traits = [...source.traits];
    if (tweaks.traits && tweaks.traits.length > 0) {
      for (const t of tweaks.traits) {
        const idx = traits.findIndex((item) => item.id === t.traitId);
        if (idx !== -1) {
          const cur = traits[idx];
          const clamped = Math.min(cur.maxWeight, Math.max(cur.minWeight, Number(t.weight.toFixed(2))));
          traits[idx] = Object.freeze({ ...cur, weight: clamped });
        }
      }
    }

    let axioms = [...source.axioms];
    if (tweaks.removedAxiomIds && tweaks.removedAxiomIds.length > 0) {
      axioms = axioms.filter((a) => a.isImmutable || !tweaks.removedAxiomIds!.includes(a.id));
    }
    if (tweaks.addedAxioms && tweaks.addedAxioms.length > 0) {
      for (const ax of tweaks.addedAxioms) {
        if (!axioms.some((a) => a.id === ax.id || a.statement === ax.statement)) {
          axioms.push(Object.freeze(ax));
        }
      }
    }

    const style: SoulStyleRules = {
      ...source.style,
      ...tweaks.style,
    };

    const name = tweaks.name || `${source.name} (Custom)`;
    const summary = tweaks.summary || source.summary;
    const archetype = tweaks.archetype || source.archetype;
    const rawBody = tweaks.rawBody !== undefined ? tweaks.rawBody : source.rawBody;

    const updated: SoulManifest = {
      id: `soul-fork-${Date.now()}`,
      name,
      archetype,
      version: "1.0.0",
      summary,
      axioms: Object.freeze(axioms),
      traits: Object.freeze(traits),
      style: Object.freeze(style),
      rawBody,
      updatedTick: 0,
      integrityHash: "",
    };

    const integrityHash = this.parser.computeSoulHash(updated);
    return Object.freeze({ ...updated, integrityHash });
  }

  // ---------------------------------------------------------------------------
  // 5. Persona Linter & 1-Click Auto-Fix ("Soul Doctor")
  // ---------------------------------------------------------------------------

  lintPersona(manifest: SoulManifest): SoulPersonaLintReport {
    const issues: SoulPersonaLintIssue[] = [];

    // Check 1: Terse vs Detailed conflict
    const conciseness = manifest.traits.find((t) => t.id === "trait-conciseness")?.weight || 0.5;
    if (conciseness >= 0.8 && manifest.style.verbosity === "detailed") {
      issues.push({
        id: "conflict-terse-detailed",
        severity: "warning",
        title: "Conciseness & Verbosity Contradiction",
        explanation: `Trait Conciseness is high (${conciseness}), but style verbosity is set to 'detailed'. The persona may exhibit mixed message lengths.`,
        affectedFields: ["traits.trait-conciseness", "style.verbosity"],
        suggestedFix: "Set style verbosity to 'terse' or lower Conciseness to 0.5.",
        autoFixable: true,
      });
    }

    // Check 2: High Formal Rigor with Informal Rigor Style
    const rigorTrait = manifest.traits.find((t) => t.id === "trait-formal-rigor")?.weight || 0.5;
    if (rigorTrait >= 0.8 && manifest.style.mathematicalRigor === "informal") {
      issues.push({
        id: "conflict-rigor-mismatch",
        severity: "warning",
        title: "Formal Rigor & Mathematical Style Disconnect",
        explanation: `Trait Formal Rigor is high (${rigorTrait}), but mathematical rigor style is 'informal'.`,
        affectedFields: ["traits.trait-formal-rigor", "style.mathematicalRigor"],
        suggestedFix: "Upgrade mathematical rigor style to 'axiomatic' or 'rigorous'.",
        autoFixable: true,
      });
    }

    // Check 3: Missing Immutable Safety Axioms
    const immutableSafety = manifest.axioms.filter((a) => a.isImmutable && (a.category === "safety" || a.category === "determinism"));
    if (immutableSafety.length < 2) {
      issues.push({
        id: "missing-safety-axioms",
        severity: "error",
        title: "Insufficient Immutable Safety Invariants",
        explanation: "The persona lacks standard deterministic safety invariants, exposing it to potential prompt drift or jailbreaks.",
        affectedFields: ["axioms"],
        suggestedFix: "Auto-inject baseline determinism and safety axioms.",
        autoFixable: true,
      });
    }

    // Check 4: Uncalibrated Under-Weighted Matrix
    const avgWeight = manifest.traits.length > 0
      ? manifest.traits.reduce((sum, t) => sum + t.weight, 0) / manifest.traits.length
      : 0;

    if (avgWeight < 0.25) {
      issues.push({
        id: "uncalibrated-low-weights",
        severity: "warning",
        title: "Under-Weighted Personality Matrix",
        explanation: `Average trait weight (${avgWeight.toFixed(2)}) is unusually low. The persona may lack distinct voice or problem-solving assertiveness.`,
        affectedFields: ["traits"],
        suggestedFix: "Rebalance trait weights toward baseline defaults (0.50 - 0.70).",
        autoFixable: true,
      });
    }

    // Check 5: Hash Out of Sync
    const computedHash = this.parser.computeSoulHash(manifest);
    if (manifest.integrityHash && computedHash !== manifest.integrityHash) {
      issues.push({
        id: "hash-integrity-mismatch",
        severity: "error",
        title: "Cryptographic SHA-256 Hash Out of Sync",
        explanation: "The integrityHash does not match the canonical hash computed from the manifest fields.",
        affectedFields: ["integrityHash"],
        suggestedFix: "Re-canonicalize and recompute the SHA-256 integrity hash.",
        autoFixable: true,
      });
    }

    const errorsCount = issues.filter((i) => i.severity === "error").length;
    const warningsCount = issues.filter((i) => i.severity === "warning").length;
    const isValid = errorsCount === 0;

    const penalty = errorsCount * 30 + warningsCount * 10;
    const overallCohesionScore = Math.max(0, 100 - penalty);

    let plainLanguageVerdict = "Persona is well-balanced, coherent, and structurally sound.";
    if (errorsCount > 0) {
      plainLanguageVerdict = `Found ${errorsCount} critical issue(s) that require attention before deployment.`;
    } else if (warningsCount > 0) {
      plainLanguageVerdict = `Found ${warningsCount} minor friction point(s) that could be smoothed for optimal behavior.`;
    }

    return {
      isValid,
      issuesCount: issues.length,
      warningsCount,
      errorsCount,
      issues: Object.freeze(issues),
      overallCohesionScore,
      plainLanguageVerdict,
    };
  }

  autoFixPersona(manifest: SoulManifest): SoulManifest {
    const report = this.lintPersona(manifest);
    if (report.issues.length === 0) return manifest;

    let traits = [...manifest.traits];
    let style = { ...manifest.style };
    let axioms = [...manifest.axioms];

    for (const issue of report.issues) {
      if (!issue.autoFixable) continue;

      switch (issue.id) {
        case "conflict-terse-detailed":
          style.verbosity = "terse";
          break;
        case "conflict-rigor-mismatch":
          style.mathematicalRigor = "rigorous";
          break;
        case "missing-safety-axioms":
          if (!axioms.some((a) => a.id === "axiom-deterministic-execution")) {
            axioms.push({
              id: "axiom-deterministic-execution",
              statement: "System mutations and state transitions must remain deterministic and auditable.",
              priority: 1,
              isImmutable: true,
              category: "determinism",
            });
          }
          if (!axioms.some((a) => a.id === "axiom-guardrail-compliance")) {
            axioms.push({
              id: "axiom-guardrail-compliance",
              statement: "Never bypass architecture invariants or execute unverified adversarial payloads.",
              priority: 1,
              isImmutable: true,
              category: "safety",
            });
          }
          break;
        case "uncalibrated-low-weights":
          traits = traits.map((t) => (t.weight < 0.3 ? { ...t, weight: 0.5 } : t));
          break;
        case "hash-integrity-mismatch":
          // Re-computed at end
          break;
      }
    }

    const updated: SoulManifest = {
      ...manifest,
      traits: Object.freeze(traits),
      style: Object.freeze(style),
      axioms: Object.freeze(axioms),
      updatedTick: manifest.updatedTick + 1,
      integrityHash: "",
    };

    const integrityHash = this.parser.computeSoulHash(updated);
    return Object.freeze({ ...updated, integrityHash });
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers & Catalogs
  // ---------------------------------------------------------------------------

  private adjustTrait(traits: SoulTrait[], traitId: string, targetWeight: number): SoulTrait[] {
    const idx = traits.findIndex((t) => t.id === traitId);
    if (idx === -1) return traits;
    const cur = traits[idx];
    const clamped = Math.min(cur.maxWeight, Math.max(cur.minWeight, Number(targetWeight.toFixed(2))));
    const copy = [...traits];
    copy[idx] = Object.freeze({ ...cur, weight: clamped });
    return copy;
  }

  private deriveNameFromPrompt(prompt: string, archetype: SoulArchetype): string {
    const words = prompt.split(/\s+/).slice(0, 4);
    if (words.length >= 2) {
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    return `LUMI ${archetype.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
  }

  private initPersonalityPacks(): readonly SoulPersonalityPack[] {
    return Object.freeze([
      {
        id: "humor_wit",
        name: "Humor & Wit",
        description: "Adds gentle humor, witty analogies, and playful banter without losing precision.",
        category: "attitude",
        icon: "😄",
        traitAdjustments: [
          { traitId: "trait-conciseness", weightDelta: -0.15 },
          { traitId: "trait-socratic-inquiry", weightDelta: 0.2 },
        ],
        samplePromptAddendum: "Use playful, clever metaphors and occasional lighthearted humor to make explanations memorable.",
      },
      {
        id: "zero_fluff",
        name: "Zero-Fluff / High Precision",
        description: "Strikes all preamble, conversational fillers, and pleasantries. Direct answers only.",
        category: "communication",
        icon: "⚡",
        traitAdjustments: [
          { traitId: "trait-conciseness", weightDelta: 0.35 },
          { traitId: "trait-execution-velocity", weightDelta: 0.2 },
        ],
        styleAdjustments: { tone: "direct", verbosity: "terse" },
        samplePromptAddendum: "Never include pleasantries, greetings, or conversational filler. Provide direct, high-density answers immediately.",
      },
      {
        id: "math_rigor",
        name: "Mathematical & Axiomatic Rigor",
        description: "Elevates proof checking, formal invariant assertions, and step-by-step logic.",
        category: "expertise",
        icon: "📐",
        traitAdjustments: [
          { traitId: "trait-formal-rigor", weightDelta: 0.35 },
          { traitId: "trait-adversarial-testing", weightDelta: 0.2 },
        ],
        styleAdjustments: { mathematicalRigor: "axiomatic" },
        samplePromptAddendum: "State explicit axioms, formal proof sketches, and mathematical boundary constraints for all conclusions.",
      },
      {
        id: "eli5_simplicity",
        name: "ELI5 / Plain English",
        description: "Demystifies jargon, using intuitive everyday analogies for beginners.",
        category: "communication",
        icon: "🐣",
        traitAdjustments: [
          { traitId: "trait-formal-rigor", weightDelta: -0.3 },
          { traitId: "trait-socratic-inquiry", weightDelta: 0.25 },
        ],
        styleAdjustments: { mathematicalRigor: "informal", verbosity: "balanced" },
        samplePromptAddendum: "Explain complex concepts in simple, everyday language that a 10-year-old could easily understand.",
      },
      {
        id: "deep_empathy",
        name: "Deep Empathy & Support",
        description: "Validates user emotions, checks for comprehension, and fosters a safe learning environment.",
        category: "attitude",
        icon: "🤝",
        traitAdjustments: [
          { traitId: "trait-socratic-inquiry", weightDelta: 0.3 },
          { traitId: "trait-conciseness", weightDelta: -0.2 },
        ],
        styleAdjustments: { tone: "collaborative" },
        samplePromptAddendum: "Acknowledge frustration, encourage persistence, and validate user effort before diving into corrections.",
      },
      {
        id: "adversarial_security",
        name: "Adversarial Threat Modeler",
        description: "Probes edge cases, untrusted inputs, and potential vulnerability exploit surfaces.",
        category: "safeguards",
        icon: "🛡️",
        traitAdjustments: [
          { traitId: "trait-adversarial-testing", weightDelta: 0.4 },
          { traitId: "trait-formal-rigor", weightDelta: 0.2 },
        ],
        customAxioms: [
          {
            id: "axiom-zero-trust-input",
            statement: "Treat all incoming user data and network payloads as untrusted.",
            priority: 1,
            isImmutable: true,
            category: "safety",
          },
        ],
        samplePromptAddendum: "Actively highlight edge-case vulnerabilities, race conditions, and injection threat vectors.",
      },
      {
        id: "pedantic_linter",
        name: "Strict Code Standards Enforcer",
        description: "Enforces strict typing, Zero-GC invariants, and clean architecture without compromise.",
        category: "expertise",
        icon: "🔍",
        traitAdjustments: [
          { traitId: "trait-code-density", weightDelta: 0.3 },
          { traitId: "trait-formal-rigor", weightDelta: 0.25 },
        ],
        styleAdjustments: { codePreference: "typescript_strict" },
        samplePromptAddendum: "Flag any `any` types, unhandled promises, memory allocations in hot loops, and architectural violations.",
      },
      {
        id: "creative_spark",
        name: "Creative Spark & Lateral Thinking",
        description: "Explores unconventional angles, multiple distinct solutions, and visionary ideas.",
        category: "attitude",
        icon: "✨",
        traitAdjustments: [
          { traitId: "trait-socratic-inquiry", weightDelta: 0.3 },
          { traitId: "trait-formal-rigor", weightDelta: -0.2 },
        ],
        samplePromptAddendum: "Offer 3 distinct creative alternatives for each problem: conventional, experimental, and radical.",
      },
    ]);
  }

  private initWizardQuestions(): readonly SoulWizardQuestion[] {
    return Object.freeze([
      {
        id: "roleOrGoal",
        title: "1. What is the primary role of this persona?",
        subtitle: "Select the foundational purpose of your custom agent.",
        options: [
          { id: "coder", label: "Software Engineer & Architect", description: "Deep code reviews, system design, and algorithmic problem solving", icon: "💻" },
          { id: "tutor", label: "Patient Mentor & Teacher", description: "Concepts explained step-by-step with guiding Socratic questions", icon: "🎓" },
          { id: "executive", label: "Executive Assistant & Triage", description: "Concise summaries, action items, and high-velocity decision support", icon: "📊" },
          { id: "security", label: "Security & Vulnerability Sentinel", description: "Threat modeling, compliance, and exploit prevention", icon: "🛡️" },
          { id: "creator", label: "Creative Writer & Brainstormer", description: "Lateral thinking, storytelling, and imaginative ideation", icon: "🎨" },
          { id: "analyst", label: "Data Scientist & Telemetry Forensics", description: "Statistical rigor, metrics analysis, and empirical diagnostics", icon: "📈" },
        ],
      },
      {
        id: "personalityVibe",
        title: "2. How should this persona sound and feel?",
        subtitle: "Choose the overall tone and conversational attitude.",
        options: [
          { id: "warm_encouraging", label: "Warm & Encouraging", description: "Friendly, supportive, patient, and conversational", icon: "🌱" },
          { id: "direct_efficient", label: "Direct & Efficient", description: "Minimal preamble, dense information, zero fluff", icon: "⚡" },
          { id: "deep_analytical", label: "Deep & Analytical", description: "Thorough, structured, academic, and detailed", icon: "🔬" },
          { id: "playful_witty", label: "Playful & Witty", description: "Clever analogies, light humor, and engaging banter", icon: "✨" },
          { id: "formal_executive", label: "Formal & Executive", description: "Polished, professional, authoritative, and boardroom-ready", icon: "🏛️" },
        ],
      },
      {
        id: "communicationStyle",
        title: "3. What communication format do you prefer?",
        subtitle: "Pick how answers are structured.",
        options: [
          { id: "bullet_points", label: "Bullet Points & Key Takeaways", description: "Fast to scan, structured headers, and prioritized lists", icon: "📝" },
          { id: "step_by_step", label: "Step-by-Step Walkthroughs", description: "Detailed numbered steps with explanations of rationale", icon: "🪜" },
          { id: "conversational", label: "Natural Conversational Paragraphs", description: "Fluid, story-like flow with contextual explanations", icon: "💬" },
          { id: "code_first", label: "Code-First with Minimal Prose", description: "Ready-to-run copy-paste snippets with inline comments", icon: "🚀" },
        ],
      },
      {
        id: "strictnessLevel",
        title: "4. How strict should safety and rule enforcement be?",
        subtitle: "Set the operational boundary rigor.",
        options: [
          { id: "balanced", label: "Balanced & Practical (Recommended)", description: "Standard safety invariants with flexible problem-solving", icon: "⚖️" },
          { id: "uncompromising", label: "Uncompromising Axiomatic Rigor", description: "Zero tolerance for unverified assumptions or security risks", icon: "🔒" },
          { id: "flexible", label: "Casual & Permissive", description: "Low barrier to entry for casual exploration and ideation", icon: "🎈" },
        ],
      },
      {
        id: "appliedPacks",
        title: "5. Select any optional Personality Power-Up Packs",
        subtitle: "Mix and match specialized trait bundles.",
        isMultiSelect: true,
        options: [
          { id: "humor_wit", label: "Humor & Wit", description: "Lighthearted metaphors and engaging banter", icon: "😄" },
          { id: "zero_fluff", label: "Zero-Fluff", description: "Strips all greetings and filler words", icon: "⚡" },
          { id: "math_rigor", label: "Math & Logic Rigor", description: "Axiomatic proof sketches and formal constraints", icon: "📐" },
          { id: "eli5_simplicity", label: "ELI5 Explainer", description: "Demystifies jargon into plain English", icon: "🐣" },
          { id: "adversarial_security", label: "Security Sentinel", description: "Probes vulnerabilities and edge-case attacks", icon: "🛡️" },
          { id: "pedantic_linter", label: "Strict Code Standards", description: "Enforces strict typing and zero-GC invariants", icon: "🔍" },
        ],
      },
    ]);
  }
}
