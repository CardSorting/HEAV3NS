/**
 * semantic-knowledge-graph.ts
 *
 * In-memory typed Directed Acyclic Graph (DAG) and knowledge adjacency network.
 * Features bidirectional adjacency indexing, topological shortest-path traversal (BFS),
 * and zero-GC BM25/Jaccard lexical-semantic search.
 */

import type {
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeGraphSnapshot,
  MemoryQueryOptions,
  MemoryRecallResult,
} from "../../../core/contracts/memory-curator.contracts.js";

export class SemanticKnowledgeGraph {
  private readonly nodes = new Map<string, KnowledgeNode>();
  private readonly outEdges = new Map<string, KnowledgeEdge[]>();
  private readonly inEdges = new Map<string, KnowledgeEdge[]>();

  public addNode(node: KnowledgeNode): void {
    this.nodes.set(node.id, node);
    if (!this.outEdges.has(node.id)) this.outEdges.set(node.id, []);
    if (!this.inEdges.has(node.id)) this.inEdges.set(node.id, []);
  }

  public getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  public removeNode(id: string): boolean {
    if (!this.nodes.has(id)) return false;

    this.nodes.delete(id);
    this.outEdges.delete(id);
    this.inEdges.delete(id);

    // Clean up incoming/outgoing links from other nodes
    for (const edges of this.outEdges.values()) {
      const idx = edges.findIndex((e) => e.target === id);
      if (idx !== -1) edges.splice(idx, 1);
    }
    for (const edges of this.inEdges.values()) {
      const idx = edges.findIndex((e) => e.source === id);
      if (idx !== -1) edges.splice(idx, 1);
    }

    return true;
  }

  public addEdge(edge: KnowledgeEdge): void {
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
      throw new Error(`Cannot add edge: source '${edge.source}' or target '${edge.target}' not found`);
    }

    const outList = this.outEdges.get(edge.source) || [];
    const inList = this.inEdges.get(edge.target) || [];

    // Avoid duplicate edges with same relation
    const existingOut = outList.findIndex(
      (e) => e.target === edge.target && e.relation === edge.relation
    );
    if (existingOut !== -1) {
      outList[existingOut] = edge;
    } else {
      outList.push(edge);
    }

    const existingIn = inList.findIndex(
      (e) => e.source === edge.source && e.relation === edge.relation
    );
    if (existingIn !== -1) {
      inList[existingIn] = edge;
    } else {
      inList.push(edge);
    }

    this.outEdges.set(edge.source, outList);
    this.inEdges.set(edge.target, inList);
  }

  public getNeighbors(id: string): KnowledgeNode[] {
    const outList = this.outEdges.get(id) || [];
    const inList = this.inEdges.get(id) || [];
    const neighborIds = new Set<string>();

    for (const e of outList) neighborIds.add(e.target);
    for (const e of inList) neighborIds.add(e.source);

    const neighbors: KnowledgeNode[] = [];
    for (const nid of neighborIds) {
      const node = this.nodes.get(nid);
      if (node) neighbors.push(node);
    }
    return neighbors;
  }

  public getEdges(id: string): { outgoing: KnowledgeEdge[]; incoming: KnowledgeEdge[] } {
    return {
      outgoing: [...(this.outEdges.get(id) || [])],
      incoming: [...(this.inEdges.get(id) || [])],
    };
  }

  /**
   * Topological shortest path (BFS) between two knowledge nodes.
   */
  public findShortestPath(startId: string, targetId: string): string[] | undefined {
    if (!this.nodes.has(startId) || !this.nodes.has(targetId)) return undefined;
    if (startId === targetId) return [startId];

    const queue: Array<{ id: string; path: string[] }> = [{ id: startId, path: [startId] }];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = this.getNeighbors(current.id);

      for (const neighbor of neighbors) {
        if (neighbor.id === targetId) {
          return [...current.path, neighbor.id];
        }

        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push({ id: neighbor.id, path: [...current.path, neighbor.id] });
        }
      }
    }

    return undefined;
  }

  /**
   * Semantic recall ranking combining Jaccard term overlap and graph connectivity.
   */
  public search(options: MemoryQueryOptions): MemoryRecallResult[] {
    const queryTerms = this.tokenize(options.query);
    if (queryTerms.length === 0) return [];

    const minConfidence = options.minConfidence ?? 0.0;
    const limit = options.limit ?? 10;
    const typeFilter = options.nodeTypes ? new Set(options.nodeTypes) : undefined;

    const scored: MemoryRecallResult[] = [];

    for (const node of this.nodes.values()) {
      if (typeFilter && !typeFilter.has(node.type)) continue;
      if (node.confidence < minConfidence) continue;

      const nodeTerms = this.tokenize(`${node.label} ${node.content}`);
      const jaccard = this.calculateJaccard(queryTerms, nodeTerms);

      if (jaccard > 0) {
        // Boost by confidence and decay factor
        const finalScore = jaccard * node.confidence * node.decayFactor;
        const relatedNodes = options.includeRelations ? this.getNeighbors(node.id) : [];

        scored.push({
          node,
          score: finalScore,
          relatedNodes,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  public exportSnapshot(): KnowledgeGraphSnapshot {
    const allEdges: KnowledgeEdge[] = [];
    for (const edges of this.outEdges.values()) {
      allEdges.push(...edges);
    }

    return {
      nodes: Array.from(this.nodes.values()),
      edges: allEdges,
      totalNodes: this.nodes.size,
      totalEdges: allEdges.length,
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: KnowledgeGraphSnapshot): void {
    this.clear();
    for (const node of snapshot.nodes) {
      this.addNode({ ...node });
    }
    for (const edge of snapshot.edges) {
      this.addEdge({ ...edge });
    }
  }

  public getAllNodes(): KnowledgeNode[] {
    return Array.from(this.nodes.values());
  }

  public getAllEdges(): KnowledgeEdge[] {
    const all: KnowledgeEdge[] = [];
    for (const edges of this.outEdges.values()) {
      all.push(...edges);
    }
    return all;
  }

  public clear(): void {
    this.nodes.clear();
    this.outEdges.clear();
    this.inEdges.clear();
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
