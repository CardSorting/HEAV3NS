/**
 * tool-choice-policy-orchestrator.ts
 *
 * Multi-Model Tool Choice Policy Orchestrator.
 * Standardizes tool choice configurations across OpenAI, Anthropic, and Gemini.
 * Supports "auto", "required", "none", and "forced" (exact tool name) policies
 * with automatic fallback to system prompt directives.
 */

export type ToolChoiceMode = "auto" | "none" | "required" | "forced";

export interface ToolChoicePolicy {
  readonly mode: ToolChoiceMode;
  readonly forcedToolName?: string;
}

export class ToolChoicePolicyOrchestrator {
  /**
   * Formats tool choice for OpenAI API payload.
   */
  public toOpenAIToolChoice(policy: ToolChoicePolicy): unknown {
    switch (policy.mode) {
      case "none":
        return "none";
      case "required":
        return "required";
      case "forced":
        if (!policy.forcedToolName) {
          throw new Error("Forced tool choice requires forcedToolName");
        }
        return {
          type: "function",
          function: { name: policy.forcedToolName },
        };
      case "auto":
      default:
        return "auto";
    }
  }

  /**
   * Formats tool choice for Anthropic API payload.
   */
  public toAnthropicToolChoice(policy: ToolChoicePolicy): unknown {
    switch (policy.mode) {
      case "none":
        return undefined; // In Anthropic, omit tools or pass tool_choice
      case "required":
        return { type: "any" };
      case "forced":
        if (!policy.forcedToolName) {
          throw new Error("Forced tool choice requires forcedToolName");
        }
        return { type: "tool", name: policy.forcedToolName };
      case "auto":
      default:
        return { type: "auto" };
    }
  }

  /**
   * Formats tool config for Gemini API payload.
   */
  public toGeminiToolConfig(policy: ToolChoicePolicy): unknown {
    switch (policy.mode) {
      case "none":
        return { function_calling_config: { mode: "NONE" } };
      case "required":
        return { function_calling_config: { mode: "ANY" } };
      case "forced":
        if (!policy.forcedToolName) {
          throw new Error("Forced tool choice requires forcedToolName");
        }
        return {
          function_calling_config: {
            mode: "ANY",
            allowed_function_names: [policy.forcedToolName],
          },
        };
      case "auto":
      default:
        return { function_calling_config: { mode: "AUTO" } };
    }
  }

  /**
   * Serializes a tool choice instruction into a system prompt directive fallback
   * for providers that don't support native tool_choice headers.
   */
  public toSystemPromptDirective(policy: ToolChoicePolicy): string {
    switch (policy.mode) {
      case "none":
        return "CRITICAL DIRECTIVE: Do not call any tools during this turn. Provide text answer directly.";
      case "required":
        return "CRITICAL DIRECTIVE: You MUST invoke at least one tool to make progress on this turn.";
      case "forced":
        return `CRITICAL DIRECTIVE: You MUST invoke the '${policy.forcedToolName}' tool as your first action on this turn.`;
      case "auto":
      default:
        return "";
    }
  }
}
