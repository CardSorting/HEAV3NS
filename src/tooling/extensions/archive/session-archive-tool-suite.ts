/**
 * session-archive-tool-suite.ts
 *
 * Model tool surface for Session Archive, Cold Storage & Multi-Format Exporter (Phase 99 / ADR-053 / Target #70):
 * 30 specialized model tools for exporting sessions (Markdown, HTML, JSONL, Binary),
 * retrieving manifests, validating checksums, DSL search, swimlanes, dashboards, and exporters.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  ExportedTurnItem,
  SessionArchiveGroupBy,
  SessionArchiveSortBy,
  SessionArchiveSortDirection,
  SessionExportFormat,
} from "../../../core/contracts/session-archive.contracts.js";
import { SessionArchiveSupervisor } from "../../../agents/extensions/archive/session-archive-supervisor.js";
import { ArchiveSnapshotManager } from "../../../sessions/extensions/archive/archive-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class SessionArchiveToolSuite {
  private readonly supervisor: SessionArchiveSupervisor;
  private readonly snapshotManager: ArchiveSnapshotManager;

  constructor(supervisor: SessionArchiveSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new ArchiveSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "archive_export_session",
        description: "Exports session conversation turns in Markdown, HTML, or JSONL format.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID to export" },
          format: { type: "string", required: true, description: "Export format ('markdown', 'html', 'jsonl')" },
          turnsJson: { type: "string", required: true, description: "JSON array string of turns" },
          title: { type: "string", description: "Optional export title" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_export_session", args);
        },
      },
      {
        name: "archive_export_markdown",
        description: "Exports session conversation turns to GitHub-Flavored Markdown.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
          turnsJson: { type: "string", required: true, description: "JSON array string of turns" },
          title: { type: "string", description: "Document title" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_export_markdown", args);
        },
      },
      {
        name: "archive_export_html",
        description: "Exports session conversation turns to a self-contained standalone HTML5 document.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
          turnsJson: { type: "string", required: true, description: "JSON array string of turns" },
          title: { type: "string", description: "Document title" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_export_html", args);
        },
      },
      {
        name: "archive_export_jsonl",
        description: "Exports session conversation turns to JSONL stream format.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
          turnsJson: { type: "string", required: true, description: "JSON array string of turns" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_export_jsonl", args);
        },
      },
      {
        name: "archive_create_backup",
        description: "Packages multiple named files into an in-memory binary backup archive (.bin).",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
          filesJson: { type: "string", required: true, description: "JSON object mapping file paths to file contents" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_create_backup", args);
        },
      },
      {
        name: "archive_get_manifest",
        description: "Retrieves an archive manifest by archive ID.",
        parameters: {
          archiveId: { type: "string", required: true, description: "Archive ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_get_manifest", args);
        },
      },
      {
        name: "archive_get_document",
        description: "Retrieves an exported document payload by archive ID.",
        parameters: {
          archiveId: { type: "string", required: true, description: "Archive ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_get_document", args);
        },
      },
      {
        name: "archive_list_manifests",
        description: "Lists all recorded archive manifests.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_list_manifests", args);
        },
      },
      {
        name: "archive_list_by_session",
        description: "Lists all archives belonging to a specific session ID.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_list_by_session", args);
        },
      },
      {
        name: "archive_verify_package",
        description: "Verifies the cryptographic SHA-256 integrity checksum of a stored archive.",
        parameters: {
          archiveId: { type: "string", required: true, description: "Archive ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_verify_package", args);
        },
      },
      {
        name: "archive_purge_archive",
        description: "Purges an archive and its stored document from memory and BroccoliDB.",
        parameters: {
          archiveId: { type: "string", required: true, description: "Archive ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_purge_archive", args);
        },
      },
      {
        name: "archive_audit_health",
        description: "Audits session archive vault health posture, total footprint, and format breakdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_audit_health", args);
        },
      },
      {
        name: "archive_get_metrics",
        description: "Fetches archive metrics, total exports, bytes archived, and format breakdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_get_metrics", args);
        },
      },
      {
        name: "archive_group_and_sort",
        description: "Organizes archives into multi-criteria swimlanes (format, session, size_tier).",
        parameters: {
          groupBy: { type: "string", description: "Group by: format, session, size_tier" },
          sortBy: { type: "string", description: "Sort by: createdAt, totalSizeBytes, turnCount" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_group_and_sort", args);
        },
      },
      {
        name: "archive_search_dsl",
        description: "Searches archives using Natural Query DSL (e.g. 'format:markdown min_turns:2').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_search_dsl", args);
        },
      },
      {
        name: "archive_render_dashboard",
        description: "Renders an ANSI CLI summary card with archive count, sizes, and health posture.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_render_dashboard", args);
        },
      },
      {
        name: "archive_render_manifest_card",
        description: "Renders an interactive ANSI CLI archive manifest descriptor card.",
        parameters: {
          archiveId: { type: "string", required: true, description: "Archive ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_render_manifest_card", args);
        },
      },
      {
        name: "archive_export_html_view",
        description: "Exports session archive vault catalog to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_export_html_view", args);
        },
      },
      {
        name: "archive_export_markdown_report",
        description: "Exports session archive vault summary to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_export_markdown_report", args);
        },
      },
      {
        name: "archive_export_csv_report",
        description: "Exports session archive manifests to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_export_csv_report", args);
        },
      },
      {
        name: "archive_bulk_purge",
        description: "Atomically purges multiple session archives.",
        parameters: {
          archiveIdsJson: { type: "string", required: true, description: "JSON array of archive IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_bulk_purge", args);
        },
      },
      {
        name: "archive_undo",
        description: "Reverts the last archive mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_undo", args);
        },
      },
      {
        name: "archive_redo",
        description: "Re-applies the last undone archive mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_redo", args);
        },
      },
      {
        name: "archive_capture_snapshot",
        description: "Captures a frame-perfect snapshot of archive workspace state.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_capture_snapshot", args);
        },
      },
      {
        name: "archive_restore_snapshot",
        description: "Restores archive workspace state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_restore_snapshot", args);
        },
      },
      {
        name: "archive_verify_checksum",
        description: "Validates a raw content string or buffer against an expected SHA-256 hash.",
        parameters: {
          archiveId: { type: "string", required: true, description: "Archive ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_verify_checksum", args);
        },
      },
      {
        name: "archive_format_manifest",
        description: "Formats an archive manifest into a human-readable string.",
        parameters: {
          archiveId: { type: "string", required: true, description: "Archive ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_format_manifest", args);
        },
      },
      {
        name: "archive_format_export",
        description: "Formats an exported document result into a human-readable summary.",
        parameters: {
          archiveId: { type: "string", required: true, description: "Archive ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_format_export", args);
        },
      },
      {
        name: "archive_export_session_auto",
        description: "Automatically exports a session across Markdown, HTML, and JSONL formats simultaneously.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
          turnsJson: { type: "string", required: true, description: "JSON array string of turns" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_export_session_auto", args);
        },
      },
      {
        name: "archive_clear_all",
        description: "Clears all stored archives and manifests from memory.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("archive_clear_all", args);
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
        case "archive_export_session": {
          const sessionId = String(args.sessionId || "default-session");
          const format = (args.format as SessionExportFormat) || "markdown";
          let turns: ExportedTurnItem[] = [];
          if (typeof args.turnsJson === "string") {
            try {
              turns = JSON.parse(args.turnsJson);
            } catch {
              return { success: false, error: "turnsJson must be valid JSON array" };
            }
          }
          const title = typeof args.title === "string" ? args.title : undefined;
          const result = this.supervisor.exportSession(sessionId, turns, format, {
            title,
            includeReasoning: true,
            includeToolCalls: true,
          });
          return {
            success: true,
            archiveId: result.archiveId,
            format: result.format,
            sizeBytes: result.sizeBytes,
            sha256Checksum: result.sha256Checksum,
            mimeType: result.mimeType,
          };
        }

        case "archive_export_markdown": {
          return this.executeTool("archive_export_session", { ...args, format: "markdown" });
        }

        case "archive_export_html": {
          return this.executeTool("archive_export_session", { ...args, format: "html" });
        }

        case "archive_export_jsonl": {
          return this.executeTool("archive_export_session", { ...args, format: "jsonl" });
        }

        case "archive_create_backup": {
          const sessionId = String(args.sessionId || "backup-session");
          const files = new Map<string, string | Uint8Array>();
          if (typeof args.filesJson === "string") {
            try {
              const parsed = JSON.parse(args.filesJson);
              for (const [k, v] of Object.entries(parsed)) {
                files.set(k, String(v));
              }
            } catch {
              return { success: false, error: "filesJson must be valid JSON object" };
            }
          }
          const result = this.supervisor.createBackup(sessionId, files);
          return {
            success: true,
            archiveId: result.archiveId,
            format: result.format,
            sizeBytes: result.sizeBytes,
            sha256Checksum: result.sha256Checksum,
          };
        }

        case "archive_get_manifest": {
          const archiveId = String(args.archiveId || "");
          const manifest = this.supervisor.getSubstrate().getManifest(archiveId);
          if (!manifest) return { success: false, error: `Manifest '${archiveId}' not found` };
          return { success: true, manifest };
        }

        case "archive_get_document": {
          const archiveId = String(args.archiveId || "");
          const doc = this.supervisor.getArchiveDocument(archiveId);
          if (!doc) return { success: false, error: `Document '${archiveId}' not found` };
          return { success: true, document: doc };
        }

        case "archive_list_manifests": {
          const manifests = this.supervisor.getAllManifests();
          return { success: true, count: manifests.length, manifests };
        }

        case "archive_list_by_session": {
          const sessionId = String(args.sessionId || "");
          const manifests = this.supervisor.getManifests(sessionId);
          return { success: true, count: manifests.length, manifests };
        }

        case "archive_verify_package":
        case "archive_verify_checksum": {
          const archiveId = String(args.archiveId || "");
          const verified = this.supervisor.verifyPackage(archiveId);
          return { success: true, archiveId, verified };
        }

        case "archive_purge_archive": {
          const archiveId = String(args.archiveId || "");
          const ok = this.supervisor.getSubstrate().purgeArchive(archiveId);
          return { success: ok };
        }

        case "archive_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "archive_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "archive_group_and_sort": {
          const groupBy = (args.groupBy as SessionArchiveGroupBy) || "format";
          const sortBy = (args.sortBy as SessionArchiveSortBy) || "createdAt";
          const direction = (args.direction as SessionArchiveSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedArchives(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "archive_search_dsl": {
          const query = String(args.query || "");
          const manifests = this.supervisor.queryDsl(query);
          return { success: true, count: manifests.length, manifests };
        }

        case "archive_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderSessionArchiveDashboard({
            totalArchives: metrics.totalExportsAttempted,
            totalSizeBytes: metrics.totalBytesArchived,
            healthStatus: health.healthStatus,
            markdownCount: metrics.formatBreakdown.markdown,
            htmlCount: metrics.formatBreakdown.html,
            jsonlCount: metrics.formatBreakdown.jsonl,
            binaryCount: metrics.formatBreakdown.binary_archive,
          });
          return { success: true, rendered };
        }

        case "archive_render_manifest_card": {
          const archiveId = String(args.archiveId || "");
          const manifest = this.supervisor.getSubstrate().getManifest(archiveId);
          if (!manifest) return { success: false, error: `Manifest '${archiveId}' not found` };
          const rendered = BroccoliViewRenderer.renderArchiveManifestCard({
            archiveId: manifest.archiveId,
            sessionId: manifest.sessionId,
            format: manifest.format,
            turnCount: manifest.turnCount,
            totalSizeBytes: manifest.totalSizeBytes,
            sha256Checksum: manifest.sha256Checksum,
          });
          return { success: true, rendered };
        }

        case "archive_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "archive_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "archive_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "archive_bulk_purge": {
          const idsJson = String(args.archiveIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "archiveIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "archive_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "archive_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "archive_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "archive_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frame);
          return { ...res };
        }

        case "archive_format_manifest": {
          const archiveId = String(args.archiveId || "");
          const manifest = this.supervisor.getSubstrate().getManifest(archiveId);
          if (!manifest) return { success: false, error: `Manifest '${archiveId}' not found` };
          const formatted = this.supervisor.getArchiver().formatManifest(manifest);
          return { success: true, formatted };
        }

        case "archive_format_export": {
          const archiveId = String(args.archiveId || "");
          const doc = this.supervisor.getArchiveDocument(archiveId);
          if (!doc) return { success: false, error: `Document '${archiveId}' not found` };
          const formatted = this.supervisor.getArchiver().formatExportResult(doc);
          return { success: true, formatted };
        }

        case "archive_export_session_auto": {
          const sessionId = String(args.sessionId || "auto-session");
          let turns: ExportedTurnItem[] = [];
          if (typeof args.turnsJson === "string") {
            try {
              turns = JSON.parse(args.turnsJson);
            } catch {
              return { success: false, error: "turnsJson must be valid JSON array" };
            }
          }
          const md = this.supervisor.exportSession(sessionId, turns, "markdown");
          const html = this.supervisor.exportSession(sessionId, turns, "html");
          const jsonl = this.supervisor.exportSession(sessionId, turns, "jsonl");
          return { success: true, sessionId, exports: { markdown: md.archiveId, html: html.archiveId, jsonl: jsonl.archiveId } };
        }

        case "archive_clear_all": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
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
