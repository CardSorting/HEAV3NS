/**
 * background-review.contracts.ts
 *
 * Core contracts for Autonomous Background Review, Post-Turn Self-Improvement Fork,
 * and Session Insights Substrate (Phase 96 / ADR-048).
 */

export type ReviewTriggerPolicy = "always" | "on_milestone" | "manual" | "disabled";

export interface CandidateFactItem {
  readonly factId: string;
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidence: number;
  readonly category: string;
}

export interface CandidateSkillItem {
  readonly skillId: string;
  readonly title: string;
  readonly description: string;
  readonly codeSnippet?: string;
  readonly prerequisites?: readonly string[];
}

export interface TurnReviewDigest {
  readonly turnIndex: number;
  readonly userGoal: string;
  readonly assistantActionSummary: string;
  readonly toolsUsed: readonly string[];
  readonly errorOccurred: boolean;
}

export interface TurnReviewResult {
  readonly reviewId: string;
  readonly turnIndex: number;
  readonly candidateFacts: readonly CandidateFactItem[];
  readonly candidateSkills: readonly CandidateSkillItem[];
  readonly reviewDigest: TurnReviewDigest;
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface SessionInsightsBreakdown {
  readonly sessionId: string;
  readonly totalTurns: number;
  readonly totalTokens: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostMicroCents: number;
  readonly toolUsageCounts: Record<string, number>;
  readonly topTools: readonly { readonly toolName: string; readonly count: number }[];
  readonly durationMs: number;
  readonly generatedAt: number;
}

export interface SessionTitleSuggestion {
  readonly title: string;
  readonly confidence: number;
  readonly derivedFrom: "user_intent" | "tool_activity" | "fallback";
  readonly timestamp: number;
}

export interface ReviewWorkspaceSnapshot {
  readonly totalReviews: number;
  readonly activeReviews: readonly TurnReviewResult[];
  readonly latestInsights?: SessionInsightsBreakdown;
  readonly currentTitle?: string;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface TurnReviewRow {
  readonly id: string;
  readonly reviewId: string;
  readonly turnIndex: number;
  readonly userGoal: string;
  readonly assistantActionSummary: string;
  readonly toolsUsedCount: number;
  readonly candidateFactsCount: number;
  readonly candidateSkillsCount: number;
  readonly durationMs: number;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface CandidateFactRow {
  readonly id: string;
  readonly factId: string;
  readonly reviewId: string;
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidence: number;
  readonly category: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface CandidateSkillRow {
  readonly id: string;
  readonly skillId: string;
  readonly reviewId: string;
  readonly title: string;
  readonly description: string;
  readonly codeSnippet?: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface ReviewAuditRow {
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

export type BackgroundReviewHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "stalled";

export interface BackgroundReviewHealthAuditReport {
  readonly totalReviews: number;
  readonly totalCandidateFacts: number;
  readonly totalCandidateSkills: number;
  readonly latestTurnIndex: number;
  readonly triggerPolicy: ReviewTriggerPolicy;
  readonly healthStatus: BackgroundReviewHealthStatus;
  readonly recommendations: readonly string[];
}

export interface BackgroundReviewMetricsReport {
  readonly totalReviewsConducted: number;
  readonly totalCandidateFactsExtracted: number;
  readonly totalCandidateSkillsExtracted: number;
  readonly averageReviewDurationMs: number;
  readonly p50DurationMs: number;
  readonly p95DurationMs: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type BackgroundReviewGroupBy = "category" | "has_skills" | "turn_range" | "error_status";

export type BackgroundReviewSortBy = "turnIndex" | "timestamp" | "durationMs";

export type BackgroundReviewSortDirection = "asc" | "desc";

export interface BackgroundReviewGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly reviews: readonly TurnReviewResult[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface BackgroundReviewDslQueryFilter {
  readonly rawQuery: string;
  readonly minTurnIndex?: number;
  readonly maxTurnIndex?: number;
  readonly hasSkills?: boolean;
  readonly hasFacts?: boolean;
  readonly toolName?: string;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface BackgroundReviewMutationUndoRecord {
  readonly mutationType: "record_review" | "clear" | "policy_update" | "bulk_purge";
  readonly previousSnapshot: ReviewWorkspaceSnapshot;
  readonly nextSnapshot: ReviewWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface BackgroundReviewBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedReviewIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliReviewSubstrate {
  recordReview(review: TurnReviewResult): void;
  getReview(reviewId: string): TurnReviewResult | undefined;
  listReviews(): readonly TurnReviewResult[];
  getLatestReview(): TurnReviewResult | undefined;
  getAllFacts(): readonly CandidateFactItem[];
  getAllSkills(): readonly CandidateSkillItem[];
  setLatestInsights(insights: SessionInsightsBreakdown): void;
  getLatestInsights(): SessionInsightsBreakdown | undefined;
  setCurrentTitle(title: string): void;
  getCurrentTitle(): string | undefined;
  getTriggerPolicy(): ReviewTriggerPolicy;
  setTriggerPolicy(policy: ReviewTriggerPolicy): void;
  auditHealth(): BackgroundReviewHealthAuditReport;
  getMetrics(): BackgroundReviewMetricsReport;
  getGroupedReviews(groupBy?: BackgroundReviewGroupBy, sortBy?: BackgroundReviewSortBy, direction?: BackgroundReviewSortDirection): readonly BackgroundReviewGroupedLane[];
  queryReviewsDsl(query: BackgroundReviewDslQueryFilter | string): readonly TurnReviewResult[];
  bulkPurgeReviews(reviewIds: readonly string[]): BackgroundReviewBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): ReviewWorkspaceSnapshot;
  importSnapshot(snapshot: ReviewWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
