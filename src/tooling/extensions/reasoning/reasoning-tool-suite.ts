/**
 * reasoning-tool-suite.ts
 *
 * Model tool suite exposing dynamic streaming reasoning scrubbing, user-customizable tag pairs,
 * dynamic model timeout floors, and adaptive thinking budget configuration (Phase 102 / ADR-056).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { ReasoningEffortLevel } from "../../../core/contracts/reasoning.contracts.js";
import { ReasoningSupervisor } from "../../../agents/extensions/reasoning/reasoning-supervisor.js";

export class ReasoningToolSuite {
  private supervisor: ReasoningSupervisor;

  constructor(supervisor: ReasoningSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "reasoning_scrub_text",
        description: "Scrubs chain-of-thought and thinking blocks from assistant text using dynamic user-configured tags, separating visible prose from reasoning blocks.",
        parameters: {
          text: {
            type: "string",
            description: "The assistant text to scrub for thinking blocks",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (!args.text || typeof args.text !== "string") {
            return { success: false, error: "Missing required parameter 'text'." };
          }

          const result = this.supervisor.scrubCompleteText(args.text);
          return {
            success: true,
            visibleText: result.visibleText,
            reasoningBlocksCount: result.reasoningBlocks.length,
            reasoningBlocks: result.reasoningBlocks,
          };
        },
      },
      {
        name: "reasoning_set_effort_level",
        description: "Dynamically configures the reasoning effort level ('none', 'low', 'medium', 'high', 'max') with an optional custom token budget override.",
        parameters: {
          effortLevel: {
            type: "string",
            description: "Reasoning effort level: 'none', 'low', 'medium', 'high', 'max'",
            required: true,
          },
          customTokenBudget: {
            type: "number",
            description: "Optional custom token budget override for this effort level",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (!args.effortLevel || typeof args.effortLevel !== "string") {
            return { success: false, error: "Missing required parameter 'effortLevel'." };
          }

          const level = args.effortLevel.toLowerCase() as ReasoningEffortLevel;
          if (!["none", "low", "medium", "high", "max"].includes(level)) {
            return {
              success: false,
              error: `Invalid effortLevel '${args.effortLevel}'. Must be one of: 'none', 'low', 'medium', 'high', 'max'.`,
            };
          }

          if (typeof args.customTokenBudget === "number" && args.customTokenBudget >= 0) {
            this.supervisor.setEffortBudget(level, Math.floor(args.customTokenBudget));
          }

          this.supervisor.setEffortLevel(level);
          const budget = this.supervisor.getThinkingBudgetTokens();

          return {
            success: true,
            effortLevel: level,
            thinkingBudgetTokens: budget,
            message: `Reasoning effort level set to '${level}' with budget ${budget} tokens.`,
          };
        },
      },
      {
        name: "reasoning_configure_tags",
        description: "Dynamically registers, removes, or resets custom reasoning tag pairs (e.g. <internal_thought>, </internal_thought>) chosen by the user.",
        parameters: {
          action: {
            type: "string",
            description: "Action to perform: 'add', 'remove', 'list', 'reset'",
            required: true,
          },
          openTag: {
            type: "string",
            description: "The opening tag string (e.g. '<my_thought>')",
            required: false,
          },
          closeTag: {
            type: "string",
            description: "The closing tag string (e.g. '</my_thought>')",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const action = (args.action as string || "").toLowerCase();

          switch (action) {
            case "add": {
              if (!args.openTag || typeof args.openTag !== "string" || !args.closeTag || typeof args.closeTag !== "string") {
                return { success: false, error: "Adding a tag pair requires both 'openTag' and 'closeTag' strings." };
              }
              this.supervisor.registerTagPair({ openTag: args.openTag, closeTag: args.closeTag });
              return {
                success: true,
                message: `Registered tag pair ${args.openTag}...${args.closeTag}`,
                currentTagPairs: this.supervisor.getTagPairs(),
              };
            }
            case "remove": {
              if (!args.openTag || typeof args.openTag !== "string") {
                return { success: false, error: "Removing a tag pair requires 'openTag' string." };
              }
              const removed = this.supervisor.removeTagPair(args.openTag);
              return {
                success: true,
                removed,
                message: removed ? `Removed tag pair starting with ${args.openTag}` : `Tag ${args.openTag} not found`,
                currentTagPairs: this.supervisor.getTagPairs(),
              };
            }
            case "reset": {
              this.supervisor.setTagPairs([
                { openTag: "<think>", closeTag: "</think>" },
                { openTag: "<thinking>", closeTag: "</thinking>" },
                { openTag: "<reasoning>", closeTag: "</reasoning>" },
                { openTag: "<thought>", closeTag: "</thought>" },
                { openTag: "<REASONING_SCRATCHPAD>", closeTag: "</REASONING_SCRATCHPAD>" },
              ]);
              return {
                success: true,
                message: "Reset tag pairs to default set",
                currentTagPairs: this.supervisor.getTagPairs(),
              };
            }
            case "list":
            default: {
              return {
                success: true,
                currentTagPairs: this.supervisor.getTagPairs(),
              };
            }
          }
        },
      },
      {
        name: "reasoning_configure_timeout_floor",
        description: "Dynamically configures the idle timeout floor (in seconds) for a model slug or sets the global default timeout floor.",
        parameters: {
          modelSlug: {
            type: "string",
            description: "Model slug to configure timeout floor for (or omit to set global default)",
            required: false,
          },
          floorSeconds: {
            type: "number",
            description: "Timeout floor in seconds (e.g. 300)",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.floorSeconds !== "number" || args.floorSeconds <= 0) {
            return { success: false, error: "Missing or invalid 'floorSeconds'. Must be a positive number." };
          }

          const seconds = Math.floor(args.floorSeconds);

          if (typeof args.modelSlug === "string" && args.modelSlug.trim()) {
            const slug = args.modelSlug.trim().toLowerCase();
            this.supervisor.setTimeoutFloor(slug, seconds);
            return {
              success: true,
              modelSlug: slug,
              floorSeconds: seconds,
              message: `Configured timeout floor of ${seconds}s for model '${slug}'.`,
              allCustomFloors: this.supervisor.getAllTimeoutFloors(),
            };
          } else {
            this.supervisor.setDefaultTimeoutFloor(seconds);
            return {
              success: true,
              defaultTimeoutFloorSeconds: seconds,
              message: `Configured global default timeout floor of ${seconds}s.`,
            };
          }
        },
      },
      {
        name: "reasoning_configure_budget",
        description: "Dynamically configures custom token limits for reasoning effort levels ('none', 'low', 'medium', 'high', 'max').",
        parameters: {
          effortLevel: {
            type: "string",
            description: "Effort level: 'none', 'low', 'medium', 'high', 'max'",
            required: true,
          },
          tokenLimit: {
            type: "number",
            description: "Token budget limit for this effort level",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (!args.effortLevel || typeof args.effortLevel !== "string") {
            return { success: false, error: "Missing required parameter 'effortLevel'." };
          }
          if (typeof args.tokenLimit !== "number" || args.tokenLimit < 0) {
            return { success: false, error: "Missing or invalid 'tokenLimit'. Must be a non-negative number." };
          }

          const level = args.effortLevel.toLowerCase() as ReasoningEffortLevel;
          if (!["none", "low", "medium", "high", "max"].includes(level)) {
            return {
              success: false,
              error: `Invalid effortLevel '${args.effortLevel}'. Must be one of: 'none', 'low', 'medium', 'high', 'max'.`,
            };
          }

          const tokens = Math.floor(args.tokenLimit);
          this.supervisor.setEffortBudget(level, tokens);

          return {
            success: true,
            effortLevel: level,
            tokenLimit: tokens,
            budgetMapping: this.supervisor.getBudgetMapping(),
            message: `Configured thinking token budget of ${tokens} tokens for effort level '${level}'.`,
          };
        },
      },
      {
        name: "reasoning_inspect_trace",
        description: "Inspects recorded reasoning blocks, active tag pairs, dynamic timeout floors, and thinking token metrics.",
        parameters: {
          modelSlug: {
            type: "string",
            description: "Optional model slug to query dynamic timeout floor for",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const blocks = this.supervisor.getRecordedReasoningBlocks();
          const metrics = this.supervisor.getReasoningMetrics();
          const effortLevel = this.supervisor.getEffortLevel();
          const budget = this.supervisor.getThinkingBudgetTokens();
          const tagPairs = this.supervisor.getTagPairs();
          const budgetMapping = this.supervisor.getBudgetMapping();
          const customFloors = this.supervisor.getAllTimeoutFloors();
          const defaultFloor = this.supervisor.getDefaultTimeoutFloor();

          let timeoutFloorSeconds = defaultFloor;
          if (typeof args.modelSlug === "string" && args.modelSlug.trim()) {
            timeoutFloorSeconds = this.supervisor.getTimeoutFloor(args.modelSlug.trim());
          }

          return {
            success: true,
            currentEffortLevel: effortLevel,
            thinkingBudgetTokens: budget,
            totalReasoningTokens: metrics.totalReasoningTokens,
            totalVisibleTokens: metrics.totalVisibleTokens,
            recordedBlocksCount: blocks.length,
            modelTimeoutFloorSeconds: timeoutFloorSeconds,
            defaultTimeoutFloorSeconds: defaultFloor,
            activeTagPairs: tagPairs,
            budgetMapping,
            customTimeoutFloors: customFloors,
            blocks,
          };
        },
      },
    ];
  }
}
