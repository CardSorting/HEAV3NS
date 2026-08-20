/**
 * prompt-cache.contracts.ts
 *
 * Core data contracts for Deterministic Byte-Stable Prompt Cache Boundary,
 * Progressive System Envelope & Reasoning Sanitizer Subsystem (Phase 93 / ADR-045 / Target #82).
 */

export type CacheBreakpointType =
  | "static_prefix"
  | "system_tail"
  | "tool_manifest"
  | "project_grounding"
  | "history_mid"
  | "history_checkpoint"
  | "turn_tail";

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

export interface PromptCacheSegment {
  readonly tier: 0 | 1 | 2 | 3 | 4;
  readonly name: "base_identity" | "tool_declarations" | "project_grounding" | "history_checkpoints" | "volatile_tail";
  readonly byteLength: number;
  readonly tokenEstimate: number;
  readonly hash: string;
  readonly isCached: boolean;
}

export interface ByteStablePromptEnvelope {
  readonly staticPrefixBytes: number;
  readonly systemPromptHash: string;
  readonly dynamicSuffixBytes: number;
  readonly totalPromptBytes: number;
  readonly breakpoints: readonly PromptCacheBreakpoint[];
  readonly segments?: readonly PromptCacheSegment[];
}

export interface ReasoningSanitizationResult {
  readonly sanitizedContent: string;
  readonly reasoningContent?: string;
  readonly hasThinkTags: boolean;
  readonly strippedTokensCount: number;
  readonly reasoningHash?: string;
}

export interface PromptCacheConfig {
  readonly minBreakpointTokens: number;
  readonly maxBreakpoints: number;
  readonly enableReasoningSanitization: boolean;
  readonly bytePrefixThreshold: number;
  readonly enableToolCanonicalization?: boolean;
}

export const DEFAULT_PROMPT_CACHE_CONFIG: PromptCacheConfig = {
  minBreakpointTokens: 1024,
  maxBreakpoints: 4,
  enableReasoningSanitization: true,
  bytePrefixThreshold: 4096,
  enableToolCanonicalization: true,
};

