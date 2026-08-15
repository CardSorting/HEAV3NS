import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  IBroccoliSkillTreeSubstrate,
  IAnchoredSkillMutator,
  ISkillTreeParser,
  SkillMutationPayload,
} from "../../../core/contracts/skills.contracts.js";
import type { Eyes } from "../../base/eyes.js";

export class SkillTreeToolSuite {
  private readonly substrate: IBroccoliSkillTreeSubstrate;
  private readonly mutator: IAnchoredSkillMutator;
  private readonly parser: ISkillTreeParser;
  private readonly eyes: Eyes;

  constructor(
    substrate: IBroccoliSkillTreeSubstrate,
    mutator: IAnchoredSkillMutator,
    parser: ISkillTreeParser,
    eyes: Eyes
  ) {
    this.substrate = substrate;
    this.mutator = mutator;
    this.parser = parser;
    this.eyes = eyes;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "skill_list_tree",
        description: "List the agent's Skill Tree DAG with tier levels, mastery ratings, and unlock states.",
        parameters: {
          category: {
            type: "string",
            required: false,
            description: "Optional category filter (e.g. 'productivity', 'software-development')",
          },
          includeLocked: {
            type: "boolean",
            required: false,
            description: "Whether to include locked skills (default true)",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const dag = this.substrate.getDag();
          const category = typeof args.category === "string" ? args.category.toLowerCase() : undefined;
          const includeLocked = args.includeLocked !== false;

          const results: Array<{
            id: string;
            name: string;
            description: string;
            category: string;
            tier: string;
            masteryScore: number;
            unlocked: boolean;
            missingPrerequisites?: readonly string[];
            relatedSkills: readonly string[];
          }> = [];

          for (const [id, node] of dag.nodes.entries()) {
            if (category && node.category.toLowerCase() !== category) continue;
            const isUnlocked = dag.unlockedNodeIds.has(id);
            if (!isUnlocked && !includeLocked) continue;

            results.push({
              id: node.id,
              name: node.name,
              description: node.description,
              category: node.category,
              tier: node.tier,
              masteryScore: node.masteryScore,
              unlocked: isUnlocked,
              missingPrerequisites: isUnlocked ? undefined : dag.lockedNodeIds.get(id),
              relatedSkills: node.relatedSkills,
            });
          }

          return {
            totalSkills: results.length,
            unlockedCount: results.filter((r) => r.unlocked).length,
            skills: results,
          };
        },
      },
      {
        name: "skill_view",
        description: "Load a skill's full instructions (SKILL.md) or a linked reference file on demand.",
        parameters: {
          skillId: {
            type: "string",
            required: true,
            description: "The identifier or name of the skill to view.",
          },
          filePath: {
            type: "string",
            required: false,
            description: "Optional relative path to a support file (e.g. 'references/api-guide.md')",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const skillId = String(args.skillId || "").trim().toLowerCase();
          const node = this.substrate.getNode(skillId);
          if (!node) {
            return {
              error: `Skill "${skillId}" not found in Skill DAG.`,
            };
          }

          this.mutator.markSkillRead(skillId);

          const subPath = typeof args.filePath === "string" ? args.filePath.trim() : undefined;
          if (subPath) {
            const basePath = node.location.replace(/SKILL\.md$/, "");
            const fullTarget = `${basePath}${subPath}`;
            try {
              const fileResult = await this.eyes.readFile(fullTarget);
              return {
                skillId: node.id,
                filePath: subPath,
                content: fileResult.content,
              };
            } catch (err) {
              return {
                error: `Failed to read support file "${subPath}" in skill "${skillId}": ${String(err)}`,
              };
            }
          }

          return {
            skillId: node.id,
            name: node.name,
            description: node.description,
            tier: node.tier,
            masteryScore: node.masteryScore,
            location: node.location,
            body: node.body,
          };
        },
      },
      {
        name: "skill_tree_visualize",
        description: "Generate an ASCII/DAG rendering of the Evolutionary Skill Tree.",
        parameters: {},
        execute: async () => {
          const dag = this.substrate.getDag();
          const lines: string[] = ["=== LUMI-JOY Evolutionary Skill Tree DAG ==="];

          for (const nodeId of dag.topologicalOrder) {
            const node = dag.nodes.get(nodeId);
            if (!node) continue;
            const unlocked = dag.unlockedNodeIds.has(nodeId);
            const statusIcon = unlocked ? "🟢 [UNLOCKED]" : "🔒 [LOCKED]";
            const prereqs = node.prerequisites.length > 0 ? ` (Prereqs: ${node.prerequisites.join(", ")})` : "";
            lines.push(
              `${statusIcon} [Tier: ${node.tier.toUpperCase()}] ${node.name} (Mastery: ${node.masteryScore}%, Fitness: ${node.fitnessScore.toFixed(2)})${prereqs}`
            );
            if (node.relatedSkills.length > 0) {
              lines.push(`    └── Conceptual Links: ${node.relatedSkills.join(", ")}`);
            }
          }

          return {
            asciiTree: lines.join("\n"),
            totalNodes: dag.nodes.size,
            unlockedNodes: dag.unlockedNodeIds.size,
            hasCycles: dag.cycles.length > 0,
          };
        },
      },
    ];
  }
}
