/**
 * web-intelligence-tool-suite.ts
 *
 * Model tool surface for the Web Intelligence Subsystem (Phase 82 / ADR-034).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { WebExtractionFormat } from "../../../core/contracts/web.contracts.js";
import { WebIntelligenceSupervisor } from "../../../agents/extensions/web/web-intelligence-supervisor.js";

export class WebIntelligenceToolSuite {
  private readonly supervisor: WebIntelligenceSupervisor;

  constructor(supervisor: WebIntelligenceSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "web_search",
        description: "Searches the web for documents, technical documentation, or information matching a search query.",
        parameters: {
          query: { type: "string", required: true, description: "Search query keywords or question" },
          limit: { type: "number", description: "Maximum number of search results to return (default: 5)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const query = String(args.query || "").trim();
          if (!query) return { success: false, error: "query parameter is required" };

          const limit = typeof args.limit === "number" ? args.limit : 5;
          const result = this.supervisor.search(query, limit);

          return {
            success: true,
            query: result.query,
            totalHits: result.totalHits,
            hits: result.hits,
            latencyMs: result.latencyMs,
          };
        },
      },
      {
        name: "web_extract",
        description: "Safely extracts clean semantic Markdown/text content from a web URL while stripping noise, scripts, and navigation.",
        parameters: {
          url: { type: "string", required: true, description: "Target web URL to extract" },
          format: { type: "string", description: "Output format: 'markdown' | 'text' | 'html' | 'summary'" },
          htmlContent: { type: "string", description: "Optional raw HTML string to parse directly" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const url = String(args.url || "").trim();
          if (!url) return { success: false, error: "url parameter is required" };

          const format = (typeof args.format === "string" ? args.format : "markdown") as WebExtractionFormat;
          const htmlContent = typeof args.htmlContent === "string" ? args.htmlContent : undefined;

          const res = this.supervisor.extractContent(url, htmlContent, format);
          if (!res.success) {
            return { success: false, error: res.error };
          }

          return {
            success: true,
            extraction: res.extraction,
          };
        },
      },
      {
        name: "url_safety_check",
        description: "Validates whether a URL is secure against SSRF attacks, private CIDR networks, and cloud instance metadata services.",
        parameters: {
          url: { type: "string", required: true, description: "Target URL to inspect" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const url = String(args.url || "").trim();
          if (!url) return { success: false, error: "url parameter is required" };

          const verdict = this.supervisor.verifyUrl(url);
          return {
            success: true,
            verdict,
          };
        },
      },
      {
        name: "web_session_status",
        description: "Queries web intelligence session cache size, extraction metrics, and blocked domain policies.",
        parameters: {},
        execute: async (_args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const stats = this.supervisor.getStats();
          return {
            success: true,
            stats,
          };
        },
      },
    ];
  }
}
