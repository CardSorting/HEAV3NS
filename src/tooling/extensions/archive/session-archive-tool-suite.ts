/**
 * session-archive-tool-suite.ts
 *
 * Model tool suite exposing multi-format session export, backup packaging, and integrity checks (Phase 99 / ADR-053).
 */

import type { SessionExportFormat } from "../../../core/contracts/session-archive.contracts.js";
import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { SessionArchiveSupervisor } from "../../../agents/extensions/archive/session-archive-supervisor.js";

export class SessionArchiveToolSuite {
  private supervisor: SessionArchiveSupervisor;

  constructor(supervisor: SessionArchiveSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "archive_export_session",
        description: "Exports session conversation turns in Markdown, HTML, or JSONL format.",
        parameters: {
          sessionId: {
            type: "string",
            description: "The unique identifier of the session to export",
            required: true,
          },
          format: {
            type: "string",
            description: "Export format ('markdown', 'html', or 'jsonl')",
            required: true,
          },
          turnsJson: {
            type: "string",
            description: "JSON array string representing session conversation turns",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const sessionId = typeof args.sessionId === "string" ? args.sessionId : "default-session";
          const format = (typeof args.format === "string" ? args.format : "markdown") as SessionExportFormat;
          const turnsJson = typeof args.turnsJson === "string" ? args.turnsJson : "[]";

          let turns: Array<{ role: string; content: string }> = [];
          try {
            const parsed = JSON.parse(turnsJson);
            if (Array.isArray(parsed)) {
              turns = parsed;
            }
          } catch {
            turns = [];
          }

          const result = this.supervisor.exportSession(sessionId, turns, format, {
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
        },
      },
      {
        name: "archive_create_backup",
        description: "Creates an in-memory binary backup archive packaging multiple virtual workspace files.",
        parameters: {
          sessionId: {
            type: "string",
            description: "The unique session identifier associated with this backup",
            required: true,
          },
          filesJson: {
            type: "string",
            description: "JSON object mapping relative file paths to file string contents",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const sessionId = typeof args.sessionId === "string" ? args.sessionId : "default-session";
          const filesJson = typeof args.filesJson === "string" ? args.filesJson : "{}";

          const fileMap = new Map<string, string>();
          try {
            const parsed = JSON.parse(filesJson);
            if (parsed && typeof parsed === "object") {
              for (const [k, v] of Object.entries(parsed)) {
                if (typeof v === "string") {
                  fileMap.set(k, v);
                }
              }
            }
          } catch {
            // empty map
          }

          const result = this.supervisor.createBackup(sessionId, fileMap);

          return {
            success: true,
            archiveId: result.archiveId,
            format: result.format,
            sizeBytes: result.sizeBytes,
            sha256Checksum: result.sha256Checksum,
            fileCount: fileMap.size,
          };
        },
      },
      {
        name: "archive_verify_package_integrity",
        description: "Verifies the cryptographic SHA-256 checksum of an exported session archive or backup package.",
        parameters: {
          archiveId: {
            type: "string",
            description: "The unique identifier of the archive to verify",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const archiveId = typeof args.archiveId === "string" ? args.archiveId : "";
          const verified = this.supervisor.verifyPackage(archiveId);

          return {
            success: true,
            archiveId,
            integrityVerified: verified,
          };
        },
      },
    ];
  }
}
