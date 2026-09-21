/**
 * [LAYER: AGENTS EXTENSION]
 * Pass 124: Zero-Dependency Broccoli Epistemic Reasoning Engine
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/ReasoningService.ts).
 * Implements Epistemic PageRank (EP-Rank) over knowledge graph nodes with damping factor score propagation,
 * contradiction edge decay, and logical contradiction detection. Zero external npm dependencies.
 */

import type { KnowledgeNode, KnowledgeEdge } from "./knowledge-graph-substrate.js";

export interface ContradictionReport {
  nodeId: string;
  conflictingNodeId: string;
  confidence: number;
  evidencePath: string[];
}

export class BroccoliEpistemicReasoningEngine {
  /**
   * Detects contradiction edge relations between knowledge graph nodes.
   */
  public detectContradictions(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): ContradictionReport[] {
    const nodeMap = new Map<string, KnowledgeNode>();
    for (const n of nodes) {
      nodeMap.set(n.id, n);
    }

    const reports: ContradictionReport[] = [];
    const contradictionEdges = edges.filter((e) => e.type === "contradicts" || e.type === "conflicts");

    for (const edge of contradictionEdges) {
      const source = nodeMap.get(edge.sourceId);
      const target = nodeMap.get(edge.targetId);
      if (source && target) {
        reports.push({
          nodeId: source.id,
          conflictingNodeId: target.id,
          confidence: Math.min(source.confidence, target.confidence),
          evidencePath: [source.id, target.id],
        });
      }
    }

    return reports;
  }

  /**
   * Epistemic PageRank (EP-Rank): Calculates graph-propagated knowledge confidence scores.
   * Iteratively updates node confidence based on supporting edge weights, hub centrality,
   * and contradiction decays.
   */
  public calculateEpistemicPageRank(
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[],
    iterations: number = 10,
    dampingFactor: number = 0.85
  ): Record<string, number> {
    if (nodes.length === 0) return {};

    const nodeIds = nodes.map((n) => n.id);
    const ranks: Record<string, number> = {};
    const initialRank = 1.0 / nodes.length;

    for (const id of nodeIds) {
      ranks[id] = initialRank;
    }

    // Build adjacency inbound edges map
    const inboundMap = new Map<string, Array<{ sourceId: string; weight: number; type: string }>>();
    const outboundDegree = new Map<string, number>();

    for (const edge of edges) {
      const existing = inboundMap.get(edge.targetId) ?? [];
      existing.push({ sourceId: edge.sourceId, weight: edge.weight, type: edge.type });
      inboundMap.set(edge.targetId, existing);

      outboundDegree.set(edge.sourceId, (outboundDegree.get(edge.sourceId) ?? 0) + 1);
    }

    const baseRank = (1.0 - dampingFactor) / nodes.length;

    for (let iter = 0; iter < iterations; iter++) {
      const nextRanks: Record<string, number> = {};

      for (const id of nodeIds) {
        let incomingContribution = 0;
        const inEdges = inboundMap.get(id) ?? [];

        for (const inEdge of inEdges) {
          const srcRank = ranks[inEdge.sourceId] ?? initialRank;
          const srcDegree = outboundDegree.get(inEdge.sourceId) ?? 1;

          let multiplier = inEdge.weight;
          if (inEdge.type === "contradicts") {
            multiplier *= -0.5; // Contradiction decay
          } else if (inEdge.type === "supports") {
            multiplier *= 1.5; // Support boost
          }

          incomingContribution += (srcRank / srcDegree) * multiplier;
        }

        nextRanks[id] = Math.max(0, baseRank + dampingFactor * incomingContribution);
      }

      for (const id of nodeIds) {
        ranks[id] = nextRanks[id];
      }
    }

    return ranks;
  }
}
