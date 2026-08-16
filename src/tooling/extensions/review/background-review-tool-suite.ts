/**
 * background-review-tool-suite.ts
 *
 * Model tool suite exposing background review evaluation, session insights, and title synthesis (Phase 96 / ADR-048).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { BackgroundReviewSupervisor } from "../../../agents/extensions/review/background-review-supervisor.js";

export class BackgroundReviewToolSuite {
  private supervisor: BackgroundReviewSupervisor;

  constructor(supervisor: BackgroundReviewSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "review_trigger_evaluation",
        description: "Evaluates a conversation turn to extract candidate facts and reusable skills in the background.",
        parameters: {
          turnIndex: {
            type: "number",
            description: "The index of the conversation turn",
            required: true,
          },
          userMessage: {
            type: "string",
            description: "The user query or instruction",
            required: true,
          },
          assistantResponse: {
            type: "string",
            description: "The assistant final response or action summary",
            required: true,
          },
          toolsUsed: {
            type: "string",
            description: "Comma-separated list of tools used during the turn",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const turnIndex = typeof args.turnIndex === "number" ? args.turnIndex : 1;
          const userMessage = typeof args.userMessage === "string" ? args.userMessage : "";
          const assistantResponse = typeof args.assistantResponse === "string" ? args.assistantResponse : "";
          const rawTools = typeof args.toolsUsed === "string" ? args.toolsUsed : "";
          const toolNames = rawTools
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          const result = this.supervisor.evaluateTurn(
            turnIndex,
            userMessage,
            assistantResponse,
            toolNames
          );

          return {
            success: true,
            reviewId: result.reviewId,
            candidateFactsCount: result.candidateFacts.length,
            candidateSkillsCount: result.candidateSkills.length,
            candidateFacts: result.candidateFacts,
            candidateSkills: result.candidateSkills,
          };
        },
      },
      {
        name: "session_generate_insights",
        description: "Generates structured session insights, token metrics, tool usage distributions, and cost estimates.",
        parameters: {
          sessionId: {
            type: "string",
            description: "The active session identifier",
            required: true,
          },
          inputTokens: {
            type: "number",
            description: "Total input tokens consumed in the session",
            required: false,
          },
          outputTokens: {
            type: "number",
            description: "Total output tokens consumed in the session",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const sessionId = typeof args.sessionId === "string" ? args.sessionId : "default";
          const inputTokens = typeof args.inputTokens === "number" ? args.inputTokens : 1000;
          const outputTokens = typeof args.outputTokens === "number" ? args.outputTokens : 500;

          const reviews = this.supervisor.getReviews();
          const digests = reviews.map((r) => r.reviewDigest);

          const insights = this.supervisor.generateSessionInsights(
            sessionId,
            digests,
            inputTokens,
            outputTokens
          );

          return {
            success: true,
            totalTurns: insights.totalTurns,
            totalTokens: insights.totalTokens,
            estimatedCostMicroCents: insights.estimatedCostMicroCents,
            topTools: insights.topTools,
          };
        },
      },
      {
        name: "session_suggest_title",
        description: "Synthesizes a clean 3-6 word topic title for the conversation session.",
        parameters: {
          firstUserMessage: {
            type: "string",
            description: "The first user query or instruction in the session",
            required: true,
          },
          toolsUsed: {
            type: "string",
            description: "Comma-separated list of tools used in the first turn",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const firstUserMessage = typeof args.firstUserMessage === "string" ? args.firstUserMessage : "";
          const rawTools = typeof args.toolsUsed === "string" ? args.toolsUsed : "";
          const toolNames = rawTools
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          const suggestion = this.supervisor.suggestTitle(firstUserMessage, toolNames);

          return {
            success: true,
            title: suggestion.title,
            confidence: suggestion.confidence,
            derivedFrom: suggestion.derivedFrom,
          };
        },
      },
    ];
  }
}
