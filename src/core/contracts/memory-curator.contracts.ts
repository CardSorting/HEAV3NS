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

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface MemoryNodeRow {
  readonly id: string;
  readonly type: KnowledgeNodeType;
  readonly label: string;
  readonly content: string;
  readonly confidence: number;
  readonly accessCount: number;
  readonly lastAccessedAt: number;
  readonly createdAt: number;
  readonly decayFactor: number;
  readonly [key: string]: unknown;
}

export interface MemoryEdgeRow {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly relation: string;
  readonly weight: number;
  readonly createdAt: number;
  readonly [key: string]: unknown;
}

export interface MemoryRecallRow {
  readonly id: string;
  readonly query: string;
  readonly matchedNodeCount: number;
  readonly topScore: number;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface MemoryAuditRow {
  readonly id: string;
  readonly action: string;
  readonly targetId: string;
  readonly reason: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Graph Diagnostics
// ---------------------------------------------------------------------------

export type MemoryHealthStatus =
  | "optimal"
  | "healthy"
  | "fragmented"
  | "stale_backlog";

export interface MemoryHealthAuditReport {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly staleFactCount: number;
  readonly fragmentedClusterCount: number;
  readonly healthStatus: MemoryHealthStatus;
  readonly avgConfidence: number;
  readonly decayRatio: number;
  readonly recommendations: readonly string[];
}

export interface MemoryMetricsReport {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly totalRecalls: number;
  readonly totalRemembered: number;
  readonly activeNodes: number;
  readonly clusterCount: number;
  readonly avgConfidence: number;
  readonly p50RecallMs: number;
  readonly p95RecallMs: number;
  readonly typeCounts: Record<KnowledgeNodeType, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type MemoryGroupBy =
  | "type"
  | "confidence"
  | "decay"
  | "staleness"
  | "cluster";

export type MemorySortBy =
  | "confidence"
  | "accessCount"
  | "lastAccessedAt"
  | "createdAt";

export type MemorySortDirection = "asc" | "desc";

export interface MemoryGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly nodes: readonly KnowledgeNode[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface MemoryDslQueryFilter {
  readonly rawQuery: string;
  readonly type?: KnowledgeNodeType;
  readonly minConfidence?: number;
  readonly maxConfidence?: number;
  readonly maxDecay?: number;
  readonly minAccessCount?: number;
  readonly isStale?: boolean;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface MemoryMutationUndoRecord {
  readonly mutationType: "remember" | "forget" | "consolidate" | "decay" | "prune" | "bulk";
  readonly previousSnapshot: KnowledgeGraphSnapshot;
  readonly nextSnapshot: KnowledgeGraphSnapshot;
  readonly timestampMs: number;
}

export interface MemoryBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly updatedNodeIds: readonly string[];
  readonly consolidatedNode?: KnowledgeNode;
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliLearningSubstrate {
  rememberNode(node: KnowledgeNode): void;
  forgetNode(nodeId: string): boolean;
  getNode(nodeId: string): KnowledgeNode | undefined;
  queryMemory(options: MemoryQueryOptions): readonly MemoryRecallResult[];
  getMetrics(): { totalRemembered: number; totalRecalls: number; activeNodes: number; totalEdges: number };
  getMemoryMetrics(): MemoryMetricsReport;
  auditMemoryHealth(): MemoryHealthAuditReport;
  getGroupedMemories(groupBy?: MemoryGroupBy, sortBy?: MemorySortBy, direction?: MemorySortDirection): readonly MemoryGroupedLane[];
  queryMemoryDsl(query: MemoryDslQueryFilter | string): readonly KnowledgeNode[];
  bulkConsolidate(nodeIds: readonly string[], primaryLabel?: string): MemoryBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): KnowledgeGraphSnapshot;
  importSnapshot(snapshot: KnowledgeGraphSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
