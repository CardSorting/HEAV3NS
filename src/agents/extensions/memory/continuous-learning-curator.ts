/**
 * continuous-learning-curator.ts
 *
 * Master Continuous Learning Curator.
 * Orchestrates mathematical exponential memory decay, stale fact pruning,
 * semantic node consolidation, and progressive prompt context envelopes.
 */

import type {
  CuratorOptions,
  CuratorReviewDirective,
  KnowledgeNode,
} from "../../../core/contracts/memory-curator.contracts.js";
import { BroccoliLearningSubstrate } from "../../../sessions/extensions/memory/broccoli-learning-substrate.js";

const DEFAULT_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEFAULT_MIN_CONFIDENCE = 0.2;

export class ContinuousLearningCurator {
  private readonly substrate: BroccoliLearningSubstrate;
  private readonly options: CuratorOptions;

  constructor(
    substrate: BroccoliLearningSubstrate,
    options: CuratorOptions = {}
  ) {
    this.substrate = substrate;
    this.options = options;
  }

  /**
   * Applies mathematical exponential decay to all active knowledge nodes.
   */
  public applyDecay(now = Date.now()): number {
    const halfLifeMs = (this.options.decayHalfLifeDays || 30) * 24 * 60 * 60 * 1000;
    const lambda = Math.LN2 / halfLifeMs;

    const graph = this.substrate.getGraph();
    const nodes = graph.getAllNodes();
    let updatedCount = 0;

    for (const node of nodes) {
      // Pinned or permanent nodes don't decay
      if (node.metadata?.pinned) continue;

      const ageMs = Math.max(0, now - node.lastAccessedAt);
      const decayFactor = Math.max(0.01, Math.exp(-lambda * ageMs));

      if (Math.abs(node.decayFactor - decayFactor) > 0.001) {
        const updated: KnowledgeNode = {
          ...node,
          decayFactor,
        };
        graph.addNode(updated);
        updatedCount++;
      }
    }

    return updatedCount;
  }

  /**
   * Prunes low-confidence / decayed facts.
   */
  public pruneStaleFacts(): string[] {
    const minConfidence = this.options.minConfidenceThreshold ?? DEFAULT_MIN_CONFIDENCE;
    const graph = this.substrate.getGraph();
    const nodes = graph.getAllNodes();
    const prunedIds: string[] = [];

    for (const node of nodes) {
      if (node.metadata?.pinned) continue;

      const effectiveConfidence = node.confidence * node.decayFactor;
      if (effectiveConfidence < minConfidence) {
        this.substrate.forgetNode(node.id);
        prunedIds.push(node.id);
      }
    }

    return prunedIds;
  }

  /**
   * Identifies candidate nodes for consolidation based on semantic overlap.
   */
  public findConsolidationCandidates(minJaccard = 0.75): Array<[KnowledgeNode, KnowledgeNode]> {
    const graph = this.substrate.getGraph();
    const nodes = graph.getAllNodes();
    const candidates: Array<[KnowledgeNode, KnowledgeNode]> = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        if (nodeA.type !== nodeB.type) continue;

        const termsA = this.tokenize(`${nodeA.label} ${nodeA.content}`);
        const termsB = this.tokenize(`${nodeB.label} ${nodeB.content}`);
        const jaccard = this.calculateJaccard(termsA, termsB);

        if (jaccard >= minJaccard) {
          candidates.push([nodeA, nodeB]);
        }
      }
    }

    return candidates;
  }

  /**
   * Merges two knowledge nodes into a unified consolidated node.
   */
  public consolidateNodes(nodeAId: string, nodeBId: string): KnowledgeNode | undefined {
    const graph = this.substrate.getGraph();
    const nodeA = graph.getNode(nodeAId);
    const nodeB = graph.getNode(nodeBId);
    if (!nodeA || !nodeB) return undefined;

    const consolidated: KnowledgeNode = {
      id: nodeA.id,
      type: nodeA.type,
      label: nodeA.label.length >= nodeB.label.length ? nodeA.label : nodeB.label,
      content: `${nodeA.content}\n${nodeB.content}`.trim(),
      confidence: Math.min(1.0, (nodeA.confidence + nodeB.confidence) / 2 + 0.1),
      accessCount: nodeA.accessCount + nodeB.accessCount,
      lastAccessedAt: Math.max(nodeA.lastAccessedAt, nodeB.lastAccessedAt),
      createdAt: Math.min(nodeA.createdAt, nodeB.createdAt),
      decayFactor: Math.max(nodeA.decayFactor, nodeB.decayFactor),
      metadata: { ...nodeA.metadata, ...nodeB.metadata, consolidatedFrom: [nodeA.id, nodeB.id] },
    };

    graph.addNode(consolidated);
    graph.removeNode(nodeB.id);

    return consolidated;
  }

  /**
   * Assembles a structured memory context envelope (LUMI-MEMORY/1) for LLM prompts.
   */
  public buildMemoryPromptContext(maxTokens = 1000): string {
    const graph = this.substrate.getGraph();
    const nodes = graph.getAllNodes();
    if (nodes.length === 0) return "";

    // Sort by effective score
    const sorted = [...nodes].sort(
      (a, b) => b.confidence * b.decayFactor - a.confidence * a.decayFactor
    );

    const lines: string[] = ["<LUMI-MEMORY/1>"];
    for (const node of sorted.slice(0, 20)) {
      lines.push(`- [${node.type.toUpperCase()}] ${node.label}: ${node.content}`);
    }
    lines.push("</LUMI-MEMORY/1>");

    return lines.join("\n");
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  private calculateJaccard(termsA: string[], termsB: string[]): number {
    const setA = new Set(termsA);
    const setB = new Set(termsB);

    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}
