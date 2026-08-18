/**
 * title-insights.contracts.ts
 *
 * Core contracts for Two-Stage Epistemic Session Title Generation,
 * Strict Provenance Hierarchy (user > llm > derived), Latent Cognitive Pattern
 * Extraction & Autonomous Conversation Insights Subsystem (Target #42 / Phase 109 / ADR-085).
 */

export type SessionTitleProvenance = "user" | "llm" | "derived";

export interface SessionTitleRecord {
  readonly sessionId: string;
  readonly title: string;
  readonly provenance: SessionTitleProvenance;
  readonly language?: string;
  readonly modelUsed?: string;
  readonly latencyMs: number;
  readonly costUsd: number;
  readonly inputChars: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface TitleGenerationOptions {
  readonly maxInputChars?: number;
  readonly maxDerivedChars?: number;
  readonly language?: string;
  readonly timeoutMs?: number;
  readonly disableThinking?: boolean;
  readonly strictJson?: boolean;
  readonly fallbackModel?: string;
}

export interface TitleGenerationResult {
  readonly success: boolean;
  readonly title: string;
  readonly provenance: SessionTitleProvenance;
  readonly stage: "instant_derived" | "llm_upgraded" | "user_custom" | "fallback";
  readonly latencyMs: number;
  readonly tokensUsed: number;
  readonly costUsd: number;
  readonly error?: string;
}

export interface InsightDateRange {
  readonly days: number;
  readonly sourceFilter?: string;
  readonly cutoffTimestamp: number;
}

export interface SessionTokenEconomics {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number;
  readonly actualCostUsd: number;
  readonly costSource: "canonical_pricing" | "actual_billing" | "fallback_heuristic";
  readonly costStatus: "exact" | "estimated" | "unpriced";
}

export interface ToolUsageMetric {
  readonly toolName: string;
  readonly category: string;
  readonly callCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly errorRate: number;
  readonly averageLatencyMs: number;
  readonly percentageOfTotalCalls: number;
}

export interface SkillUsageMetric {
  readonly skillName: string;
  readonly loadsCount: number;
  readonly editsCount: number;
  readonly actionsCount: number;
  readonly distinctSkillsUsed: number;
  readonly percentageOfTotalActions: number;
}

export interface ModelUsageMetric {
  readonly modelName: string;
  readonly provider: string;
  readonly sessionCount: number;
  readonly messageCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly totalCostUsd: number;
}

export interface PlatformUsageMetric {
  readonly platform: string;
  readonly sessionCount: number;
  readonly messageCount: number;
  readonly totalCostUsd: number;
  readonly percentageOfTotalSessions: number;
}

export interface ActivityTrendMetric {
  readonly dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  readonly hourOfDay: number; // 0 - 23
  readonly activityMatrix: readonly (readonly number[])[]; // 7 rows x 24 cols
  readonly peakHour: number;
  readonly peakDay: number;
  readonly totalActiveHours: number;
}

export interface TopSessionMetric {
  readonly sessionId: string;
  readonly title: string;
  readonly source: string;
  readonly model: string;
  readonly startedAt: number;
  readonly durationSeconds: number;
  readonly messageCount: number;
  readonly toolCallCount: number;
  readonly totalTokens: number;
  readonly totalCostUsd: number;
}

export interface SessionInsightsOverview {
  readonly totalSessions: number;
  readonly totalMessages: number;
  readonly totalToolCalls: number;
  readonly totalDurationSeconds: number;
  readonly averageMessagesPerSession: number;
  readonly averageToolCallsPerSession: number;
  readonly totalCostUsd: number;
  readonly averageCostPerSession: number;
  readonly totalTokens: number;
  readonly cacheEfficiencyRate: number;
}

export interface ConversationInsightsReport {
  readonly generatedAt: number;
  readonly dateRangeDays: number;
  readonly sourceFilter?: string;
  readonly isEmpty: boolean;
  readonly overview: SessionInsightsOverview;
  readonly models: readonly ModelUsageMetric[];
  readonly platforms: readonly PlatformUsageMetric[];
  readonly tools: readonly ToolUsageMetric[];
  readonly skills: {
    readonly summary: {
      readonly totalSkillLoads: number;
      readonly totalSkillEdits: number;
      readonly totalSkillActions: number;
      readonly distinctSkillsUsed: number;
    };
    readonly topSkills: readonly SkillUsageMetric[];
  };
  readonly activity: ActivityTrendMetric;
  readonly topSessions: readonly TopSessionMetric[];
  readonly tokenEconomics: SessionTokenEconomics;
}

export interface SessionActivityEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly timestamp: number;
  readonly eventType: "message_sent" | "tool_called" | "skill_invoked" | "model_switched" | "session_ended";
  readonly platform: string;
  readonly model: string;
  readonly toolName?: string;
  readonly skillName?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly cacheReadTokens?: number;
  readonly cacheWriteTokens?: number;
  readonly latencyMs?: number;
  readonly isSuccess?: boolean;
  readonly costUsd?: number;
}

