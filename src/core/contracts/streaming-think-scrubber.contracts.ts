/**
 * streaming-think-scrubber.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Streaming Reasoning Tag Scrubber,
 * Boundary Gated Holdback Buffer & Live Delta Filter Subsystem (Phase 137 / ADR-113 / Target #77).
 */

export type ReasoningTagName =
  | "think"
  | "thinking"
  | "reasoning"
  | "thought"
  | "REASONING_SCRATCHPAD";

export interface StreamingScrubberState {
  inBlock: boolean;
  heldBuffer: string;
  lastEmittedEndedNewline: boolean;
  turnIndex: number;
}

export interface StreamingScrubResult {
  emittedText: string;
  heldBackText: string;
  suppressedText: string;
  inReasoningBlock: boolean;
  deltaSize: number;
  emittedSize: number;
  durationMs: number;
}

export interface StreamingThinkScrubberConfig {
  enabled: boolean;
  tagNames: readonly string[];
  preserveProseMentions: boolean;
  discardUnterminatedOnFlush: boolean;
}

export interface StreamingThinkScrubberMetrics {
  totalDeltasProcessed: number;
  reasoningChunksSuppressed: number;
  heldBackTailEmissions: number;
  blocksEncountered: number;
  flushesExecuted: number;
}

export interface StreamingThinkScrubberWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: StreamingThinkScrubberConfig;
  metrics: StreamingThinkScrubberMetrics;
  sessionStates: Record<string, StreamingScrubberState>;
  events?: readonly StreamingScrubberEventRow[];
}

export const DEFAULT_REASONING_TAG_NAMES: readonly string[] = [
  "think",
  "thinking",
  "reasoning",
  "thought",
  "REASONING_SCRATCHPAD",
];

export const DEFAULT_STREAMING_THINK_SCRUBBER_CONFIG: StreamingThinkScrubberConfig = {
  enabled: true,
  tagNames: DEFAULT_REASONING_TAG_NAMES,
  preserveProseMentions: true,
  discardUnterminatedOnFlush: true,
};

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Row Schemas
// ---------------------------------------------------------------------------

export interface StreamingScrubberEventRow {
  id: string;
  sessionId: string;
  turnIndex: number;
  deltaSize: number;
  emittedSize: number;
  suppressedSize: number;
  inBlock: boolean;
  durationMs: number;
  timestamp: number;
  [key: string]: unknown;
}

export interface StreamingScrubberAuditRow {
  auditId: string;
  totalEvents: number;
  totalChunksSuppressed: number;
  totalBlocksEncountered: number;
  healthStatus: StreamingScrubberHealthStatus;
  timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Health Matrix & Telemetry Reports
// ---------------------------------------------------------------------------

export type StreamingScrubberHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface StreamingScrubberHealthAuditReport {
  totalDeltasProcessed: number;
  reasoningChunksSuppressed: number;
  blocksEncountered: number;
  activeSessions: number;
  healthStatus: StreamingScrubberHealthStatus;
  recommendations: string[];
}

export interface StreamingScrubberMetricsReport {
  totalDeltasProcessed: number;
  reasoningChunksSuppressed: number;
  heldBackTailEmissions: number;
  blocksEncountered: number;
  flushesExecuted: number;
  activeSessionsCount: number;
  eventsBySession: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Swimlane Grouping
// ---------------------------------------------------------------------------

export type StreamingScrubberGroupBy = "sessionId" | "status" | "blockState";
export type StreamingScrubberSortBy = "timestamp" | "deltaSize" | "durationMs" | "emittedSize";
export type StreamingScrubberSortDirection = "asc" | "desc";

export interface StreamingScrubberGroupedLane {
  key: string;
  title: string;
  count: number;
  events: readonly StreamingScrubberEventRow[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search
// ---------------------------------------------------------------------------

export interface StreamingScrubberDslQueryFilter {
  rawQuery?: string;
  sessionId?: string;
  inBlock?: boolean;
  minDeltaSize?: number;
  textTerms?: string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Bulk Operations
// ---------------------------------------------------------------------------

export interface StreamingScrubberMutationUndoRecord {
  mutationType: "add_event" | "reset_session" | "clear" | "config_change";
  previousSnapshot: StreamingThinkScrubberWorkspaceSnapshot;
  nextSnapshot: StreamingThinkScrubberWorkspaceSnapshot;
  timestampMs: number;
}

export interface StreamingScrubberBulkMutationResult {
  matchedCount: number;
  modifiedCount: number;
  affectedIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Core Interface
// ---------------------------------------------------------------------------

export interface IBroccoliStreamingScrubberSubstrate {
  recordEvent(event: StreamingScrubberEventRow): void;
  getEvent(id: string): StreamingScrubberEventRow | undefined;
  listEvents(): readonly StreamingScrubberEventRow[];
  removeEvent(id: string): boolean;
  clear(): void;

  auditHealth(): StreamingScrubberHealthAuditReport;
  getMetrics(): StreamingThinkScrubberMetrics;
  getMetricsReport(): StreamingScrubberMetricsReport;
  getGroupedEvents(
    groupBy?: StreamingScrubberGroupBy,
    sortBy?: StreamingScrubberSortBy,
    direction?: StreamingScrubberSortDirection
  ): readonly StreamingScrubberGroupedLane[];
  queryEventsDsl(query: StreamingScrubberDslQueryFilter | string): readonly StreamingScrubberEventRow[];

  bulkPurgeEvents(ids: readonly string[]): StreamingScrubberBulkMutationResult;
  bulkResetSessions(sessionIds: readonly string[]): StreamingScrubberBulkMutationResult;

  undo(): boolean;
  redo(): boolean;

  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;

  exportSnapshot(): StreamingThinkScrubberWorkspaceSnapshot;
  importSnapshot(snapshot: StreamingThinkScrubberWorkspaceSnapshot): void;
}
