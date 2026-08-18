/**
 * terminal-cleaner-tool-suite.ts
 *
 * Model tool surface for Deterministic Terminal Output Cleaner, ANSI Sanitizer
 * & Binary Asset Safeguards Subsystem (Phase 136 / ADR-112 / Target #76):
 * 30 specialized model tools for cleaning terminal output, stripping ANSI codes,
 * classifying file assets, DSL searches, swimlanes, dashboards, and HTML/Markdown/CSV exports.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  AnsiCleanMode,
  TerminalCleanerGroupBy,
  TerminalCleanerSortBy,
  TerminalCleanerSortDirection,
} from "../../../core/contracts/terminal-cleaner.contracts.js";
import {
  TERMINAL_KNOWN_BINARY_EXTENSIONS,
  TERMINAL_OPAQUE_DOCUMENT_EXTENSIONS,
} from "../../../core/contracts/terminal-cleaner.contracts.js";
import { TerminalCleanerSupervisor } from "../../../agents/extensions/terminal_cleaner/terminal-cleaner-supervisor.js";
import { TerminalCleanerSnapshotManager } from "../../../sessions/extensions/terminal_cleaner/terminal-cleaner-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class TerminalCleanerToolSuite {
  private readonly supervisor: TerminalCleanerSupervisor;
  private readonly snapshotManager: TerminalCleanerSnapshotManager;

  constructor(supervisor: TerminalCleanerSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new TerminalCleanerSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "terminal_cleaner_strip_ansi",
        description: "Removes all ANSI and ECMA-48 escape sequences from a command output or string.",
        parameters: {
          text: { type: "string", required: true, description: "Text containing ANSI escape sequences" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_strip_ansi", args);
        },
      },
      {
        name: "terminal_cleaner_sanitize_display",
        description: "Sanitizes text for safe terminal display, removing escape codes and control characters.",
        parameters: {
          text: { type: "string", required: true, description: "Text to sanitize" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_sanitize_display", args);
        },
      },
      {
        name: "terminal_cleaner_clean_with_metrics",
        description: "Performs high-precision text cleaning with detailed token and byte reduction telemetry.",
        parameters: {
          text: { type: "string", required: true, description: "Text to clean" },
          mode: { type: "string", description: "strip_all or sanitize_display" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_clean_with_metrics", args);
        },
      },
      {
        name: "terminal_cleaner_classify_path",
        description: "Classifies a file path as text, binary, opaque document, or pdf.",
        parameters: {
          filePath: { type: "string", required: true, description: "File path to inspect" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_classify_path", args);
        },
      },
      {
        name: "terminal_cleaner_can_write_as_text",
        description: "Checks whether a path can safely receive a plain-text write or edit.",
        parameters: {
          filePath: { type: "string", required: true, description: "File path to verify" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_can_write_as_text", args);
        },
      },
      {
        name: "terminal_cleaner_configure",
        description: "Configures terminal cleaning policies, escape stripping, and opaque document protection.",
        parameters: {
          enabled: { type: "boolean", description: "Enable or disable cleaner" },
          stripAnsiSequences: { type: "boolean", description: "Strip ANSI codes" },
          guardOpaqueDocuments: { type: "boolean", description: "Guard opaque document writes" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_configure", args);
        },
      },
      {
        name: "terminal_cleaner_get_config",
        description: "Retrieves active terminal cleaner configuration.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_get_config", args);
        },
      },
      {
        name: "terminal_cleaner_get_metrics",
        description: "Fetches aggregated cleaning metrics, ANSI stripped counts, and fast path passes.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_get_metrics", args);
        },
      },
      {
        name: "terminal_cleaner_audit_health",
        description: "Audits terminal cleaner health posture, blocked writes, and fast path ratios.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_audit_health", args);
        },
      },
      {
        name: "terminal_cleaner_record_event",
        description: "Records a cleaning event in the memory ledger.",
        parameters: {
          mode: { type: "string", description: "strip_all or sanitize_display" },
          originalLength: { type: "number", required: true, description: "Original length" },
          cleanedLength: { type: "number", required: true, description: "Cleaned length" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_record_event", args);
        },
      },
      {
        name: "terminal_cleaner_get_event",
        description: "Retrieves a clean event from the ledger by ID.",
        parameters: {
          id: { type: "string", required: true, description: "Event ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_get_event", args);
        },
      },
      {
        name: "terminal_cleaner_list_events",
        description: "Lists all recorded cleaning events.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_list_events", args);
        },
      },
      {
        name: "terminal_cleaner_remove_event",
        description: "Removes a clean event from the memory ledger.",
        parameters: {
          id: { type: "string", required: true, description: "Event ID to delete" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_remove_event", args);
        },
      },
      {
        name: "terminal_cleaner_clear_events",
        description: "Clears all events and resets metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_clear_events", args);
        },
      },
      {
        name: "terminal_cleaner_group_and_sort",
        description: "Organizes clean events into multi-criteria swimlanes (mode, status, reductionTier).",
        parameters: {
          groupBy: { type: "string", description: "mode, status, reductionTier" },
          sortBy: { type: "string", description: "timestamp, originalLength, durationMs, ansiCount" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_group_and_sort", args);
        },
      },
      {
        name: "terminal_cleaner_search_dsl",
        description: "Searches clean events using Natural Query DSL (e.g. 'mode:sanitize_display').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_search_dsl", args);
        },
      },
      {
        name: "terminal_cleaner_render_dashboard",
        description: "Renders an ANSI CLI summary card with cleaned counts and health status.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_render_dashboard", args);
        },
      },
      {
        name: "terminal_cleaner_render_event_card",
        description: "Renders an interactive ANSI CLI cleaning event card.",
        parameters: {
          id: { type: "string", required: true, description: "Event ID" },
          mode: { type: "string", description: "Mode" },
          originalLength: { type: "number", description: "Original length" },
          cleanedLength: { type: "number", description: "Cleaned length" },
          ansiCodesCount: { type: "number", description: "ANSI count" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_render_event_card", args);
        },
      },
      {
        name: "terminal_cleaner_export_html_view",
        description: "Exports terminal cleaner ledger to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_export_html_view", args);
        },
      },
      {
        name: "terminal_cleaner_export_markdown_report",
        description: "Exports terminal cleaner report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_export_markdown_report", args);
        },
      },
      {
        name: "terminal_cleaner_export_csv_report",
        description: "Exports terminal cleaning events ledger to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_export_csv_report", args);
        },
      },
      {
        name: "terminal_cleaner_bulk_purge",
        description: "Atomically purges multiple cleaning events from the ledger.",
        parameters: {
          idsJson: { type: "string", required: true, description: "JSON array of event IDs" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_bulk_purge", args);
        },
      },
      {
        name: "terminal_cleaner_undo",
        description: "Reverts the last terminal cleaner mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_undo", args);
        },
      },
      {
        name: "terminal_cleaner_redo",
        description: "Re-applies the last undone terminal cleaner mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_redo", args);
        },
      },
      {
        name: "terminal_cleaner_capture_snapshot",
        description: "Captures a frame-perfect snapshot of terminal cleaner state.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_capture_snapshot", args);
        },
      },
      {
        name: "terminal_cleaner_restore_snapshot",
        description: "Restores terminal cleaner state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_restore_snapshot", args);
        },
      },
      {
        name: "terminal_cleaner_format_result",
        description: "Formats a cleaning result into a standardized summary.",
        parameters: {
          originalLength: { type: "number", required: true, description: "Original length" },
          cleanedLength: { type: "number", required: true, description: "Cleaned length" },
          ansiCodesCount: { type: "number", required: true, description: "ANSI count" },
          durationMs: { type: "number", description: "Duration in ms" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_format_result", args);
        },
      },
      {
        name: "terminal_cleaner_format_asset",
        description: "Formats a file classification result into a string.",
        parameters: {
          filePath: { type: "string", required: true, description: "File path" },
          classification: { type: "string", required: true, description: "Classification" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_format_asset", args);
        },
      },
      {
        name: "terminal_cleaner_check_binary_extension",
        description: "Checks if a given file extension is a known binary format.",
        parameters: {
          extension: { type: "string", required: true, description: "File extension e.g. .png" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_check_binary_extension", args);
        },
      },
      {
        name: "terminal_cleaner_check_opaque_extension",
        description: "Checks if a given file extension is an opaque document format.",
        parameters: {
          extension: { type: "string", required: true, description: "File extension e.g. .docx" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("terminal_cleaner_check_opaque_extension", args);
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
        case "terminal_cleaner_strip_ansi": {
          const text = String(args.text || "");
          const cleaned = this.supervisor.stripAnsi(text);
          return { success: true, originalLength: text.length, cleanedLength: cleaned.length, cleaned };
        }

        case "terminal_cleaner_sanitize_display": {
          const text = String(args.text || "");
          const cleaned = this.supervisor.sanitizeDisplayText(text);
          return { success: true, originalLength: text.length, cleanedLength: cleaned.length, cleaned };
        }

        case "terminal_cleaner_clean_with_metrics": {
          const text = String(args.text || "");
          const mode = (args.mode as AnsiCleanMode) || "sanitize_display";
          const res = this.supervisor.cleanWithMetrics(text, mode);
          return { success: true, result: res };
        }

        case "terminal_cleaner_classify_path": {
          const filePath = String(args.filePath || "");
          const classification = this.supervisor.classifyPath(filePath);
          const writeCheck = this.supervisor.canWriteAsText(filePath);
          return {
            success: true,
            filePath,
            classification,
            canWriteAsText: writeCheck.allowed,
            reason: writeCheck.reason,
          };
        }

        case "terminal_cleaner_can_write_as_text": {
          const filePath = String(args.filePath || "");
          const res = this.supervisor.canWriteAsText(filePath);
          return { success: true, filePath, ...res };
        }

        case "terminal_cleaner_configure": {
          this.supervisor.configure(args as any);
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "terminal_cleaner_get_config": {
          const config = this.supervisor.getConfig();
          return { success: true, config };
        }

        case "terminal_cleaner_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "terminal_cleaner_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "terminal_cleaner_record_event": {
          const mode = (args.mode as AnsiCleanMode) || "sanitize_display";
          const originalLength = Number(args.originalLength || 0);
          const cleanedLength = Number(args.cleanedLength || 0);
          const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          this.supervisor.getSubstrate().recordEvent({
            id,
            mode,
            originalLength,
            cleanedLength,
            ansiCodesCount: 0,
            controlCharsCount: 0,
            durationMs: 0.05,
            timestamp: Date.now(),
          });
          return { success: true, id };
        }

        case "terminal_cleaner_get_event": {
          const id = String(args.id || "");
          const event = this.supervisor.getSubstrate().getEvent(id);
          if (!event) return { success: false, error: `Event '${id}' not found` };
          return { success: true, event };
        }

        case "terminal_cleaner_list_events": {
          const events = this.supervisor.getSubstrate().listEvents();
          return { success: true, count: events.length, events };
        }

        case "terminal_cleaner_remove_event": {
          const id = String(args.id || "");
          const ok = this.supervisor.getSubstrate().removeEvent(id);
          return { success: ok };
        }

        case "terminal_cleaner_clear_events": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
        }

        case "terminal_cleaner_group_and_sort": {
          const groupBy = (args.groupBy as TerminalCleanerGroupBy) || "mode";
          const sortBy = (args.sortBy as TerminalCleanerSortBy) || "timestamp";
          const direction = (args.direction as TerminalCleanerSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedEvents(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "terminal_cleaner_search_dsl": {
          const query = String(args.query || "");
          const events = this.supervisor.queryDsl(query);
          return { success: true, count: events.length, events };
        }

        case "terminal_cleaner_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderTerminalCleanerDashboard({
            totalCleaned: metrics.totalStringsCleaned,
            ansiStripped: metrics.ansiSequencesStripped,
            controlFiltered: metrics.controlCharsFiltered,
            blockedWrites: metrics.opaqueDocumentWritesBlocked,
            healthStatus: health.healthStatus,
          });
          return { success: true, rendered };
        }

        case "terminal_cleaner_render_event_card": {
          const id = String(args.id || "ev-1");
          const mode = String(args.mode || "sanitize_display");
          const originalLength = Number(args.originalLength || 100);
          const cleanedLength = Number(args.cleanedLength || 80);
          const ansiCodesCount = Number(args.ansiCodesCount || 2);
          const rendered = BroccoliViewRenderer.renderTerminalCleanEventCard({
            id,
            mode,
            originalLength,
            cleanedLength,
            ansiCodesCount,
          });
          return { success: true, rendered };
        }

        case "terminal_cleaner_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "terminal_cleaner_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "terminal_cleaner_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "terminal_cleaner_bulk_purge": {
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

        case "terminal_cleaner_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "terminal_cleaner_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "terminal_cleaner_capture_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const snap = this.snapshotManager.captureSnapshot(frameId);
          return { success: true, frameId, snapshot: snap };
        }

        case "terminal_cleaner_restore_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frameId);
          return { ...res };
        }

        case "terminal_cleaner_format_result": {
          const originalLength = Number(args.originalLength || 0);
          const cleanedLength = Number(args.cleanedLength || 0);
          const ansiCodesCount = Number(args.ansiCodesCount || 0);
          const durationMs = Number(args.durationMs || 0.05);
          const formatted = this.supervisor.getEngine().formatCleanResult({
            originalLength,
            cleanedLength,
            ansiCodesCount,
            durationMs,
          });
          return { success: true, formatted };
        }

        case "terminal_cleaner_format_asset": {
          const filePath = String(args.filePath || "");
          const classification = (args.classification as any) || "text";
          const formatted = this.supervisor.getEngine().formatAssetClassification(filePath, classification);
          return { success: true, formatted };
        }

        case "terminal_cleaner_check_binary_extension": {
          const ext = String(args.extension || "").toLowerCase();
          const isBinary = TERMINAL_KNOWN_BINARY_EXTENSIONS.has(ext.startsWith(".") ? ext : `.${ext}`);
          return { success: true, extension: ext, isBinary };
        }

        case "terminal_cleaner_check_opaque_extension": {
          const ext = String(args.extension || "").toLowerCase();
          const isOpaque = TERMINAL_OPAQUE_DOCUMENT_EXTENSIONS.has(ext.startsWith(".") ? ext : `.${ext}`);
          return { success: true, extension: ext, isOpaque };
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
