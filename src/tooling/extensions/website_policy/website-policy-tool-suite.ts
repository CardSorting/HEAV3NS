/**
 * website-policy-tool-suite.ts
 *
 * Model tool definitions exposing Website Access Policy and Domain Blocklist to agents
 * (Phase 120 / ADR-096 / Target #53).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { WebsitePolicySupervisor } from "../../../agents/extensions/website_policy/website-policy-supervisor.js";

export class WebsitePolicyToolSuite {
  private readonly supervisor: WebsitePolicySupervisor;

  constructor(supervisor: WebsitePolicySupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "website_policy_check_url",
        description:
          "Checks whether a URL or domain is permitted by active website blocklist policy.",
        parameters: {
          url: {
            type: "string",
            description: "The URL or hostname to evaluate against the blocklist.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const url = typeof args.url === "string" ? args.url : "";
          if (!url) {
            return { success: false, error: "url is required" };
          }
          const result = this.supervisor.checkAccess(url);
          return {
            success: true,
            allowed: result.allowed,
            host: result.host,
            matchedRule: result.matchedRule,
            message: result.message,
          };
        },
      },
      {
        name: "website_policy_add_rule",
        description:
          "Dynamically adds a domain or glob wildcard pattern to the active website blocklist.",
        parameters: {
          pattern: {
            type: "string",
            description: "The domain name or wildcard pattern (e.g. 'ads.example.com', '*.tracker.*').",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const pattern = typeof args.pattern === "string" ? args.pattern : "";
          if (!pattern) {
            return { success: false, error: "pattern is required" };
          }
          const added = this.supervisor.addRule(pattern, "runtime");
          return {
            success: added,
            pattern,
            message: added
              ? `Rule '${pattern}' successfully added to blocklist.`
              : `Invalid rule pattern '${pattern}'.`,
          };
        },
      },
      {
        name: "website_policy_remove_rule",
        description:
          "Removes an existing domain pattern from the active website blocklist.",
        parameters: {
          pattern: {
            type: "string",
            description: "The domain pattern to remove.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const pattern = typeof args.pattern === "string" ? args.pattern : "";
          if (!pattern) {
            return { success: false, error: "pattern is required" };
          }
          const removed = this.supervisor.removeRule(pattern);
          return {
            success: removed,
            pattern,
            message: removed
              ? `Rule '${pattern}' removed from blocklist.`
              : `Rule '${pattern}' was not found in blocklist.`,
          };
        },
      },
      {
        name: "website_policy_inspect_rules",
        description:
          "Inspects all active website blocklist rules and their provenance sources.",
        parameters: {},
        execute: async () => {
          const rules = this.supervisor.getRules();
          const enabled = this.supervisor.isEnabled();
          return {
            success: true,
            enabled,
            rulesCount: rules.length,
            rules,
          };
        },
      },
      {
        name: "website_policy_get_metrics",
        description:
          "Retrieves aggregate statistics for website access checks and block rates.",
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
