/**
 * url-safety-tool-suite.ts
 *
 * Model tool definitions exposing SSRF Defense Firewall, Cloud Metadata & Private IP Blocker,
 * and URL Normalizer to autonomous agents (Phase 118 / ADR-094 / Target #87).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { UrlSafetySupervisor } from "../../../agents/extensions/url_safety/url-safety-supervisor.js";
import type { UrlSafetySnapshotManager } from "../../../sessions/extensions/url_safety/url-safety-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
import type {
  UrlSafetyGroupBy,
  UrlSafetySortBy,
  UrlSafetySortDirection,
} from "../../../core/contracts/url-safety.contracts.js";

export class UrlSafetyToolSuite {
  private readonly supervisor: UrlSafetySupervisor;
  private readonly snapshotManager?: UrlSafetySnapshotManager;

  constructor(
    supervisor: UrlSafetySupervisor,
    snapshotManager?: UrlSafetySnapshotManager
  ) {
    this.supervisor = supervisor;
    this.snapshotManager = snapshotManager;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "url_check_safety",
        description: "Verifies whether a target URL is safe to fetch, blocking SSRF attempts to cloud metadata, localhost, or private network IPs.",
        parameters: {
          url: { type: "string", description: "The URL string to evaluate for SSRF safety.", required: true },
          allow_private: { type: "boolean", description: "Optional flag to permit private network IPs.", required: false },
          allow_localhost: { type: "boolean", description: "Optional flag to permit localhost.", required: false },
        },
        execute: async (args: Record<string, unknown>) => {
          const url = typeof args.url === "string" ? args.url : "";
          if (!url) return { success: false, error: "url is required" };
          const result = this.supervisor.checkUrl(url, {
            allowPrivateUrls: args.allow_private === true,
            allowLocalhost: args.allow_localhost === true,
          });
          return { success: true, ...result };
        },
      },
      {
        name: "url_normalize_target",
        description: "Normalizes a URL string, converting internationalized hostnames and fixing formatting artifacts.",
        parameters: {
          url: { type: "string", description: "The raw URL string to normalize.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const url = typeof args.url === "string" ? args.url : "";
          if (!url) return { success: false, error: "url is required" };
          const normalizedUrl = this.supervisor.normalizeUrl(url);
          return { success: true, originalUrl: url, normalizedUrl };
        },
      },
      {
        name: "url_resolve_and_verify",
        description: "Evaluates a hostname or IP address directly against SSRF firewall policies and IP classification rules.",
        parameters: {
          host_or_ip: { type: "string", description: "Hostname, domain, or IP address to classify.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const hostOrIp = typeof args.host_or_ip === "string" ? args.host_or_ip : "";
          if (!hostOrIp) return { success: false, error: "host_or_ip is required" };
          const category = this.supervisor.classifyIp(hostOrIp);
          const check = this.supervisor.checkUrl(`http://${hostOrIp}/`);
          return { success: true, hostOrIp, category, isSafe: check.isSafe, verdict: check.verdict, reason: check.reason };
        },
      },
      {
        name: "url_parse_alternative_ip",
        description: "Parses alternative IP encodings (Hex, Octal, Integer, IPv4-mapped IPv6) into canonical decimal form.",
        parameters: {
          host: { type: "string", description: "The candidate host string.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const host = typeof args.host === "string" ? args.host : "";
          const parsed = this.supervisor.parseAlternativeIp(host);
          return { success: true, host, canonicalIp: parsed, isAlternative: parsed !== null };
        },
      },
      {
        name: "url_add_custom_blocked_host",
        description: "Adds a specific domain or hostname to the custom firewall blocklist.",
        parameters: {
          host: { type: "string", description: "The hostname to block.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const host = typeof args.host === "string" ? args.host : "";
          if (!host) return { success: false, error: "host is required" };
          this.supervisor.addCustomBlockedHost(host);
          return { success: true, blockedHost: host, totalBlocked: this.supervisor.getConfig().customBlockedHosts.length };
        },
      },
      {
        name: "url_add_custom_allowed_host",
        description: "Adds a specific domain or hostname to the custom firewall allowlist.",
        parameters: {
          host: { type: "string", description: "The hostname to allow.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const host = typeof args.host === "string" ? args.host : "";
          if (!host) return { success: false, error: "host is required" };
          this.supervisor.addCustomAllowedHost(host);
          return { success: true, allowedHost: host, totalAllowed: this.supervisor.getConfig().customAllowedHosts.length };
        },
      },
      {
        name: "url_is_custom_blocked",
        description: "Checks if a hostname is actively in the custom blocklist.",
        parameters: {
          host: { type: "string", description: "Hostname to check.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const host = typeof args.host === "string" ? args.host : "";
          return { success: true, host, isBlocked: this.supervisor.isCustomBlocked(host) };
        },
      },
      {
        name: "url_is_custom_allowed",
        description: "Checks if a hostname is actively in the custom allowlist.",
        parameters: {
          host: { type: "string", description: "Hostname to check.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const host = typeof args.host === "string" ? args.host : "";
          return { success: true, host, isAllowed: this.supervisor.isCustomAllowed(host) };
        },
      },
      {
        name: "url_get_custom_blocked_hosts",
        description: "Returns all hostnames currently configured in the custom blocklist.",
        parameters: {},
        execute: async () => {
          return { success: true, customBlockedHosts: this.supervisor.getConfig().customBlockedHosts };
        },
      },
      {
        name: "url_get_custom_allowed_hosts",
        description: "Returns all hostnames currently configured in the custom allowlist.",
        parameters: {},
        execute: async () => {
          return { success: true, customAllowedHosts: this.supervisor.getConfig().customAllowedHosts };
        },
      },
      {
        name: "url_inspect_security_ledger",
        description: "Lists recently blocked SSRF request attempts from the in-memory firewall ledger.",
        parameters: {},
        execute: async () => {
          const ledger = this.supervisor.getBlockedLedger();
          return { success: true, blockedCount: ledger.length, recentBlocks: ledger.slice(-50) };
        },
      },
      {
        name: "url_get_recent_checks",
        description: "Retrieves recent URL safety check records from the substrate.",
        parameters: {
          limit: { type: "number", description: "Max records to return (default: 50).", required: false },
        },
        execute: async (args: Record<string, unknown>) => {
          const limit = typeof args.limit === "number" ? args.limit : 50;
          return { success: true, checks: this.supervisor.getRecentChecks(limit) };
        },
      },
      {
        name: "url_get_all_checks",
        description: "Retrieves all URL safety checks stored in the substrate.",
        parameters: {},
        execute: async () => {
          return { success: true, checks: this.supervisor.getAllChecks() };
        },
      },
      {
        name: "url_get_firewall_metrics",
        description: "Retrieves aggregate SSRF firewall metrics including allowed and blocked request counts.",
        parameters: {},
        execute: async () => {
          return { success: true, metrics: this.supervisor.getMetrics() };
        },
      },
      {
        name: "url_get_metrics_report",
        description: "Generates a structured telemetry report of the SSRF firewall.",
        parameters: {},
        execute: async () => {
          return { success: true, report: this.supervisor.getMetricsReport() };
        },
      },
      {
        name: "url_audit_health",
        description: "Executes an SLA health audit of the SSRF firewall and returns compliance status.",
        parameters: {},
        execute: async () => {
          return { success: true, report: this.supervisor.auditHealth() };
        },
      },
      {
        name: "url_get_config",
        description: "Returns the active configuration options of the SSRF firewall.",
        parameters: {},
        execute: async () => {
          return { success: true, config: this.supervisor.getConfig() };
        },
      },
      {
        name: "url_set_config",
        description: "Updates configuration options of the SSRF firewall.",
        parameters: {
          allow_private_urls: { type: "boolean", description: "Allow private IPs.", required: false },
          allow_localhost: { type: "boolean", description: "Allow localhost.", required: false },
        },
        execute: async (args: Record<string, unknown>) => {
          const updates: Record<string, unknown> = {};
          if (args.allow_private_urls !== undefined) updates.allowPrivateUrls = Boolean(args.allow_private_urls);
          if (args.allow_localhost !== undefined) updates.allowLocalhost = Boolean(args.allow_localhost);
          const config = this.supervisor.setConfig(updates);
          return { success: true, config };
        },
      },
      {
        name: "url_clear",
        description: "Clears all stored check history and resets firewall state.",
        parameters: {},
        execute: async () => {
          this.supervisor.clear();
          return { success: true, cleared: true };
        },
      },
      {
        name: "url_group_and_sort",
        description: "Organizes URL safety checks into multi-criteria swimlanes with sorting.",
        parameters: {
          group_by: { type: "string", description: "Grouping criterion: verdict, category, hostname, isSafe.", required: true },
          sort_by: { type: "string", description: "Sorting criterion: timestamp, normalizedUrl, hostname, verdict, latencyMs.", required: false },
          sort_direction: { type: "string", description: "Sorting direction: asc or desc.", required: false },
        },
        execute: async (args: Record<string, unknown>) => {
          const groupBy = (args.group_by as UrlSafetyGroupBy) || "verdict";
          const sortBy = (args.sort_by as UrlSafetySortBy) || "timestamp";
          const sortDirection = (args.sort_direction as UrlSafetySortDirection) || "desc";
          const lanes = this.supervisor.getGroupedChecks(groupBy, sortBy, sortDirection);
          return { success: true, groupBy, lanesCount: lanes.length, lanes };
        },
      },
      {
        name: "url_search_dsl",
        description: "Searches URL safety checks using natural query DSL (e.g. 'is:blocked host:internal').",
        parameters: {
          query: { type: "string", description: "Natural query DSL string.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const query = typeof args.query === "string" ? args.query : "";
          const results = this.supervisor.queryChecksDsl(query);
          return { success: true, query, count: results.length, results };
        },
      },
      {
        name: "url_bulk_purge",
        description: "Purges multiple URL safety checks in an atomic transaction with undo record creation.",
        parameters: {
          check_ids: { type: "string", description: "JSON array of check IDs to delete.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          let checkIds: string[] = [];
          if (typeof args.check_ids === "string") {
            try {
              checkIds = JSON.parse(args.check_ids);
            } catch {
              checkIds = [args.check_ids];
            }
          } else if (Array.isArray(args.check_ids)) {
            checkIds = args.check_ids as string[];
          }
          const result = this.supervisor.bulkPurgeChecks(checkIds);
          return { success: true, result };
        },
      },
      {
        name: "url_undo",
        description: "Reverts the previous mutation in the substrate.",
        parameters: {},
        execute: async () => {
          const undone = this.supervisor.undo();
          return { success: true, undone };
        },
      },
      {
        name: "url_redo",
        description: "Reapplies the previously reverted mutation in the substrate.",
        parameters: {},
        execute: async () => {
          const redone = this.supervisor.redo();
          return { success: true, redone };
        },
      },
      {
        name: "url_capture_snapshot",
        description: "Captures a deep state snapshot of the SSRF firewall pinned to an execution frame.",
        parameters: {
          snapshot_id: { type: "string", description: "Unique identifier for the snapshot.", required: true },
          frame_number: { type: "number", description: "Optional execution frame number.", required: false },
        },
        execute: async (args: Record<string, unknown>) => {
          const snapshotId = typeof args.snapshot_id === "string" ? args.snapshot_id : `snap_${Date.now()}`;
          const frameNumber = typeof args.frame_number === "number" ? args.frame_number : undefined;
          if (this.snapshotManager) {
            const snap = this.snapshotManager.takeSnapshot(snapshotId, frameNumber);
            return { success: true, snapshot: snap };
          }
          return { success: false, error: "snapshotManager not configured" };
        },
      },
      {
        name: "url_restore_snapshot",
        description: "Restores a previous firewall state snapshot with sub-millisecond O(1) latency.",
        parameters: {
          snapshot_id: { type: "string", description: "Identifier of the snapshot to restore.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const snapshotId = typeof args.snapshot_id === "string" ? args.snapshot_id : "";
          if (this.snapshotManager) {
            const restored = this.snapshotManager.restoreSnapshot(snapshotId);
            return { success: true, restored };
          }
          return { success: false, error: "snapshotManager not configured" };
        },
      },
      {
        name: "url_render_dashboard",
        description: "Renders an ANSI CLI dashboard view of the SSRF firewall state.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          const health = this.supervisor.auditHealth();
          const rendered = BroccoliViewRenderer.renderUrlSafetyDashboard({
            ...metrics,
            status: health.status,
          });
          return { success: true, rendered };
        },
      },
      {
        name: "url_render_card",
        description: "Renders an interactive ANSI CLI card for a single URL safety check.",
        parameters: {
          check_id: { type: "string", description: "ID of the check to render.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const checkId = typeof args.check_id === "string" ? args.check_id : "";
          const check = this.supervisor.getAllChecks().find((c) => c.checkId === checkId);
          if (!check) return { success: false, error: "Check not found" };
          const rendered = BroccoliViewRenderer.renderUrlSafetyCard(check);
          return { success: true, rendered };
        },
      },
      {
        name: "url_export_html",
        description: "Exports a single-page interactive HTML dashboard of SSRF firewall checks.",
        parameters: {},
        execute: async () => {
          return { success: true, html: this.supervisor.exportHtml() };
        },
      },
      {
        name: "url_export_markdown",
        description: "Exports a Markdown report of SSRF firewall checks and metrics.",
        parameters: {},
        execute: async () => {
          return { success: true, markdown: this.supervisor.exportMarkdown() };
        },
      },
    ];
  }
}
