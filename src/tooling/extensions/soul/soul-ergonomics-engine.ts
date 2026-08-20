import type {
  SoulArchetype,
  SoulDiffEntry,
  SoulDiffReport,
  SoulFuzzyMatchSuggestion,
  SoulManifest,
  SoulPresetBundle,
  SoulPresetCategory,
  SoulStyleRules,
  SoulTaxonomyNode,
  SoulTrait,
} from "../../../core/contracts/soul.contracts.js";

/**
 * SoulErgonomicsEngine.
 * Formalized under SOUL-001 & ADR-014.
 *
 * Implements non-technical navigation ergonomics, natural query synonym resolution,
 * Levenshtein fuzzy distance matching, standard persona preset bundles, hierarchical taxonomy,
 * and plain-English explainability / narrative diff generation.
 */
export class SoulErgonomicsEngine {
  /**
   * Predefined standard persona presets mirroring leading industry platforms.
   */
  private readonly presetCatalog: readonly SoulPresetBundle[] = [
    {
      id: "executive_briefing",
      name: "Executive Briefing",
      description: "High-density, terse executive summaries with structured key takeaways and zero conversational filler.",
      archetype: "executive_assistant",
      category: "productivity",
      icon: "💼",
      targetTraits: [
        { traitId: "trait-conciseness", weight: 0.95 },
        { traitId: "trait-code-density", weight: 0.8 },
        { traitId: "trait-forensic-skepticism", weight: 0.85 },
      ],
      targetStyle: {
        tone: "direct",
        verbosity: "terse",
        codePreference: "minimal_diff",
        mathematicalRigor: "informal",
      },
      recommendedFor: ["C-Suite briefings", "Morning standups", "Action item extraction"],
    },
    {
      id: "socratic_mentor",
      name: "Socratic Mentor",
      description: "Pedagogical, patient guidance that breaks complex concepts down step-by-step with intuitive analogies.",
      archetype: "socratic_mentor",
      category: "education",
      icon: "🎓",
      targetTraits: [
        { traitId: "trait-conciseness", weight: 0.5 },
        { traitId: "trait-mathematical-rigor", weight: 0.75 },
        { traitId: "trait-forensic-skepticism", weight: 0.7 },
      ],
      targetStyle: {
        tone: "collaborative",
        verbosity: "balanced",
        codePreference: "typescript_strict",
        mathematicalRigor: "rigorous",
      },
      recommendedFor: ["Code onboarding", "Architecture walkthroughs", "Algorithmic tutoring"],
    },
    {
      id: "deep_code_review",
      name: "Deep Code Reviewer",
      description: "Maximum forensic rigor, strict TypeScript type validation, zero-GC assertion, and line-anchored patch checks.",
      archetype: "formal_verifier",
      category: "engineering",
      icon: "🔍",
      targetTraits: [
        { traitId: "trait-code-density", weight: 0.98 },
        { traitId: "trait-forensic-skepticism", weight: 0.95 },
        { traitId: "trait-mathematical-rigor", weight: 0.9 },
        { traitId: "trait-conciseness", weight: 0.85 },
      ],
      targetStyle: {
        tone: "analytical",
        verbosity: "terse",
        codePreference: "idiomatic_zero_gc",
        mathematicalRigor: "axiomatic",
      },
      recommendedFor: ["Security audits", "PR reviews", "SLA compliance verification"],
    },
    {
      id: "creative_brainstorm",
      name: "Creative Brainstormer",
      description: "Exploratory, divergent ideation with alternative design patterns, expansive trade-off analysis, and product insights.",
      archetype: "creative_collaborator",
      category: "creative",
      icon: "💡",
      targetTraits: [
        { traitId: "trait-conciseness", weight: 0.4 },
        { traitId: "trait-forensic-skepticism", weight: 0.5 },
        { traitId: "trait-code-density", weight: 0.7 },
      ],
      targetStyle: {
        tone: "collaborative",
        verbosity: "detailed",
        codePreference: "minimal_diff",
        mathematicalRigor: "informal",
      },
      recommendedFor: ["System design ideation", "RFC drafting", "Feature brainstorms"],
    },
    {
      id: "security_sentinel",
      name: "Security Sentinel",
      description: "Defensive perimeter enforcement, prompt injection scanning, Trojan Unicode stripping, and hard safety invariant checks.",
      archetype: "security_sentinel",
      category: "compliance",
      icon: "🛡️",
      targetTraits: [
        { traitId: "trait-forensic-skepticism", weight: 1.0 },
        { traitId: "trait-mathematical-rigor", weight: 0.95 },
        { traitId: "trait-code-density", weight: 0.9 },
        { traitId: "trait-conciseness", weight: 0.9 },
      ],
      targetStyle: {
        tone: "formal",
        verbosity: "terse",
        codePreference: "typescript_strict",
        mathematicalRigor: "axiomatic",
      },
      recommendedFor: ["Penetration testing", "Access boundary checks", "Secret leak prevention"],
    },
    {
      id: "eli5_explainer",
      name: "ELI5 (Explain Like I'm 5)",
      description: "Zero jargon, warm supportive tone, simple metaphors, and highly accessible explanations for non-technical users.",
      archetype: "socratic_mentor",
      category: "education",
      icon: "🌱",
      targetTraits: [
        { traitId: "trait-conciseness", weight: 0.55 },
        { traitId: "trait-forensic-skepticism", weight: 0.5 },
        { traitId: "trait-code-density", weight: 0.4 },
      ],
      targetStyle: {
        tone: "collaborative",
        verbosity: "balanced",
        codePreference: "minimal_diff",
        mathematicalRigor: "informal",
      },
      recommendedFor: ["Non-technical stakeholders", "Product managers", "General learning"],
    },
    {
      id: "zen_focus",
      name: "Zen Fast-Execution",
      description: "Ultra-compact diffs, minimal text, instant execution, zero preamble, and pure focus on requested output.",
      archetype: "lumi_core",
      category: "productivity",
      icon: "⚡",
      targetTraits: [
        { traitId: "trait-conciseness", weight: 1.0 },
        { traitId: "trait-code-density", weight: 0.95 },
        { traitId: "trait-mathematical-rigor", weight: 0.8 },
      ],
      targetStyle: {
        tone: "direct",
        verbosity: "terse",
        codePreference: "typescript_strict",
        mathematicalRigor: "axiomatic",
      },
      recommendedFor: ["Rapid script editing", "Refactoring passes", "High-velocity development"],
    },
  ];

