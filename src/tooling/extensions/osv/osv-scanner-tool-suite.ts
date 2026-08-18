/**
 * osv-scanner-tool-suite.ts
 *
 * Model tool surface for Deterministic OSV Malware Scanner,
 * Package Ecosystem Firewall & Supply-Chain Advisory Subsystem (Phase 128 / ADR-104 / Target #81):
 * 30 specialized model tools for scanning packages, checking shell commands,
 * querying DSL, swimlanes, dashboards, and HTML/Markdown/CSV exports.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  OsvGroupBy,
  OsvSortBy,
  OsvSortDirection,
  PackageEcosystem,
} from "../../../core/contracts/osv-scanner.contracts.js";
import { OsvScannerSupervisor } from "../../../agents/extensions/osv/osv-scanner-supervisor.js";
import { OsvSnapshotManager } from "../../../sessions/extensions/osv/osv-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class OsvScannerToolSuite {
  private readonly supervisor: OsvScannerSupervisor;
  private readonly snapshotManager: OsvSnapshotManager;

  constructor(supervisor: OsvScannerSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new OsvSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "osv_scan_package",
        description: "Scans a specific package name, ecosystem, and optional version against OSV advisories.",
        parameters: {
          name: { type: "string", required: true, description: "Package name" },
          ecosystem: { type: "string", required: true, description: "Ecosystem e.g. npm, PyPI, crates.io" },
          version: { type: "string", description: "Package version" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_scan_package", args);
        },
      },
      {
        name: "osv_check_command",
        description: "Pre-flight checks a command line string for malicious packages.",
        parameters: {
          command: { type: "string", required: true, description: "Command executable" },
          args: { type: "string", description: "Command arguments JSON or string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_check_command", args);
        },
      },
      {
        name: "osv_add_blocked_package",
        description: "Adds a custom blocked package to organization policy.",
        parameters: {
          name: { type: "string", required: true, description: "Package name" },
          ecosystem: { type: "string", required: true, description: "Ecosystem" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_add_blocked_package", args);
        },
      },
      {
        name: "osv_configure",
        description: "Configures OSV vulnerability scanner options.",
        parameters: {
          blockMalwareOnly: { type: "boolean", description: "Block malware only" },
          failOpen: { type: "boolean", description: "Fail open on network error" },
          cacheTtlMs: { type: "number", description: "Cache TTL ms" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_configure", args);
        },
      },
      {
        name: "osv_get_config",
        description: "Retrieves active OSV scanner configuration.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_get_config", args);
        },
      },
      {
        name: "osv_get_metrics",
        description: "Fetches aggregated vulnerability scanning metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_get_metrics", args);
        },
      },
      {
        name: "osv_get_metrics_report",
        description: "Retrieves detailed metrics report with ecosystem breakdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_get_metrics_report", args);
        },
      },
      {
        name: "osv_audit_health",
        description: "Audits OSV scanner SLA health posture and cache hit rate.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_audit_health", args);
        },
      },
      {
        name: "osv_record_scan",
        description: "Records a package scan result into the memory ledger.",
        parameters: {
          name: { type: "string", required: true, description: "Package name" },
          ecosystem: { type: "string", required: true, description: "Ecosystem" },
          allowed: { type: "boolean", required: true, description: "Allowed boolean" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_record_scan", args);
        },
      },
      {
        name: "osv_get_scan",
        description: "Retrieves a scan record from the ledger by ID.",
        parameters: {
          id: { type: "string", required: true, description: "Scan ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_get_scan", args);
        },
      },
      {
        name: "osv_list_scans",
        description: "Lists all recorded package vulnerability scans.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_list_scans", args);
        },
      },
      {
        name: "osv_remove_scan",
        description: "Removes a scan record from the ledger.",
        parameters: {
          id: { type: "string", required: true, description: "Scan ID to delete" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_remove_scan", args);
        },
      },
      {
        name: "osv_clear_scans",
        description: "Clears all scans and resets metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_clear_scans", args);
        },
      },
      {
        name: "osv_clear_cache",
        description: "Clears the in-memory OSV advisory cache.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_clear_cache", args);
        },
      },
      {
        name: "osv_is_custom_blocked",
        description: "Checks if a package is blocked by organization policy.",
        parameters: {
          name: { type: "string", required: true, description: "Package name" },
          ecosystem: { type: "string", required: true, description: "Ecosystem" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_is_custom_blocked", args);
        },
      },
      {
        name: "osv_group_and_sort",
        description: "Organizes scans into multi-criteria swimlanes (ecosystem, allowedStatus, isMalware).",
        parameters: {
          groupBy: { type: "string", description: "ecosystem, allowedStatus, isMalware" },
          sortBy: { type: "string", description: "timestamp, scanDurationMs, packageName" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_group_and_sort", args);
        },
      },
      {
        name: "osv_search_dsl",
        description: "Searches scans using Natural Query DSL (e.g. 'eco:npm is:blocked').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_search_dsl", args);
        },
      },
      {
        name: "osv_render_dashboard",
        description: "Renders an ANSI CLI summary card with OSV vulnerability statistics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_render_dashboard", args);
        },
      },
      {
        name: "osv_render_advisory_card",
        description: "Renders an interactive ANSI CLI advisory finding card.",
        parameters: {
          id: { type: "string", required: true, description: "Advisory ID" },
          summary: { type: "string", description: "Summary" },
          isMalware: { type: "boolean", description: "Is malware boolean" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_render_advisory_card", args);
        },
      },
      {
        name: "osv_export_html_view",
        description: "Exports OSV scans ledger to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_export_html_view", args);
        },
      },
      {
        name: "osv_export_markdown_report",
        description: "Exports OSV scanner report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_export_markdown_report", args);
        },
      },
      {
        name: "osv_export_csv_report",
        description: "Exports OSV scans ledger to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_export_csv_report", args);
        },
      },
      {
        name: "osv_bulk_purge",
        description: "Atomically purges multiple scans from the ledger.",
        parameters: {
          idsJson: { type: "string", required: true, description: "JSON array of scan IDs" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_bulk_purge", args);
        },
      },
      {
        name: "osv_undo",
        description: "Reverts the last OSV mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_undo", args);
        },
      },
      {
        name: "osv_redo",
        description: "Re-applies the last undone OSV mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_redo", args);
        },
      },
      {
        name: "osv_capture_snapshot",
        description: "Captures a frame-perfect snapshot of scanner state.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_capture_snapshot", args);
        },
      },
      {
        name: "osv_restore_snapshot",
        description: "Restores scanner state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_restore_snapshot", args);
        },
      },
      {
        name: "osv_format_scan_result",
        description: "Formats an OSV scan result into a concise summary string.",
        parameters: {
          name: { type: "string", required: true, description: "Package name" },
          allowed: { type: "boolean", required: true, description: "Allowed" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_format_scan_result", args);
        },
      },
      {
        name: "osv_format_advisory",
        description: "Formats an OSV advisory into a standardized tag string.",
        parameters: {
          id: { type: "string", required: true, description: "Advisory ID" },
          summary: { type: "string", required: true, description: "Summary" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_format_advisory", args);
        },
      },
      {
        name: "osv_infer_ecosystem",
        description: "Infers package ecosystem from command executable name.",
        parameters: {
          command: { type: "string", required: true, description: "Executable name" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("osv_infer_ecosystem", args);
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
        case "osv_scan_package": {
          const pkgName = String(args.name || "").trim();
          const ecosystem = (String(args.ecosystem || "npm").trim()) as PackageEcosystem;
          const version = typeof args.version === "string" && args.version.trim() ? args.version.trim() : undefined;
          if (!pkgName) return { success: false, error: "Package name is required" };

          const result = await this.supervisor.scanPackage({
            name: pkgName,
            ecosystem,
            version,
            rawToken: version ? `${pkgName}@${version}` : pkgName,
          });
          return { success: true, ...result };
        }

        case "osv_check_command": {
          const command = String(args.command || "").trim();
          let rawArgs: string[] = [];
          if (Array.isArray(args.args)) {
            rawArgs = args.args.map((a) => String(a));
          } else if (typeof args.args === "string" && args.args.trim()) {
            const trimmed = args.args.trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) rawArgs = parsed.map((a) => String(a));
              } catch {
                rawArgs = trimmed.split(/\s+/);
              }
            } else {
              rawArgs = trimmed.split(/\s+/);
            }
          }

          const result = await this.supervisor.checkCommand(command, rawArgs);
          return { success: true, result };
        }

        case "osv_add_blocked_package": {
          const pkgName = String(args.name || "").trim();
          const ecosystem = (String(args.ecosystem || "npm").trim()) as PackageEcosystem;
          this.supervisor.addCustomBlockedPackage({
            name: pkgName,
            ecosystem,
            rawToken: pkgName,
          });
          return { success: true, blocked: true };
        }

        case "osv_configure": {
          this.supervisor.configure(args as any);
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "osv_get_config": {
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "osv_get_metrics": {
          return { success: true, metrics: this.supervisor.getMetrics() };
        }

        case "osv_get_metrics_report": {
          return { success: true, report: this.supervisor.getMetricsReport() };
        }

        case "osv_audit_health": {
          return { success: true, audit: this.supervisor.auditHealth() };
        }

        case "osv_record_scan": {
          const pkgName = String(args.name || "pkg");
          const ecosystem = (args.ecosystem as any) || "npm";
          const allowed = args.allowed !== false;
          const scanId = `osv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          this.supervisor.getSubstrate().recordScan({
            scanId,
            ecosystem,
            packageName: pkgName,
            allowed,
            cached: false,
            advisories: [],
            scanDurationMs: 0.1,
            timestamp: Date.now(),
          });
          return { success: true, scanId };
        }

        case "osv_get_scan": {
          const id = String(args.id || "");
          const scan = this.supervisor.getSubstrate().getScan(id);
          if (!scan) return { success: false, error: `Scan '${id}' not found` };
          return { success: true, scan };
        }

        case "osv_list_scans": {
          const scans = this.supervisor.getSubstrate().listScans();
          return { success: true, count: scans.length, scans };
        }

        case "osv_remove_scan": {
          const id = String(args.id || "");
          const ok = this.supervisor.getSubstrate().removeScan(id);
          return { success: ok };
        }

        case "osv_clear_scans": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
        }

        case "osv_clear_cache": {
          this.supervisor.clearCache();
          return { success: true, cacheCleared: true };
        }

        case "osv_is_custom_blocked": {
          const pkgName = String(args.name || "").trim();
          const ecosystem = (String(args.ecosystem || "npm").trim()) as PackageEcosystem;
          const isBlocked = this.supervisor.isCustomBlocked({
            name: pkgName,
            ecosystem,
            rawToken: pkgName,
          });
          return { success: true, isBlocked };
        }

        case "osv_group_and_sort": {
          const groupBy = (args.groupBy as OsvGroupBy) || "ecosystem";
          const sortBy = (args.sortBy as OsvSortBy) || "timestamp";
          const direction = (args.direction as OsvSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedScans(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "osv_search_dsl": {
          const query = String(args.query || "");
          const scans = this.supervisor.queryDsl(query);
          return { success: true, count: scans.length, scans };
        }

        case "osv_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const hitRate = metrics.totalScans === 0 ? 0 : Number(((metrics.cacheHits / metrics.totalScans) * 100).toFixed(1));
          const rendered = BroccoliViewRenderer.renderOsvDashboard({
            totalScans: metrics.totalScans,
            malwareBlocked: metrics.malwareBlocked,
            cleanAllowed: metrics.cleanAllowed,
            cacheHits: metrics.cacheHits,
            hitRate,
            healthStatus: health.healthStatus,
          });
          return { success: true, rendered };
        }

        case "osv_render_advisory_card": {
          const id = String(args.id || "GHSA-1234");
          const summary = String(args.summary || "Malicious code execution");
          const isMalware = args.isMalware !== false;
          const rendered = BroccoliViewRenderer.renderOsvAdvisoryCard({
            id,
            summary,
            isMalware,
          });
          return { success: true, rendered };
        }

        case "osv_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "osv_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "osv_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "osv_bulk_purge": {
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

        case "osv_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "osv_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "osv_capture_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const snap = this.snapshotManager.captureSnapshot(frameId);
          return { success: true, frameId, snapshot: snap };
        }

        case "osv_restore_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frameId);
          return { ...res };
        }

        case "osv_format_scan_result": {
          const pkgName = String(args.name || "express");
          const allowed = args.allowed !== false;
          const formatted = this.supervisor.getParser().formatScanResult({
            allowed,
            package: { name: pkgName, ecosystem: "npm", rawToken: pkgName },
            advisories: [],
            cached: true,
            scanDurationMs: 0.05,
          });
          return { success: true, formatted };
        }

        case "osv_format_advisory": {
          const id = String(args.id || "MAL-2024-001");
          const summary = String(args.summary || "Malware injection");
          const formatted = this.supervisor.getParser().formatAdvisory({
            id,
            summary,
            isMalware: true,
          });
          return { success: true, formatted };
        }

        case "osv_infer_ecosystem": {
          const command = String(args.command || "npm");
          const eco = this.supervisor.getParser().inferEcosystem(command);
          return { success: true, command, ecosystem: eco };
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
