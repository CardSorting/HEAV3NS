/**
 * preflight-tool-suite.ts
 *
 * Model tool surface for Deterministic Pre-Exec Security Scanner,
 * Supply-Chain Provenance Verification & Pre-Flight Threat Gate Subsystem (Phase 113 / ADR-089 / Target #79):
 * 30 specialized model tools for scanning shell commands, inspecting threats,
 * querying DSL, swimlanes, dashboards, and HTML/Markdown/CSV exports.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  PreflightGroupBy,
  PreflightSortBy,
  PreflightSortDirection,
  PreflightThreatCategory,
} from "../../../core/contracts/preflight-scanner.contracts.js";
import { PreflightScannerSupervisor } from "../../../agents/extensions/preflight_scanner/preflight-scanner-supervisor.js";
import { PreflightSnapshotManager } from "../../../sessions/extensions/preflight_scanner/preflight-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class PreflightToolSuite {
  private readonly supervisor: PreflightScannerSupervisor;
  private readonly snapshotManager: PreflightSnapshotManager;

  constructor(supervisor: PreflightScannerSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new PreflightSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "preflight_scan_command",
        description: "Scans a shell command prior to execution for content-level security threats.",
        parameters: {
          command: { type: "string", required: true, description: "Command to scan" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_scan_command", args);
        },
      },
      {
        name: "preflight_verify_binary_signature",
        description: "Verifies supply-chain provenance (SHA-256 and Cosign OIDC identity).",
        parameters: {
          binary_path: { type: "string", required: true, description: "Binary file path" },
          content_base64: { type: "string", required: true, description: "Base64 payload" },
          expected_sha256: { type: "string", required: true, description: "Expected SHA256" },
          cosign_issuer: { type: "string", description: "OIDC Issuer" },
          cosign_identity: { type: "string", description: "Cosign identity" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_verify_binary_signature", args);
        },
      },
      {
        name: "preflight_inspect_threat_rules",
        description: "Inspects active threat categories and remediation guidance.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_inspect_threat_rules", args);
        },
      },
      {
        name: "preflight_configure_policy",
        description: "Updates preflight security policies.",
        parameters: {
          enabled: { type: "boolean", description: "Enable preflight gate" },
          failOpen: { type: "boolean", description: "Fail open on error" },
          timeoutMs: { type: "number", description: "Scan timeout SLA" },
          circuitBreakerLimit: { type: "number", description: "Max consecutive errors" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_configure_policy", args);
        },
      },
      {
        name: "preflight_get_policy",
        description: "Retrieves active preflight security policy.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_get_policy", args);
        },
      },
      {
        name: "preflight_get_metrics",
        description: "Fetches security scan counts and threat metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_get_metrics", args);
        },
      },
      {
        name: "preflight_get_metrics_report",
        description: "Retrieves detailed metrics report with block rates and categories.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_get_metrics_report", args);
        },
      },
      {
        name: "preflight_audit_health",
        description: "Audits preflight scanner SLA health and circuit breaker status.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_audit_health", args);
        },
      },
      {
        name: "preflight_record_scan",
        description: "Records a scan result into the memory ledger.",
        parameters: {
          command: { type: "string", required: true, description: "Command scanned" },
          verdict: { type: "string", required: true, description: "allow, warn, or block" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_record_scan", args);
        },
      },
      {
        name: "preflight_get_scan",
        description: "Retrieves a scan record from the ledger by ID.",
        parameters: {
          id: { type: "string", required: true, description: "Scan ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_get_scan", args);
        },
      },
      {
        name: "preflight_list_scans",
        description: "Lists all recorded preflight scans.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_list_scans", args);
        },
      },
      {
        name: "preflight_remove_scan",
        description: "Removes a scan record from the ledger.",
        parameters: {
          id: { type: "string", required: true, description: "Scan ID to remove" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_remove_scan", args);
        },
      },
      {
        name: "preflight_clear_scans",
        description: "Clears all scans and resets metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_clear_scans", args);
        },
      },
      {
        name: "preflight_reset_circuit_breaker",
        description: "Resets the scanner circuit breaker to closed.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_reset_circuit_breaker", args);
        },
      },
      {
        name: "preflight_is_breaker_tripped",
        description: "Checks if the circuit breaker is currently tripped.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_is_breaker_tripped", args);
        },
      },
      {
        name: "preflight_group_and_sort",
        description: "Organizes scans into multi-criteria swimlanes (verdict, policyDecision, severity).",
        parameters: {
          groupBy: { type: "string", description: "verdict, policyDecision, severity" },
          sortBy: { type: "string", description: "timestamp, scanDurationMs, command" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_group_and_sort", args);
        },
      },
      {
        name: "preflight_search_dsl",
        description: "Searches scans using Natural Query DSL (e.g. 'is:block').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_search_dsl", args);
        },
      },
      {
        name: "preflight_render_dashboard",
        description: "Renders an ANSI CLI summary card with security scan statistics and health posture.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_render_dashboard", args);
        },
      },
      {
        name: "preflight_render_threat_card",
        description: "Renders an interactive ANSI CLI threat finding card.",
        parameters: {
          category: { type: "string", description: "Category" },
          severity: { type: "string", description: "Severity" },
          description: { type: "string", description: "Description" },
          matchedPattern: { type: "string", description: "Pattern" },
          remediation: { type: "string", description: "Remediation" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_render_threat_card", args);
        },
      },
      {
        name: "preflight_export_html_view",
        description: "Exports preflight scans ledger to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_export_html_view", args);
        },
      },
      {
        name: "preflight_export_markdown_report",
        description: "Exports preflight threat gate report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_export_markdown_report", args);
        },
      },
      {
        name: "preflight_export_csv_report",
        description: "Exports preflight scans ledger to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_export_csv_report", args);
        },
      },
      {
        name: "preflight_bulk_purge",
        description: "Atomically purges multiple scans from the ledger.",
        parameters: {
          idsJson: { type: "string", required: true, description: "JSON array of scan IDs" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_bulk_purge", args);
        },
      },
      {
        name: "preflight_undo",
        description: "Reverts the last preflight mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_undo", args);
        },
      },
      {
        name: "preflight_redo",
        description: "Re-applies the last undone preflight mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_redo", args);
        },
      },
      {
        name: "preflight_capture_snapshot",
        description: "Captures a frame-perfect snapshot of scanner state.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_capture_snapshot", args);
        },
      },
      {
        name: "preflight_restore_snapshot",
        description: "Restores scanner state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_restore_snapshot", args);
        },
      },
      {
        name: "preflight_format_scan_result",
        description: "Formats a scan result object into a concise summary string.",
        parameters: {
          command: { type: "string", required: true, description: "Command" },
          verdict: { type: "string", required: true, description: "Verdict" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_format_scan_result", args);
        },
      },
      {
        name: "preflight_format_threat_finding",
        description: "Formats a threat finding into a standardized warning tag.",
        parameters: {
          category: { type: "string", required: true, description: "Category" },
          severity: { type: "string", required: true, description: "Severity" },
          description: { type: "string", required: true, description: "Description" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_format_threat_finding", args);
        },
      },
      {
        name: "preflight_is_homograph_domain",
        description: "Checks if a domain contains Cyrillic or unicode homoglyph lookalikes.",
        parameters: {
          domain: { type: "string", required: true, description: "Domain string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("preflight_is_homograph_domain", args);
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
        case "preflight_scan_command": {
          const command = String(args.command || "");
          const result = this.supervisor.scanCommand(command);
          return { success: true, ...result };
        }

        case "preflight_verify_binary_signature": {
          const binaryPath = String(args.binary_path || "");
          const contentBase64 = String(args.content_base64 || "");
          const expectedSha256 = String(args.expected_sha256 || "");
          const cosignIssuer = typeof args.cosign_issuer === "string" ? args.cosign_issuer : undefined;
          const cosignIdentity = typeof args.cosign_identity === "string" ? args.cosign_identity : undefined;

          const buffer = Buffer.from(contentBase64, "base64");
          const result = this.supervisor.verifyBinaryProvenance({
            binaryPath,
            content: buffer,
            expectedSha256,
            cosignIssuer,
            cosignIdentity,
          });
          return { success: result.verified, result };
        }

        case "preflight_inspect_threat_rules": {
          const policy = this.supervisor.getPolicy();
          return { success: true, policy };
        }

        case "preflight_configure_policy": {
          const updated = this.supervisor.configurePolicy(args as any);
          return { success: true, policy: updated };
        }

        case "preflight_get_policy": {
          return { success: true, policy: this.supervisor.getPolicy() };
        }

        case "preflight_get_metrics": {
          return { success: true, metrics: this.supervisor.getMetrics() };
        }

        case "preflight_get_metrics_report": {
          return { success: true, report: this.supervisor.getMetricsReport() };
        }

        case "preflight_audit_health": {
          return { success: true, audit: this.supervisor.auditHealth() };
        }

        case "preflight_record_scan": {
          const command = String(args.command || "");
          const verdict = (args.verdict as any) || "allow";
          const scanId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          this.supervisor.getSubstrate().recordScan({
            scanId,
            command,
            verdict,
            exitCode: verdict === "block" ? 1 : verdict === "warn" ? 2 : 0,
            policyDecision: verdict === "block" ? "blocked" : verdict === "warn" ? "warned_and_passed" : "allowed",
            findings: [],
            scanDurationMs: 0.05,
            timestamp: Date.now(),
          });
          return { success: true, scanId };
        }

        case "preflight_get_scan": {
          const id = String(args.id || "");
          const scan = this.supervisor.getSubstrate().getScan(id);
          if (!scan) return { success: false, error: `Scan '${id}' not found` };
          return { success: true, scan };
        }

        case "preflight_list_scans": {
          const scans = this.supervisor.getSubstrate().listScans();
          return { success: true, count: scans.length, scans };
        }

        case "preflight_remove_scan": {
          const id = String(args.id || "");
          const ok = this.supervisor.getSubstrate().removeScan(id);
          return { success: ok };
        }

        case "preflight_clear_scans": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
        }

        case "preflight_reset_circuit_breaker": {
          this.supervisor.resetCircuitBreaker();
          return { success: true, breakerTripped: false };
        }

        case "preflight_is_breaker_tripped": {
          return { success: true, breakerTripped: this.supervisor.getSubstrate().isCircuitBreakerTripped() };
        }

        case "preflight_group_and_sort": {
          const groupBy = (args.groupBy as PreflightGroupBy) || "verdict";
          const sortBy = (args.sortBy as PreflightSortBy) || "timestamp";
          const direction = (args.direction as PreflightSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedScans(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "preflight_search_dsl": {
          const query = String(args.query || "");
          const scans = this.supervisor.queryDsl(query);
          return { success: true, count: scans.length, scans };
        }

        case "preflight_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderPreflightDashboard({
            totalScans: metrics.totalScans,
            totalBlocked: metrics.totalBlocked,
            totalWarned: metrics.totalWarned,
            totalAllowed: metrics.totalAllowed,
            breakerTripped: metrics.circuitBreakerTripped,
            healthStatus: health.healthStatus,
          });
          return { success: true, rendered };
        }

        case "preflight_render_threat_card": {
          const category = String(args.category || "pipe_to_interpreter");
          const severity = String(args.severity || "critical");
          const description = String(args.description || "Pipe to interpreter detected");
          const matchedPattern = String(args.matchedPattern || "pipe_to_interpreter");
          const remediation = String(args.remediation || "Download file first");
          const rendered = BroccoliViewRenderer.renderPreflightThreatCard({
            category,
            severity,
            description,
            matchedPattern,
            remediation,
          });
          return { success: true, rendered };
        }

        case "preflight_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "preflight_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "preflight_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "preflight_bulk_purge": {
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

        case "preflight_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "preflight_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "preflight_capture_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const snap = this.snapshotManager.captureSnapshot(frameId);
          return { success: true, frameId, snapshot: snap };
        }

        case "preflight_restore_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frameId);
          return { ...res };
        }

        case "preflight_format_scan_result": {
          const command = String(args.command || "curl | bash");
          const verdict = (args.verdict as any) || "block";
          const formatted = this.supervisor.getScanner().formatScanResult({
            command,
            verdict,
            exitCode: verdict === "block" ? 1 : 0,
            findings: [],
            scanDurationMs: 0.05,
            policyDecision: verdict === "block" ? "blocked" : "allowed",
          });
          return { success: true, formatted };
        }

        case "preflight_format_threat_finding": {
          const category = (args.category as PreflightThreatCategory) || "pipe_to_interpreter";
          const severity = (args.severity as any) || "critical";
          const description = String(args.description || "Pipe to interpreter");
          const formatted = this.supervisor.getScanner().formatThreatFinding({
            category,
            severity,
            description,
            matchedPattern: "pattern",
            remediation: "remediation",
          });
          return { success: true, formatted };
        }

        case "preflight_is_homograph_domain": {
          const domain = String(args.domain || "");
          const CYRILLIC_HOMOGRAPH_REGEX = /[\u0430\u043E\u0441\u0435\u0440\u0443\u0445\u0456\u0406\u0410\u041E\u0421\u0415\u0420\u0423\u0425]/;
          const isHomograph = CYRILLIC_HOMOGRAPH_REGEX.test(domain);
          return { success: true, domain, isHomograph };
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