  /**
   * Natural query synonym dictionary mapping human phrases to canonical traits.
   */
  private readonly synonymMap: Record<string, { traitId: string; traitName: string; defaultTargetWeight: number }> = {
    // Conciseness
    brief: { traitId: "trait-conciseness", traitName: "Conciseness", defaultTargetWeight: 0.95 },
    brevity: { traitId: "trait-conciseness", traitName: "Conciseness", defaultTargetWeight: 0.95 },
    terse: { traitId: "trait-conciseness", traitName: "Conciseness", defaultTargetWeight: 0.95 },
    short: { traitId: "trait-conciseness", traitName: "Conciseness", defaultTargetWeight: 0.9 },
    direct: { traitId: "trait-conciseness", traitName: "Conciseness", defaultTargetWeight: 0.9 },
    concise: { traitId: "trait-conciseness", traitName: "Conciseness", defaultTargetWeight: 0.95 },
    compact: { traitId: "trait-conciseness", traitName: "Conciseness", defaultTargetWeight: 0.9 },
    quick: { traitId: "trait-conciseness", traitName: "Conciseness", defaultTargetWeight: 0.9 },
    fast: { traitId: "trait-conciseness", traitName: "Conciseness", defaultTargetWeight: 0.9 },

    // Code density
    code: { traitId: "trait-code-density", traitName: "Code Density", defaultTargetWeight: 0.95 },
    coding: { traitId: "trait-code-density", traitName: "Code Density", defaultTargetWeight: 0.95 },
    typescript: { traitId: "trait-code-density", traitName: "Code Density", defaultTargetWeight: 0.95 },
    syntax: { traitId: "trait-code-density", traitName: "Code Density", defaultTargetWeight: 0.9 },
    diffs: { traitId: "trait-code-density", traitName: "Code Density", defaultTargetWeight: 0.9 },
    implementation: { traitId: "trait-code-density", traitName: "Code Density", defaultTargetWeight: 0.95 },
    patches: { traitId: "trait-code-density", traitName: "Code Density", defaultTargetWeight: 0.9 },

    // Mathematical rigor
    math: { traitId: "trait-mathematical-rigor", traitName: "Mathematical Rigor", defaultTargetWeight: 0.9 },
    rigor: { traitId: "trait-mathematical-rigor", traitName: "Mathematical Rigor", defaultTargetWeight: 0.9 },
    rigorous: { traitId: "trait-mathematical-rigor", traitName: "Mathematical Rigor", defaultTargetWeight: 0.9 },
    formal: { traitId: "trait-mathematical-rigor", traitName: "Mathematical Rigor", defaultTargetWeight: 0.95 },
    axiomatic: { traitId: "trait-mathematical-rigor", traitName: "Mathematical Rigor", defaultTargetWeight: 0.95 },
    proofs: { traitId: "trait-mathematical-rigor", traitName: "Mathematical Rigor", defaultTargetWeight: 0.9 },
    logic: { traitId: "trait-mathematical-rigor", traitName: "Mathematical Rigor", defaultTargetWeight: 0.85 },
    invariants: { traitId: "trait-mathematical-rigor", traitName: "Mathematical Rigor", defaultTargetWeight: 0.95 },

    // Forensic skepticism
    skeptical: { traitId: "trait-forensic-skepticism", traitName: "Forensic Skepticism", defaultTargetWeight: 0.95 },
    skepticism: { traitId: "trait-forensic-skepticism", traitName: "Forensic Skepticism", defaultTargetWeight: 0.95 },
    verify: { traitId: "trait-forensic-skepticism", traitName: "Forensic Skepticism", defaultTargetWeight: 0.9 },
    critical: { traitId: "trait-forensic-skepticism", traitName: "Forensic Skepticism", defaultTargetWeight: 0.9 },
    audit: { traitId: "trait-forensic-skepticism", traitName: "Forensic Skepticism", defaultTargetWeight: 0.95 },
    forensic: { traitId: "trait-forensic-skepticism", traitName: "Forensic Skepticism", defaultTargetWeight: 0.95 },
    security: { traitId: "trait-forensic-skepticism", traitName: "Forensic Skepticism", defaultTargetWeight: 0.9 },
    scrutiny: { traitId: "trait-forensic-skepticism", traitName: "Forensic Skepticism", defaultTargetWeight: 0.9 },
  };

