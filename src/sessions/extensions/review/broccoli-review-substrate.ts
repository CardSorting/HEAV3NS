/**
 * broccoli-review-substrate.ts
 *
 * In-memory Broccolidb repository for background review results, candidate facts,
 * session titles, and telemetry insights (Phase 96 / ADR-048).
 */

import type {
  ReviewWorkspaceSnapshot,
  SessionInsightsBreakdown,
  TurnReviewResult,
} from "../../../core/contracts/background-review.contracts.js";

export class BroccoliReviewSubstrate {
  private reviews: TurnReviewResult[];
  private latestInsights?: SessionInsightsBreakdown;
  private currentTitle?: string;

  constructor() {
    this.reviews = [];
  }

  recordReview(review: TurnReviewResult): void {
    this.reviews.push(review);
    if (this.reviews.length > 500) {
      this.reviews.shift();
    }
  }

  getReviews(): readonly TurnReviewResult[] {
    return this.reviews;
  }

  setLatestInsights(insights: SessionInsightsBreakdown): void {
    this.latestInsights = { ...insights };
  }

  getLatestInsights(): SessionInsightsBreakdown | undefined {
    return this.latestInsights;
  }

  setTitle(title: string): void {
    this.currentTitle = title;
  }

  getTitle(): string | undefined {
    return this.currentTitle;
  }

  exportSnapshot(): ReviewWorkspaceSnapshot {
    return {
      totalReviews: this.reviews.length,
      activeReviews: [...this.reviews],
      latestInsights: this.latestInsights ? { ...this.latestInsights } : undefined,
      currentTitle: this.currentTitle,
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: ReviewWorkspaceSnapshot): void {
    this.reviews = [...snapshot.activeReviews];
    this.latestInsights = snapshot.latestInsights ? { ...snapshot.latestInsights } : undefined;
    this.currentTitle = snapshot.currentTitle;
  }

  clear(): void {
    this.reviews = [];
    this.latestInsights = undefined;
    this.currentTitle = undefined;
  }
}
