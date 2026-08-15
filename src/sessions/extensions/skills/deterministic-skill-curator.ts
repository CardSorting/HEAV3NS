import type {
  IDeterministicSkillCurator,
  IBroccoliSkillTreeSubstrate,
  SkillNodeManifest,
} from "../../../core/contracts/skills.contracts.js";

export class DeterministicSkillCurator implements IDeterministicSkillCurator {
  private readonly substrate: IBroccoliSkillTreeSubstrate;

  constructor(substrate: IBroccoliSkillTreeSubstrate) {
    this.substrate = substrate;
  }

  /**
   * Evaluates decay based on elapsed game engine ticks rather than wall-clock time.
   */
  evaluateDecay(
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
  detectConsolidationClusters(similarityThreshold = 0.5): readonly {
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
}
