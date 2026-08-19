import type {
  IDeterministicSkillCurator,
  IBroccoliSkillTreeSubstrate,
  SkillNodeManifest,
  SkillPruningRecommendation,
} from "../../../core/contracts/skills.contracts.js";

export class DeterministicSkillCurator implements IDeterministicSkillCurator {
  private readonly substrate: IBroccoliSkillTreeSubstrate;

  constructor(substrate: IBroccoliSkillTreeSubstrate) {
    this.substrate = substrate;
  }

  /**
   * Evaluates decay based on elapsed game engine ticks rather than wall-clock time.
   */
  public evaluateDecay(
    currentTick: number,
    staleTickThreshold = 500,
    archiveTickThreshold = 2000
  ): {
    staleNodeIds: readonly string[];
    archivableNodeIds: readonly string[];
  } {
    const nodes = this.substrate.getAllNodes();
    const staleNodeIds: string[] = [];
    const archivableNodeIds: string[] = [];

    for (const node of nodes) {
      if (node.pinned || node.provenance === "system_bundled") continue;

      const elapsed = currentTick - node.lastUsedTick;
      if (elapsed >= archiveTickThreshold && node.lifecycleState !== "archived") {
        archivableNodeIds.push(node.id);
      } else if (elapsed >= staleTickThreshold && node.lifecycleState === "active") {
        staleNodeIds.push(node.id);
      }
    }

    return {
      staleNodeIds: Object.freeze(staleNodeIds),
      archivableNodeIds: Object.freeze(archivableNodeIds),
    };
  }

  /**
   * Detects clusters of overlapping skills using Jaccard similarity across tags, related skills, and tokens.
   */
  public detectConsolidationClusters(similarityThreshold = 0.5): readonly {
    clusterName: string;
    nodeIds: readonly string[];
    similarityScore: number;
  }[] {
    const nodes = this.substrate.getAllNodes();
    const clusters: Array<{
      clusterName: string;
      nodeIds: readonly string[];
      similarityScore: number;
    }> = [];

    const visited = new Set<string>();

    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i];
      if (visited.has(nodeA.id)) continue;

      const clusterMembers = [nodeA.id];
      const setA = new Set([...nodeA.tags, ...nodeA.relatedSkills, nodeA.category]);

      for (let j = i + 1; j < nodes.length; j++) {
        const nodeB = nodes[j];
        if (visited.has(nodeB.id)) continue;

        const setB = new Set([...nodeB.tags, ...nodeB.relatedSkills, nodeB.category]);
        const intersection = new Set([...setA].filter((x) => setB.has(x)));
        const union = new Set([...setA, ...setB]);
        const jaccard = union.size > 0 ? intersection.size / union.size : 0;

        if (jaccard >= similarityThreshold) {
          clusterMembers.push(nodeB.id);
          visited.add(nodeB.id);
        }
      }

      if (clusterMembers.length > 1) {
        visited.add(nodeA.id);
        clusters.push({
          clusterName: `${nodeA.category}-umbrella`,
          nodeIds: Object.freeze(clusterMembers),
          similarityScore: similarityThreshold,
        });
      }
    }

    return Object.freeze(clusters);
  }

  /**
   * Generates prioritized pruning recommendations with risk assessments.
   */
  public generatePruningRecommendations(
    currentTick: number,
    staleThreshold = 500,
    archiveThreshold = 800
  ): readonly SkillPruningRecommendation[] {
    const decay = this.evaluateDecay(currentTick, staleThreshold, archiveThreshold);
    const dag = this.substrate.getDag();
    const recommendations: SkillPruningRecommendation[] = [];

    for (const archId of decay.archivableNodeIds) {
      const node = this.substrate.getNode(archId);
      if (!node) continue;

      const dependents = dag.dependentsEdges.get(archId) || [];
      const hasDependents = dependents.length > 0;
      const riskLevel = hasDependents ? "high" : node.masteryScore > 75 ? "medium" : "low";

      recommendations.push({
        skillId: node.id,
        skillName: node.name,
        action: "archive",
        riskLevel,
        rationale: hasDependents
          ? `Archiving node '${node.name}' blocks ${dependents.length} downstream skills.`
          : `Node inactive for >${archiveThreshold} ticks with no active downstream dependencies.`,
      });
    }

    for (const staleId of decay.staleNodeIds) {
      const node = this.substrate.getNode(staleId);
      if (!node) continue;

      recommendations.push({
        skillId: node.id,
        skillName: node.name,
        action: "decay",
        riskLevel: "low",
        rationale: `Node has not been utilized for >${staleThreshold} ticks; recommended for mastery refresh or soft decay.`,
      });
    }

    return Object.freeze(recommendations);
  }
}