  /**
   * Computes Levenshtein edit distance between two strings.
   */
  public computeLevenshteinDistance(a: string, b: string): number {
    const s1 = a.toLowerCase();
    const s2 = b.toLowerCase();
    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    const matrix: number[][] = [];
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Computes string similarity score between 0.0 and 1.0.
   */
  public computeSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    const distance = this.computeLevenshteinDistance(a, b);
    return Math.max(0, 1 - distance / maxLen);
  }

  /**
   * Performs fuzzy natural language search over traits using synonyms and edit distance.
   */
  public searchTraitsFuzzy(query: string, manifestTraits: readonly SoulTrait[], limit = 5): readonly SoulFuzzyMatchSuggestion[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    const suggestions: SoulFuzzyMatchSuggestion[] = [];
    const seenTraitIds = new Set<string>();

    // 1. Direct synonym lookup
    if (this.synonymMap[normalized]) {
      const syn = this.synonymMap[normalized];
      suggestions.push({
        inputQuery: query,
        matchedTraitId: syn.traitId,
        matchedTraitName: syn.traitName,
        confidenceScore: 0.98,
        reason: `Direct synonym match for '${query}'`,
        suggestedWeight: syn.defaultTargetWeight,
      });
      seenTraitIds.add(syn.traitId);
    }

    // 2. Token-level synonym and trait matching
    const tokens = normalized.split(/[\s,._-]+/).filter(Boolean);
    for (const token of tokens) {
      if (this.synonymMap[token] && !seenTraitIds.has(this.synonymMap[token].traitId)) {
        const syn = this.synonymMap[token];
        suggestions.push({
          inputQuery: query,
          matchedTraitId: syn.traitId,
          matchedTraitName: syn.traitName,
          confidenceScore: 0.9,
          reason: `Keyword match on token '${token}'`,
          suggestedWeight: syn.defaultTargetWeight,
        });
        seenTraitIds.add(syn.traitId);
      }
    }

    // 3. Fuzzy similarity against active traits (ID, Name, Description)
    for (const trait of manifestTraits) {
      if (seenTraitIds.has(trait.id)) continue;

      const idSim = this.computeSimilarity(normalized, trait.id.replace("trait-", ""));
      const nameSim = this.computeSimilarity(normalized, trait.name);

      const bestSim = Math.max(idSim, nameSim);
      if (bestSim >= 0.55) {
        suggestions.push({
          inputQuery: query,
          matchedTraitId: trait.id,
          matchedTraitName: trait.name,
          confidenceScore: Number(bestSim.toFixed(2)),
          reason: bestSim >= 0.8 ? `Strong fuzzy match on '${trait.name}'` : `Fuzzy similarity match on '${trait.name}'`,
          suggestedWeight: trait.weight,
        });
        seenTraitIds.add(trait.id);
      }
    }

    // Sort by confidence descending
    suggestions.sort((a, b) => b.confidenceScore - a.confidenceScore);
    return suggestions.slice(0, limit);
  }

