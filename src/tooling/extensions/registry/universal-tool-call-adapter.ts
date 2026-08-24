/**
 * universal-tool-call-adapter.ts
 *
 * Universal Provider Wire Format Adapter.
 * Translates incoming tool calls and outgoing execution results across
 * OpenAI, Anthropic, Gemini, OpenRouter, and Ollama envelope standards into
 * unified LUMI tool executions.
 */

import type { ToolExecutionRecord } from "../../../core/contracts/tooling.contracts.js";
import type { ScheduledToolCall } from "../execution/tool-execution-scheduler.js";

export type SupportedModelProvider = "openai" | "anthropic" | "gemini" | "openrouter" | "ollama";

export class UniversalToolCallAdapter {
  /**
   * Parses raw provider message payload into normalized ScheduledToolCall array.
   */
  public extractToolCalls(
    provider: SupportedModelProvider,
    rawPayload: Record<string, unknown>
  ): ScheduledToolCall[] {
    const calls: ScheduledToolCall[] = [];

    if (provider === "openai" || provider === "openrouter" || provider === "ollama") {
      // OpenAI / OpenRouter / Ollama envelope format
      const choice = (rawPayload.choices as Array<Record<string, unknown>>)?.[0];
      const message = choice?.message as Record<string, unknown> | undefined;
      const toolCalls = (message?.tool_calls || rawPayload.tool_calls) as Array<{
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string | Record<string, unknown> };
      }> | undefined;

      if (Array.isArray(toolCalls)) {
        for (const tc of toolCalls) {
          if (tc.function?.name) {
            calls.push({
              id: tc.id || `call_${Math.random().toString(36).slice(2, 9)}`,
              name: tc.function.name,
              args: tc.function.arguments || {},
            });
          }
        }
      }
    } else if (provider === "anthropic") {
      // Anthropic Claude tool_use content blocks
      const content = rawPayload.content as Array<{
        type?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }> | undefined;

      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "tool_use" && block.name) {
            calls.push({
              id: block.id || `toolu_${Math.random().toString(36).slice(2, 9)}`,
              name: block.name,
              args: block.input || {},
            });
          }
        }
      }
    } else if (provider === "gemini") {
      // Google Gemini functionCall candidate parts
      const candidates = (rawPayload.candidates as Array<Record<string, unknown>>)?.[0];
      const parts = (candidates?.content as Record<string, unknown>)?.parts as Array<{
        functionCall?: { name?: string; args?: Record<string, unknown> };
      }> | undefined;

      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part.functionCall?.name) {
            calls.push({
              id: `gemini_call_${Math.random().toString(36).slice(2, 9)}`,
              name: part.functionCall.name,
              args: part.functionCall.args || {},
            });
          }
        }
      }
    }

    return calls;
  }

  /**
   * Formats a ToolExecutionRecord into the provider's exact response wire format.
   */
  public formatToolResponse(
    provider: SupportedModelProvider,
    record: ToolExecutionRecord
  ): Record<string, unknown> {
    const stringifiedOutput =
      typeof record.output === "string" ? record.output : JSON.stringify(record.output, null, 2);

    if (provider === "openai" || provider === "openrouter" || provider === "ollama") {
      return {
        role: "tool",
        tool_call_id: record.callId || "unknown_call",
        name: record.name,
        content: stringifiedOutput,
      };
    } else if (provider === "anthropic") {
      return {
        type: "tool_result",
        tool_use_id: record.callId || "unknown_tool_use",
        content: stringifiedOutput,
        is_error: record.success === false,
      };
    } else if (provider === "gemini") {
      return {
        functionResponse: {
          name: record.name,
          response: {
            output: record.output,
            success: record.success !== false,
          },
        },
      };
    }

    // Default fallback
    return {
      role: "tool",
      tool_call_id: record.callId,
      name: record.name,
      content: stringifiedOutput,
    };
  }
}
