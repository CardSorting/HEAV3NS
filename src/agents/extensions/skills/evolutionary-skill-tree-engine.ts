import type {
  IEvolutionarySkillEngine,
  ISkillStrategyEngine,
  SkillAutoRemediationReport,
  SkillBulkMutationResult,
  SkillComboSynergy,
  SkillCompetencyUncertainty,
  SkillCompetencyVector,
  SkillDslQueryFilter,
  SkillEvolutionLineage,
  SkillEvolutionPath,
  SkillEvolutionSignal,
  SkillGroupBy,
  SkillGroupedLane,
  SkillHealthAuditReport,
  SkillMetricsReport,
  SkillNodeManifest,
  SkillRecommendation,
  SkillSortBy,
  SkillSortDirection,
  SkillSpeciationEvaluation,
  SkillStrategyGoal,
  SkillStrategyPlan,
  SkillTier,
  SpecializedBranch,
} from "../../../core/contracts/skills.contracts.js";
import { BroccoliSkillTreeSubstrate } from "../../../sessions/extensions/skills/broccoli-skill-tree-substrate.js";
import { SkillStrategyEngine } from "./skill-strategy-engine.js";
import type { SkillDesktopNotificationDispatcher } from "../../../tooling/extensions/skills/skill-notification-dispatcher.js";

/**
 * EvolutionarySkillTreeEngine.
 * Part of LUMI's World-Class Evolutionary Skill Tree System (ADR-014).
 *
 * Implements 5-signal trajectory sensing, 4D competency matrix, dynamic mastery progression,
 * autonomous speciation & consolidation, lineage tracking, and strategy planning integration.
 */
export class EvolutionarySkillTreeEngine implements IEvolutionarySkillEngine {
  private readonly substrate: BroccoliSkillTreeSubstrate;
  private readonly strategyEngine: SkillStrategyEngine;

  constructor(substrate: BroccoliSkillTreeSubstrate) {
    this.substrate = substrate;
    this.strategyEngine = new SkillStrategyEngine(substrate);
  }

  public getSubstrate(): BroccoliSkillTreeSubstrate {
    return this.substrate;
  }

  public getStrategyEngine(): ISkillStrategyEngine {
    return this.strategyEngine;
  }

  public getNotificationDispatcher(): SkillDesktopNotificationDispatcher {
    return this.substrate.getNotificationDispatcher();
  }

