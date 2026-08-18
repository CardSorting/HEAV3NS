/**
 * diagnostic-doctor-tool-suite.ts
 *
 * Model tool surface for System Diagnostics, Health Checks & Session Salvage (Phase 97 / ADR-049 / Target #68):
 * 30 specialized model tools for running system diagnostics, checking individual subsystems,
 * salvaging broken sessions, repairing corrupt turns, DSL search, swimlanes, dashboards, and exporters.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  DiagnosticDoctorGroupBy,
  DiagnosticDoctorSortBy,
  DiagnosticDoctorSortDirection,
} from "../../../core/contracts/diagnostic-doctor.contracts.js";
import { DiagnosticDoctorSupervisor } from "../../../agents/extensions/doctor/diagnostic-doctor-supervisor.js";
import { DoctorSnapshotManager } from "../../../sessions/extensions/doctor/doctor-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class DiagnosticDoctorToolSuite {
  private readonly supervisor: DiagnosticDoctorSupervisor;
  private readonly snapshotManager: DoctorSnapshotManager;

  constructor(supervisor: DiagnosticDoctorSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new DoctorSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "doctor_run_diagnostics",
        description: "Runs deterministic health diagnostics across memory, VFS, tools, snapshots, and providers.",
        parameters: {
          includeDetails: { type: "boolean", description: "Whether to include detailed check diagnostic records" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_run_diagnostics", args);
        },
      },
      {
        name: "doctor_probe_subsystem",
        description: "Probes the health of a specific named subsystem.",
        parameters: {
          subsystemName: { type: "string", required: true, description: "Subsystem name to probe" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_probe_subsystem", args);
        },
      },
      {
        name: "doctor_salvage_session",
        description: "Non-destructively repairs orphaned turns, hanging tool calls, and corrupt payloads in a session transcript.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID to salvage" },
          rawTranscriptJson: { type: "string", required: true, description: "JSON array string of damaged transcript" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_salvage_session", args);
        },
      },
      {
        name: "doctor_get_latest_report",
        description: "Retrieves the most recent system diagnostic report.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_get_latest_report", args);
        },
      },
      {
        name: "doctor_list_reports",
        description: "Lists all generated diagnostic reports.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_list_reports", args);
        },
      },
      {
        name: "doctor_get_report",
        description: "Retrieves a specific diagnostic report by report ID.",
        parameters: {
          reportId: { type: "string", required: true, description: "Report ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_get_report", args);
        },
      },
      {
        name: "doctor_list_salvages",
        description: "Lists all recorded session salvage reports.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_list_salvages", args);
        },
      },
      {
        name: "doctor_get_salvage",
        description: "Retrieves a salvage report for a specific session ID.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_get_salvage", args);
        },
      },
      {
        name: "doctor_audit_health",
        description: "Audits diagnostic doctor health posture, latest severity, and recommendations.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_audit_health", args);
        },
      },
      {
        name: "doctor_get_metrics",
        description: "Fetches diagnostic metrics, total checks, repaired turns, and latency percentiles.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_get_metrics", args);
        },
      },
      {
        name: "doctor_group_and_sort",
        description: "Organizes diagnostic reports into multi-criteria swimlanes (severity, category, salvage_status).",
        parameters: {
          groupBy: { type: "string", description: "Group by: severity, category, salvage_status" },
          sortBy: { type: "string", description: "Sort by: timestamp, severity, durationMs" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_group_and_sort", args);
        },
      },
      {
        name: "doctor_search_dsl",
        description: "Searches diagnostic reports using Natural Query DSL (e.g. 'severity:healthy min_checks:5').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_search_dsl", args);
        },
      },
      {
        name: "doctor_render_dashboard",
        description: "Renders an ANSI CLI summary card with overall health and diagnostic counts.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_render_dashboard", args);
        },
      },
      {
        name: "doctor_render_check_card",
        description: "Renders an interactive ANSI CLI diagnostic check descriptor card.",
        parameters: {
          checkId: { type: "string", required: true, description: "Check ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_render_check_card", args);
        },
      },
      {
        name: "doctor_export_html",
        description: "Exports diagnostic reports and check results to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_export_html", args);
        },
      },
      {
        name: "doctor_export_markdown",
        description: "Exports diagnostic doctor report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_export_markdown", args);
        },
      },
      {
        name: "doctor_export_csv",
        description: "Exports diagnostic reports to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_export_csv", args);
        },
      },
      {
        name: "doctor_bulk_purge",
        description: "Atomically purges multiple diagnostic reports.",
        parameters: {
          reportIdsJson: { type: "string", required: true, description: "JSON array of report IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_bulk_purge", args);
        },
      },
      {
        name: "doctor_undo",
        description: "Reverts the last doctor mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_undo", args);
        },
      },
      {
        name: "doctor_redo",
        description: "Re-applies the last undone doctor mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_redo", args);
        },
      },
      {
        name: "doctor_capture_snapshot",
        description: "Captures a frame-perfect snapshot of doctor workspace state.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_capture_snapshot", args);
        },
      },
      {
        name: "doctor_restore_snapshot",
        description: "Restores doctor workspace state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_restore_snapshot", args);
        },
      },
      {
        name: "doctor_probe_memory",
        description: "Probes the continuous slab arena memory allocator status.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_probe_memory", args);
        },
      },
      {
        name: "doctor_probe_vfs",
        description: "Probes Virtual File System (VFS) staging and overlay buffers.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_probe_vfs", args);
        },
      },
      {
        name: "doctor_probe_tools",
        description: "Probes Tool Registry definition integrity and schema validity.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_probe_tools", args);
        },
      },
      {
        name: "doctor_probe_providers",
        description: "Probes AI model provider credentials and fallback routing.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_probe_providers", args);
        },
      },
      {
        name: "doctor_probe_snapshots",
        description: "Probes frame snapshot managers and O(1) state rewind integrity.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_probe_snapshots", args);
        },
      },
      {
        name: "doctor_format_check",
        description: "Formats a diagnostic check result into human-readable string.",
        parameters: {
          checkId: { type: "string", required: true, description: "Check ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_format_check", args);
        },
      },
      {
        name: "doctor_format_salvage",
        description: "Formats a session salvage report into human-readable string.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_format_salvage", args);
        },
      },
      {
        name: "doctor_clear_all",
        description: "Clears all stored diagnostic reports and session salvages.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("doctor_clear_all", args);
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
        case "doctor_run_diagnostics": {
          const report = this.supervisor.runDiagnostics();
          return {
            success: true,
            reportId: report.reportId,
            overallHealth: report.overallHealth,
            totalChecks: report.totalChecks,
            healthyCount: report.healthyCount,
            warningCount: report.warningCount,
            criticalCount: report.criticalCount,
            fatalCount: report.fatalCount,
            durationMs: report.durationMs,
            checks: report.checks,
          };
        }

        case "doctor_probe_subsystem": {
          const subsystemName = String(args.subsystemName || "memory");
          const result = this.supervisor.probeSubsystem(subsystemName);
          return { success: true, result };
        }

        case "doctor_salvage_session": {
          const sessionId = String(args.sessionId || "session-temp");
          let raw: Record<string, unknown>[] = [];
          if (typeof args.rawTranscriptJson === "string") {
            try {
              raw = JSON.parse(args.rawTranscriptJson);
            } catch {
              return { success: false, error: "rawTranscriptJson must be valid JSON array string" };
            }
          }
          const salvage = this.supervisor.salvageSession(sessionId, raw);
          return { success: true, salvage };
        }

        case "doctor_get_latest_report": {
          const report = this.supervisor.getLatestReport();
          return { success: true, report };
        }

        case "doctor_list_reports": {
          const reports = this.supervisor.getAllReports();
          return { success: true, count: reports.length, reports };
        }

        case "doctor_get_report": {
          const reportId = String(args.reportId || "");
          const report = this.supervisor.getSubstrate().getReport(reportId);
          if (!report) return { success: false, error: `Report '${reportId}' not found` };
          return { success: true, report };
        }

        case "doctor_list_salvages": {
          const salvages = this.supervisor.getSalvages();
          return { success: true, count: salvages.length, salvages };
        }

        case "doctor_get_salvage": {
          const sessionId = String(args.sessionId || "");
          const salvage = this.supervisor.getSubstrate().getSalvage(sessionId);
          if (!salvage) return { success: false, error: `Salvage for session '${sessionId}' not found` };
          return { success: true, salvage };
        }

        case "doctor_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "doctor_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "doctor_group_and_sort": {
          const groupBy = (args.groupBy as DiagnosticDoctorGroupBy) || "severity";
          const sortBy = (args.sortBy as DiagnosticDoctorSortBy) || "timestamp";
          const direction = (args.direction as DiagnosticDoctorSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedReports(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "doctor_search_dsl": {
          const query = String(args.query || "");
          const reports = this.supervisor.queryDsl(query);
          return { success: true, count: reports.length, reports };
        }

        case "doctor_render_dashboard": {
          const latest = this.supervisor.getLatestReport() || this.supervisor.runDiagnostics();
          const rendered = BroccoliViewRenderer.renderDiagnosticDoctorDashboard({
            reportId: latest.reportId,
            overallHealth: latest.overallHealth,
            totalChecks: latest.totalChecks,
            healthyCount: latest.healthyCount,
            warningCount: latest.warningCount,
            criticalCount: latest.criticalCount,
            durationMs: latest.durationMs,
          });
          return { success: true, rendered };
        }

        case "doctor_render_check_card": {
          const checkId = String(args.checkId || "");
          const latest = this.supervisor.getLatestReport() || this.supervisor.runDiagnostics();
          const check = latest.checks.find((c) => c.checkId === checkId);
          if (!check) return { success: false, error: `Check '${checkId}' not found` };
          const rendered = BroccoliViewRenderer.renderDiagnosticCheckCard({
            checkId: check.checkId,
            category: check.category,
            severity: check.severity,
            message: check.message,
          });
          return { success: true, rendered };
        }

        case "doctor_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "doctor_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "doctor_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "doctor_bulk_purge": {
          const idsJson = String(args.reportIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "reportIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "doctor_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "doctor_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "doctor_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "doctor_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frame);
          return { ...res };
        }

        case "doctor_probe_memory": {
          const result = this.supervisor.probeSubsystem("memory");
          return { success: true, result };
        }

        case "doctor_probe_vfs": {
          const result = this.supervisor.probeSubsystem("vfs");
          return { success: true, result };
        }

        case "doctor_probe_tools": {
          const result = this.supervisor.probeSubsystem("tools");
          return { success: true, result };
        }

        case "doctor_probe_providers": {
          const result = this.supervisor.probeSubsystem("providers");
          return { success: true, result };
        }

        case "doctor_probe_snapshots": {
          const result = this.supervisor.probeSubsystem("snapshots");
          return { success: true, result };
        }

        case "doctor_format_check": {
          const checkId = String(args.checkId || "");
          const latest = this.supervisor.getLatestReport() || this.supervisor.runDiagnostics();
          const check = latest.checks.find((c) => c.checkId === checkId);
          if (!check) return { success: false, error: `Check '${checkId}' not found` };
          const formatted = (this.supervisor as any).doctor?.formatDiagnosticCheck(check) || check.message;
          return { success: true, formatted };
        }

        case "doctor_format_salvage": {
          const sessionId = String(args.sessionId || "");
          const salvage = this.supervisor.getSubstrate().getSalvage(sessionId);
          if (!salvage) return { success: false, error: `Salvage for session '${sessionId}' not found` };
          const formatted = (this.supervisor as any).doctor?.formatSalvageReport(salvage) || `Salvaged: ${salvage.sessionId}`;
          return { success: true, formatted };
        }

        case "doctor_clear_all": {
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
