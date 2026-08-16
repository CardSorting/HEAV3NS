/**
 * deterministic-context-breakdown-engine.ts
 *
 * Pure TypeScript Context Window Token Composition Breakdown & Category Metering Engine
 * (Phase 127 / ADR-103 / Target #60).
 */

import type {
  ContextBreakdownConfig,
  ContextBreakdownReport,
  ContextCategoryId,
  ContextCategorySlice,
} from "../../../core/contracts/context-breakdown.contracts.js";
import { DEFAULT_CONTEXT_BREAKDOWN_CONFIG } from "../../../core/contracts/context-breakdown.contracts.js";

const CATEGORY_META: Record<
  ContextCategoryId,
  { label: string; color: string }
> = {
  system_prompt: { label: "System Prompt", color: "#3B82F6" },
  tool_definitions: { label: "Tool Definitions", color: "#10B981" },
  rules: { label: "Rules & Policies", color: "#8B5CF6" },
  skills: { label: "Skills Catalog", color: "#F59E0B" },
  mcp: { label: "MCP Tools", color: "#EC4899" },
  subagent_definitions: { label: "Subagent Definitions", color: "#6366F1" },
  memory: { label: "Working Memory", color: "#14B8A6" },
  conversation: { label: "Conversation Turns", color: "#F97316" },
};

export class DeterministicContextBreakdownEngine {
  /**
   * Fast zero-allocation token estimation from character length (approx. 4 chars per token).
   */
  public charsToTokens(text?: string, multiplier = DEFAULT_CONTEXT_BREAKDOWN_CONFIG.tokenEstimationMultiplier): number {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length * multiplier));
  }

  /**
   * Fast zero-allocation token estimation from JSON serializable objects.
   */
  public jsonTokens(val?: unknown, multiplier = DEFAULT_CONTEXT_BREAKDOWN_CONFIG.tokenEstimationMultiplier): number {
    if (val === undefined || val === null) return 0;
    try {
      const serialized = JSON.stringify(val);
      return this.charsToTokens(serialized, multiplier);
    } catch {
      return 0;
    }
  }

  /**
   * Partitions a list of model tools into builtin, MCP, and subagent groups.
   */
  public partitionTools(tools: Array<{ name: string; [key: string]: unknown }>): {
    builtin: Array<{ name: string; [key: string]: unknown }>;
    mcp: Array<{ name: string; [key: string]: unknown }>;
    subagent: Array<{ name: string; [key: string]: unknown }>;
  } {
    const builtin: Array<{ name: string; [key: string]: unknown }> = [];
    const mcp: Array<{ name: string; [key: string]: unknown }> = [];
    const subagent: Array<{ name: string; [key: string]: unknown }> = [];

    for (const tool of tools) {
      if (tool.name.startsWith("mcp_")) {
        mcp.push(tool);
      } else if (tool.name.startsWith("swarm_") || tool.name.startsWith("delegate_") || tool.name === "subagent_spawn") {
        subagent.push(tool);
      } else {
        builtin.push(tool);
      }
    }

    return { builtin, mcp, subagent };
  }

  /**
   * Computes a full categorical token breakdown from raw components.
   */
  public computeBreakdown(
    params: {
      systemPrompt?: string;
      rulesText?: string;
      skillsText?: string;
      memoryText?: string;
      tools?: Array<{ name: string; [key: string]: unknown }>;
      messages?: Array<{ role: string; content: string }>;
      model?: string;
      maxContextTokens?: number;
    },
    config: ContextBreakdownConfig = DEFAULT_CONTEXT_BREAKDOWN_CONFIG
  ): ContextBreakdownReport {
    const multiplier = config.tokenEstimationMultiplier;
    const maxContext = params.maxContextTokens || config.defaultContextLimit;

    // 1. Tool partitions
    const toolPartitions = this.partitionTools(params.tools || []);
    const builtinToolTokens = this.jsonTokens(toolPartitions.builtin, multiplier);
    const mcpToolTokens = this.jsonTokens(toolPartitions.mcp, multiplier);
    const subagentToolTokens = this.jsonTokens(toolPartitions.subagent, multiplier);

    // 2. Text tokens
    const systemPromptTokens = this.charsToTokens(params.systemPrompt, multiplier);
    const rulesTokens = this.charsToTokens(params.rulesText, multiplier);
    const skillsTokens = this.charsToTokens(params.skillsText, multiplier);
    const memoryTokens = this.charsToTokens(params.memoryText, multiplier);

    // 3. Conversation tokens
    let conversationTokens = 0;
    if (params.messages && params.messages.length > 0) {
      for (const msg of params.messages) {
        conversationTokens += this.charsToTokens(msg.content, multiplier) + 4; // role + envelope overhead
      }
    }

    const rawSlices: Array<{ id: ContextCategoryId; tokens: number }> = [
      { id: "system_prompt", tokens: systemPromptTokens },
      { id: "tool_definitions", tokens: builtinToolTokens },
      { id: "rules", tokens: rulesTokens },
      { id: "skills", tokens: skillsTokens },
      { id: "mcp", tokens: mcpToolTokens },
      { id: "subagent_definitions", tokens: subagentToolTokens },
      { id: "memory", tokens: memoryTokens },
      { id: "conversation", tokens: conversationTokens },
    ];

    const totalTokens = rawSlices.reduce((acc, s) => acc + s.tokens, 0);
    const utilizationPercent = maxContext > 0 ? Math.min(100, Math.round((totalTokens / maxContext) * 100)) : 0;
    const headroomTokens = Math.max(0, maxContext - totalTokens);
    const compressionImminent = utilizationPercent >= config.compressionThresholdPercent;

    const categories: ContextCategorySlice[] = rawSlices
      .filter((s) => s.tokens > 0)
      .map((s) => {
        const meta = CATEGORY_META[s.id];
        const percentage = totalTokens > 0 ? Number(((s.tokens / totalTokens) * 100).toFixed(1)) : 0;
        return {
          id: s.id,
          label: meta.label,
          tokens: s.tokens,
          percentage,
          color: meta.color,
        };
      });

    return {
      categories,
      totalTokens,
      maxContextTokens: maxContext,
      utilizationPercent,
      headroomTokens,
      compressionImminent,
      model: params.model || "default-model",
      timestamp: Date.now(),
    };
  }

  /**
   * Formats an ASCII visual progress bar for CLI and TUI rendering.
   */
  public renderAsciiBar(report: ContextBreakdownReport, width = 40): string {
    const filled = Math.round((report.utilizationPercent / 100) * width);
    const empty = Math.max(0, width - filled);
    const bar = "█".repeat(filled) + "░".repeat(empty);

    const warnTag = report.compressionImminent ? " [COMPRESSION IMMINENT]" : "";
    return `[${bar}] ${report.utilizationPercent}% (${report.totalTokens.toLocaleString()} / ${report.maxContextTokens.toLocaleString()} tokens)${warnTag}`;
  }
}