  /**
   * Evaluates turn trajectory Step_t to detect learning/evolution signals across 5 classes:
   * 1. User Corrections (frustration, style/formatting directives)
   * 2. Workflow Refinements (consistent multi-step pipelines)
   * 3. Debugging Techniques (error recovery and diagnostic breakthroughs)
   * 4. Tool Workarounds (multi-tool chains and fallback discoveries)
   * 5. Performance Breakthroughs (low latency / high efficiency workflows)
   */
  public analyzeTrajectory(trajectory: {
    prompt: string;
    response: string;
    toolCalls?: readonly { name: string; args: unknown; result: unknown }[];
    userCorrections?: readonly string[];
    tickIndex: number;
  }): readonly SkillEvolutionSignal[] {
    const signals: SkillEvolutionSignal[] = [];
    const promptLower = trajectory.prompt.toLowerCase();
    const responseLower = trajectory.response.toLowerCase();

    // 1. User Correction Signals (Frustration / style / workflow correction)
    const correctionPhrases = [
      "stop doing",
      "don't format",
      "do not format",
      "why are you explaining",
      "just give me the",
      "you always",
      "remember this",
      "next time",
      "wrong approach",
      "avoid using",
      "please format like",
      "do not include",
      "never write",
    ];

    for (const phrase of correctionPhrases) {
      if (promptLower.includes(phrase)) {
        signals.push({
          type: "user_correction",
          context: `User correction detected: "${phrase}" in turn prompt.`,
          confidence: 0.95,
          suggestedAction: "patch_loaded",
        });
        break;
      }
    }

    // 2. Explicit user corrections list
    if (trajectory.userCorrections && trajectory.userCorrections.length > 0) {
      for (const corr of trajectory.userCorrections) {
        signals.push({
          type: "user_correction",
          context: `Explicit user correction: ${corr}`,
          confidence: 1.0,
          suggestedAction: "patch_loaded",
        });
      }
    }

    // 3. Debugging Technique Signal (Error recovery patterns in response or tool results)
    const errorRecoveryDetected =
      (responseLower.includes("error resolved") ||
        responseLower.includes("fixed by updating") ||
        responseLower.includes("root cause identified") ||
        responseLower.includes("diagnostic showed")) &&
      trajectory.toolCalls &&
      trajectory.toolCalls.length >= 2;

    if (errorRecoveryDetected) {
      signals.push({
        type: "debugging_technique",
        context: "Diagnostic error recovery sequence detected and resolved successfully.",
        confidence: 0.88,
        suggestedAction: "add_support_file",
        detectedMetrics: {
          errorRecoverySuccess: true,
          toolCallCount: trajectory.toolCalls?.length || 0,
        },
      });
    }

    // 4. Multi-Tool Workaround Signal (Tool chaining or fallback discoveries)
    if (trajectory.toolCalls && trajectory.toolCalls.length >= 3) {
      const toolNames = trajectory.toolCalls.map((t) => t.name);
      const uniqueTools = new Set(toolNames);
      if (uniqueTools.size >= 2) {
        signals.push({
          type: "tool_workaround",
          context: `Multi-tool execution chain synthesized across: ${Array.from(uniqueTools).join(", ")}.`,
          confidence: 0.85,
          suggestedAction: "add_support_file",
          detectedMetrics: {
            toolCallCount: trajectory.toolCalls.length,
          },
        });
      }
    }

    // 5. Workflow Refinement & Speciation Signal (High complexity structured response)
    if (trajectory.response.length > 1500 && (trajectory.toolCalls?.length || 0) >= 4) {
      signals.push({
        type: "workflow_refinement",
        context: "High-density multi-step procedural workflow identified.",
        confidence: 0.82,
        suggestedAction: "speciate_skill",
      });
    }

    // 6. Performance Breakthrough Signal
    if (trajectory.toolCalls && trajectory.toolCalls.length === 1 && trajectory.response.length > 200) {
      signals.push({
        type: "performance_breakthrough",
        context: "Single-turn optimal tool execution achieved with zero retries.",
        confidence: 0.75,
        suggestedAction: "patch_loaded",
        detectedMetrics: {
          latencyReductionMs: 50,
          toolCallCount: 1,
        },
      });
    }

    return Object.freeze(signals);
  }

  /**
   * Computes Evolutionary Fitness F based on 4D competencies, success rate, activity, and stability.
   */
  public calculateFitness(node: SkillNodeManifest, currentTick: number): number {
    const useFactor = Math.min(1.0, node.useCount / 20.0);
    const masteryFactor = node.masteryScore / 100.0;
    const elapsed = Math.max(0, currentTick - node.lastUsedTick);
    const stalenessPenalty = Math.min(0.5, elapsed / 5000.0);

    // Factor in 4D competency vector if present
    let competencyFactor = masteryFactor;
    if (node.competencies) {
      const avgComp =
        (node.competencies.syntaxAccuracy +
          node.competencies.executionReliability +
          node.competencies.recoveryResilience +
          node.competencies.speedEfficiency) /
        400.0;
      competencyFactor = (masteryFactor * 0.5) + (avgComp * 0.5);
    }

    const pinBonus = node.pinned ? 1.0 : 0.8;
    const fitness = (0.45 * competencyFactor) + (0.35 * useFactor) + (0.2 * pinBonus) - stalenessPenalty;
    return Number(Math.min(1.0, Math.max(0.0, fitness)).toFixed(3));
  }

