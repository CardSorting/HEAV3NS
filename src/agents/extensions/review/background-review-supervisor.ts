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
  public getCurrentTitle(): string | undefined {
    return this.substrate.getTitle();
  }

  public auditHealth() {
    return this.substrate.auditHealth();
  }

  public getMetrics() {
    return this.substrate.getMetrics();
  }

  public getGroupedReviews(groupBy?: any, sortBy?: any, direction?: any) {
    return this.substrate.getGroupedReviews(groupBy, sortBy, direction);
  }

  public queryDsl(query: any) {
    return this.substrate.queryReviewsDsl(query);
  }

  public bulkPurge(reviewIds: readonly string[]) {
    return this.substrate.bulkPurgeReviews(reviewIds);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }

  public getTriggerPolicy() {
    return this.substrate.getTriggerPolicy();
  }

  public setTriggerPolicy(policy: any) {
    this.substrate.setTriggerPolicy(policy);
  }

  public getAllFacts() {
    return this.substrate.getAllFacts();
  }

  public getAllSkills() {
    return this.substrate.getAllSkills();
  }

  public getSubstrate(): BroccoliReviewSubstrate {
    return this.substrate;
  }
}
