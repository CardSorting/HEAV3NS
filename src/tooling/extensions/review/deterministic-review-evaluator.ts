/**
 * deterministic-review-evaluator.ts
 *
 * Deterministic in-memory evaluator for turn reviews, candidate knowledge extraction,
 * session insights breakdown, and topic title synthesis (Phase 96 / ADR-048).
 */

import type {
  CandidateFactItem,
  CandidateSkillItem,
  SessionInsightsBreakdown,
  SessionTitleSuggestion,
  TurnReviewDigest,
  TurnReviewResult,
} from "../../../core/contracts/background-review.contracts.js";

export class DeterministicReviewEvaluator {
  /**
   * Generates a compact structured turn digest from raw turn messages and tool names.
   */
  generateTurnDigest(
    turnIndex: number,
    userMessage: string,
    assistantResponse: string,
    toolNames: readonly string[],
    hasError: boolean = false
  ): TurnReviewDigest {
    const userGoal = userMessage.trim().split("\n")[0].slice(0, 120);
    const actionSummary = assistantResponse.trim().split("\n")[0].slice(0, 160);

    return {
      turnIndex,
      userGoal: userGoal || "General user query",
      assistantActionSummary: actionSummary || "Direct assistant answer",
      toolsUsed: [...toolNames],
      errorOccurred: hasError,
    };
  }

  /**
   * Extracts candidate memory facts and skills from a turn digest.
   */
  extractCandidateKnowledge(digest: TurnReviewDigest): {
    facts: CandidateFactItem[];
    skills: CandidateSkillItem[];
  } {
    const facts: CandidateFactItem[] = [];
    const skills: CandidateSkillItem[] = [];

    // Extract preference or environment facts
    const lowerGoal = digest.userGoal.toLowerCase();
    if (lowerGoal.includes("prefer") || lowerGoal.includes("always use") || lowerGoal.includes("my project uses")) {
      facts.push({
        factId: `fact-t${digest.turnIndex}-${facts.length + 1}`,
        subject: "user",
        predicate: "preference",
        object: digest.userGoal,
        confidence: 0.95,
        category: "user_preference",
      });
    }

    // Extract architectural or tool pattern skills
    if (digest.toolsUsed.length >= 2 && !digest.errorOccurred) {
      skills.push({
        skillId: `skill-t${digest.turnIndex}-${skills.length + 1}`,
        title: `Workflow: ${digest.toolsUsed.join(" -> ")}`,
        description: `Automated multi-tool execution pattern for: ${digest.userGoal}`,
        prerequisites: [...digest.toolsUsed],
      });
    }

    return { facts, skills };
  }

  /**
   * Evaluates a turn and produces a complete TurnReviewResult.
   */
  evaluateTurn(
    turnIndex: number,
    userMessage: string,
    assistantResponse: string,
    toolNames: readonly string[],
    hasError: boolean = false
  ): TurnReviewResult {
    const startTime = Date.now();
    const digest = this.generateTurnDigest(turnIndex, userMessage, assistantResponse, toolNames, hasError);
    const { facts, skills } = this.extractCandidateKnowledge(digest);
    const duration = Date.now() - startTime;

    return {
      reviewId: `review-turn-${turnIndex}-${Date.now()}`,
      turnIndex,
      candidateFacts: facts,
      candidateSkills: skills,
      reviewDigest: digest,
      durationMs: duration,
      timestamp: Date.now(),
    };
  }

  /**
   * Computes comprehensive session insights from historical turn digests and token metrics.
   */
  generateSessionInsights(
    sessionId: string,
    digests: readonly TurnReviewDigest[],
    inputTokens: number,
    outputTokens: number,
    microCentsPerThousandTokens: number = 250 // $0.0025 per 1k tokens
  ): SessionInsightsBreakdown {
    const toolCounts: Record<string, number> = {};

    for (let i = 0; i < digests.length; i++) {
      const d = digests[i];
      for (let j = 0; j < d.toolsUsed.length; j++) {
        const tool = d.toolsUsed[j];
        toolCounts[tool] = (toolCounts[tool] ?? 0) + 1;
      }
    }

    const topTools = Object.entries(toolCounts)
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count);

    const totalTokens = inputTokens + outputTokens;
    const estimatedCostMicroCents = Math.round((totalTokens / 1000) * microCentsPerThousandTokens);

    return {
      sessionId,
      totalTurns: digests.length,
      totalTokens,
      inputTokens,
      outputTokens,
      estimatedCostMicroCents,
      toolUsageCounts: toolCounts,
      topTools,
      durationMs: digests.length * 120, // Estimated duration aggregate
      generatedAt: Date.now(),
    };
  }

  /**
   * Suggests a clean 3-6 word topic title from the initial user message.
   */
  suggestSessionTitle(
    firstUserMessage: string,
    toolsUsed: readonly string[]
  ): SessionTitleSuggestion {
    const trimmed = firstUserMessage.trim();
    if (!trimmed) {
      if (toolsUsed.length > 0) {
        return {
          title: `Session using ${toolsUsed[0]}`,
          confidence: 0.7,
          derivedFrom: "tool_activity",
          timestamp: Date.now(),
        };
      }
      return {
        title: "New Agent Session",
        confidence: 0.5,
        derivedFrom: "fallback",
        timestamp: Date.now(),
      };
    }

    // Clean markdown, punctuation, and extract first 5 meaningful words
    const cleanWords = trimmed
      .replace(/[`#*_~[\](){}<>]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0 && !/^(the|a|an|please|can|you|i|want|to|do|how)$/i.test(w))
      .slice(0, 5);

    if (cleanWords.length > 0) {
      const title = cleanWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      return {
        title,
        confidence: 0.9,
        derivedFrom: "user_intent",
        timestamp: Date.now(),
      };
    }

    return {
      title: "Interactive Coding Session",
      confidence: 0.6,
      derivedFrom: "fallback",
      timestamp: Date.now(),
    };
  }
}
