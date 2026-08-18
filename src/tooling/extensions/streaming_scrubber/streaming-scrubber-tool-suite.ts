/**
 * streaming-scrubber-tool-suite.ts
 *
 * Model tool surface for Deterministic Streaming Reasoning Scrubber, Delta Filtration
 * & Boundary Gated Holdback Buffer (Phase 137 / ADR-113 / Target #77):
 * 30 specialized model tools for scrubbing stream deltas, flushing session buffers,
 * querying DSL, swimlanes, dashboards, and HTML/Markdown/CSV exports.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  StreamingScrubberGroupBy,
  StreamingScrubberSortBy,
  StreamingScrubberSortDirection,
} from "../../../core/contracts/streaming-think-scrubber.contracts.js";
import { StreamingScrubberSupervisor } from "../../../agents/extensions/streaming_scrubber/streaming-scrubber-supervisor.js";
import { StreamingScrubberSnapshotManager } from "../../../sessions/extensions/streaming_scrubber/streaming-scrubber-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class StreamingScrubberToolSuite {
  private readonly supervisor: StreamingScrubberSupervisor;
  private readonly snapshotManager: StreamingScrubberSnapshotManager;

  constructor(supervisor: StreamingScrubberSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new StreamingScrubberSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "streaming_scrubber_feed_delta",
        description: "Feeds a streaming delta chunk for a session and returns visible sanitized text.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session identifier" },
          delta: { type: "string", required: true, description: "Delta text chunk" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_feed_delta", args);
        },
      },
      {
        name: "streaming_scrubber_feed_delta_with_metrics",
        description: "Feeds a delta chunk and records telemetry into the memory ledger.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session identifier" },
          delta: { type: "string", required: true, description: "Delta text chunk" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_feed_delta_with_metrics", args);
        },
      },
      {
        name: "streaming_scrubber_flush_stream",
        description: "Flushes the held-back buffer at the end of a stream turn.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session identifier" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_flush_stream", args);
        },
      },
      {
        name: "streaming_scrubber_simulate_stream",
        description: "Simulates feeding an array of split delta chunks and returns reconstructed text.",
        parameters: {
          chunks: { type: "string", required: true, description: "JSON array of string deltas" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_simulate_stream", args);
        },
      },
      {
        name: "streaming_scrubber_get_session_state",
        description: "Retrieves active streaming scrubber state for a session.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session identifier" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_get_session_state", args);
        },
      },
      {
        name: "streaming_scrubber_reset_session",
        description: "Resets buffer state and advances turn index for a session.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session identifier" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_reset_session", args);
        },
      },
      {
        name: "streaming_scrubber_configure",
        description: "Configures streaming scrubber policies and recognized reasoning tag names.",
        parameters: {
          enabled: { type: "boolean", description: "Enable or disable scrubber" },
          preserveProseMentions: { type: "boolean", description: "Preserve prose mentions" },
          discardUnterminatedOnFlush: { type: "boolean", description: "Discard unterminated blocks on flush" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_configure", args);
        },
      },
      {
        name: "streaming_scrubber_get_config",
        description: "Retrieves active streaming scrubber configuration.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_get_config", args);
        },
      },
      {
        name: "streaming_scrubber_get_metrics",
        description: "Fetches aggregated scrubber metrics and suppressed chunk counts.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_get_metrics", args);
        },
      },
      {
        name: "streaming_scrubber_get_metrics_report",
        description: "Retrieves detailed metrics report broken down by session.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_get_metrics_report", args);
        },
      },
      {
        name: "streaming_scrubber_audit_health",
        description: "Audits scrubber health posture and active session counts.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_audit_health", args);
        },
      },
      {
        name: "streaming_scrubber_record_event",
        description: "Manually records a scrub event in the substrate ledger.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
          deltaSize: { type: "number", required: true, description: "Delta size in bytes" },
          emittedSize: { type: "number", required: true, description: "Emitted size in bytes" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_record_event", args);
        },
      },
      {
        name: "streaming_scrubber_get_event",
        description: "Retrieves a scrub event from the ledger by ID.",
        parameters: {
          id: { type: "string", required: true, description: "Event ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_get_event", args);
        },
      },
      {
        name: "streaming_scrubber_list_events",
        description: "Lists all recorded stream scrub events.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_list_events", args);
        },
      },
      {
        name: "streaming_scrubber_remove_event",
        description: "Removes a scrub event from the memory ledger.",
        parameters: {
          id: { type: "string", required: true, description: "Event ID to delete" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_remove_event", args);
        },
      },
      {
        name: "streaming_scrubber_clear_events",
        description: "Clears all events, metrics, and session holdbacks.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_clear_events", args);
        },
      },
      {
        name: "streaming_scrubber_group_and_sort",
        description: "Organizes scrub events into multi-criteria swimlanes (sessionId, status, blockState).",
        parameters: {
          groupBy: { type: "string", description: "sessionId, status, blockState" },
          sortBy: { type: "string", description: "timestamp, deltaSize, durationMs, emittedSize" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_group_and_sort", args);
        },
      },
      {
        name: "streaming_scrubber_search_dsl",
        description: "Searches scrub events using Natural Query DSL (e.g. 'is:block session:main').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_search_dsl", args);
        },
      },
      {
        name: "streaming_scrubber_render_dashboard",
        description: "Renders an ANSI CLI summary card with processed deltas and health status.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_render_dashboard", args);
        },
      },
      {
        name: "streaming_scrubber_render_event_card",
        description: "Renders an interactive ANSI CLI scrub event card.",
        parameters: {
          id: { type: "string", required: true, description: "Event ID" },
          sessionId: { type: "string", description: "Session ID" },
          turnIndex: { type: "number", description: "Turn Index" },
          deltaSize: { type: "number", description: "Delta Size" },
          emittedSize: { type: "number", description: "Emitted Size" },
          inBlock: { type: "boolean", description: "In Block" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_render_event_card", args);
        },
      },
      {
        name: "streaming_scrubber_export_html_view",
        description: "Exports streaming scrubber ledger to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_export_html_view", args);
        },
      },
      {
        name: "streaming_scrubber_export_markdown_report",
        description: "Exports streaming scrubber report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_export_markdown_report", args);
        },
      },
      {
        name: "streaming_scrubber_export_csv_report",
        description: "Exports streaming scrub events ledger to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_export_csv_report", args);
        },
      },
      {
        name: "streaming_scrubber_bulk_purge",
        description: "Atomically purges multiple scrub events from the ledger.",
        parameters: {
          idsJson: { type: "string", required: true, description: "JSON array of event IDs" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_bulk_purge", args);
        },
      },
      {
        name: "streaming_scrubber_bulk_reset",
        description: "Atomically resets multiple session states.",
        parameters: {
          sessionIdsJson: { type: "string", required: true, description: "JSON array of session IDs" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_bulk_reset", args);
        },
      },
      {
        name: "streaming_scrubber_undo",
        description: "Reverts the last streaming scrubber mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_undo", args);
        },
      },
      {
        name: "streaming_scrubber_redo",
        description: "Re-applies the last undone streaming scrubber mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_redo", args);
        },
      },
      {
        name: "streaming_scrubber_capture_snapshot",
        description: "Captures a frame-perfect snapshot of scrubber states.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_capture_snapshot", args);
        },
      },
      {
        name: "streaming_scrubber_restore_snapshot",
        description: "Restores scrubber state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_restore_snapshot", args);
        },
      },
      {
        name: "streaming_scrubber_format_result",
        description: "Formats a scrub result into a standardized summary.",
        parameters: {
          deltaLength: { type: "number", required: true, description: "Delta length" },
          emittedLength: { type: "number", required: true, description: "Emitted length" },
          inBlock: { type: "boolean", required: true, description: "In block" },
          durationMs: { type: "number", description: "Duration in ms" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("streaming_scrubber_format_result", args);
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
        case "streaming_scrubber_feed_delta": {
          const sessionId = String(args.sessionId || "default-session");
          const delta = String(args.delta || "");
          const visibleText = this.supervisor.feedDelta(sessionId, delta);
          const state = this.supervisor.getSessionState(sessionId);
          return { success: true, sessionId, visibleText, inBlock: state.inBlock, heldBufferLength: state.heldBuffer.length };
        }

        case "streaming_scrubber_feed_delta_with_metrics": {
          const sessionId = String(args.sessionId || "default-session");
          const delta = String(args.delta || "");
          const result = this.supervisor.feedDeltaWithMetrics(sessionId, delta);
          return { success: true, sessionId, result };
        }

        case "streaming_scrubber_flush_stream": {
          const sessionId = String(args.sessionId || "default-session");
          const tailText = this.supervisor.flushStream(sessionId);
          return { success: true, sessionId, tailText };
        }

        case "streaming_scrubber_simulate_stream": {
          let rawChunks: unknown[] = [];
          if (Array.isArray(args.chunks)) {
            rawChunks = args.chunks;
          } else if (typeof args.chunks === "string") {
            try {
              const parsed = JSON.parse(args.chunks);
              if (Array.isArray(parsed)) rawChunks = parsed;
              else rawChunks = [args.chunks];
            } catch {
              rawChunks = [args.chunks];
            }
          }
          const chunks = rawChunks.map((c) => String(c));
          const simulation = this.supervisor.simulateStream(chunks);
          return { success: true, ...simulation };
        }

        case "streaming_scrubber_get_session_state": {
          const sessionId = String(args.sessionId || "default-session");
          const state = this.supervisor.getSessionState(sessionId);
          return { success: true, sessionId, state };
        }

        case "streaming_scrubber_reset_session": {
          const sessionId = String(args.sessionId || "default-session");
          this.supervisor.resetSession(sessionId);
          return { success: true, sessionId };
        }

        case "streaming_scrubber_configure": {
          this.supervisor.configure(args as any);
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "streaming_scrubber_get_config": {
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "streaming_scrubber_get_metrics": {
          return { success: true, metrics: this.supervisor.getMetrics() };
        }

        case "streaming_scrubber_get_metrics_report": {
          return { success: true, report: this.supervisor.getMetricsReport() };
        }

        case "streaming_scrubber_audit_health": {
          return { success: true, audit: this.supervisor.auditHealth() };
        }

        case "streaming_scrubber_record_event": {
          const sessionId = String(args.sessionId || "default-session");
          const deltaSize = Number(args.deltaSize || 0);
          const emittedSize = Number(args.emittedSize || 0);
          const id = `scrub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          this.supervisor.getSubstrate().recordEvent({
            id,
            sessionId,
            turnIndex: 0,
            deltaSize,
            emittedSize,
            suppressedSize: Math.max(0, deltaSize - emittedSize),
            inBlock: false,
            durationMs: 0.05,
            timestamp: Date.now(),
          });
          return { success: true, id };
        }

        case "streaming_scrubber_get_event": {
          const id = String(args.id || "");
          const event = this.supervisor.getSubstrate().getEvent(id);
          if (!event) return { success: false, error: `Event '${id}' not found` };
          return { success: true, event };
        }

        case "streaming_scrubber_list_events": {
          const events = this.supervisor.getSubstrate().listEvents();
          return { success: true, count: events.length, events };
        }

        case "streaming_scrubber_remove_event": {
          const id = String(args.id || "");
          const ok = this.supervisor.getSubstrate().removeEvent(id);
          return { success: ok };
        }

        case "streaming_scrubber_clear_events": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
        }

        case "streaming_scrubber_group_and_sort": {
          const groupBy = (args.groupBy as StreamingScrubberGroupBy) || "sessionId";
          const sortBy = (args.sortBy as StreamingScrubberSortBy) || "timestamp";
          const direction = (args.direction as StreamingScrubberSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedEvents(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "streaming_scrubber_search_dsl": {
          const query = String(args.query || "");
          const events = this.supervisor.queryDsl(query);
          return { success: true, count: events.length, events };
        }

        case "streaming_scrubber_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderStreamingScrubberDashboard({
            totalDeltas: metrics.totalDeltasProcessed,
            suppressedChunks: metrics.reasoningChunksSuppressed,
            blocksEncountered: metrics.blocksEncountered,
            activeSessions: health.activeSessions,
            healthStatus: health.healthStatus,
          });
          return { success: true, rendered };
        }

        case "streaming_scrubber_render_event_card": {
          const id = String(args.id || "scrub-1");
          const sessionId = String(args.sessionId || "sess-1");
          const turnIndex = Number(args.turnIndex || 0);
          const deltaSize = Number(args.deltaSize || 50);
          const emittedSize = Number(args.emittedSize || 20);
          const inBlock = Boolean(args.inBlock);
          const rendered = BroccoliViewRenderer.renderStreamingScrubberEventCard({
            id,
            sessionId,
            turnIndex,
            deltaSize,
            emittedSize,
            inBlock,
          });
          return { success: true, rendered };
        }

        case "streaming_scrubber_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "streaming_scrubber_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "streaming_scrubber_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "streaming_scrubber_bulk_purge": {
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

        case "streaming_scrubber_bulk_reset": {
          const sessionIdsJson = String(args.sessionIdsJson || "[]");
          let sessionIds: string[];
          try {
            sessionIds = JSON.parse(sessionIdsJson);
          } catch {
            return { success: false, error: "sessionIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkReset(sessionIds);
          return { success: true, result };
        }

        case "streaming_scrubber_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "streaming_scrubber_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "streaming_scrubber_capture_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const snap = this.snapshotManager.captureSnapshot(frameId);
          return { success: true, frameId, snapshot: snap };
        }

        case "streaming_scrubber_restore_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frameId);
          return { ...res };
        }

        case "streaming_scrubber_format_result": {
          const deltaLength = Number(args.deltaLength || 0);
          const emittedLength = Number(args.emittedLength || 0);
          const inBlock = Boolean(args.inBlock);
          const durationMs = Number(args.durationMs || 0.05);
          const formatted = this.supervisor.getEngine().formatScrubResult({
            deltaLength,
            emittedLength,
            inBlock,
            durationMs,
          });
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
