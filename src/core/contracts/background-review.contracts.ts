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
