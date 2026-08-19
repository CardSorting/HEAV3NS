import * as crypto from "node:crypto";
import type {
  SkillTreeDag,
  SkillNodeManifest,
  SkillStrategyPlan,
} from "../../../core/contracts/skills.contracts.js";

export type SkillPromptLod = "lod_0_compact" | "lod_1_active" | "lod_2_strategic";

export interface SkillPromptComposerOptions {
  readonly lod?: SkillPromptLod;
  readonly maxSkills?: number;
  readonly maxTokensEstimate?: number;
  readonly strategyPlan?: SkillStrategyPlan;
  readonly queryContext?: string;
  readonly inlinePrimaryProcedures?: boolean;
}

/**
 * SkillTreePromptComposer.
 * Part of LUMI's World-Class Evolutionary Skill Tree System (ADR-014).
 *
 * Formulates level-of-detail (LOD) stratified prompt context for system and turn injection.
 * Ensures byte-stable prefixes for LLM KV caching while dynamically surfacing high-relevance
 * procedural knowledge and strategic combos.
 */
export class SkillTreePromptComposer {
  /**
   * Composes a compact, cache-friendly Skill Tree summary for prompt injection.
   */
  public composeSkillTreePromptContext(
    dag: SkillTreeDag,
    options?: SkillPromptComposerOptions
  ): string {
    if (dag.nodes.size === 0) return "";

    const lod: SkillPromptLod = options?.lod ?? "lod_1_active";
    const maxSkills = options?.maxSkills ?? 50;
    const maxTokens = options?.maxTokensEstimate ?? 2000;

    const unlockedNodes: SkillNodeManifest[] = [];
    for (const id of dag.unlockedNodeIds) {
      const node = dag.nodes.get(id);
      if (node && node.lifecycleState === "active") {
        unlockedNodes.push(node);
      }
    }

    if (unlockedNodes.length === 0) return "";

    // Sort by mastery descending
    unlockedNodes.sort((a, b) => b.masteryScore - a.masteryScore);
    const selectedNodes = unlockedNodes.slice(0, maxSkills);

    let result = "";

    // LOD 0: Ultra-compact table for prefix cache
    if (lod === "lod_0_compact") {
      const lines: string[] = ["## Skill Tree Index"];
      for (const node of selectedNodes) {
        lines.push(`- \`${node.id}\` [${node.tier}]: ${node.description}`);
      }
      result = lines.join("\n").trim();
    } else if (lod === "lod_2_strategic" && options?.strategyPlan) {
      // LOD 2: Strategic Execution Context (if plan provided)
      const plan = options.strategyPlan;
      const lines: string[] = ["## Active Skill Execution Strategy"];
      lines.push(`**Strategy ID**: \`${plan.strategyId}\` | **Policy**: \`${plan.policy}\` | **Confidence**: ${Math.round(plan.confidenceScore * 100)}%`);
      lines.push(`**Rationale**: ${plan.rationale}`);
      lines.push("");
      lines.push("### Execution Chain:");
      for (const step of plan.executionChain) {
        lines.push(`${step.stepIndex}. **${step.skillName}** [${step.tier.toUpperCase()} | ${step.masteryScore}%]: ${step.rationale}`);
      }
      if (plan.synergies.length > 0) {
        lines.push("");
        lines.push("### Active Synergies:");
        for (const syn of plan.synergies) {
          lines.push(`- ⚡ **${syn.name}**: ${syn.description} (+${Math.round((syn.fitnessMultiplier - 1) * 100)}% fitness)`);
        }
      }

      if (options.inlinePrimaryProcedures && plan.primarySkill.body) {
        lines.push("");
        lines.push(`### Inlined Primary Procedure: ${plan.primarySkill.name}`);
        lines.push(plan.primarySkill.body);
      }

      result = lines.join("\n").trim();
    } else {
      // LOD 1: Standard Active Grouped Summary
      const lines: string[] = ["## Evolutionary Skill Tree"];
      lines.push("You possess procedural knowledge skills organized in a directed skill tree.");
      lines.push("To view full procedures or references, invoke `skill_view(skillId, filePath)`.");
      lines.push("");

      // Group by category
      const byCategory = new Map<string, SkillNodeManifest[]>();
      for (const node of selectedNodes) {
        if (!byCategory.has(node.category)) byCategory.set(node.category, []);
        byCategory.get(node.category)!.push(node);
      }

      for (const [cat, nodes] of byCategory.entries()) {
        lines.push(`### ${cat.toUpperCase()}`);
        for (const node of nodes) {
          const pinTag = node.pinned ? " 📌" : "";
          lines.push(`- **${node.name}** [Tier: ${node.tier.toUpperCase()} | Mastery: ${node.masteryScore}%]${pinTag}: ${node.description}`);
        }
        lines.push("");
      }

      result = lines.join("\n").trim();
    }

    // Token budget trimming
    const approxTokens = Math.ceil(result.length / 4);
    if (approxTokens > maxTokens) {
      const charLimit = maxTokens * 4;
      result = `${result.slice(0, charLimit)}\n... [Remaining context truncated to respect token budget]`;
    }

    return result;
  }
}
