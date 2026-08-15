/**
 * memory-curator.contracts.ts
 *
 * Core contracts and data models for the Persistent Memory Substrate,
 * Knowledge Graph & Continuous Learning Curator (Phase 76 / ADR-028).
 */

export type KnowledgeNodeType = "fact" | "preference" | "entity" | "concept" | "skill";

export interface CuratorKnowledgeNode {
  readonly id: string;
  readonly type: KnowledgeNodeType;
  readonly label: string;
  readonly content: string;
  readonly confidence: number; // 0.0 to 1.0
  readonly accessCount: number;
  readonly lastAccessedAt: number;
  readonly createdAt: number;
  readonly decayFactor: number; // 0.0 to 1.0 (default 1.0)
  readonly metadata?: Record<string, unknown>;
}

export type KnowledgeNode = CuratorKnowledgeNode;

export interface CuratorKnowledgeEdge {
  readonly source: string;
  readonly target: string;
  readonly relation: string;
  readonly weight: number; // 0.0 to 1.0
  readonly createdAt: number;
}

export type KnowledgeEdge = CuratorKnowledgeEdge;

export interface KnowledgeGraphSnapshot {
  readonly nodes: readonly KnowledgeNode[];
  readonly edges: readonly KnowledgeEdge[];
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly timestamp: number;
}

export interface MemoryQueryOptions {
  readonly query: string;
  readonly limit?: number;
  readonly minConfidence?: number;
  readonly includeRelations?: boolean;
  readonly nodeTypes?: readonly KnowledgeNodeType[];
}

export interface MemoryRecallResult {
  readonly node: KnowledgeNode;
  readonly score: number;
  readonly relatedNodes: readonly KnowledgeNode[];
}

export interface CuratorReviewDirective {
  readonly action: "archive" | "pin" | "consolidate" | "decay" | "boost";
  readonly targetId: string;
  readonly reason: string;
}

export interface CuratorOptions {
  readonly decayHalfLifeDays?: number; // Default 30 days
  readonly autoConsolidateThreshold?: number; // Default 0.75 lexical/semantic overlap
  readonly minConfidenceThreshold?: number; // Default 0.2
}
