/**
 * prompt-cache-tool-suite.ts
 *
 * Model tool surface for Deterministic Byte-Stable Prompt Cache Boundary,
 * Progressive System Envelope & Reasoning Sanitizer Subsystem (Phase 93 / ADR-045 / Target #82):
 * 30 specialized model tools for calculating envelopes, injecting breakpoints,
 * sanitizing reasoning tags, querying DSL, swimlanes, dashboards, and HTML/Markdown/CSV exports.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  CacheBreakpointType,
  PromptCacheGroupBy,
  PromptCacheSortBy,
  PromptCacheSortDirection,
} from "../../../core/contracts/prompt-cache.contracts.js";
import { PromptCacheSupervisor } from "../../../agents/extensions/prompt/prompt-cache-supervisor.js";
import { PromptCacheSnapshotManager } from "../../../sessions/extensions/prompt/prompt-cache-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class PromptCacheToolSuite {
  private readonly supervisor: PromptCacheSupervisor;
  private readonly snapshotManager: PromptCacheSnapshotManager;

  constructor(supervisor: PromptCacheSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new PromptCacheSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "prompt_cache_plan",
        description: "Generates the byte-stable 4-breakpoint prompt cache plan for a system prompt and conversation messages.",
        parameters: {
          systemPrompt: { type: "string", required: true, description: "System prompt" },
          messageCount: { type: "number", description: "Message count estimate" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_plan", args);
        },
      },
      {
        name: "prompt_scrub_reasoning",
        description: "Scrubs raw <think> tags and chain-of-thought blocks from assistant responses.",
        parameters: {
          rawContent: { type: "string", required: true, description: "Raw assistant text" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_scrub_reasoning", args);
        },
      },
      {
        name: "prompt_cache_status",
        description: "Queries active prompt cache envelope stability and metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_status", args);
        },
      },
      {
        name: "prompt_cache_configure",
        description: "Configures prompt cache parameters.",
        parameters: {
          minBreakpointTokens: { type: "number", description: "Min tokens" },
          maxBreakpoints: { type: "number", description: "Max breakpoints" },
          enableReasoningSanitization: { type: "boolean", description: "Enable sanitization" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_configure", args);
        },
      },
      {
        name: "prompt_cache_get_config",
        description: "Retrieves active prompt cache configuration.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_config", args);
        },
      },
      {
        name: "prompt_cache_get_metrics",
        description: "Fetches aggregated prompt caching metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_metrics", args);
        },
      },
      {
        name: "prompt_cache_get_metrics_report",
        description: "Retrieves detailed prompt cache metrics report with breakdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_metrics_report", args);
        },
      },
      {
        name: "prompt_cache_audit_health",
        description: "Audits prompt cache SLA health posture and prefix coverage.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_audit_health", args);
        },
      },
      {
        name: "prompt_cache_record_breakpoint",
        description: "Records a custom breakpoint into the memory ledger.",
        parameters: {
          target: { type: "string", required: true, description: "Target system/message/tool" },
          type: { type: "string", required: true, description: "Breakpoint type" },
          byteOffset: { type: "number", required: true, description: "Byte offset" },
          tokenEstimate: { type: "number", required: true, description: "Token estimate" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_record_breakpoint", args);
        },
      },
      {
        name: "prompt_cache_get_breakpoint",
        description: "Retrieves a recorded breakpoint by ID.",
        parameters: {
          id: { type: "string", required: true, description: "Breakpoint ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_breakpoint", args);
        },
      },
      {
        name: "prompt_cache_list_breakpoints",
        description: "Lists all recorded prompt cache breakpoints.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_list_breakpoints", args);
        },
      },
      {
        name: "prompt_cache_remove_breakpoint",
        description: "Removes a breakpoint from the ledger.",
        parameters: {
          id: { type: "string", required: true, description: "Breakpoint ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_remove_breakpoint", args);
        },
      },
      {
        name: "prompt_cache_clear_breakpoints",
        description: "Clears all recorded breakpoints.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_clear_breakpoints", args);
        },
      },
      {
        name: "prompt_cache_compute_hash",
        description: "Computes deterministic SHA-256 hash of a prompt string.",
        parameters: {
          prompt: { type: "string", required: true, description: "Prompt string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_compute_hash", args);
        },
      },
      {
        name: "prompt_cache_group_and_sort",
        description: "Organizes breakpoints into multi-criteria swimlanes (target, breakpointType).",
        parameters: {
          groupBy: { type: "string", description: "target, breakpointType" },
          sortBy: { type: "string", description: "timestamp, byteOffset, tokenEstimate" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_group_and_sort", args);
        },
      },
      {
        name: "prompt_cache_search_dsl",
        description: "Searches breakpoints using Natural Query DSL (e.g. 'type:static_prefix').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_search_dsl", args);
        },
      },
      {
        name: "prompt_cache_render_dashboard",
        description: "Renders an ANSI CLI summary card with prompt caching statistics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_render_dashboard", args);
        },
      },
      {
        name: "prompt_cache_render_breakpoint_card",
        description: "Renders an interactive ANSI CLI breakpoint descriptor card.",
        parameters: {
          breakpointIndex: { type: "number", required: true, description: "Index" },
          target: { type: "string", required: true, description: "Target" },
          breakpointType: { type: "string", required: true, description: "Type" },
          byteOffset: { type: "number", required: true, description: "Byte offset" },
          tokenEstimate: { type: "number", required: true, description: "Token estimate" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_render_breakpoint_card", args);
        },
      },
      {
        name: "prompt_cache_export_html_view",
        description: "Exports prompt cache ledger to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_export_html_view", args);
        },
      },
      {
        name: "prompt_cache_export_markdown_report",
        description: "Exports prompt cache report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_export_markdown_report", args);
        },
      },
      {
        name: "prompt_cache_export_csv_report",
        description: "Exports prompt cache ledger to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_export_csv_report", args);
        },
      },
      {
        name: "prompt_cache_bulk_purge",
        description: "Atomically purges multiple breakpoints from the ledger.",
        parameters: {
          idsJson: { type: "string", required: true, description: "JSON array of IDs" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_bulk_purge", args);
        },
      },
      {
        name: "prompt_cache_undo",
        description: "Reverts the last prompt cache mutation from undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_undo", args);
        },
      },
      {
        name: "prompt_cache_redo",
        description: "Re-applies the last undone prompt cache mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_redo", args);
        },
      },
      {
        name: "prompt_cache_capture_snapshot",
        description: "Captures a frame-perfect snapshot of cache state.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_capture_snapshot", args);
        },
      },
      {
        name: "prompt_cache_restore_snapshot",
        description: "Restores cache state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_restore_snapshot", args);
        },
      },
      {
        name: "prompt_cache_format_breakpoint",
        description: "Formats a breakpoint into a standardized tag string.",
        parameters: {
          breakpointIndex: { type: "number", required: true, description: "Index" },
          target: { type: "string", required: true, description: "Target" },
          breakpointType: { type: "string", required: true, description: "Type" },
          byteOffset: { type: "number", required: true, description: "Offset" },
          tokenEstimate: { type: "number", required: true, description: "Tokens" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_format_breakpoint", args);
        },
      },
      {
        name: "prompt_cache_format_envelope",
        description: "Formats a cache envelope into a summary string.",
        parameters: {
          staticPrefixBytes: { type: "number", required: true, description: "Static bytes" },
          totalPromptBytes: { type: "number", required: true, description: "Total bytes" },
          systemPromptHash: { type: "string", required: true, description: "Hash" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_format_envelope", args);
        },
      },
      {
        name: "prompt_cache_estimate_tokens",
        description: "Estimates token count from byte length or character count.",
        parameters: {
          bytes: { type: "number", required: true, description: "Byte count" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_estimate_tokens", args);
        },
      },
      {
        name: "prompt_cache_get_latest_envelope",
        description: "Fetches latest active cache envelope.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_latest_envelope", args);
        },
      },
      {
        name: "prompt_cache_analyze_efficiency",
        description: "Analyzes prompt cache efficiency, structural coverage, and financial/latency ROI.",
        parameters: {
          systemPrompt: { type: "string", required: true, description: "System prompt" },
          modelId: { type: "string", description: "Target model ID (e.g. anthropic/claude-3.7-sonnet)" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_analyze_efficiency", args);
        },
      },
      {
        name: "prompt_cache_simulate_savings",
        description: "Simulates multi-turn cost and latency savings for a model and prompt size.",
        parameters: {
          modelId: { type: "string", description: "Target model ID" },
          turnCount: { type: "number", description: "Projected turn count" },
          promptTokens: { type: "number", description: "Prompt token size" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_simulate_savings", args);
        },
      },
      {
        name: "prompt_cache_get_human_summary",
        description: "Generates approachable plain-English diagnostic summary of prompt cache status.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_human_summary", args);
        },
      },
      {
        name: "prompt_cache_get_provider_directives",
        description: "Fetches provider-specific caching directives and breakpoint rules.",
        parameters: {
          modelId: { type: "string", description: "Target model ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_provider_directives", args);
        },
      },
      {
        name: "prompt_cache_get_scorecard",
        description: "Generates 4-dimensional prompt caching efficiency scorecard and grade (A+/A/B/C/D).",
        parameters: {
          systemPrompt: { type: "string", description: "System prompt text" },
          modelId: { type: "string", description: "Target model ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_scorecard", args);
        },
      },
      {
        name: "prompt_cache_get_invalidation_forensics",
        description: "Pinpoints exact character, line, column, and byte offset where prompt prefix mutated.",
        parameters: {
          prevSystemPrompt: { type: "string", description: "Previous system prompt" },
          newSystemPrompt: { type: "string", description: "New system prompt" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_invalidation_forensics", args);
        },
      },
      {
        name: "prompt_cache_get_optimization_prescriptions",
        description: "Retrieves prioritized, step-by-step actionable recommendations for maximizing cache retention.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_optimization_prescriptions", args);
        },
      },
      {
        name: "prompt_cache_calculate_provider_roi",
        description: "Calculates multi-provider cost savings comparison matrix across frontier models.",
        parameters: {
          promptTokens: { type: "number", description: "Total prompt tokens" },
          cachedTokens: { type: "number", description: "Cached prompt tokens" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_calculate_provider_roi", args);
        },
      },
      {
        name: "prompt_cache_get_telemetry_headers",
        description: "Generates Cloudflare/Vercel-style HTTP telemetry headers (X-Lumi-Cache-*) for prompt cache tracing.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_telemetry_headers", args);
        },
      },
      {
        name: "prompt_cache_get_savings_forecast",
        description: "Generates period-based savings forecasts (Daily/Weekly/Monthly/Annual) and warmth tiering.",
        parameters: {
          projectedDailyTurns: { type: "number", description: "Projected daily turns (default: 200)" },
          modelId: { type: "string", description: "Target model ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_savings_forecast", args);
        },
      },
      {
        name: "prompt_cache_get_layered_fingerprints",
        description: "Generates Docker-style multi-layer SHA-256 cache fingerprints across L0-L3 tiers.",
        parameters: {
          systemPrompt: { type: "string", description: "System prompt text" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_layered_fingerprints", args);
        },
      },
      {
        name: "prompt_cache_get_remediation_diffs",
        description: "Retrieves step-by-step remediation recipes with before/after code diff patterns.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_remediation_diffs", args);
        },
      },
      {
        name: "prompt_cache_get_waterfall_trace",
        description: "Generates Datadog/APM-style prefill waterfall execution timeline across semantic tiers.",
        parameters: {
          modelId: { type: "string", description: "Target model ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_get_waterfall_trace", args);
        },
      },
      {
        name: "prompt_cache_audit_alerts",
        description: "Audits real-time anomaly detection and prompt cache health alert policies.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_audit_alerts", args);
        },
      },
      {
        name: "prompt_cache_explain_plan",
        description: "PostgreSQL-style EXPLAIN simulation for prompt caching costs and prefill latency.",
        parameters: {
          systemPrompt: { type: "string", required: true, description: "System prompt text" },
          modelId: { type: "string", description: "Target model ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_explain_plan", args);
        },
      },
      {
        name: "prompt_cache_auto_tune_prompt",
        description: "Automatically restructures a system prompt to isolate volatile variables and maximize cache reuse.",
        parameters: {
          systemPrompt: { type: "string", required: true, description: "Raw system prompt" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("prompt_cache_auto_tune_prompt", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "prompt_cache_plan": {
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
        }

        case "prompt_scrub_reasoning": {
          const rawContent = typeof args.rawContent === "string" ? args.rawContent : "";
          const result = this.supervisor.sanitizeAssistantResponse(rawContent);
          return {
            success: true,
            hasThinkTags: result.hasThinkTags,
            sanitizedContent: result.sanitizedContent,
            reasoningContent: result.reasoningContent,
            strippedTokensCount: result.strippedTokensCount,
          };
        }

        case "prompt_cache_status": {
          const latest = this.supervisor.getLatestEnvelope();
          const stats = this.supervisor.getSanitizationStats();
          return {
            success: true,
            hasActiveEnvelope: latest !== undefined,
            latestEnvelope: latest,
            totalSanitizations: stats.length,
          };
        }

        case "prompt_cache_configure": {
          this.supervisor.configure(args as any);
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "prompt_cache_get_config": {
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "prompt_cache_get_metrics": {
          return { success: true, metrics: this.supervisor.getMetrics() };
        }

        case "prompt_cache_get_metrics_report": {
          return { success: true, report: this.supervisor.getMetricsReport() };
        }

        case "prompt_cache_audit_health": {
          return { success: true, audit: this.supervisor.auditHealth() };
        }

        case "prompt_cache_record_breakpoint": {
          const target = (args.target as any) || "system";
          const type = (args.type as CacheBreakpointType) || "static_prefix";
          const byteOffset = typeof args.byteOffset === "number" ? args.byteOffset : 0;
          const tokenEstimate = typeof args.tokenEstimate === "number" ? args.tokenEstimate : Math.ceil(byteOffset / 4);
          const breakpointId = `bp-custom-${Date.now()}`;
          this.supervisor.getSubstrate().recordBreakpoint({
            breakpointId,
            breakpointIndex: 0,
            target,
            breakpointType: type,
            byteOffset,
            tokenEstimate,
            envelopeHash: "custom",
            timestamp: Date.now(),
          });
          return { success: true, breakpointId };
        }

        case "prompt_cache_get_breakpoint": {
          const id = String(args.id || "");
          const bp = this.supervisor.getSubstrate().getBreakpoint(id);
          if (!bp) return { success: false, error: `Breakpoint '${id}' not found` };
          return { success: true, breakpoint: bp };
        }

        case "prompt_cache_list_breakpoints": {
          const bps = this.supervisor.getSubstrate().listBreakpoints();
          return { success: true, count: bps.length, breakpoints: bps };
        }

        case "prompt_cache_remove_breakpoint": {
          const id = String(args.id || "");
          const ok = this.supervisor.getSubstrate().removeBreakpoint(id);
          return { success: ok };
        }

        case "prompt_cache_clear_breakpoints": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
        }

        case "prompt_cache_compute_hash": {
          const prompt = String(args.prompt || "");
          const hash = this.supervisor.getCacher().computeSystemPromptHash(prompt);
          return { success: true, hash };
        }

        case "prompt_cache_group_and_sort": {
          const groupBy = (args.groupBy as PromptCacheGroupBy) || "target";
          const sortBy = (args.sortBy as PromptCacheSortBy) || "timestamp";
          const direction = (args.direction as PromptCacheSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedBreakpoints(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "prompt_cache_search_dsl": {
          const query = String(args.query || "");
          const bps = this.supervisor.queryDsl(query);
          return { success: true, count: bps.length, breakpoints: bps };
        }

        case "prompt_cache_render_dashboard": {
          const metrics = this.supervisor.getMetrics();
          const health = this.supervisor.auditHealth();
          const rendered = BroccoliViewRenderer.renderPromptCacheDashboard({
            totalEnvelopes: metrics.totalEnvelopesCalculated,
            totalBreakpoints: metrics.totalBreakpointsInserted,
            totalTokensCached: metrics.estimatedTokensCached,
            sanitizedReasonings: metrics.totalSanitizedReasonings,
            coveragePercent: health.staticPrefixCoveragePercent,
            healthStatus: health.healthStatus,
          });
          return { success: true, rendered };
        }

        case "prompt_cache_render_breakpoint_card": {
          const rendered = BroccoliViewRenderer.renderPromptCacheBreakpointCard({
            breakpointIndex: typeof args.breakpointIndex === "number" ? args.breakpointIndex : 0,
            target: String(args.target || "system"),
            breakpointType: String(args.breakpointType || "static_prefix"),
            byteOffset: typeof args.byteOffset === "number" ? args.byteOffset : 0,
            tokenEstimate: typeof args.tokenEstimate === "number" ? args.tokenEstimate : 0,
          });
          return { success: true, rendered };
        }

        case "prompt_cache_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "prompt_cache_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "prompt_cache_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "prompt_cache_bulk_purge": {
          const idsJson = String(args.idsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "idsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "prompt_cache_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "prompt_cache_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "prompt_cache_capture_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const snap = this.snapshotManager.captureSnapshot(frameId);
          return { success: true, frameId, snapshot: snap };
        }

        case "prompt_cache_restore_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frameId);
          return { ...res };
        }

        case "prompt_cache_format_breakpoint": {
          const formatted = this.supervisor.getCacher().formatBreakpoint({
            breakpointIndex: typeof args.breakpointIndex === "number" ? args.breakpointIndex : 0,
            target: (args.target as any) || "system",
            breakpointType: (args.breakpointType as any) || "static_prefix",
            byteOffset: typeof args.byteOffset === "number" ? args.byteOffset : 0,
            tokenEstimate: typeof args.tokenEstimate === "number" ? args.tokenEstimate : 0,
          });
          return { success: true, formatted };
        }

        case "prompt_cache_format_envelope": {
          const formatted = this.supervisor.getCacher().formatCacheEnvelope({
            staticPrefixBytes: typeof args.staticPrefixBytes === "number" ? args.staticPrefixBytes : 0,
            totalPromptBytes: typeof args.totalPromptBytes === "number" ? args.totalPromptBytes : 0,
            systemPromptHash: String(args.systemPromptHash || "00000000"),
            dynamicSuffixBytes: 0,
            breakpoints: [],
          });
          return { success: true, formatted };
        }

        case "prompt_cache_estimate_tokens": {
          const bytes = typeof args.bytes === "number" ? args.bytes : 0;
          return { success: true, estimatedTokens: Math.ceil(bytes / 4) };
        }

        case "prompt_cache_get_latest_envelope": {
          const env = this.supervisor.getLatestEnvelope();
          return { success: true, envelope: env };
        }

        case "prompt_cache_analyze_efficiency": {
          const systemPrompt = typeof args.systemPrompt === "string" ? args.systemPrompt : "";
          const modelId = typeof args.modelId === "string" ? args.modelId : undefined;
          const analysis = this.supervisor.analyzePromptEfficiency(systemPrompt, [], [], modelId);
          return { success: true, analysis };
        }

        case "prompt_cache_simulate_savings": {
          const modelId = typeof args.modelId === "string" ? args.modelId : "anthropic/claude-3.7-sonnet";
          const turnCount = typeof args.turnCount === "number" ? args.turnCount : 20;
          const promptTokens = typeof args.promptTokens === "number" ? args.promptTokens : 4096;
          const simulation = this.supervisor.simulateSavings(modelId, turnCount, promptTokens);
          return { success: true, simulation };
        }

        case "prompt_cache_get_human_summary": {
          const summary = this.supervisor.getHumanDiagnosticSummary();
          return { success: true, summary };
        }

        case "prompt_cache_get_provider_directives": {
          const modelId = typeof args.modelId === "string" ? args.modelId : "anthropic/claude-3.7-sonnet";
          const directives = this.supervisor.getProviderDirectives(modelId);
          return { success: true, directives };
        }

        case "prompt_cache_get_scorecard": {
          const systemPrompt = typeof args.systemPrompt === "string" ? args.systemPrompt : "";
          const modelId = typeof args.modelId === "string" ? args.modelId : "anthropic/claude-3.7-sonnet";
          const scorecard = systemPrompt
            ? this.supervisor.getCacher().generateScorecard(systemPrompt, [], [], modelId)
            : this.supervisor.getScorecard();
          return { success: true, scorecard };
        }

        case "prompt_cache_get_invalidation_forensics": {
          const prevPrompt = typeof args.prevSystemPrompt === "string" ? args.prevSystemPrompt : undefined;
          const newPrompt = typeof args.newSystemPrompt === "string" ? args.newSystemPrompt : undefined;
          const forensics = prevPrompt && newPrompt
            ? this.supervisor.detectInvalidationPoint(prevPrompt, newPrompt)
            : this.supervisor.getInvalidationForensics(prevPrompt);
          return { success: true, forensics };
        }

        case "prompt_cache_get_optimization_prescriptions": {
          const prescriptions = this.supervisor.getOptimizationPrescriptions();
          return { success: true, count: prescriptions.length, prescriptions };
        }

        case "prompt_cache_calculate_provider_roi": {
          const promptTokens = typeof args.promptTokens === "number" ? args.promptTokens : 8192;
          const cachedTokens = typeof args.cachedTokens === "number" ? args.cachedTokens : Math.round(promptTokens * 0.75);
          const matrix = this.supervisor.getMultiProviderRoiMatrix(promptTokens, cachedTokens);
          return { success: true, matrix };
        }

        case "prompt_cache_get_telemetry_headers": {
          const telemetry = this.supervisor.getTelemetryHeaders();
          return { success: true, telemetry };
        }

        case "prompt_cache_get_savings_forecast": {
          const projectedDailyTurns = typeof args.projectedDailyTurns === "number" ? args.projectedDailyTurns : 200;
          const modelId = typeof args.modelId === "string" ? args.modelId : "anthropic/claude-3.7-sonnet";
          const forecast = this.supervisor.getSavingsForecast(projectedDailyTurns, modelId);
          return { success: true, forecast };
        }

        case "prompt_cache_get_layered_fingerprints": {
          const systemPrompt = typeof args.systemPrompt === "string" ? args.systemPrompt : undefined;
          const fingerprint = this.supervisor.getLayeredFingerprint(systemPrompt);
          return { success: true, fingerprint };
        }

        case "prompt_cache_get_remediation_diffs": {
          const recipes = this.supervisor.getRemediationRecipes();
          return { success: true, count: recipes.length, recipes };
        }

        case "prompt_cache_get_waterfall_trace": {
          const modelId = typeof args.modelId === "string" ? args.modelId : "anthropic/claude-3.7-sonnet";
          const trace = this.supervisor.getWaterfallTrace(modelId);
          return { success: true, trace };
        }

        case "prompt_cache_audit_alerts": {
          const alerts = this.supervisor.auditAlerts();
          return { success: true, count: alerts.length, alerts };
        }

        case "prompt_cache_explain_plan": {
          const systemPrompt = typeof args.systemPrompt === "string" ? args.systemPrompt : "";
          const modelId = typeof args.modelId === "string" ? args.modelId : "anthropic/claude-3.7-sonnet";
          const plan = this.supervisor.explainPlan(systemPrompt, [], [], modelId);
          return { success: true, plan };
        }

        case "prompt_cache_auto_tune_prompt": {
          const systemPrompt = typeof args.systemPrompt === "string" ? args.systemPrompt : "";
          const tuned = this.supervisor.autoTuneSystemPrompt(systemPrompt);
          return { success: true, tuned };
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
