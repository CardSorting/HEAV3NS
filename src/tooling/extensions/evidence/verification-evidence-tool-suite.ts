/**
 * verification-evidence-tool-suite.ts
 *
 * Model tool surface for Verification Evidence, Quality Gates & Compliance Attestation (Phase 92 / ADR-044 / Target #73):
 * 30 specialized model tools for recording evidence, evaluating stop-gates, tracking modified files,
 * DSL search, swimlanes, dashboards, and HTML/Markdown/CSV exporters.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  EvidenceKind,
  EvidenceScope,
  VerificationEvidenceGroupBy,
  VerificationEvidenceSortBy,
  VerificationEvidenceSortDirection,
} from "../../../core/contracts/verification-evidence.contracts.js";
import { VerificationEvidenceSupervisor } from "../../../agents/extensions/evidence/verification-evidence-supervisor.js";
import { EvidenceSnapshotManager } from "../../../sessions/extensions/evidence/evidence-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class VerificationEvidenceToolSuite {
  private readonly supervisor: VerificationEvidenceSupervisor;
  private readonly snapshotManager: EvidenceSnapshotManager;

  constructor(supervisor: VerificationEvidenceSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new EvidenceSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "evidence_record",
        description: "Records a verified test, build, typecheck, or lint command execution result.",
        parameters: {
          command: { type: "string", required: true, description: "Verification command executed" },
          kind: { type: "string", required: true, description: "Kind: test, build, typecheck, lint, manual" },
          scope: { type: "string", required: true, description: "Scope: file, package, workspace" },
          passed: { type: "boolean", required: true, description: "Whether verification passed cleanly" },
          exitCode: { type: "number", description: "Process exit code" },
          durationMs: { type: "number", description: "Duration in milliseconds" },
          outputSummary: { type: "string", description: "Output or test summary" },
          verifiedPaths: { type: "string", description: "Comma-separated verified file paths" },
          frameIndex: { type: "number", description: "Execution frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_record", args);
        },
      },
      {
        name: "evidence_track_file",
        description: "Tracks a modified file in the active turn for stop-gate verification enforcement.",
        parameters: {
          filePath: { type: "string", required: true, description: "Modified source code file path" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_track_file", args);
        },
      },
      {
        name: "evidence_check_stop_gate",
        description: "Evaluates if turn completion is safe or requires an automated verification nudge.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_check_stop_gate", args);
        },
      },
      {
        name: "evidence_get_insights",
        description: "Generates a comprehensive session verification insights and compliance report.",
        parameters: {
          totalFrames: { type: "number", description: "Total execution frames" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_get_insights", args);
        },
      },
      {
        name: "evidence_get_record",
        description: "Retrieves a specific evidence record by its unique ID.",
        parameters: {
          id: { type: "string", required: true, description: "Evidence record ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_get_record", args);
        },
      },
      {
        name: "evidence_list_records",
        description: "Lists all recorded verification evidence entries.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_list_records", args);
        },
      },
      {
        name: "evidence_get_latest",
        description: "Retrieves the most recently recorded verification evidence record.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_get_latest", args);
        },
      },
      {
        name: "evidence_delete_record",
        description: "Deletes a verification evidence record from the ledger.",
        parameters: {
          id: { type: "string", required: true, description: "Evidence record ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_delete_record", args);
        },
      },
      {
        name: "evidence_list_modified_files",
        description: "Lists all unverified modified source code files currently pending verification.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_list_modified_files", args);
        },
      },
      {
        name: "evidence_clear_modified_files",
        description: "Clears the modified code files tracking buffer.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_clear_modified_files", args);
        },
      },
      {
        name: "evidence_audit_health",
        description: "Audits verification health status, pass rate, and unverified files.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_audit_health", args);
        },
      },
      {
        name: "evidence_get_metrics",
        description: "Fetches aggregated verification metrics, durations, and kind breakdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_get_metrics", args);
        },
      },
      {
        name: "evidence_group_and_sort",
        description: "Organizes evidence records into multi-criteria swimlanes (kind, scope, status).",
        parameters: {
          groupBy: { type: "string", description: "kind, scope, status" },
          sortBy: { type: "string", description: "timestamp, durationMs, frameIndex" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_group_and_sort", args);
        },
      },
      {
        name: "evidence_search_dsl",
        description: "Searches evidence records using Natural Query DSL (e.g. 'kind:test passed:true').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_search_dsl", args);
        },
      },
      {
        name: "evidence_render_dashboard",
        description: "Renders an ANSI CLI summary card with evidence counts, pass rate, and health.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_render_dashboard", args);
        },
      },
      {
        name: "evidence_render_evidence_card",
        description: "Renders an interactive ANSI CLI verification evidence descriptor card.",
        parameters: {
          id: { type: "string", required: true, description: "Evidence record ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_render_evidence_card", args);
        },
      },
      {
        name: "evidence_export_html_view",
        description: "Exports verification ledger and quality gate status to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_export_html_view", args);
        },
      },
      {
        name: "evidence_export_markdown_report",
        description: "Exports verification evidence report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_export_markdown_report", args);
        },
      },
      {
        name: "evidence_export_csv_report",
        description: "Exports verification evidence records to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_export_csv_report", args);
        },
      },
      {
        name: "evidence_bulk_purge",
        description: "Atomically purges multiple evidence records.",
        parameters: {
          evidenceIdsJson: { type: "string", required: true, description: "JSON array of evidence IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_bulk_purge", args);
        },
      },
      {
        name: "evidence_undo",
        description: "Reverts the last verification evidence mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_undo", args);
        },
      },
      {
        name: "evidence_redo",
        description: "Re-applies the last undone evidence mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_redo", args);
        },
      },
      {
        name: "evidence_capture_snapshot",
        description: "Captures a frame-perfect snapshot of verification evidence workspace state.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_capture_snapshot", args);
        },
      },
      {
        name: "evidence_restore_snapshot",
        description: "Restores verification evidence state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_restore_snapshot", args);
        },
      },
      {
        name: "evidence_record_test",
        description: "Convenience tool to record test suite execution evidence.",
        parameters: {
          command: { type: "string", required: true, description: "Test command" },
          passed: { type: "boolean", required: true, description: "Passed status" },
          durationMs: { type: "number", description: "Duration in ms" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_record", { ...args, kind: "test", scope: "workspace" });
        },
      },
      {
        name: "evidence_record_build",
        description: "Convenience tool to record build task execution evidence.",
        parameters: {
          command: { type: "string", required: true, description: "Build command" },
          passed: { type: "boolean", required: true, description: "Passed status" },
          durationMs: { type: "number", description: "Duration in ms" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_record", { ...args, kind: "build", scope: "workspace" });
        },
      },
      {
        name: "evidence_record_typecheck",
        description: "Convenience tool to record TypeScript typecheck evidence.",
        parameters: {
          passed: { type: "boolean", required: true, description: "Typecheck passed" },
          durationMs: { type: "number", description: "Duration in ms" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_record", { command: "tsc --noEmit", ...args, kind: "typecheck", scope: "workspace" });
        },
      },
      {
        name: "evidence_format_record",
        description: "Formats an evidence record into a human-readable string.",
        parameters: {
          id: { type: "string", required: true, description: "Evidence record ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_format_record", args);
        },
      },
      {
        name: "evidence_format_evaluation",
        description: "Formats the current stop-gate evaluation result into a human-readable string.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("evidence_format_evaluation", args);
        },
      },
      {
        name: "evidence_clear_all",
        description: "Clears all stored verification evidence records and modified files from memory.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          this.supervisor.getSubstrate().clear();
          return { success: true };
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
        case "evidence_record": {
          const command = String(args.command || "test");
          const kind = (args.kind as EvidenceKind) || "test";
          const scope = (args.scope as EvidenceScope) || "workspace";
          const passed = typeof args.passed === "boolean" ? args.passed : true;
          const exitCode = typeof args.exitCode === "number" ? args.exitCode : passed ? 0 : 1;
          const durationMs = typeof args.durationMs === "number" ? args.durationMs : 10;
          const outputSummary = args.outputSummary ? String(args.outputSummary) : passed ? "Pass" : "Fail";
          const frameIndex = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const verifiedPaths = args.verifiedPaths ? String(args.verifiedPaths).split(",").map((p) => p.trim()) : [];

          const record = this.supervisor.recordEvidence({
            frameIndex,
            command,
            kind,
            scope,
            passed,
            exitCode,
            durationMs,
            outputSummary,
            verifiedPaths,
          });

          return {
            success: true,
            evidenceId: record.id,
            passed: record.passed,
            kind: record.kind,
            durationMs: record.durationMs,
          };
        }

        case "evidence_track_file": {
          const filePath = String(args.filePath || "");
          this.supervisor.trackFileModification(filePath);
          return { success: true, filePath };
        }

        case "evidence_check_stop_gate": {
          const evalResult = this.supervisor.checkStopGate();
          return {
            success: true,
            shouldNudge: evalResult.shouldNudge,
            reason: evalResult.reason,
            unverifiedFiles: evalResult.unverifiedModifiedFiles,
            latestEvidence: evalResult.latestEvidence,
          };
        }

        case "evidence_get_insights": {
          const frames = typeof args.totalFrames === "number" ? args.totalFrames : 1;
          const insights = this.supervisor.getInsights(frames);
          return { success: true, insights };
        }

        case "evidence_get_record": {
          const id = String(args.id || "");
          const record = this.supervisor.getSubstrate().getEvidence(id);
          if (!record) return { success: false, error: `Evidence '${id}' not found` };
          return { success: true, record };
        }

        case "evidence_list_records": {
          const records = this.supervisor.getRecords();
          return { success: true, count: records.length, records };
        }

        case "evidence_get_latest": {
          const latest = this.supervisor.getSubstrate().getLatestEvidence();
          return { success: true, latest };
        }

        case "evidence_delete_record": {
          const id = String(args.id || "");
          const ok = this.supervisor.getSubstrate().deleteEvidence(id);
          return { success: ok };
        }

        case "evidence_list_modified_files": {
          const files = this.supervisor.getModifiedFiles();
          return { success: true, count: files.length, files };
        }

        case "evidence_clear_modified_files": {
          this.supervisor.getSubstrate().clearModifiedFiles();
          return { success: true };
        }

        case "evidence_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "evidence_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "evidence_group_and_sort": {
          const groupBy = (args.groupBy as VerificationEvidenceGroupBy) || "kind";
          const sortBy = (args.sortBy as VerificationEvidenceSortBy) || "timestamp";
          const direction = (args.direction as VerificationEvidenceSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedEvidence(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "evidence_search_dsl": {
          const query = String(args.query || "");
          const records = this.supervisor.queryDsl(query);
          return { success: true, count: records.length, records };
        }

        case "evidence_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderVerificationEvidenceDashboard({
            totalEvidence: metrics.totalEvidenceCount,
            passedCount: metrics.passedEvidenceCount,
            failedCount: metrics.failedEvidenceCount,
            passRatePercent: metrics.passRatePercent,
            unverifiedFilesCount: metrics.totalUnverifiedFiles,
            healthStatus: health.healthStatus,
          });
          return { success: true, rendered };
        }

        case "evidence_render_evidence_card": {
          const id = String(args.id || "");
          const record = this.supervisor.getSubstrate().getEvidence(id);
          if (!record) return { success: false, error: `Evidence '${id}' not found` };
          const rendered = BroccoliViewRenderer.renderVerificationEvidenceCard({
            id: record.id,
            kind: record.kind,
            scope: record.scope,
            command: record.command,
            passed: record.passed,
            durationMs: record.durationMs,
            exitCode: record.exitCode,
          });
          return { success: true, rendered };
        }

        case "evidence_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "evidence_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "evidence_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "evidence_bulk_purge": {
          const idsJson = String(args.evidenceIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "evidenceIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "evidence_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "evidence_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "evidence_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "evidence_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frame);
          return { ...res };
        }

        case "evidence_format_record": {
          const id = String(args.id || "");
          const record = this.supervisor.getSubstrate().getEvidence(id);
          if (!record) return { success: false, error: `Evidence '${id}' not found` };
          const formatted = this.supervisor.getLedger().formatEvidence(record);
          return { success: true, formatted };
        }

        case "evidence_format_evaluation": {
          const evalResult = this.supervisor.checkStopGate();
          const formatted = this.supervisor.getLedger().formatEvaluation(evalResult);
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