export interface TitleInsightsWorkspaceSnapshot {
  readonly titles: Record<string, SessionTitleRecord>;
  readonly activityEvents: readonly SessionActivityEvent[];
  readonly totalTitlesGenerated: number;
  readonly totalInsightsGenerated: number;
  readonly timestamp: number;
}

export const CONTROL_WRAPPERS = [
  ["<command-message>", "</command-message>"],
  ["<command-name>", "</command-name>"],
  ["<command-args>", "</command-args>"],
  ["<local-command-caveat>", "</local-command-caveat>"],
  ["<local-command-stderr>", "</local-command-stderr>"],
  ["<local-command-stdout>", "</local-command-stdout>"],
  ["<task-notification>", "</task-notification>"],
  ["<system-reminder>", "</system-reminder>"],
  ["<ide_opened_file>", "</ide_opened_file>"],
  ["<ide_selection>", "</ide_selection>"],
] as const;

export const MACHINE_PREFIXES = [
  "[CONTEXT COMPACTION",
  "[LEGACY SUMMARY",
  "[Runtime note:",
  "[System note:",
  "[SYSTEM]",
  "[System: The active model for this chat has changed to ",
] as const;

export const MAX_DERIVED_TITLE_CHARS = 48;
export const MAX_TITLE_INPUT_CHARS = 1000;
export const MAX_MODEL_TITLE_CHARS = 80;

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface SessionTitleRow {
  readonly id: string;
  readonly sessionId: string;
  readonly title: string;
  readonly provenance: SessionTitleProvenance;
  readonly costUsd: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly [key: string]: unknown;
}

export interface SessionActivityEventRow {
  readonly id: string;
  readonly eventId: string;
  readonly sessionId: string;
  readonly eventType: string;
  readonly platform: string;
  readonly model: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface InsightSummaryRow {
  readonly id: string;
  readonly generatedAt: number;
  readonly totalSessions: number;
  readonly totalCostUsd: number;
  readonly totalTokens: number;
  readonly [key: string]: unknown;
}

export interface TitleAuditRow {
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

export type TitleInsightsHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "critical_desync";

export interface TitleInsightsHealthAuditReport {
  readonly totalTitles: number;
  readonly totalActivityEvents: number;
  readonly derivedTitlesCount: number;
  readonly llmTitlesCount: number;
  readonly userTitlesCount: number;
  readonly healthStatus: TitleInsightsHealthStatus;
  readonly recommendations: readonly string[];
}

export interface TitleInsightsMetricsReport {
  readonly totalTitles: number;
  readonly userCustomTitles: number;
  readonly llmUpgradedTitles: number;
  readonly instantDerivedTitles: number;
  readonly totalActivityEvents: number;
  readonly totalCostUsd: number;
  readonly totalTokens: number;
  readonly averageLatencyMs: number;
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type TitleInsightsGroupBy = "provenance" | "language" | "model" | "costTier";

export type TitleInsightsSortBy = "title" | "recent" | "cost" | "latency";

export type TitleInsightsSortDirection = "asc" | "desc";

export interface TitleInsightsGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly titles: readonly SessionTitleRecord[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface TitleInsightsDslQueryFilter {
  readonly rawQuery: string;
  readonly provenance?: SessionTitleProvenance;
  readonly model?: string;
  readonly minCostUsd?: number;
  readonly maxCostUsd?: number;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface TitleInsightsMutationUndoRecord {
  readonly mutationType: "set_title" | "delete_title" | "record_event" | "bulk";
  readonly previousSnapshot: TitleInsightsWorkspaceSnapshot;
  readonly nextSnapshot: TitleInsightsWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface TitleInsightsBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedSessionIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliTitleInsightsSubstrate {
  setTitle(record: SessionTitleRecord): void;
  getTitle(sessionId: string): SessionTitleRecord | undefined;
  listTitles(): readonly SessionTitleRecord[];
  deleteTitle(sessionId: string): boolean;
  recordActivityEvent(event: SessionActivityEvent): void;
  listActivityEvents(sessionId?: string): readonly SessionActivityEvent[];
  generateInsightsReport(dateRangeDays?: number, sourceFilter?: string): ConversationInsightsReport;
  getMetrics(): TitleInsightsMetricsReport;
  auditHealth(): TitleInsightsHealthAuditReport;
  getGroupedTitles(groupBy?: TitleInsightsGroupBy, sortBy?: TitleInsightsSortBy, direction?: TitleInsightsSortDirection): readonly TitleInsightsGroupedLane[];
  queryTitlesDsl(query: TitleInsightsDslQueryFilter | string): readonly SessionTitleRecord[];
  bulkPurgeTitles(sessionIds: readonly string[]): TitleInsightsBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): TitleInsightsWorkspaceSnapshot;
  importSnapshot(snapshot: TitleInsightsWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}

