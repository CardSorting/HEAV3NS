/**
 * context-breakdown-tool-suite.ts
 *
 * Model tool definitions exposing Context Window Token Breakdown & Metering to agents
 * (Phase 127 / ADR-103 / Target #60).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { ContextBreakdownSupervisor } from "../../../agents/extensions/context_breakdown/context-breakdown-supervisor.js";

export class ContextBreakdownToolSuite {
  private readonly supervisor: ContextBreakdownSupervisor;

  constructor(supervisor: ContextBreakdownSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "context_breakdown_compute",
        description:
          "Computes a categorical breakdown of token consumption across prompt, tools, rules, skills, memory, and conversation.",
        parameters: {
          systemPrompt: {
            type: "string",
            description: "System prompt text content.",
            required: false,
          },
          rulesText: {
            type: "string",
            description: "Active system rules text content.",
            required: false,
          },
          skillsText: {
            type: "string",
            description: "Injected skills text content.",
            required: false,
          },
          memoryText: {
            type: "string",
            description: "Working memory text content.",
            required: false,
          },
          model: {
            type: "string",
            description: "Active model name identifier.",
            required: false,
          },
          maxContextTokens: {
            type: "number",
            description: "Maximum context window limit in tokens.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const systemPrompt = typeof args.systemPrompt === "string" ? args.systemPrompt : undefined;
          const rulesText = typeof args.rulesText === "string" ? args.rulesText : undefined;
          const skillsText = typeof args.skillsText === "string" ? args.skillsText : undefined;
          const memoryText = typeof args.memoryText === "string" ? args.memoryText : undefined;
          const model = typeof args.model === "string" ? args.model : undefined;
          const maxContextTokens = typeof args.maxContextTokens === "number" ? args.maxContextTokens : undefined;

          const report = this.supervisor.computeBreakdown({
            systemPrompt,
            rulesText,
            skillsText,
            memoryText,
            model,
            maxContextTokens,
          });

          return {
            success: true,
            report,
          };
        },
      },
      {
        name: "context_breakdown_render_bar",
        description:
          "Renders an ASCII visual bar chart of token utilization across categories.",
        parameters: {
          width: {
            type: "number",
            description: "Width of the ASCII bar in characters (default 40).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const width = typeof args.width === "number" ? args.width : 40;
          const bar = this.supervisor.renderBar(undefined, width);
          return {
            success: true,
            bar,
          };
        },
      },
      {
        name: "context_breakdown_check_compression",
        description:
          "Evaluates whether current token volume is approaching the context compression threshold.",
        parameters: {},
        execute: async () => {
          const report = this.supervisor.getLatestReport();
          const compressionImminent = this.supervisor.isCompressionImminent();
          return {
            success: true,
            compressionImminent,
            utilizationPercent: report ? report.utilizationPercent : 0,
            headroomTokens: report ? report.headroomTokens : 0,
          };
        },
      },
      {
        name: "context_breakdown_configure",
        description:
          "Adjusts context limits, threshold percentages, and token estimation parameters.",
        parameters: {
          defaultContextLimit: {
            type: "number",
            description: "Default maximum context tokens limit.",
            required: false,
          },
          compressionThresholdPercent: {
            type: "number",
            description: "Threshold percentage at which compression is marked imminent.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const defaultContextLimit = typeof args.defaultContextLimit === "number" ? args.defaultContextLimit : undefined;
          const compressionThresholdPercent = typeof args.compressionThresholdPercent === "number" ? args.compressionThresholdPercent : undefined;

          this.supervisor.configure({
            defaultContextLimit,
            compressionThresholdPercent,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "context_breakdown_get_metrics",
        description:
          "Retrieves aggregate statistics on token breakdown evaluations and observed limits.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          return {
            success: true,
            metrics,
          };
        },
      },
    ];
  }
}