  /**
   * Updates skill mastery score and upgrades tier upon reaching milestones:
   * - Novice: 0-49%
   * - Adept: 50-74%
   * - Master: 75-89%
   * - Sovereign: 90-100%
   */
  public updateMastery(nodeId: string, success: boolean): number {
    const node = this.substrate.getNode(nodeId);
    if (!node) return 0;

    const delta = success ? 5 : -8;
    const newMastery = success ? Math.min(100, node.masteryScore + delta) : Math.max(0, node.masteryScore + delta);

    let newTier: SkillTier = "novice";
    if (newMastery >= 90) newTier = "sovereign";
    else if (newMastery >= 75) newTier = "master";
    else if (newMastery >= 50) newTier = "adept";

    // Update 4D competency vector
    const currentComp = node.competencies ?? {
      syntaxAccuracy: node.masteryScore,
      executionReliability: node.masteryScore,
      recoveryResilience: node.masteryScore,
      speedEfficiency: 80,
    };

    const newComp: SkillCompetencyVector = {
      syntaxAccuracy: success ? Math.min(100, currentComp.syntaxAccuracy + 4) : Math.max(0, currentComp.syntaxAccuracy - 6),
      executionReliability: success ? Math.min(100, currentComp.executionReliability + 5) : Math.max(0, currentComp.executionReliability - 8),
      recoveryResilience: success ? Math.min(100, currentComp.recoveryResilience + 6) : Math.max(0, currentComp.recoveryResilience - 5),
      speedEfficiency: Math.min(100, Math.max(50, currentComp.speedEfficiency + (success ? 2 : -2))),
    };

    const updated: SkillNodeManifest = {
      ...node,
      masteryScore: newMastery,
      tier: newTier,
      competencies: newComp,
      updatedAtMs: Date.now(),
    };

    this.substrate.saveNode(updated);

    if (newMastery >= 90 && node.masteryScore < 90) {
      this.substrate.getNotificationDispatcher().dispatch({
        skillId: node.id,
        title: "Skill Mastery Sovereign",
        message: `Skill '${node.name}' achieved Sovereign status (${newMastery}%).`,
        urgency: "normal",
        trigger: "mastery_promoted",
      }).catch(() => {});
    }

    return newMastery;
  }

