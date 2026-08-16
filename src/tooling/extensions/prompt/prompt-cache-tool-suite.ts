/**
 * prompt-cache-tool-suite.ts
 *
 * Model tool suite exposing prompt cache planning, reasoning scrubbing, and status (Phase 93 / ADR-045).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { PromptCacheSupervisor } from "../../../agents/extensions/prompt/prompt-cache-supervisor.js";

export class PromptCacheToolSuite {
  private supervisor: PromptCacheSupervisor;

  constructor(supervisor: PromptCacheSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "prompt_cache_plan",
        description: "Generates the byte-stable 4-breakpoint prompt cache plan for a system prompt and conversation messages.",
        parameters: {
          systemPrompt: {
            type: "string",
            description: "The system instructions prompt to evaluate for caching breakpoints",
            required: true,
          },
          messageCount: {
            type: "number",
            description: "Estimated number of messages in the active conversation",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const systemPrompt = typeof args.systemPrompt === "string" ? args.systemPrompt : "";
          const messageCount = typeof args.messageCount === "number" ? args.messageCount : 0;

          const dummyMessages = Array.from({ length: messageCount }, (_, i) => ({
            role: i % 2 === 0 ? "user" : "assistant",
            content: `Message ${i}`,
          }));

          const envelope = this.supervisor.generatePlan(systemPrompt, dummyMessages);

          return {
            success: true,
            systemPromptHash: envelope.systemPromptHash,
            totalBreakpoints: envelope.breakpoints.length,
            breakpoints: envelope.breakpoints,
            totalPromptBytes: envelope.totalPromptBytes,
          };
        },
      },
      {
        name: "prompt_scrub_reasoning",
        description: "Scrubs raw <think> tags and chain-of-thought blocks from assistant responses to preserve clean cache prefixes.",
        parameters: {
          rawContent: {
            type: "string",
            description: "The raw assistant text content containing possible <think> tags",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const rawContent = typeof args.rawContent === "string" ? args.rawContent : "";
          const result = this.supervisor.sanitizeAssistantResponse(rawContent);

          return {
            success: true,
            hasThinkTags: result.hasThinkTags,
            sanitizedContent: result.sanitizedContent,
            reasoningContent: result.reasoningContent,
            strippedTokensCount: result.strippedTokensCount,
          };
        },
      },
      {
        name: "prompt_cache_status",
        description: "Queries the current prompt cache envelope stability and byte boundary metrics.",
        parameters: {},
        execute: async () => {
          const latest = this.supervisor.getLatestEnvelope();
          const stats = this.supervisor.getSanitizationStats();

          return {
            success: true,
            hasActiveEnvelope: latest !== undefined,
            latestEnvelope: latest,
            totalSanitizations: stats.length,
          };
        },
      },
    ];
  }
}
