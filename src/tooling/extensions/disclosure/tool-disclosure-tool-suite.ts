/**
 * tool-disclosure-tool-suite.ts
 *
 * Model tool suite exposing progressive tool search, describe, and disclosure status (Phase 91 / ADR-043).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { ToolDisclosureSupervisor } from "../../../agents/extensions/disclosure/tool-disclosure-supervisor.js";

export class ToolDisclosureToolSuite {
  private supervisor: ToolDisclosureSupervisor;

  constructor(supervisor: ToolDisclosureSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "tool_search",
        description: "Searches the catalog of deferred and plugin tools by keyword, tag, or namespace.",
        parameters: {
          query: {
            type: "string",
            description: "Search keyword for tool name or description",
            required: false,
          },
          tag: {
            type: "string",
            description: "Filter tools by specific capability tag (e.g. 'cloudflare', 'sql', 'database')",
            required: false,
          },
          namespace: {
            type: "string",
            description: "Filter tools by specific service namespace (e.g. 'cloudflare', 'jira')",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const query = typeof args.query === "string" ? args.query : "";
          const tag = typeof args.tag === "string" ? args.tag : undefined;
          const namespace = typeof args.namespace === "string" ? args.namespace : undefined;

          const searchResult = this.supervisor.searchTools(query, tag, namespace);
          return {
            success: true,
            query,
            totalMatches: searchResult.totalMatches,
            tools: searchResult.tools.map((t) => ({
              name: t.name,
              namespace: t.namespace,
              description: t.description,
              tags: t.tags,
            })),
          };
        },
      },
      {
        name: "tool_describe",
        description: "Retrieves the full parameter schema and documentation for a specific deferred tool.",
        parameters: {
          name: {
            type: "string",
            description: "The name of the tool to describe",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const name = typeof args.name === "string" ? args.name : "";
          const tool = this.supervisor.describeTool(name);

          if (!tool) {
            return {
              success: false,
              error: `Tool '${name}' not found in deferred tool catalog`,
            };
          }

          this.supervisor.activateTool(name);

          return {
            success: true,
            tool: {
              name: tool.name,
              namespace: tool.namespace,
              description: tool.description,
              parameters: tool.parameters,
              tags: tool.tags,
            },
          };
        },
      },
      {
        name: "tool_disclosure_status",
        description: "Queries the current tool disclosure tier and active catalog statistics.",
        parameters: {},
        execute: async () => {
          const manifest = this.supervisor.getManifest();
          const stats = this.supervisor.getStats();
          const activatedTools = this.supervisor.getActivatedTools();

          return {
            success: true,
            manifest,
            stats,
            activatedTools,
          };
        },
      },
    ];
  }
}
