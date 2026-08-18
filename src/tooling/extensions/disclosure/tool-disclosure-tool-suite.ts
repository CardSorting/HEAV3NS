/**
 * tool-disclosure-tool-suite.ts
 *
 * Model tool surface for Progressive Tool Disclosure, Dynamic Schema Gateway
 * & Deferred Tooling Subsystem (Phase 91 / ADR-043 / Target #83):
 * 30 specialized model tools for searching catalog, describing deferred schemas,
 * tiered budgeting, querying DSL, swimlanes, dashboards, and HTML/Markdown/CSV exports.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  DisclosureTier,
  ToolDisclosureGroupBy,
  ToolDisclosureSortBy,
  ToolDisclosureSortDirection,
} from "../../../core/contracts/tool-disclosure.contracts.js";
import { ToolDisclosureSupervisor } from "../../../agents/extensions/disclosure/tool-disclosure-supervisor.js";
import { ToolDisclosureSnapshotManager } from "../../../sessions/extensions/disclosure/disclosure-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class ToolDisclosureToolSuite {
  private readonly supervisor: ToolDisclosureSupervisor;
  private readonly snapshotManager: ToolDisclosureSnapshotManager;

  constructor(supervisor: ToolDisclosureSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new ToolDisclosureSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "tool_search",
        description: "Searches the catalog of deferred and plugin tools by keyword, tag, or namespace.",
        parameters: {
          query: { type: "string", description: "Search keyword" },
          tag: { type: "string", description: "Capability tag filter" },
          namespace: { type: "string", description: "Namespace filter" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_search", args);
        },
      },
      {
        name: "tool_describe",
        description: "Retrieves the full parameter schema and documentation for a specific deferred tool.",
        parameters: {
          name: { type: "string", required: true, description: "Tool name" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_describe", args);
        },
      },
      {
        name: "tool_disclosure_status",
        description: "Queries the current tool disclosure tier and active catalog statistics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_status", args);
        },
      },
      {
        name: "tool_disclosure_configure",
        description: "Configures progressive tool disclosure parameters.",
        parameters: {
          defaultTier: { type: "string", description: "Default tier" },
          eagerTokenBudget: { type: "number", description: "Token budget" },
          autoActivateOnSearch: { type: "boolean", description: "Auto-activate on search" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_configure", args);
        },
      },
      {
        name: "tool_disclosure_get_config",
        description: "Retrieves active tool disclosure configuration.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_get_config", args);
        },
      },
      {
        name: "tool_disclosure_get_metrics",
        description: "Fetches aggregated tool disclosure metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_get_metrics", args);
        },
      },
      {
        name: "tool_disclosure_get_metrics_report",
        description: "Retrieves detailed tool metrics report with breakdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_get_metrics_report", args);
        },
      },
      {
        name: "tool_disclosure_audit_health",
        description: "Audits tool disclosure SLA health posture and token economy.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_audit_health", args);
        },
      },
      {
        name: "tool_disclosure_register_tool",
        description: "Registers a new deferred tool into the catalog.",
        parameters: {
          name: { type: "string", required: true, description: "Tool name" },
          namespace: { type: "string", required: true, description: "Namespace" },
          description: { type: "string", required: true, description: "Description" },
          parametersJson: { type: "string", description: "Parameters JSON" },
          isCore: { type: "boolean", description: "Is core tool" },
          tagsJson: { type: "string", description: "Tags JSON array" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_register_tool", args);
        },
      },
      {
        name: "tool_disclosure_remove_tool",
        description: "Removes a tool from the catalog.",
        parameters: {
          name: { type: "string", required: true, description: "Tool name" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_remove_tool", args);
        },
      },
      {
        name: "tool_disclosure_list_tools",
        description: "Lists all registered tools in the catalog.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_list_tools", args);
        },
      },
      {
        name: "tool_disclosure_clear_tools",
        description: "Clears all registered tools from the catalog.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_clear_tools", args);
        },
      },
      {
        name: "tool_disclosure_activate_tool",
        description: "Explicitly activates a deferred tool for immediate model availability.",
        parameters: {
          name: { type: "string", required: true, description: "Tool name" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_activate_tool", args);
        },
      },
      {
        name: "tool_disclosure_deactivate_tool",
        description: "Deactivates an activated tool back into deferred state.",
        parameters: {
          name: { type: "string", required: true, description: "Tool name" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_deactivate_tool", args);
        },
      },
      {
        name: "tool_disclosure_get_activated_tools",
        description: "Retrieves list of all currently activated tool names.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_get_activated_tools", args);
        },
      },
      {
        name: "tool_disclosure_group_and_sort",
        description: "Organizes tool catalog into multi-criteria swimlanes (namespace, tier, isCore).",
        parameters: {
          groupBy: { type: "string", description: "namespace, tier, isCore" },
          sortBy: { type: "string", description: "name, namespace, registeredAt" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_group_and_sort", args);
        },
      },
      {
        name: "tool_disclosure_search_dsl",
        description: "Searches tools using Natural Query DSL (e.g. 'ns:cloudflare is:core tag:dns').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_search_dsl", args);
        },
      },
      {
        name: "tool_disclosure_determine_tier",
        description: "Evaluates disclosure tier based on token budget.",
        parameters: {
          tokenBudget: { type: "number", description: "Token budget" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_determine_tier", args);
        },
      },
      {
        name: "tool_disclosure_render_dashboard",
        description: "Renders an ANSI CLI summary card with tool disclosure metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_render_dashboard", args);
        },
      },
      {
        name: "tool_disclosure_render_tool_card",
        description: "Renders an interactive ANSI CLI tool descriptor card.",
        parameters: {
          name: { type: "string", required: true, description: "Tool name" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_render_tool_card", args);
        },
      },
      {
        name: "tool_disclosure_export_html_view",
        description: "Exports tool catalog to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_export_html_view", args);
        },
      },
      {
        name: "tool_disclosure_export_markdown_report",
        description: "Exports tool catalog report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_export_markdown_report", args);
        },
      },
      {
        name: "tool_disclosure_export_csv_report",
        description: "Exports tool catalog to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_export_csv_report", args);
        },
      },
      {
        name: "tool_disclosure_bulk_purge",
        description: "Atomically purges multiple tools from the catalog.",
        parameters: {
          namesJson: { type: "string", required: true, description: "JSON array of tool names" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_bulk_purge", args);
        },
      },
      {
        name: "tool_disclosure_undo",
        description: "Reverts the last tool disclosure mutation from undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_undo", args);
        },
      },
      {
        name: "tool_disclosure_redo",
        description: "Re-applies the last undone tool disclosure mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_redo", args);
        },
      },
      {
        name: "tool_disclosure_capture_snapshot",
        description: "Captures a frame-perfect snapshot of disclosure state.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_capture_snapshot", args);
        },
      },
      {
        name: "tool_disclosure_restore_snapshot",
        description: "Restores disclosure state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_restore_snapshot", args);
        },
      },
      {
        name: "tool_disclosure_format_tool",
        description: "Formats a tool definition into a standardized summary tag.",
        parameters: {
          name: { type: "string", required: true, description: "Tool name" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_format_tool", args);
        },
      },
      {
        name: "tool_disclosure_format_manifest",
        description: "Formats a disclosure manifest into a summary string.",
        parameters: {
          tokenBudget: { type: "number", description: "Token budget" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("tool_disclosure_format_manifest", args);
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
        case "tool_search": {
          const query = typeof args.query === "string" ? args.query : "";
          const tag = typeof args.tag === "string" ? args.tag : undefined;
          const namespace = typeof args.namespace === "string" ? args.namespace : undefined;
          const searchResult = this.supervisor.searchTools(query, tag, namespace);
          return {
            success: true,
            query,
            totalMatches: searchResult.totalMatches,
            tools: searchResult.tools,
          };
        }

        case "tool_describe": {
          const toolName = typeof args.name === "string" ? args.name : "";
          const tool = this.supervisor.describeTool(toolName);
          if (!tool) return { success: false, error: `Tool '${toolName}' not found` };
          this.supervisor.activateTool(toolName);
          return { success: true, tool };
        }

        case "tool_disclosure_status": {
          const manifest = this.supervisor.getManifest();
          const stats = this.supervisor.getStats();
          const activatedTools = this.supervisor.getActivatedTools();
          return {
            success: true,
            manifest,
            stats,
            activatedTools,
          };
        }

        case "tool_disclosure_configure": {
          this.supervisor.configure(args as any);
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "tool_disclosure_get_config": {
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "tool_disclosure_get_metrics": {
          return { success: true, metrics: this.supervisor.getMetrics() };
        }

        case "tool_disclosure_get_metrics_report": {
          return { success: true, report: this.supervisor.getMetricsReport() };
        }

        case "tool_disclosure_audit_health": {
          return { success: true, audit: this.supervisor.auditHealth() };
        }

        case "tool_disclosure_register_tool": {
          const toolName = String(args.name || "");
          const namespace = String(args.namespace || "default");
          const description = String(args.description || "");
          let parameters: Record<string, unknown> = {};
          if (typeof args.parametersJson === "string") {
            try {
              parameters = JSON.parse(args.parametersJson);
            } catch {
              parameters = {};
            }
          }
          let tags: string[] = [];
          if (typeof args.tagsJson === "string") {
            try {
              tags = JSON.parse(args.tagsJson);
            } catch {
              tags = [];
            }
          }
          const isCore = typeof args.isCore === "boolean" ? args.isCore : false;

          this.supervisor.registerTool({
            name: toolName,
            namespace,
            description,
            parameters,
            isCore,
            tags,
          });
          return { success: true, name: toolName };
        }

        case "tool_disclosure_remove_tool": {
          const toolName = String(args.name || "");
          const ok = this.supervisor.removeTool(toolName);
          return { success: ok };
        }

        case "tool_disclosure_list_tools": {
          const tools = this.supervisor.getSubstrate().listTools();
          return { success: true, count: tools.length, tools };
        }

        case "tool_disclosure_clear_tools": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
        }

        case "tool_disclosure_activate_tool": {
          const toolName = String(args.name || "");
          const ok = this.supervisor.activateTool(toolName);
          return { success: ok };
        }

        case "tool_disclosure_deactivate_tool": {
          const toolName = String(args.name || "");
          const ok = this.supervisor.deactivateTool(toolName);
          return { success: ok };
        }

        case "tool_disclosure_get_activated_tools": {
          const act = this.supervisor.getActivatedTools();
          return { success: true, activatedTools: act };
        }

        case "tool_disclosure_group_and_sort": {
          const groupBy = (args.groupBy as ToolDisclosureGroupBy) || "namespace";
          const sortBy = (args.sortBy as ToolDisclosureSortBy) || "name";
          const direction = (args.direction as ToolDisclosureSortDirection) || "asc";
          const lanes = this.supervisor.getGroupedTools(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "tool_disclosure_search_dsl": {
          const query = String(args.query || "");
          const tools = this.supervisor.queryDsl(query);
          return { success: true, count: tools.length, tools };
        }

        case "tool_disclosure_determine_tier": {
          const budget = typeof args.tokenBudget === "number" ? args.tokenBudget : 2000;
          const manifest = this.supervisor.getManifest(budget);
          return { success: true, manifest };
        }

        case "tool_disclosure_render_dashboard": {
          const metrics = this.supervisor.getMetrics();
          const health = this.supervisor.auditHealth();
          const rendered = BroccoliViewRenderer.renderToolDisclosureDashboard({
            totalRegistered: metrics.totalRegisteredTools,
            eagerCount: health.eagerCount,
            deferredCount: health.deferredCount,
            activatedCount: metrics.totalActivatedTools,
            activeTier: this.supervisor.getSubstrate().getActiveTier(),
            healthStatus: health.healthStatus,
          });
          return { success: true, rendered };
        }

        case "tool_disclosure_render_tool_card": {
          const toolName = String(args.name || "");
          const tool = this.supervisor.describeTool(toolName);
          if (!tool) return { success: false, error: `Tool '${toolName}' not found` };
          const isAct = this.supervisor.getActivatedTools().includes(toolName);
          const rendered = BroccoliViewRenderer.renderToolDisclosureCard({
            name: tool.name,
            namespace: tool.namespace,
            description: tool.description,
            isCore: tool.isCore,
            isActivated: isAct,
            tags: tool.tags,
          });
          return { success: true, rendered };
        }

        case "tool_disclosure_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "tool_disclosure_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "tool_disclosure_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "tool_disclosure_bulk_purge": {
          const namesJson = String(args.namesJson || "[]");
          let names: string[];
          try {
            names = JSON.parse(namesJson);
          } catch {
            return { success: false, error: "namesJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(names);
          return { success: true, result };
        }

        case "tool_disclosure_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "tool_disclosure_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "tool_disclosure_capture_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const snap = this.snapshotManager.captureSnapshot(frameId);
          return { success: true, frameId, snapshot: snap };
        }

        case "tool_disclosure_restore_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frameId);
          return { ...res };
        }

        case "tool_disclosure_format_tool": {
          const toolName = String(args.name || "");
          const tool = this.supervisor.describeTool(toolName);
          if (!tool) return { success: false, error: `Tool '${toolName}' not found` };
          const formatted = this.supervisor.getDiscloser().formatToolDefinition(tool);
          return { success: true, formatted };
        }

        case "tool_disclosure_format_manifest": {
          const budget = typeof args.tokenBudget === "number" ? args.tokenBudget : 2000;
          const manifest = this.supervisor.getManifest(budget);
          const formatted = this.supervisor.getDiscloser().formatDisclosureManifest(manifest);
          return { success: true, formatted };
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