  /**
   * Generates "Did you mean?" suggestions for non-technical user typo tolerance.
   */
  public suggestCorrections(query: string, manifestTraits: readonly SoulTrait[]): readonly string[] {
    const fuzzy = this.searchTraitsFuzzy(query, manifestTraits, 3);
    return fuzzy.map((f) => `Did you mean '${f.matchedTraitName}' (${f.matchedTraitId})? [Confidence: ${Math.round(f.confidenceScore * 100)}%]`);
  }

  /**
   * Lists available preset bundles, optionally filtered by category.
   */
  public listPresets(category?: SoulPresetCategory): readonly SoulPresetBundle[] {
    if (!category) {
      return this.presetCatalog;
    }
    return this.presetCatalog.filter((p) => p.category === category);
  }

  /**
   * Gets a specific preset bundle by ID.
   */
  public getPresetById(presetId: string): SoulPresetBundle | undefined {
    return this.presetCatalog.find((p) => p.id === presetId || p.name.toLowerCase() === presetId.toLowerCase());
  }

  /**
   * Builds the comprehensive 3-level hierarchical taxonomy.
   */
  public getTaxonomy(): readonly SoulTaxonomyNode[] {
    return [
      {
        dimension: "Communication Style & Brevity",
        category: "communication",
        description: "Controls the density of language, pacing, conversational filler, and brevity.",
        traits: [
          {
            id: "trait-conciseness",
            name: "Conciseness",
            description: "Preference for terse, direct technical explanations over verbose conversational filler.",
            nonTechnicalSummary: "How short and to-the-point the AI is. High conciseness avoids fluff.",
            defaultWeight: 0.9,
            sliderRecommendation: "Set to 0.95 for rapid developer workflows; 0.50 for beginner learning.",
            commonSynonyms: ["brevity", "terse", "short", "compact", "brief"],
          },
        ],
      },
      {
        dimension: "Cognition & Logical Rigor",
        category: "cognition",
        description: "Governs formal mathematical proofs, time complexity analysis, and algorithmic discipline.",
        traits: [
          {
            id: "trait-mathematical-rigor",
            name: "Mathematical Rigor",
            description: "Formalization of algorithmic properties, time complexities, and invariant proofs.",
            nonTechnicalSummary: "How strictly the AI validates math, algorithms, and logical proofs.",
            defaultWeight: 0.85,
            sliderRecommendation: "Set to 0.90 for mission-critical core engines; 0.40 for casual apps.",
            commonSynonyms: ["math", "rigor", "proofs", "logic", "formal"],
          },
        ],
      },
      {
        dimension: "Execution & Code Output",
        category: "execution",
        description: "Dictates the balance between working code diffs vs conceptual prose.",
        traits: [
          {
            id: "trait-code-density",
            name: "Code Density",
            description: "Priority of concrete TypeScript code and exact diffs over conceptual prose.",
            nonTechnicalSummary: "How much actual code the AI outputs vs talking about code.",
            defaultWeight: 0.95,
            sliderRecommendation: "Keep above 0.90 for high-efficiency programming tasks.",
            commonSynonyms: ["coding", "syntax", "implementation", "diffs"],
          },
        ],
      },
      {
        dimension: "Behavior & Forensic Scrutiny",
        category: "behavior",
        description: "Defines the agent's critical stance, skepticism toward unverified claims, and security vigilance.",
        traits: [
          {
            id: "trait-forensic-skepticism",
            name: "Forensic Skepticism",
            description: "Critical evaluation of unproven claims, verify before accepting assertions.",
            nonTechnicalSummary: "How thoroughly the AI questions unverified assumptions and verifies reality.",
            defaultWeight: 0.9,
            sliderRecommendation: "Set to 0.95 for code reviews and security audits.",
            commonSynonyms: ["skeptical", "verify", "audit", "security", "scrutiny"],
          },
        ],
      },
    ];
  }

