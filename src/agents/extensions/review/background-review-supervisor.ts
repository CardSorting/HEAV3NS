/**
 * background-review-supervisor.ts
 *
 * Master supervisor coordinating background turn reviews, self-improvement evaluation,
 * candidate knowledge promotion, session insights, and topic title synthesis (Phase 96 / ADR-048).
 */

import type {
  SessionInsightsBreakdown,
  SessionTitleSuggestion,
  TurnReviewDigest,
  TurnReviewResult,
} from "../../../core/contracts/background-review.contracts.js";
import { DeterministicReviewEvaluator } from "../../../tooling/extensions/review/deterministic-review-evaluator.js";
import { BroccoliReviewSubstrate } from "../../../sessions/extensions/review/broccoli-review-substrate.js";

export class BackgroundReviewSupervisor {
  private evaluator: DeterministicReviewEvaluator;
  private substrate: BroccoliReviewSubstrate;

  constructor(
    evaluator: DeterministicReviewEvaluator,
    substrate: BroccoliReviewSubstrate
  ) {
    this.evaluator = evaluator;
    this.substrate = substrate;
  }

  /**
   * Evaluates a completed conversation turn and saves the review result to the substrate.
   */
  evaluateTurn(
    turnIndex: number,
    userMessage: string,
    assistantResponse: string,
    toolNames: readonly string[],
    hasError: boolean = false
  ): TurnReviewResult {
    const result = this.evaluator.evaluateTurn(
      turnIndex,
      userMessage,
      assistantResponse,
      toolNames,
      hasError
    );
    this.substrate.recordReview(result);
    return result;
  }

  /**
   * Computes and persists structured session insights.
   */
  generateSessionInsights(
    sessionId: string,
    digests: readonly TurnReviewDigest[],
    inputTokens: number,
    outputTokens: number
  ): SessionInsightsBreakdown {
    const insights = this.evaluator.generateSessionInsights(
      sessionId,
      digests,
      inputTokens,
      outputTokens
    );
    this.substrate.setLatestInsights(insights);
    return insights;
  }

  /**
   * Generates and stores a session title suggestion.
   */
  suggestTitle(
    firstUserMessage: string,
    toolsUsed: readonly string[]
  ): SessionTitleSuggestion {
    const suggestion = this.evaluator.suggestSessionTitle(firstUserMessage, toolsUsed);
    this.substrate.setTitle(suggestion.title);
    return suggestion;
  }

  /**
   * Retrieves all completed turn reviews.
   */
  getReviews(): readonly TurnReviewResult[] {
    return this.substrate.getReviews();
  }

  /**
   * Retrieves the latest computed session insights.
   */
  getLatestInsights(): SessionInsightsBreakdown | undefined {
    return this.substrate.getLatestInsights();
  }

  /**
   * Retrieves the current session title.
   */
  getCurrentTitle(): string | undefined {
    return this.substrate.getTitle();
  }
}
