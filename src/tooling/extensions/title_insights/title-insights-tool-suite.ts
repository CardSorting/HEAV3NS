/**
 * title-insights-tool-suite.ts
 *
 * Model tool suite for Session Titling, Provenance Governance & Conversation Insights (Target #42 / Phase 109 / ADR-085).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { TitleInsightsSupervisor } from "../../../agents/extensions/title_insights/title-insights-supervisor.js";

export class TitleInsightsToolSuite {
  private readonly supervisor: TitleInsightsSupervisor;

  constructor(supervisor: TitleInsightsSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "session_derive_title",
        description: "Instantly derive a concise deterministic session title from opening message text without calling an LLM.",
        parameters: {
          user_message: {
            type: "string",
            description: "The opening user message text",
            required: true,
          },
          max_chars: {
            type: "number",
            description: "Optional character length cap (default 48)",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const userMessage = typeof args.user_message === "string" ? args.user_message : "";
          const maxChars = typeof args.max_chars === "number" ? args.max_chars : undefined;
          const title = this.supervisor.titleGenerator.deriveTitle(userMessage, maxChars);
          return { success: true, title: title || "New Session", provenance: "derived" };
        },
      },
      {
        name: "session_generate_title",
        description: "Generate and record a 2-stage session title with provenance tracking for a session.",
        parameters: {
          session_id: {
            type: "string",
            description: "The target session ID",
            required: true,
          },
          user_message: {
            type: "string",
            description: "The opening user message text",
            required: true,
          },
          language: {
            type: "string",
            description: "Optional language constraint",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const sessionId = typeof args.session_id === "string" ? args.session_id : "";
          const userMessage = typeof args.user_message === "string" ? args.user_message : "";
          const language = typeof args.language === "string" ? args.language : undefined;
          const res = await this.supervisor.handleOpeningMessage(
            sessionId,
            userMessage,
            { language }
          );
          return {
            success: res.success,
            sessionId,
            title: res.title,
            provenance: res.provenance,
            stage: res.stage,
            latencyMs: res.latencyMs,
          };
        },
      },
      {
        name: "session_set_title",
        description: "Explicitly set or rename a session title with user or custom provenance.",
        parameters: {
          session_id: {
            type: "string",
            description: "The target session ID",
            required: true,
          },
          title: {
            type: "string",
            description: "The title string to assign",
            required: true,
          },
          provenance: {
            type: "string",
            description: "Provenance level: 'user' | 'llm' | 'derived' (default: 'user')",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const sessionId = typeof args.session_id === "string" ? args.session_id : "";
          const title = typeof args.title === "string" ? args.title : "";
          const provenance = (args.provenance === "llm" || args.provenance === "derived") ? args.provenance : "user";
          const ok = this.supervisor.setTitle(sessionId, title, provenance);
          return { success: ok, sessionId, title, provenance };
        },
      },
      {
        name: "session_get_title",
        description: "Retrieve current title, provenance, and metadata for a session.",
        parameters: {
          session_id: {
            type: "string",
            description: "The session ID to lookup",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const sessionId = typeof args.session_id === "string" ? args.session_id : "";
          const record = this.supervisor.getTitle(sessionId);
          if (!record) {
            return { success: false, error: `Session not found: ${sessionId}` };
          }
          return { success: true, record };
        },
      },
      {
        name: "session_generate_insights",
        description: "Generate a comprehensive multi-dimensional conversation insights and token economics report.",
        parameters: {
          days: {
            type: "number",
            description: "Number of historical days to inspect (default: 30)",
            required: false,
          },
          source_filter: {
            type: "string",
            description: "Optional platform filter (e.g. 'cli', 'vscode', 'telegram')",
            required: false,
          },
          format: {
            type: "string",
            description: "Output format: 'json' (structured) or 'terminal_dashboard' (formatted ANSI text)",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const days = typeof args.days === "number" ? args.days : 30;
          const sourceFilter = typeof args.source_filter === "string" ? args.source_filter : undefined;
          const report = this.supervisor.generateInsights(days, sourceFilter);
          if (args.format === "terminal_dashboard") {
            return { success: true, dashboard: this.supervisor.formatTerminalReport(report) };
          }
          return { success: true, report };
        },
      },
      {
        name: "session_get_usage_breakdown",
        description: "Fast-path lookup of tool and skill execution frequencies and error rates.",
        parameters: {
          days: {
            type: "number",
            description: "Lookback window in days (default: 30)",
            required: false,
          },
          source_filter: {
            type: "string",
            description: "Optional platform filter",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const days = typeof args.days === "number" ? args.days : 30;
          const sourceFilter = typeof args.source_filter === "string" ? args.source_filter : undefined;
          const breakdown = this.supervisor.getUsageBreakdown(days, sourceFilter);
          return { success: true, breakdown };
        },
      },
      {
        name: "session_inspect_activity_patterns",
        description: "Inspect 7x24 session activity matrix, peak usage hours, and active time distribution.",
        parameters: {
          days: {
            type: "number",
            description: "Lookback window in days (default: 30)",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const days = typeof args.days === "number" ? args.days : 30;
          const report = this.supervisor.generateInsights(days);
          return { success: true, activity: report.activity };
        },
      },
    ];
  }
}
