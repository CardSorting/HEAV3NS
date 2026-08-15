/**
 * broccoli-learning-substrate.ts
 *
 * In-memory zero-GC Broccolidb storage layer for semantic knowledge nodes,
 * associative relationship edges, and user preferences.
 */

import type {
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeGraphSnapshot,
  MemoryQueryOptions,
  MemoryRecallResult,
} from "../../../core/contracts/memory-curator.contracts.js";
import { SemanticKnowledgeGraph } from "./semantic-knowledge-graph.js";

export class BroccoliLearningSubstrate {
  private readonly graph: SemanticKnowledgeGraph;
  private totalRemembered = 0;
  private totalForgotten = 0;
  private totalRecalls = 0;

  constructor(graph?: SemanticKnowledgeGraph) {
    this.graph = graph ?? new SemanticKnowledgeGraph();
  }

  public getGraph(): SemanticKnowledgeGraph {
    return this.graph;
  }

  public rememberNode(node: KnowledgeNode): void {
    this.graph.addNode(node);
    this.totalRemembered++;
  }

  public forgetNode(id: string): boolean {
    const removed = this.graph.removeNode(id);
    if (removed) this.totalForgotten++;
    return removed;
  }

  public recordAccess(id: string): KnowledgeNode | undefined {
    const node = this.graph.getNode(id);
    if (!node) return undefined;

    const updated: KnowledgeNode = {
      ...node,
      accessCount: node.accessCount + 1,
      lastAccessedAt: Date.now(),
    };

    this.graph.addNode(updated);
    return updated;
  }

  public linkNodes(source: string, target: string, relation: string, weight = 1.0): void {
    this.graph.addEdge({
      source,
      target,
      relation,
      weight,
      createdAt: Date.now(),
    });
  }

  public queryMemory(options: MemoryQueryOptions): MemoryRecallResult[] {
    this.totalRecalls++;
    const results = this.graph.search(options);
    return results.map((res) => {
      const updated = this.recordAccess(res.node.id);
      return {
        ...res,
        node: updated ?? res.node,
      };
    });
  }

  public captureSnapshot(): KnowledgeGraphSnapshot {
    return this.graph.exportSnapshot();
  }

  public restoreSnapshot(snapshot: KnowledgeGraphSnapshot): void {
    this.graph.importSnapshot(snapshot);
  }

  public getMetrics(): { totalRemembered: number; totalForgotten: number; totalRecalls: number; activeNodes: number; activeEdges: number } {
    return {
      totalRemembered: this.totalRemembered,
      totalForgotten: this.totalForgotten,
      totalRecalls: this.totalRecalls,
      activeNodes: this.graph.getAllNodes().length,
      activeEdges: this.graph.getAllEdges().length,
    };
  }

  public clear(): void {
    this.graph.clear();
    this.totalRemembered = 0;
    this.totalForgotten = 0;
    this.totalRecalls = 0;
  }
}
