/**
 * prompt-cache.contracts.ts
 *
 * Core data contracts for Deterministic Byte-Stable Prompt Cache Boundary,
 * Progressive System Envelope & Reasoning Sanitizer Subsystem (Phase 93 / ADR-045 / Target #82).
 */

export type CacheBreakpointType = "static_prefix" | "system_tail" | "history_mid" | "turn_tail";

export interface PromptCacheMarker {
  readonly type: "ephemeral";
  readonly ttl?: string;
  readonly priority?: number;
}

export interface PromptCacheBreakpoint {
  readonly breakpointIndex: number;
  readonly target: "system" | "message" | "tool";
  readonly breakpointType: CacheBreakpointType;
  readonly byteOffset: number;
  readonly tokenEstimate: number;
}

export interface ByteStablePromptEnvelope {
  readonly staticPrefixBytes: number;
  readonly systemPromptHash: string;
  readonly dynamicSuffixBytes: number;
  readonly totalPromptBytes: number;
  readonly breakpoints: readonly PromptCacheBreakpoint[];
}

export interface ReasoningSanitizationResult {
  readonly sanitizedContent: string;
  readonly reasoningContent?: string;
  readonly hasThinkTags: boolean;
  readonly strippedTokensCount: number;
}

export interface PromptCacheConfig {
  readonly minBreakpointTokens: number;
  readonly maxBreakpoints: number;
  readonly enableReasoningSanitization: boolean;
  readonly bytePrefixThreshold: number;
}

export const DEFAULT_PROMPT_CACHE_CONFIG: PromptCacheConfig = {
  minBreakpointTokens: 1024,
  maxBreakpoints: 4,
  enableReasoningSanitization: true,
  bytePrefixThreshold: 4096,
};

export interface PromptCacheMetrics {
  readonly totalEnvelopesCalculated: number;
  readonly totalBreakpointsInserted: number;
  readonly totalSanitizedReasonings: number;
  readonly estimatedTokensCached: number;
  readonly staticPrefixBytesAvg: number;
}

export interface PromptCacheWorkspaceSnapshot {
  readonly snapshotId: string;
  readonly envelopeHash: string;
  readonly totalBreakpoints: number;
  readonly activeBreakpoints: readonly PromptCacheBreakpoint[];
  readonly metrics: PromptCacheMetrics;
  readonly config: PromptCacheConfig;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Row Schemas
// ---------------------------------------------------------------------------

export interface PromptCacheBreakpointRow {
  readonly breakpointId: string;
  readonly breakpointIndex: number;
  readonly target: "system" | "message" | "tool";
  readonly breakpointType: CacheBreakpointType;
  readonly byteOffset: number;
  readonly tokenEstimate: number;
  readonly envelopeHash: string;
  readonly timestamp: number;
  [key: string]: unknown;
}

export interface PromptCacheAuditRow {
  readonly auditId: string;
  readonly envelopeHash: string;
  readonly totalBreakpoints: number;
  readonly totalTokensCached: number;
  readonly healthStatus: PromptCacheHealthStatus;
  readonly timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Health Matrix & Telemetry Reports
// ---------------------------------------------------------------------------

export type PromptCacheHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface PromptCacheHealthAuditReport {
  readonly totalEnvelopes: number;
  readonly totalBreakpoints: number;
  readonly totalTokensCached: number;
  readonly staticPrefixCoveragePercent: number;
  readonly healthStatus: PromptCacheHealthStatus;
  readonly recommendations: readonly string[];
}

export interface PromptCacheMetricsReport {
  readonly totalEnvelopesCalculated: number;
  readonly totalBreakpointsInserted: number;
  readonly totalSanitizedReasonings: number;
  readonly estimatedTokensCached: number;
  readonly staticPrefixBytesAvg: number;
  readonly breakpointsByType: Record<string, number>;
  readonly breakpointsByTarget: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Swimlane Grouping
// ---------------------------------------------------------------------------

export type PromptCacheGroupBy = "target" | "breakpointType";
export type PromptCacheSortBy = "timestamp" | "byteOffset" | "tokenEstimate";
export type PromptCacheSortDirection = "asc" | "desc";

export interface PromptCacheGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly breakpoints: readonly PromptCacheBreakpointRow[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search
// ---------------------------------------------------------------------------

export interface PromptCacheDslQueryFilter {
  readonly rawQuery?: string;
  readonly target?: "system" | "message" | "tool";
  readonly breakpointType?: CacheBreakpointType;
  readonly minTokens?: number;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Bulk Operations
// ---------------------------------------------------------------------------

export interface PromptCacheMutationUndoRecord {
  readonly mutationType: "add_breakpoint" | "bulk_purge" | "clear" | "config_change";
  readonly previousSnapshot: PromptCacheWorkspaceSnapshot;
  readonly nextSnapshot: PromptCacheWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface PromptCacheBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedBreakpointIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Core Interface
// ---------------------------------------------------------------------------

export interface IBroccoliPromptCacheSubstrate {
  recordBreakpoint(row: PromptCacheBreakpointRow): void;
  getBreakpoint(id: string): PromptCacheBreakpointRow | undefined;
  listBreakpoints(): readonly PromptCacheBreakpointRow[];
  removeBreakpoint(id: string): boolean;
  clear(): void;

  auditHealth(): PromptCacheHealthAuditReport;
  getMetrics(): PromptCacheMetrics;
  getMetricsReport(): PromptCacheMetricsReport;
  getGroupedBreakpoints(
    groupBy?: PromptCacheGroupBy,
    sortBy?: PromptCacheSortBy,
    direction?: PromptCacheSortDirection
  ): readonly PromptCacheGroupedLane[];
  queryBreakpointsDsl(query: PromptCacheDslQueryFilter | string): readonly PromptCacheBreakpointRow[];

  bulkPurgeBreakpoints(ids: readonly string[]): PromptCacheBulkMutationResult;

  undo(): boolean;
  redo(): boolean;

  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;

  exportSnapshot(): PromptCacheWorkspaceSnapshot;
  importSnapshot(snapshot: PromptCacheWorkspaceSnapshot): void;
}