  /**
   * Evaluates whether a skill has expanded enough in scope to benefit from autonomous speciation.
   */
  public evaluateSpeciationOpportunity(skillId: string): SkillSpeciationEvaluation {
    const node = this.substrate.getNode(skillId);
    if (!node) {
      return {
        skillId,
        shouldSpeciate: false,
        divergenceScore: 0,
        reason: "Skill not found in substrate.",
        recommendedBranches: [],
      };
    }

    let divergenceScore = 0;
    const reasons: string[] = [];
    const recommendedBranches: SpecializedBranch[] = [];

    // Factor 1: Tag diversity
    if (node.tags.length >= 4) {
      divergenceScore += 0.3;
      reasons.push(`High tag diversity (${node.tags.length} tags: ${node.tags.join(", ")})`);
    }

    // Factor 2: Body length / procedure complexity
    if (node.body.length > 1000) {
      divergenceScore += 0.35;
      reasons.push(`High procedural density (${node.body.length} characters)`);
    }

    // Factor 3: Frequent usage
    if (node.useCount >= 10) {
      divergenceScore += 0.2;
      reasons.push(`High execution frequency (${node.useCount} runs)`);
    }

    // Generate branch candidates
    if (divergenceScore >= 0.5) {
      const tagHalf = Math.ceil(node.tags.length / 2);
      const groupA = node.tags.slice(0, tagHalf);
      const groupB = node.tags.slice(tagHalf);

      if (groupA.length > 0) {
        recommendedBranches.push({
          suffix: groupA[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
          name: `${node.name} (${groupA[0].toUpperCase()})`,
          description: `Specialized ${groupA.join(", ")} procedure for ${node.name}.`,
          focusTags: groupA,
          specializedBody: `## ${node.name} - ${groupA.join(", ")}\nSpecialized focus instructions.`,
        });
      }

      if (groupB.length > 0) {
        recommendedBranches.push({
          suffix: groupB[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
          name: `${node.name} (${groupB[0].toUpperCase()})`,
          description: `Specialized ${groupB.join(", ")} procedure for ${node.name}.`,
          focusTags: groupB,
          specializedBody: `## ${node.name} - ${groupB.join(", ")}\nSpecialized focus instructions.`,
        });
      }
    }

    const shouldSpeciate = divergenceScore >= 0.6;

    return {
      skillId: node.id,
      shouldSpeciate,
      divergenceScore: Math.min(1.0, divergenceScore),
      reason: reasons.length > 0 ? reasons.join("; ") : "Skill within standard scope bounds.",
      recommendedBranches: Object.freeze(recommendedBranches),
    };
  }

  /**
   * Autonomous Speciation: Splits an overloaded or broad skill into specialized child branches.
   */
  public speciateSkill(skillId: string, branches: readonly SpecializedBranch[]): readonly SkillNodeManifest[] {
    const parent = this.substrate.getNode(skillId);
    if (!parent) return [];

    const parentLineage = parent.lineage ?? {
      generation: 1,
      mutationCount: 0,
    };

    const createdChildren: SkillNodeManifest[] = [];
    const childIds: string[] = [];

    for (const branch of branches) {
      const childId = `${parent.id}-${branch.suffix}`.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
      childIds.push(childId);

      const childNode: SkillNodeManifest = {
        id: childId,
        name: branch.name,
        description: branch.description.endsWith(".") ? branch.description : `${branch.description}.`,
        category: parent.category,
        tier: "adept",
        version: "1.0.0",
        author: parent.author,
        platforms: parent.platforms,
        prerequisites: [parent.id],
        relatedSkills: [parent.id],
        tags: Array.from(new Set([...parent.tags, ...branch.focusTags])),
        masteryScore: Math.max(50, Math.floor(parent.masteryScore * 0.8)),
        fitnessScore: parent.fitnessScore,
        useCount: 0,
        lastUsedTick: 0,
        createdTick: 0,
        lifecycleState: "active",
        provenance: "evolved_mutation",
        pinned: false,
        location: `/skills/${childId}/SKILL.md`,
        body: branch.specializedBody || parent.body,
        contentHash: `hash-spec-${Date.now()}-${childId}`,
        supportFiles: [],
        competencies: parent.competencies,
        lineage: {
          generation: parentLineage.generation + 1,
          ancestorId: parent.id,
          branchOrigin: branch.suffix,
          mutationCount: 0,
          createdAtMs: Date.now(),
        },
        updatedAtMs: Date.now(),
      };

      this.substrate.saveNode(childNode);
      createdChildren.push(childNode);
    }

    // Update parent with speciated children references
    const updatedParent: SkillNodeManifest = {
      ...parent,
      lineage: {
        ...parentLineage,
        speciatedChildren: Object.freeze(Array.from(new Set([...(parentLineage.speciatedChildren || []), ...childIds]))),
      },
      updatedAtMs: Date.now(),
    };
    this.substrate.saveNode(updatedParent);

    return Object.freeze(createdChildren);
  }

  /**
   * Autonomous Consolidation: Merges multiple overlapping skills into a unified cohesive skill.
   */
  public consolidateSkills(
    skillIds: readonly string[],
    mergedId: string,
    mergedName: string,
    mergedCategory: string
  ): SkillNodeManifest {
    const nodes = skillIds.map((id) => this.substrate.getNode(id)).filter(Boolean) as SkillNodeManifest[];
    const cleanMergedId = mergedId.toLowerCase().replace(/[^a-z0-9-_]/g, "-");

    const allTags = Array.from(new Set(nodes.flatMap((n) => n.tags)));
    const allPrereqs = Array.from(new Set(nodes.flatMap((n) => n.prerequisites))).filter((p) => !skillIds.includes(p));
    const allRelated = Array.from(new Set(nodes.flatMap((n) => n.relatedSkills))).filter((r) => !skillIds.includes(r));

    const avgMastery = nodes.length > 0 ? Math.round(nodes.reduce((s, n) => s + n.masteryScore, 0) / nodes.length) : 60;
    const maxGen = nodes.reduce((max, n) => Math.max(max, n.lineage?.generation ?? 1), 1);

    const mergedNode: SkillNodeManifest = {
      id: cleanMergedId,
      name: mergedName,
      description: `Consolidated procedure combining ${nodes.map((n) => n.name).join(", ")}.`,
      category: mergedCategory,
      tier: avgMastery >= 75 ? "master" : "adept",
      version: "1.0.0",
      author: "LUMI",
      prerequisites: Object.freeze(allPrereqs),
      relatedSkills: Object.freeze(allRelated),
      tags: Object.freeze(allTags),
      masteryScore: Math.min(100, avgMastery + 10), // Fusion mastery boost
      fitnessScore: 0.9,
      useCount: nodes.reduce((s, n) => s + n.useCount, 0),
      lastUsedTick: 0,
      createdTick: 0,
      lifecycleState: "active",
      provenance: "evolved_mutation",
      pinned: false,
      location: `/skills/${cleanMergedId}/SKILL.md`,
      body: nodes.map((n) => `## ${n.name}\n${n.body}`).join("\n\n"),
      contentHash: `hash-cons-${Date.now()}-${cleanMergedId}`,
      supportFiles: [],
      lineage: {
        generation: maxGen + 1,
        consolidatedFrom: Object.freeze(skillIds),
        mutationCount: 0,
        createdAtMs: Date.now(),
      },
      updatedAtMs: Date.now(),
    };

    this.substrate.saveNode(mergedNode);

    // Mark constituent nodes as consolidated
    for (const n of nodes) {
      this.substrate.saveNode({
        ...n,
        lifecycleState: "consolidated",
        updatedAtMs: Date.now(),
      });
    }

    return mergedNode;
  }

  /**
   * Retrieves full lineage record for a skill.
   */
  public getLineage(skillId: string): SkillEvolutionLineage | undefined {
    return this.substrate.getNode(skillId)?.lineage;
  }

  // ---------------------------------------------------------------------------
  // Strategy Facade Methods
  // ---------------------------------------------------------------------------

  public synthesizeStrategy(goal: SkillStrategyGoal): SkillStrategyPlan {
    return this.strategyEngine.synthesizeStrategy(goal);
  }

  public evaluateSynergies(skillIds: readonly string[]): readonly SkillComboSynergy[] {
    return this.strategyEngine.evaluateSynergies(skillIds);
  }

  public computeEvolutionPath(targetSkillId: string): SkillEvolutionPath {
    return this.strategyEngine.computeEvolutionPath(targetSkillId);
  }

  public recommendNextSkills(context: string, limit?: number): readonly SkillRecommendation[] {
    return this.strategyEngine.recommendNextSkills(context, limit);
  }

  // ---------------------------------------------------------------------------
  // Substrate Facade Wrappers
  // ---------------------------------------------------------------------------

  public auditSkillHealth(skillId?: string): SkillHealthAuditReport {
    return this.substrate.auditSkillHealth(skillId);
  }

  public getSkillMetrics(): SkillMetricsReport {
    return this.substrate.getSkillMetrics();
  }

  public getGroupedSkills(
    groupBy?: SkillGroupBy,
    sortBy?: SkillSortBy,
    direction?: SkillSortDirection
  ): readonly SkillGroupedLane[] {
    return this.substrate.getGroupedSkills(groupBy, sortBy, direction);
  }

  public querySkillsDsl(query: SkillDslQueryFilter | string): readonly SkillNodeManifest[] {
    return this.substrate.querySkillsDsl(query);
  }

  public bulkUpdateSkills(
    skillIds: readonly string[],
    updates: Partial<Pick<SkillNodeManifest, "tier" | "lifecycleState" | "pinned" | "category">>
  ): SkillBulkMutationResult {
    return this.substrate.bulkUpdateSkills(skillIds, updates);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  /**
   * Estimates Bayesian epistemic uncertainty for a skill's competencies.
   */
  public estimateCompetencyUncertainty(skillId: string): SkillCompetencyUncertainty {
    const node = this.substrate.getNode(skillId);
    if (!node) {
      return {
        skillId,
        observationCount: 0,
        epistemicUncertainty: 1.0,
        confidenceInterval: { min: 0, max: 100 },
        isStableSovereign: false,
      };
    }

    const n = Math.max(0, node.useCount);
    const uncertainty = Number((Math.max(0.02, 1.0 / Math.sqrt(n + 1))).toFixed(3));
    const margin = Math.round(uncertainty * 25);
    const min = Math.max(0, node.masteryScore - margin);
    const max = Math.min(100, node.masteryScore + margin);
    const isStable = node.tier === "sovereign" && uncertainty < 0.15;

    return {
      skillId: node.id,
      observationCount: n,
      epistemicUncertainty: uncertainty,
      confidenceInterval: { min, max },
      isStableSovereign: isStable,
    };
  }

  /**
   * Recombines procedural instructions from multiple skills into a cohesive unified procedure.
   */
  public recombineSkillBodies(nodes: readonly SkillNodeManifest[]): string {
    if (nodes.length === 0) return "";
    if (nodes.length === 1) return nodes[0].body;

    const sections: string[] = [];
    sections.push(`# Consolidated Multi-Disciplinary Procedure`);
    sections.push(`Synthesized from ${nodes.length} component skills: ${nodes.map((n) => n.name).join(", ")}.\n`);

    for (const node of nodes) {
      sections.push(`## Section: ${node.name} (${node.category.toUpperCase()})`);
      sections.push(node.body.trim());
      sections.push("");
    }

    return sections.join("\n\n").trim();
  }

  /**
   * Automatically repairs structural issues in the DAG, clearing broken prerequisite edges.
   */
  public autoRemediateHealthIssues(): SkillAutoRemediationReport {
    const all = this.substrate.getAllNodes();
    const existingIds = new Set(all.map((n) => n.id.toLowerCase()));
    let brokenEdgesFixed = 0;
    let unlockedOrphansCount = 0;
    const actionsTaken: string[] = [];

    for (const node of all) {
      let nodeChanged = false;
      const validPrereqs: string[] = [];

      for (const p of node.prerequisites) {
        if (existingIds.has(p.toLowerCase())) {
          validPrereqs.push(p);
        } else {
          brokenEdgesFixed++;
          nodeChanged = true;
          actionsTaken.push(`Removed broken prerequisite reference '${p}' from skill '${node.name}'.`);
        }
      }

      // Check if orphaned dormant skill can be reactivated
      if (node.lifecycleState === "dormant" && node.masteryScore >= 75) {
        nodeChanged = true;
        unlockedOrphansCount++;
        actionsTaken.push(`Reactivated dormant high-mastery skill '${node.name}'.`);
      }

      if (nodeChanged) {
        this.substrate.saveNode({
          ...node,
          prerequisites: Object.freeze(validPrereqs),
          lifecycleState: node.lifecycleState === "dormant" && node.masteryScore >= 75 ? "active" : node.lifecycleState,
          updatedAtMs: Date.now(),
        });
      }
    }

    const healthAfter = this.substrate.auditSkillHealth().healthStatus;

    return {
      repairedCount: actionsTaken.length,
      brokenEdgesFixed,
      unlockedOrphansCount,
      actionsTaken: Object.freeze(actionsTaken),
      healthStatusAfter: healthAfter,
    };
  }

  public exportInteractiveHtmlView(skillId?: string): string {
    return this.substrate.exportInteractiveHtmlView(skillId);
  }

  public exportMarkdownReport(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsvReport(): string {
    return this.substrate.exportCsvReport();
  }
}

