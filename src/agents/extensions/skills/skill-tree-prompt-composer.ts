import type { SkillTreeDag, SkillNodeManifest } from "../../../core/contracts/skills.contracts.js";

export class SkillTreePromptComposer {
  /**
   * Composes a compact, cache-friendly Tier 1 Skill Tree summary for system prompt injection.
   * Only includes unlocked skills, keeping descriptions strictly bounded to preserve token cache.
   */
  composeSkillTreePromptContext(dag: SkillTreeDag): string {
    if (dag.nodes.size === 0) return "";

    const lines: string[] = ["## Evolutionary Skill Tree"];
    lines.push("You possess procedural knowledge skills organized in a directed skill tree.");
    lines.push("To view full procedures or references, invoke `skill_view(skillId, filePath)`.");
    lines.push("");

    const unlockedNodes: SkillNodeManifest[] = [];
    for (const id of dag.unlockedNodeIds) {
      const node = dag.nodes.get(id);
      if (node && node.lifecycleState === "active") {
        unlockedNodes.push(node);
      }
    }

    if (unlockedNodes.length === 0) return "";

    // Group by category
    const byCategory = new Map<string, SkillNodeManifest[]>();
    for (const node of unlockedNodes) {
      if (!byCategory.has(node.category)) byCategory.set(node.category, []);
      byCategory.get(node.category)!.push(node);
    }

    for (const [cat, nodes] of byCategory.entries()) {
      lines.push(`### ${cat.toUpperCase()}`);
      for (const node of nodes) {
        lines.push(`- **${node.name}** [Tier: ${node.tier.toUpperCase()} | Mastery: ${node.masteryScore}%]: ${node.description}`);
      }
      lines.push("");
    }

    return lines.join("\n").trim();
  }
}
