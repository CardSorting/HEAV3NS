/**
 * url-safety-tool-suite.ts
 *
 * Model tool definitions exposing SSRF Defense Firewall & URL Normalizer to agents
 * (Phase 118 / ADR-094 / Target #51).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { UrlSafetySupervisor } from "../../../agents/extensions/url_safety/url-safety-supervisor.js";

export class UrlSafetyToolSuite {
  private readonly supervisor: UrlSafetySupervisor;

  constructor(supervisor: UrlSafetySupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "url_check_safety",
        description:
          "Verifies whether a target URL is safe to fetch, blocking SSRF attempts to cloud metadata, localhost, or private network IPs.",
        parameters: {
          url: {
            type: "string",
            description: "The URL string to evaluate for SSRF safety.",
            required: true,
          },
          allow_private: {
            type: "boolean",
            description: "Optional flag to permit private network IPs (default: false).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const url = typeof args.url === "string" ? args.url : "";
          const allowPrivate = args.allow_private === true;

          if (!url) {
            return { success: false, error: "url is required" };
          }

          const result = this.supervisor.checkUrl(url, {
            allowPrivateUrls: allowPrivate,
          });

          return {
            success: true,
            isSafe: result.isSafe,
            verdict: result.verdict,
            normalizedUrl: result.normalizedUrl,
            hostname: result.hostname,
            resolvedIps: result.resolvedIps,
            reason: result.reason,
          };
        },
      },
      {
        name: "url_normalize_target",
        description:
          "Normalizes a URL string, converting internationalized hostnames (IDNA) and fixing formatting artifacts.",
        parameters: {
          url: {
            type: "string",
            description: "The raw URL string to normalize.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const url = typeof args.url === "string" ? args.url : "";
          if (!url) {
            return { success: false, error: "url is required" };
          }

          const normalizedUrl = this.supervisor.normalizeUrl(url);
          return {
            success: true,
            originalUrl: url,
            normalizedUrl,
          };
        },
      },
      {
        name: "url_resolve_and_verify",
        description:
          "Evaluates a hostname or IP address directly against SSRF firewall policies and IP classification rules.",
        parameters: {
          host_or_ip: {
            type: "string",
            description: "Hostname, domain, or IP address to classify.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const hostOrIp = typeof args.host_or_ip === "string" ? args.host_or_ip : "";
          if (!hostOrIp) {
            return { success: false, error: "host_or_ip is required" };
          }

          const category = this.supervisor.classifyIp(hostOrIp);
          const check = this.supervisor.checkUrl(`http://${hostOrIp}/`);

          return {
            success: true,
            hostOrIp,
            category,
            isSafe: check.isSafe,
            verdict: check.verdict,
            reason: check.reason,
          };
        },
      },
      {
        name: "url_inspect_security_ledger",
        description:
          "Lists recently blocked SSRF request attempts from the in-memory firewall ledger.",
        parameters: {},
        execute: async () => {
          const ledger = this.supervisor.getBlockedLedger();
          return {
            success: true,
            blockedCount: ledger.length,
            recentBlocks: ledger.slice(-50),
          };
        },
      },
      {
        name: "url_get_firewall_metrics",
        description:
          "Retrieves aggregate SSRF firewall metrics including allowed and blocked request counts.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          return {
            success: true,
            metrics,
          };
        },
      },
    ];
  }
}
