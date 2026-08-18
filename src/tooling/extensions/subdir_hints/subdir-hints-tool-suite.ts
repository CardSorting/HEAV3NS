/**
 * subdir-hints-tool-suite.ts
 *
 * Model tool surface for Progressive Subdirectory Context Discovery & Dynamic Hints
 * Subsystem (Phase 129 / ADR-105 / Target #84):
 * 30 specialized model tools for evaluating tool paths, registering virtual rules,
 * querying DSL, swimlanes, dashboards, and HTML/Markdown/CSV exports.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  SubdirectoryHintsGroupBy,
  SubdirectoryHintsSortBy,
  SubdirectoryHintsSortDirection,
} from "../../../core/contracts/subdirectory-hints.contracts.js";
import { SubdirHintsSupervisor } from "../../../agents/extensions/subdir_hints/subdir-hints-supervisor.js";
import { SubdirHintsSnapshotManager } from "../../../sessions/extensions/subdir_hints/subdir-hints-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class SubdirHintsToolSuite {
  private readonly supervisor: SubdirHintsSupervisor;
  private readonly snapshotManager: SubdirHintsSnapshotManager;

  constructor(supervisor: SubdirHintsSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new SubdirHintsSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "subdir_hints_check_tool",
        description: "Evaluates tool arguments and progressively discovers new subdirectory instruction files.",
        parameters: {
          toolName: { type: "string", required: true, description: "Tool name" },
          path: { type: "string", description: "File or directory path" },
          command: { type: "string", description: "Shell command string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_check_tool", args);
        },
      },
      {
        name: "subdir_hints_register_virtual",
        description: "Registers an in-memory virtual guideline/hint file for a specific directory.",
        parameters: {
          directoryPath: { type: "string", required: true, description: "Directory path" },
          filename: { type: "string", required: true, description: "Filename (e.g. AGENTS.md)" },
          content: { type: "string", required: true, description: "Guideline content" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_register_virtual", args);
        },
      },
      {
        name: "subdir_hints_list_discovered",
        description: "Lists all discovered subdirectory context hints and their cryptographic digests.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_list_discovered", args);
        },
      },
      {
        name: "subdir_hints_get_metrics",
        description: "Fetches aggregated telemetry metrics for subdirectory hints discovery.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_get_metrics", args);
        },
      },
      {
        name: "subdir_hints_get_metrics_report",
        description: "Retrieves detailed subdirectory hints metrics report with breakdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_get_metrics_report", args);
        },
      },
      {
        name: "subdir_hints_audit_health",
        description: "Audits subdirectory hints SLA health posture and token economy.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_audit_health", args);
        },
      },
      {
        name: "subdir_hints_configure",
        description: "Configures progressive subdirectory hints parameters.",
        parameters: {
          maxHintChars: { type: "number", description: "Max chars allowed" },
          maxAncestorWalk: { type: "number", description: "Max ancestor walk levels" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_configure", args);
        },
      },
      {
        name: "subdir_hints_get_config",
        description: "Retrieves active subdirectory hints configuration.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_get_config", args);
        },
      },
      {
        name: "subdir_hints_clear",
        description: "Clears all discovered hints, loaded directories, and caches.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_clear", args);
        },
      },
      {
        name: "subdir_hints_is_dir_loaded",
        description: "Checks if a directory has already been evaluated for hints.",
        parameters: {
          directoryPath: { type: "string", required: true, description: "Directory path" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_is_dir_loaded", args);
        },
      },
      {
        name: "subdir_hints_is_digest_loaded",
        description: "Checks if a content SHA-256 digest is already loaded.",
        parameters: {
          digest: { type: "string", required: true, description: "SHA-256 digest" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_is_digest_loaded", args);
        },
      },
      {
        name: "subdir_hints_get_loaded_dirs",
        description: "Retrieves list of all directories evaluated so far.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_get_loaded_dirs", args);
        },
      },
      {
        name: "subdir_hints_get_virtual_hints",
        description: "Retrieves list of all registered virtual guideline files.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_get_virtual_hints", args);
        },
      },
      {
        name: "subdir_hints_group_and_sort",
        description: "Organizes discovered hints into multi-criteria swimlanes.",
        parameters: {
          groupBy: { type: "string", description: "directory or filename" },
          sortBy: { type: "string", description: "filename, charCount, discoveredAt" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_group_and_sort", args);
        },
      },
      {
        name: "subdir_hints_search_dsl",
        description: "Searches discovered hints using Natural Query DSL (e.g. 'dir:src file:AGENTS.md').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_search_dsl", args);
        },
      },
      {
        name: "subdir_hints_format_hint",
        description: "Formats a discovered hint into a standardized summary tag.",
        parameters: {
          directoryPath: { type: "string", required: true, description: "Directory" },
          filename: { type: "string", required: true, description: "Filename" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_format_hint", args);
        },
      },
      {
        name: "subdir_hints_format_discovery",
        description: "Formats discovery result summary.",
        parameters: {
          count: { type: "number", required: true, description: "Count" },
          durationMs: { type: "number", required: true, description: "Duration ms" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_format_discovery", args);
        },
      },
      {
        name: "subdir_hints_render_dashboard",
        description: "Renders an ANSI CLI summary card with hints metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_render_dashboard", args);
        },
      },
      {
        name: "subdir_hints_render_hint_card",
        description: "Renders an interactive ANSI CLI hint rule card.",
        parameters: {
          directoryPath: { type: "string", required: true, description: "Directory" },
          filename: { type: "string", required: true, description: "Filename" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_render_hint_card", args);
        },
      },
      {
        name: "subdir_hints_export_html_view",
        description: "Exports discovered hints to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_export_html_view", args);
        },
      },
      {
        name: "subdir_hints_export_markdown_report",
        description: "Exports discovered hints report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_export_markdown_report", args);
        },
      },
      {
        name: "subdir_hints_export_csv_report",
        description: "Exports discovered hints to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_export_csv_report", args);
        },
      },
      {
        name: "subdir_hints_bulk_purge",
        description: "Atomically purges multiple hints from the substrate.",
        parameters: {
          hintKeysJson: { type: "string", required: true, description: "JSON array of hint keys" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_bulk_purge", args);
        },
      },
      {
        name: "subdir_hints_undo",
        description: "Reverts the last subdirectory hints mutation from undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_undo", args);
        },
      },
      {
        name: "subdir_hints_redo",
        description: "Re-applies the last undone subdirectory hints mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_redo", args);
        },
      },
      {
        name: "subdir_hints_capture_snapshot",
        description: "Captures a frame-perfect snapshot of subdirectory hints state.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_capture_snapshot", args);
        },
      },
      {
        name: "subdir_hints_restore_snapshot",
        description: "Restores subdirectory hints state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_restore_snapshot", args);
        },
      },
      {
        name: "subdir_hints_compute_digest",
        description: "Calculates SHA-256 hex digest for rule content string.",
        parameters: {
          content: { type: "string", required: true, description: "Content string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_compute_digest", args);
        },
      },
      {
        name: "subdir_hints_extract_candidate_dirs",
        description: "Extracts directory paths from tool arguments without executing.",
        parameters: {
          toolName: { type: "string", required: true, description: "Tool name" },
          path: { type: "string", description: "Path" },
          command: { type: "string", description: "Command" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_extract_candidate_dirs", args);
        },
      },
      {
        name: "subdir_hints_format_attachment",
        description: "Formats discovered hints into prompt markdown attachment blocks.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("subdir_hints_format_attachment", args);
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
        case "subdir_hints_check_tool": {
          const toolName = String(args.toolName || "read_file").trim();
          const pathVal = typeof args.path === "string" ? args.path : undefined;
          const command = typeof args.command === "string" ? args.command : undefined;
          const toolArgs: Record<string, unknown> = {};
          if (pathVal) toolArgs.path = pathVal;
          if (command) toolArgs.command = command;

          const result = await this.supervisor.checkToolCall(toolName, toolArgs);
          return { success: true, result };
        }

        case "subdir_hints_register_virtual": {
          const directoryPath = String(args.directoryPath || "").trim();
          const filename = String(args.filename || "AGENTS.md").trim();
          const content = String(args.content || "").trim();
          if (!directoryPath || !content) return { success: false, error: "directoryPath and content required" };
          this.supervisor.registerVirtualHint(directoryPath, filename, content);
          return { success: true, message: `Virtual hint '${filename}' registered for '${directoryPath}'` };
        }

        case "subdir_hints_list_discovered": {
          const hints = this.supervisor.getDiscoveredHints();
          return { success: true, count: hints.length, hints };
        }

        case "subdir_hints_get_metrics": {
          return { success: true, metrics: this.supervisor.getMetrics() };
        }

        case "subdir_hints_get_metrics_report": {
          return { success: true, report: this.supervisor.getMetricsReport() };
        }

        case "subdir_hints_audit_health": {
          return { success: true, audit: this.supervisor.auditHealth() };
        }

        case "subdir_hints_configure": {
          this.supervisor.configure(args as any);
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "subdir_hints_get_config": {
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "subdir_hints_clear": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
        }

        case "subdir_hints_is_dir_loaded": {
          const dirPath = String(args.directoryPath || "");
          return { success: true, isLoaded: this.supervisor.getSubstrate().hasDirectory(dirPath) };
        }

        case "subdir_hints_is_digest_loaded": {
          const digest = String(args.digest || "");
          return { success: true, isLoaded: this.supervisor.getSubstrate().hasDigest(digest) };
        }

        case "subdir_hints_get_loaded_dirs": {
          return { success: true, loadedDirectories: this.supervisor.getSubstrate().getLoadedDirectories() };
        }

        case "subdir_hints_get_virtual_hints": {
          return { success: true, virtualHints: this.supervisor.getSubstrate().getVirtualHints() };
        }

        case "subdir_hints_group_and_sort": {
          const groupBy = (args.groupBy as SubdirectoryHintsGroupBy) || "directory";
          const sortBy = (args.sortBy as SubdirectoryHintsSortBy) || "filename";
          const direction = (args.direction as SubdirectoryHintsSortDirection) || "asc";
          const lanes = this.supervisor.getGroupedHints(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "subdir_hints_search_dsl": {
          const query = String(args.query || "");
          const hints = this.supervisor.queryDsl(query);
          return { success: true, count: hints.length, hints };
        }

        case "subdir_hints_format_hint": {
          const dir = String(args.directoryPath || "");
          const file = String(args.filename || "");
          const hint = this.supervisor.getDiscoveredHints().find((h) => h.directoryPath === dir && h.filename === file);
          if (!hint) return { success: false, error: `Hint not found` };
          const formatted = this.supervisor.getEngine().formatDiscoveredHint(hint);
          return { success: true, formatted };
        }

        case "subdir_hints_format_discovery": {
          const count = typeof args.count === "number" ? args.count : 0;
          const durationMs = typeof args.durationMs === "number" ? args.durationMs : 0;
          const formatted = this.supervisor.getEngine().formatDiscoveryResult({ hintsFound: new Array(count) as any, durationMs });
          return { success: true, formatted };
        }

        case "subdir_hints_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderSubdirHintsDashboard({
            totalHints: health.totalHints,
            totalLoadedDirectories: health.totalLoadedDirectories,
            totalBytesInjected: metrics.bytesInjected,
            healthStatus: health.healthStatus,
          });
          return { success: true, rendered };
        }

        case "subdir_hints_render_hint_card": {
          const dir = String(args.directoryPath || "");
          const file = String(args.filename || "");
          const hint = this.supervisor.getDiscoveredHints().find((h) => h.directoryPath === dir && h.filename === file);
          if (!hint) return { success: false, error: `Hint not found` };
          const rendered = BroccoliViewRenderer.renderSubdirHintCard(hint);
          return { success: true, rendered };
        }

        case "subdir_hints_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "subdir_hints_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "subdir_hints_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "subdir_hints_bulk_purge": {
          const keysJson = String(args.hintKeysJson || "[]");
          let keys: string[];
          try {
            keys = JSON.parse(keysJson);
          } catch {
            return { success: false, error: "hintKeysJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(keys);
          return { success: true, result };
        }

        case "subdir_hints_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "subdir_hints_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "subdir_hints_capture_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const snap = this.snapshotManager.captureSnapshot(frameId);
          return { success: true, frameId, snapshot: snap };
        }

        case "subdir_hints_restore_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frameId);
          return { ...res };
        }

        case "subdir_hints_compute_digest": {
          const content = String(args.content || "");
          const digest = this.supervisor.getEngine().computeDigest(content);
          return { success: true, digest };
        }

        case "subdir_hints_extract_candidate_dirs": {
          const toolName = String(args.toolName || "read_file");
          const config = this.supervisor.getConfig();
          const toolArgs: Record<string, unknown> = {};
          if (typeof args.path === "string") toolArgs.path = args.path;
          if (typeof args.command === "string") toolArgs.command = args.command;
          const dirs = this.supervisor.getEngine().extractCandidateDirectories(toolName, toolArgs, config);
          return { success: true, candidateDirectories: dirs };
        }

        case "subdir_hints_format_attachment": {
          const hints = this.supervisor.getDiscoveredHints();
          const attachment = this.supervisor.getEngine().formatHintAttachment(hints);
          return { success: true, attachment };
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
