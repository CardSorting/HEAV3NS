/**
 * title-insights-tool-suite.ts
 *
 * Model tool surface for Two-Stage Epistemic Session Titling & Conversation Insights (Target #42 / Phase 109 / ADR-085):
 * 30 specialized model tools for generating titles, setting custom titles, recording activity,
 * generating reports, DSL search, swimlanes, dashboards, and exporters.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  SessionActivityEvent,
  SessionTitleProvenance,
  TitleInsightsGroupBy,
  TitleInsightsSortBy,
  TitleInsightsSortDirection,
} from "../../../core/contracts/title-insights.contracts.js";
import { TitleInsightsSupervisor } from "../../../agents/extensions/title_insights/title-insights-supervisor.js";
import { TitleInsightsSnapshotManager } from "../../../sessions/extensions/title_insights/title-insights-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class TitleInsightsToolSuite {
  private readonly supervisor: TitleInsightsSupervisor;
  private readonly snapshotManager: TitleInsightsSnapshotManager;

  constructor(supervisor: TitleInsightsSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new TitleInsightsSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "title_generate",
        description: "Generates and records a two-stage session title from an opening user message.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
          userMessage: { type: "string", required: true, description: "Opening user message" },
          language: { type: "string", description: "Language code" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_generate", args);
        },
      },
      {
        name: "title_get",
        description: "Retrieves the recorded title and provenance for a session.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_get", args);
        },
      },
      {
        name: "title_list",
        description: "Lists all generated session titles.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_list", args);
        },
      },
      {
        name: "title_set_custom",
        description: "Explicitly sets a custom user title for a session, locking provenance.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
          title: { type: "string", required: true, description: "Custom title" },
          provenance: { type: "string", description: "Provenance: user, llm, or derived" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_set_custom", args);
        },
      },
      {
        name: "title_delete",
        description: "Deletes a title record for a session.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_delete", args);
        },
      },
      {
        name: "title_record_activity",
        description: "Records an activity event into the conversation telemetry ledger.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
          eventType: { type: "string", required: true, description: "Event type: message_sent, tool_called, skill_invoked, session_ended" },
          platform: { type: "string", description: "Platform" },
          model: { type: "string", description: "Model used" },
          inputTokens: { type: "number", description: "Input tokens" },
          outputTokens: { type: "number", description: "Output tokens" },
          costUsd: { type: "number", description: "Cost in USD" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_record_activity", args);
        },
      },
      {
        name: "title_list_activities",
        description: "Lists recorded activity events for a session.",
        parameters: {
          sessionId: { type: "string", description: "Optional session ID filter" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_list_activities", args);
        },
      },
      {
        name: "title_generate_insights_report",
        description: "Generates multi-dimensional cognitive insights and token economics report.",
        parameters: {
          days: { type: "number", description: "Date range in days (default 30)" },
          sourceFilter: { type: "string", description: "Optional platform filter" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_generate_insights_report", args);
        },
      },
      {
        name: "title_clean_prompt",
        description: "Unwraps control wrappers and cleans noisy markdown from prompt text.",
        parameters: {
          text: { type: "string", required: true, description: "Raw prompt text" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_clean_prompt", args);
        },
      },
      {
        name: "title_extract_instant",
        description: "Instantly derives a concise title in < 0.01 ms using pure deterministic heuristics.",
        parameters: {
          text: { type: "string", required: true, description: "Opening prompt text" },
          maxChars: { type: "number", description: "Max character length" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_extract_instant", args);
        },
      },
      {
        name: "title_audit_health",
        description: "Audits title synchronization, provenance health, and telemetry alignment.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_audit_health", args);
        },
      },
      {
        name: "title_get_metrics",
        description: "Fetches title generation latency percentiles, cost, and event counts.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_get_metrics", args);
        },
      },
      {
        name: "title_group_and_sort",
        description: "Organizes session titles into multi-criteria swimlanes (provenance, language, model, costTier).",
        parameters: {
          groupBy: { type: "string", description: "Group by: provenance, language, model, costTier" },
          sortBy: { type: "string", description: "Sort by: title, recent, cost, latency" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_group_and_sort", args);
        },
      },
      {
        name: "title_search_dsl",
        description: "Searches session titles using Natural Query DSL (e.g. 'provenance:user min_cost:0.01').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_search_dsl", args);
        },
      },
      {
        name: "title_render_dashboard",
        description: "Renders an ANSI CLI summary card with title metrics and event counts.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_render_dashboard", args);
        },
      },
      {
        name: "title_render_card",
        description: "Renders an interactive ANSI CLI session title descriptor card.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_render_card", args);
        },
      },
      {
        name: "title_export_html",
        description: "Exports session titles to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_export_html", args);
        },
      },
      {
        name: "title_export_markdown",
        description: "Exports title diagnostic report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_export_markdown", args);
        },
      },
      {
        name: "title_export_csv",
        description: "Exports session titles to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_export_csv", args);
        },
      },
      {
        name: "title_bulk_purge",
        description: "Atomically purges multiple session titles.",
        parameters: {
          sessionIdsJson: { type: "string", required: true, description: "JSON array of session IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_bulk_purge", args);
        },
      },
      {
        name: "title_undo",
        description: "Reverts the last title mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_undo", args);
        },
      },
      {
        name: "title_redo",
        description: "Re-applies the last undone title mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_redo", args);
        },
      },
      {
        name: "title_capture_snapshot",
        description: "Captures a frame-perfect snapshot of title workspace state.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_capture_snapshot", args);
        },
      },
      {
        name: "title_restore_snapshot",
        description: "Restores title workspace state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_restore_snapshot", args);
        },
      },
      {
        name: "title_get_token_economics",
        description: "Extracts token economics (inputs, outputs, cache hits, spend) across sessions.",
        parameters: {
          days: { type: "number", description: "Date range in days" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_get_token_economics", args);
        },
      },
      {
        name: "title_get_model_metrics",
        description: "Gets breakdown of usage and token cost grouped by model provider.",
        parameters: {
          days: { type: "number", description: "Date range in days" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_get_model_metrics", args);
        },
      },
      {
        name: "title_get_platform_metrics",
        description: "Gets breakdown of session distribution grouped by platform.",
        parameters: {
          days: { type: "number", description: "Date range in days" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_get_platform_metrics", args);
        },
      },
      {
        name: "title_get_tool_metrics",
        description: "Gets tool execution frequency, failure rates, and average latency.",
        parameters: {
          days: { type: "number", description: "Date range in days" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_get_tool_metrics", args);
        },
      },
      {
        name: "title_get_skill_metrics",
        description: "Gets skill invocation activity counts and distinct skills used.",
        parameters: {
          days: { type: "number", description: "Date range in days" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_get_skill_metrics", args);
        },
      },
      {
        name: "title_get_activity_trend",
        description: "Gets 7x24 weekly activity matrix and peak activity hours.",
        parameters: {
          days: { type: "number", description: "Date range in days" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("title_get_activity_trend", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    _cwd?: string
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "title_generate": {
          const sessionId = String(args.sessionId || "").trim();
          const userMessage = String(args.userMessage || "").trim();
          const language = typeof args.language === "string" ? args.language : undefined;
          const result = await this.supervisor.handleOpeningMessage(sessionId, userMessage, { language });
          return { success: result.success, result };
        }

        case "title_get": {
          const sessionId = String(args.sessionId || "").trim();
          const record = this.supervisor.getTitle(sessionId);
          if (!record) return { success: false, error: `Title for session '${sessionId}' not found` };
          return { success: true, record };
        }

        case "title_list": {
          const titles = this.supervisor.getAllTitles();
          return { success: true, count: titles.length, titles };
        }

        case "title_set_custom": {
          const sessionId = String(args.sessionId || "").trim();
          const title = String(args.title || "").trim();
          const provenance = (args.provenance as SessionTitleProvenance) || "user";
          const ok = this.supervisor.setTitle(sessionId, title, provenance);
          return { success: ok, sessionId, title, provenance };
        }

        case "title_delete": {
          const sessionId = String(args.sessionId || "").trim();
          const ok = this.supervisor.deleteTitle(sessionId);
          return { success: ok, sessionId };
        }

        case "title_record_activity": {
          const sessionId = String(args.sessionId || "").trim();
          const eventType = String(args.eventType || "message_sent") as any;
          const platform = String(args.platform || "default");
          const model = String(args.model || "default");
          const inputTokens = typeof args.inputTokens === "number" ? args.inputTokens : undefined;
          const outputTokens = typeof args.outputTokens === "number" ? args.outputTokens : undefined;
          const costUsd = typeof args.costUsd === "number" ? args.costUsd : undefined;

          const event: SessionActivityEvent = {
            eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            sessionId,
            timestamp: Date.now(),
            eventType,
            platform,
            model,
            inputTokens,
            outputTokens,
            costUsd,
          };
          this.supervisor.recordActivity(event);
          return { success: true, event };
        }

        case "title_list_activities": {
          const sessionId = typeof args.sessionId === "string" ? args.sessionId : undefined;
          const events = this.supervisor.getSubstrate().listActivityEvents(sessionId);
          return { success: true, count: events.length, events };
        }

        case "title_generate_insights_report": {
          const days = typeof args.days === "number" ? args.days : 30;
          const sourceFilter = typeof args.sourceFilter === "string" ? args.sourceFilter : undefined;
          const report = this.supervisor.generateInsights(days, sourceFilter);
          return { success: true, report };
        }

        case "title_clean_prompt": {
          const text = String(args.text || "");
          const cleaned = this.supervisor.titleGenerator.cleanTitle(text);
          return { success: true, cleaned };
        }

        case "title_extract_instant": {
          const text = String(args.text || "");
          const maxChars = typeof args.maxChars === "number" ? args.maxChars : undefined;
          const title = this.supervisor.titleGenerator.deriveTitle(text, maxChars);
          return { success: true, title: title || "New Session", provenance: "derived" };
        }

        case "title_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "title_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "title_group_and_sort": {
          const groupBy = (args.groupBy as TitleInsightsGroupBy) || "provenance";
          const sortBy = (args.sortBy as TitleInsightsSortBy) || "recent";
          const direction = (args.direction as TitleInsightsSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedTitles(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "title_search_dsl": {
          const query = String(args.query || "");
          const titles = this.supervisor.queryDsl(query);
          return { success: true, count: titles.length, titles };
        }

        case "title_render_dashboard": {
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderTitleInsightsDashboard(metrics);
          return { success: true, rendered };
        }

        case "title_render_card": {
          const sessionId = String(args.sessionId || "").trim();
          const record = this.supervisor.getTitle(sessionId);
          if (!record) return { success: false, error: `Title for session '${sessionId}' not found` };
          const rendered = BroccoliViewRenderer.renderSessionTitleCard(record);
          return { success: true, rendered };
        }

        case "title_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "title_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "title_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "title_bulk_purge": {
          const idsJson = String(args.sessionIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "sessionIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "title_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "title_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "title_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "title_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frame);
          return { ...res };
        }

        case "title_get_token_economics": {
          const days = typeof args.days === "number" ? args.days : 30;
          const report = this.supervisor.generateInsights(days);
          return { success: true, tokenEconomics: report.tokenEconomics };
        }

        case "title_get_model_metrics": {
          const days = typeof args.days === "number" ? args.days : 30;
          const report = this.supervisor.generateInsights(days);
          return { success: true, models: report.models };
        }

        case "title_get_platform_metrics": {
          const days = typeof args.days === "number" ? args.days : 30;
          const report = this.supervisor.generateInsights(days);
          return { success: true, platforms: report.platforms };
        }

        case "title_get_tool_metrics": {
          const days = typeof args.days === "number" ? args.days : 30;
          const report = this.supervisor.generateInsights(days);
          return { success: true, tools: report.tools };
        }

        case "title_get_skill_metrics": {
          const days = typeof args.days === "number" ? args.days : 30;
          const report = this.supervisor.generateInsights(days);
          return { success: true, skills: report.skills };
        }

        case "title_get_activity_trend": {
          const days = typeof args.days === "number" ? args.days : 30;
          const report = this.supervisor.generateInsights(days);
          return { success: true, activity: report.activity };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
