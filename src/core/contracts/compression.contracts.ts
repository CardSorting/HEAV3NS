/**
 * compression.contracts.ts
 *
 * Core data contracts for Semantic Context Compression, Token Attention Pruning,
 * Head-Tail Budget Governors & Trajectory Compaction Subsystem (Phase 86 / ADR-038).
 */

export type CompressionPolicy = "aggressive" | "balanced" | "conservative";

export interface TokenWindowBudget {
  readonly totalTokens: number;
  readonly maxContextLimit: number;
  readonly compressionThreshold: number;
  readonly headReservedTokens: number;
  readonly tailReservedTokens: number;
  readonly summaryBudgetTokens: number;
}

export interface CompressedTurnSummary {
  readonly id: string;
  readonly sourceTurnStart: number;
  readonly sourceTurnEnd: number;
  readonly originalTokens: number;
  readonly compressedTokens: number;
  readonly summaryText: string;
  readonly resolvedGoals: readonly string[];
  readonly pendingGoals: readonly string[];
  readonly timestampMs: number;
}

export interface ToolPruningPolicy {
  readonly maxOutputChars: number;
  readonly stripBase64Data: boolean;
  readonly preserveExitCodes: boolean;
  readonly collapseRepeatedLines: boolean;
}

export interface CompressionStateSnapshot {
  readonly summaries: readonly CompressedTurnSummary[];
  readonly totalCompactedTurns: number;
  readonly totalTokensSaved: number;
  readonly snapshotTick: number;
  readonly timestamp?: number;
}

export interface IHeadTailBudgetGovernor {
  calculateBudget(totalTokens: number, maxLimit?: number): TokenWindowBudget;
  shouldCompress(currentTokens: number, budget: TokenWindowBudget): boolean;
  partitionTurns<T>(turns: readonly T[], headCount: number, tailCount: number): { head: readonly T[]; middle: readonly T[]; tail: readonly T[] };
}

export interface IDeterministicToolPruner {
  pruneToolResult(rawOutput: string, policy?: Partial<ToolPruningPolicy>): { prunedText: string; originalChars: number; prunedChars: number; wasPruned: boolean };
}

export interface ITrajectoryCompactorEngine {
  compactTrajectory(
    turns: readonly { turnIndex: number; role: string; content: string }[],
    budget: TokenWindowBudget
  ): {
    compactedTurns: readonly { turnIndex: number; role: string; content: string }[];
    summary?: CompressedTurnSummary;
    tokensSaved: number;
  };
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface CompressionSummaryRow {
  readonly id: string;
  readonly sourceTurnStart: number;
  readonly sourceTurnEnd: number;
  readonly originalTokens: number;
  readonly compressedTokens: number;
  readonly tokensSaved: number;
  readonly timestampMs: number;
  readonly [key: string]: unknown;
}

export interface PrunedToolOutputRow {
  readonly id: string;
  readonly originalChars: number;
  readonly prunedChars: number;
  readonly charsSaved: number;
  readonly wasPruned: boolean;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface CompressionAuditRow {
  readonly id: string;
  readonly action: string;
  readonly operator: string;
  readonly details: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Metrics Telemetry
// ---------------------------------------------------------------------------

export type CompressionHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "overflow_risk";

export interface CompressionHealthAuditReport {
  readonly totalSummaries: number;
  readonly totalCompactedTurns: number;
  readonly totalTokensSaved: number;
  readonly avgCompressionRatio: number; // e.g. 0.35 (35% of original size)
  readonly overflowRiskScore: number;   // 0.0 - 1.0
  readonly healthStatus: CompressionHealthStatus;
  readonly recommendations: readonly string[];
}

export interface CompressionMetricsReport {
  readonly totalSummaries: number;
  readonly totalCompactedTurns: number;
  readonly totalTokensSaved: number;
  readonly avgOriginalTokens: number;
  readonly avgCompressedTokens: number;
  readonly overallSavingsPercentage: number;
  readonly p50TokensSaved: number;
  readonly p95TokensSaved: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type CompressionGroupBy = "savingsTier" | "turnRange" | "goalStatus";

export type CompressionSortBy = "timestamp" | "tokensSaved" | "compressedTokens";

export type CompressionSortDirection = "asc" | "desc";

export interface CompressionGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly totalTokensSaved: number;
  readonly summaries: readonly CompressedTurnSummary[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface CompressionDslQueryFilter {
  readonly rawQuery: string;
  readonly minTokensSaved?: number;
  readonly maxCompressedTokens?: number;
  readonly turnIndex?: number;
  readonly goalTerm?: string;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface CompressionMutationUndoRecord {
  readonly mutationType: "record_summary" | "purge_summaries" | "prune_tool" | "bulk";
  readonly previousSnapshot: CompressionStateSnapshot;
  readonly nextSnapshot: CompressionStateSnapshot;
  readonly timestampMs: number;
}

export interface CompressionBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedSummaryIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliCompressionSubstrate {
  recordSummary(summary: CompressedTurnSummary): void;
  getSummary(id: string): CompressedTurnSummary | undefined;
  listSummaries(limit?: number): readonly CompressedTurnSummary[];
  getLatestSummary(): CompressedTurnSummary | undefined;
  recordPrunedOutput(originalChars: number, prunedChars: number, wasPruned: boolean): void;
  getMetrics(): CompressionMetricsReport;
  auditHealth(): CompressionHealthAuditReport;
  getGroupedSummaries(groupBy?: CompressionGroupBy, sortBy?: CompressionSortBy, direction?: CompressionSortDirection): readonly CompressionGroupedLane[];
  querySummariesDsl(query: CompressionDslQueryFilter | string): readonly CompressedTurnSummary[];
  bulkPurgeSummaries(summaryIds: readonly string[]): CompressionBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(tick?: number): CompressionStateSnapshot;
  importSnapshot(snapshot: CompressionStateSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}

export interface ICompressionSnapshotManager {
  createSnapshot(tick: number): CompressionStateSnapshot;
  restoreSnapshot(snapshot: CompressionStateSnapshot): void;
}