export interface PromptCacheMetrics {
  readonly totalEnvelopesCalculated: number;
  readonly totalBreakpointsInserted: number;
  readonly totalSanitizedReasonings: number;
  readonly estimatedTokensCached: number;
  readonly staticPrefixBytesAvg: number;
  readonly totalCostSavingsUsd?: number;
  readonly cacheHitRatePercent?: number;
  readonly estimatedTtftReductionMs?: number;
  readonly prefixStabilityIndex?: number;
  readonly totalToolBytesCached?: number;
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

export interface PromptCacheReasoningLedgerRow {
  readonly ledgerId: string;
  readonly reasoningHash: string;
  readonly strippedTokensCount: number;
  readonly reasoningSnippet: string;
  readonly timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Health Matrix, Financial ROI & Telemetry Reports
// ---------------------------------------------------------------------------

export type PromptCacheHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface PromptCacheHealthAuditReport {
  readonly totalEnvelopes: number;
  readonly totalBreakpoints: number;
  readonly totalTokensCached: number;
  readonly staticPrefixCoveragePercent: number;
  readonly healthStatus: PromptCacheHealthStatus;
  readonly recommendations: readonly string[];
  readonly costSavingsUsd?: number;
  readonly cacheHitRatePercent?: number;
}

export interface PromptCacheMetricsReport {
  readonly totalEnvelopesCalculated: number;
  readonly totalBreakpointsInserted: number;
  readonly totalSanitizedReasonings: number;
  readonly estimatedTokensCached: number;
  readonly staticPrefixBytesAvg: number;
  readonly breakpointsByType: Record<string, number>;
  readonly breakpointsByTarget: Record<string, number>;
  readonly totalCostSavingsUsd: number;
  readonly cacheHitRatePercent: number;
  readonly estimatedTtftReductionMs: number;
  readonly prefixStabilityIndex: number;
}

export interface HumanDiagnosticSummary {
  readonly headline: string;
  readonly healthStatus: PromptCacheHealthStatus;
  readonly cacheHitRateFormatted: string;
  readonly dollarSavingsFormatted: string;
  readonly ttftImprovementFormatted: string;
  readonly activeBreakpointsCount: number;
  readonly structureExplanation: string;
  readonly actionableAdvice: string;
}

export interface PromptCacheEfficiencyAnalysis {
  readonly score: number; // 0 to 100
  readonly rating: "EXCELLENT" | "GOOD" | "SUBOPTIMAL" | "POOR";
  readonly totalPromptBytes: number;
  readonly cachedPrefixBytes: number;
  readonly cachedPrefixTokens: number;
  readonly cacheCoveragePercent: number;
  readonly estimatedSavingsUsd: number;
  readonly estimatedTtftGainMs: number;
  readonly recommendations: readonly string[];
}

export interface PromptCacheSavingsSimulation {
  readonly modelId: string;
  readonly turnCount: number;
  readonly basePromptTokens: number;
  readonly cachedTokensPerTurn: number;
  readonly unoptimizedCostUsd: number;
  readonly optimizedCostUsd: number;
  readonly totalSavedUsd: number;
  readonly savingsPercent: number;
  readonly projectedTtftReductionSec: number;
}

export interface ProviderCacheDirectives {
  readonly provider: "anthropic" | "openai" | "deepseek" | "gemini" | "openrouter" | "local";
  readonly supportsExplicitBreakpoints: boolean;
  readonly maxBreakpoints: number;
  readonly minTokenThreshold: number;
  readonly ttlSeconds: number;
  readonly cacheReadDiscountMultiplier: number;
  readonly recommendedBreakpointTargets: readonly ("system" | "message" | "tool")[];
}

// ---------------------------------------------------------------------------
// Apex-Tier Diagnostics, Forensics & Scorecards
// ---------------------------------------------------------------------------

export type PromptCacheGrade = "A+" | "A" | "B" | "C" | "D";
export type PromptCachePrescriptionPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type PromptCachePrescriptionCategory =
  | "PREFIX_IMMUTABILITY"
  | "TOOL_CANONICALIZATION"
  | "CHECKPOINT_PLACEMENT"
  | "TTL_REFRESH";

export interface PromptCachePrescription {
  readonly id: string;
  readonly priority: PromptCachePrescriptionPriority;
  readonly title: string;
  readonly description: string;
  readonly projectedGainUsd: number;
  readonly projectedTtftGainMs: number;
  readonly category: PromptCachePrescriptionCategory;
}

export interface PromptCacheScorecard {
  readonly grade: PromptCacheGrade;
  readonly overallScore: number; // 0 to 100
  readonly dimensions: {
    readonly prefixStabilityScore: number;
    readonly toolSchemaCoverageScore: number;
    readonly checkpointGranularityScore: number;
    readonly costOptimizationScore: number;
  };
  readonly summary: string;
  readonly actionablePrescriptions: readonly PromptCachePrescription[];
}

export interface PromptCacheInvalidationForensic {
  readonly hasInvalidation: boolean;
  readonly reasonCode: "NONE" | "PREFIX_MUTATION" | "TOOL_SCHEMA_DRIFT" | "TTL_EXPIRATION" | "TOKEN_UNDERFLOW";
  readonly line: number;
  readonly column: number;
  readonly byteOffset: number;
  readonly invalidationSnippet?: string;
  readonly explanation: string;
}

export interface ProviderRoiEntry {
  readonly modelId: string;
  readonly providerName: string;
  readonly unoptimizedCostUsd: number;
  readonly optimizedCostUsd: number;
  readonly savingsUsd: number;
  readonly savingsPercent: number;
  readonly ttftReductionMs: number;
}

export interface PromptCacheMultiProviderRoiMatrix {
  readonly promptTokens: number;
  readonly cachedTokens: number;
  readonly providerEntries: readonly ProviderRoiEntry[];
}

// ---------------------------------------------------------------------------
// Pinnacle-Tier Cloudflare/Vercel Telemetry, Layered Keys & Forecasts
// ---------------------------------------------------------------------------

export type PromptCacheStatusEnum = "HIT" | "MISS" | "PARTIAL" | "REVALIDATED" | "BYPASS" | "EXPIRED";

export interface PromptCacheTelemetryHeaders {
  readonly status: PromptCacheStatusEnum;
  readonly tierMatch: string;
  readonly prefixAgeSec: number;
  readonly prefixHash: string;
  readonly tokensSaved: number;
  readonly costSavedUsd: number;
  readonly ttftGainMs: number;
  readonly invalidationReason: string;
  readonly rawHeaders: Record<string, string>;
}

export interface PromptCacheSavingsForecast {
  readonly modelId: string;
  readonly projectedDailyTurns: number;
  readonly dailySavingsUsd: number;
  readonly weeklySavingsUsd: number;
  readonly monthlySavingsUsd: number;
  readonly annualSavingsUsd: number;
  readonly tierBreakdown: {
    readonly tier0BaseIdentityPercent: number;
    readonly tier1ToolDeclarationsPercent: number;
    readonly tier2ProjectGroundingPercent: number;
    readonly tier3HistoryCheckpointsPercent: number;
  };
  readonly warmthTiers: {
    readonly frozenTokens: number;
    readonly coldTokens: number;
    readonly warmTokens: number;
    readonly hotTokens: number;
  };
}

export interface PromptCacheLayeredFingerprint {
  readonly l0BaseHash: string;
  readonly l1ToolHash: string;
  readonly l2ProjectHash: string;
  readonly l3HistoryHash: string;
  readonly compositeFingerprint: string;
  readonly matchedPrefixLayers: readonly string[];
  readonly reuseRatioPercent: number;
}

export interface PromptCacheRemediationRecipe {
  readonly recipeId: string;
  readonly title: string;
  readonly issue: string;
  readonly fix: string;
  readonly originalSnippet: string;
  readonly remediatedSnippet: string;
  readonly efficiencyGainPercent: number;
  readonly category: PromptCachePrescriptionCategory;
}

// ---------------------------------------------------------------------------
// Zenith-Tier APM Waterfall, Anomaly Alerts, Explain Plans & Auto-Tuning
// ---------------------------------------------------------------------------

export interface PromptCacheSpan {
  readonly spanId: string;
  readonly segmentName: string;
  readonly tier: "L0" | "L1" | "L2" | "L3" | "L4";
  readonly cacheStatus: "HIT" | "MISS" | "PARTIAL";
  readonly tokenCount: number;
  readonly prefillTimeMs: number;
  readonly latencySavedMs: number;
  readonly byteRange: readonly [number, number];
}

export interface PromptCacheWaterfallTrace {
  readonly traceId: string;
  readonly totalTokens: number;
  readonly cachedTokens: number;
  readonly totalLatencyMs: number;
  readonly unoptimizedLatencyMs: number;
  readonly spans: readonly PromptCacheSpan[];
  readonly humanNarrative: string;
}

export type PromptCacheAlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type PromptCacheAlertType =
  | "PREFIX_MUTATION_SPIKE"
  | "CACHE_TOKEN_UNDERFLOW"
  | "TTL_NEAR_EXPIRY"
  | "UNEXPECTED_COST_INCREASE"
  | "REASONING_LEAK_DETECTED";

export interface PromptCacheAlertEvent {
  readonly alertId: string;
  readonly severity: PromptCacheAlertSeverity;
  readonly alertType: PromptCacheAlertType;
  readonly metricValue: number | string;
  readonly thresholdValue: number | string;
  readonly plainEnglishMessage: string;
  readonly suggestedRemediation: string;
  readonly timestamp: number;
}

export interface PromptCacheExplainBreakpoint {
  readonly target: string;
  readonly type: string;
  readonly byteOffset: number;
  readonly rationale: string;
}

export interface PromptCacheExplainPlan {
  readonly estimatedTotalTokens: number;
  readonly cachedTokens: number;
  readonly cacheReadDiscount: number;
  readonly costPerTurnOptimized: number;
  readonly costPerTurnUnoptimized: number;
  readonly projectedTtftMs: number;
  readonly unoptimizedTtftMs: number;
  readonly breakpointAllocations: readonly PromptCacheExplainBreakpoint[];
  readonly executionVerdict: "HIGHLY_OPTIMIZED" | "ACCEPTABLE" | "WASTEFUL";
  readonly nonTechnicalSummary: string;
}

export interface PromptCacheAutoTuneResult {
  readonly optimizedSystemPrompt: string;
  readonly diffSummary: string;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly gradeBefore: PromptCacheGrade;
  readonly gradeAfter: PromptCacheGrade;
  readonly estimatedSavingsMultiplier: number;
  readonly optimizationsApplied: readonly string[];
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
  readonly maxTokens?: number;
  readonly minSavings?: number;
  readonly status?: PromptCacheHealthStatus;
  readonly textTerms?: readonly string[];
  readonly sortBy?: "timestamp" | "byteOffset" | "tokenEstimate" | "savings";
  readonly limit?: number;
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
  getHumanDiagnosticSummary(): HumanDiagnosticSummary;
  getScorecard(): PromptCacheScorecard;
  getInvalidationForensic(previousPrompt?: string): PromptCacheInvalidationForensic;
  getOptimizationPrescriptions(): readonly PromptCachePrescription[];
  getMultiProviderRoiMatrix(promptTokens?: number, cachedTokens?: number): PromptCacheMultiProviderRoiMatrix;
  getTelemetryHeaders(): PromptCacheTelemetryHeaders;
  getSavingsForecast(projectedDailyTurns?: number, modelId?: string): PromptCacheSavingsForecast;
  getLayeredFingerprint(
    systemPrompt?: string,
    tools?: readonly unknown[],
    messages?: readonly { role: string; content?: string }[]
  ): PromptCacheLayeredFingerprint;
  getRemediationRecipes(): readonly PromptCacheRemediationRecipe[];
  getWaterfallTrace(modelId?: string): PromptCacheWaterfallTrace;
  auditAlerts(): readonly PromptCacheAlertEvent[];
  explainPlan(
    systemPrompt?: string,
    tools?: readonly unknown[],
    messages?: readonly { role: string; content?: string }[],
    modelId?: string
  ): PromptCacheExplainPlan;
  autoTuneSystemPrompt(systemPrompt: string): PromptCacheAutoTuneResult;
  simulateCacheSavings(modelId: string, turnCount: number, promptTokens?: number): PromptCacheSavingsSimulation;
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