  /**
   * Generates a plain-English explainability diff report between two manifests.
   */
  public generateDiffReport(previousManifest: SoulManifest, currentManifest: SoulManifest): SoulDiffReport {
    const entries: SoulDiffEntry[] = [];

    // 1. Archetype Change
    if (previousManifest.archetype !== currentManifest.archetype) {
      entries.push({
        target: "archetype",
        identifier: "archetype",
        oldValue: previousManifest.archetype,
        newValue: currentManifest.archetype,
        plainEnglishNarrative: `Switched agent archetype from '${previousManifest.archetype}' to '${currentManifest.archetype}' (Agent persona re-oriented).`,
        impact: "significant",
      });
    }

    // 2. Trait Adjustments
    const prevTraitMap = new Map(previousManifest.traits.map((t) => [t.id, t]));
    for (const currTrait of currentManifest.traits) {
      const prevTrait = prevTraitMap.get(currTrait.id);
      if (!prevTrait) {
        entries.push({
          target: "trait",
          identifier: currTrait.id,
          oldValue: undefined,
          newValue: currTrait.weight,
          plainEnglishNarrative: `Added new dynamic trait '${currTrait.name}' initialized at weight ${currTrait.weight}.`,
          impact: "moderate",
        });
      } else if (Math.abs(prevTrait.weight - currTrait.weight) >= 0.01) {
        const delta = currTrait.weight - prevTrait.weight;
        const sign = delta > 0 ? "+" : "";
        const percent = Math.round(delta * 100);
        let impact: SoulDiffEntry["impact"] = "subtle";
        if (Math.abs(delta) >= 0.25) impact = "significant";
        else if (Math.abs(delta) >= 0.1) impact = "moderate";

        let behavioralExplanation = "";
        if (currTrait.id === "trait-conciseness") {
          behavioralExplanation = delta > 0 ? "Agent will be more direct with shorter explanations." : "Agent will provide more detailed contextual prose.";
        } else if (currTrait.id === "trait-code-density") {
          behavioralExplanation = delta > 0 ? "Agent will prioritize complete code diffs over explanations." : "Agent will explain logic in prose before code.";
        } else if (currTrait.id === "trait-forensic-skepticism") {
          behavioralExplanation = delta > 0 ? "Agent will more critically challenge unverified assertions." : "Agent will be more accepting of premise assumptions.";
        } else {
          behavioralExplanation = `Behavior calibrated by ${sign}${percent}%.`;
        }

        entries.push({
          target: "trait",
          identifier: currTrait.id,
          oldValue: prevTrait.weight,
          newValue: currTrait.weight,
          plainEnglishNarrative: `Tuned '${currTrait.name}' from ${prevTrait.weight.toFixed(2)} to ${currTrait.weight.toFixed(2)} (${sign}${percent}%). ${behavioralExplanation}`,
          impact,
        });
      }
    }

    // 3. Style Directives
    const prevStyle = previousManifest.style;
    const currStyle = currentManifest.style;
    if (prevStyle.tone !== currStyle.tone) {
      entries.push({
        target: "style",
        identifier: "tone",
        oldValue: prevStyle.tone,
        newValue: currStyle.tone,
        plainEnglishNarrative: `Adjusted communication tone from '${prevStyle.tone}' to '${currStyle.tone}'.`,
        impact: "moderate",
      });
    }
    if (prevStyle.verbosity !== currStyle.verbosity) {
      entries.push({
        target: "style",
        identifier: "verbosity",
        oldValue: prevStyle.verbosity,
        newValue: currStyle.verbosity,
        plainEnglishNarrative: `Changed response verbosity from '${prevStyle.verbosity}' to '${currStyle.verbosity}'.`,
        impact: "moderate",
      });
    }

    // 4. Axioms Added
    const prevAxiomIds = new Set(previousManifest.axioms.map((a) => a.id));
    for (const currAxiom of currentManifest.axioms) {
      if (!prevAxiomIds.has(currAxiom.id)) {
        entries.push({
          target: "axiom",
          identifier: currAxiom.id,
          oldValue: undefined,
          newValue: currAxiom.statement,
          plainEnglishNarrative: `Adopted new operational axiom [P${currAxiom.priority}]: "${currAxiom.statement}".`,
          impact: "significant",
        });
      }
    }

    // Construct high-level summary narrative
    let summaryNarrative = "";
    if (entries.length === 0) {
      summaryNarrative = "No detectable behavioral changes between soul manifests.";
    } else {
      const count = entries.length;
      const significantCount = entries.filter((e) => e.impact === "significant").length;
      summaryNarrative = `SOUL Manifest updated with ${count} change${count > 1 ? "s" : ""} (${significantCount} significant shift${significantCount === 1 ? "" : "s"}).`;
    }

    return {
      fromHash: previousManifest.integrityHash,
      toHash: currentManifest.integrityHash,
      timestamp: Date.now(),
      entries,
      summaryNarrative,
    };
  }
}
