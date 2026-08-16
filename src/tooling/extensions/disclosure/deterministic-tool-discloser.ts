/**
 * deterministic-tool-discloser.ts
 *
 * In-memory zero-GC progressive tool disclosure engine with tiered token budgeting (Phase 91 / ADR-043).
 */

import type {
  DeferredToolDefinition,
  DisclosureManifest,
  DisclosureTier,
  ToolSearchResult,
} from "../../../core/contracts/tool-disclosure.contracts.js";

export class DeterministicToolDiscloser {
  private toolCatalog: Map<string, DeferredToolDefinition>;

  constructor() {
    this.toolCatalog = new Map<string, DeferredToolDefinition>();
    this.initDefaultDeferredTools();
  }

  private initDefaultDeferredTools(): void {
    const defaultTools: DeferredToolDefinition[] = [
      {
        name: "cloudflare_dns_record_create",
        namespace: "cloudflare",
        description: "Creates a new DNS record in Cloudflare Zone",
        parameters: { zoneId: { type: "string" }, name: { type: "string" }, content: { type: "string" } },
        isCore: false,
        tags: ["cloudflare", "dns", "devops", "cloud"],
      },
      {
        name: "cloudflare_worker_deploy",
        namespace: "cloudflare",
        description: "Deploys a serverless Worker script to Cloudflare",
        parameters: { scriptName: { type: "string" }, content: { type: "string" } },
        isCore: false,
        tags: ["cloudflare", "serverless", "devops"],
      },
      {
        name: "database_sql_query",
        namespace: "database",
        description: "Executes a read-only SQL query against PostgreSQL/MySQL",
        parameters: { query: { type: "string" }, limit: { type: "number" } },
        isCore: false,
        tags: ["database", "sql", "postgres", "data"],
      },
      {
        name: "jira_issue_create",
        namespace: "jira",
        description: "Creates a new task or bug ticket in Jira board",
        parameters: { projectKey: { type: "string" }, summary: { type: "string" }, description: { type: "string" } },
        isCore: false,
        tags: ["jira", "issue", "project-management"],
      },
    ];

    for (let i = 0; i < defaultTools.length; i++) {
      const tool = defaultTools[i];
      this.toolCatalog.set(tool.name, tool);
    }
  }

  /**
   * Registers a deferred tool into the catalog.
   */
  registerTool(tool: DeferredToolDefinition): void {
    this.toolCatalog.set(tool.name, tool);
  }

  /**
   * Retrieves a tool by name.
   */
  getTool(name: string): DeferredToolDefinition | undefined {
    return this.toolCatalog.get(name);
  }

  /**
   * Searches the deferred tool catalog by query, tag, or namespace.
   */
  search(query: string, tag?: string, namespace?: string): ToolSearchResult {
    const q = query.trim().toLowerCase();
    const targetTag = tag ? tag.trim().toLowerCase() : undefined;
    const targetNamespace = namespace ? namespace.trim().toLowerCase() : undefined;

    const matches: DeferredToolDefinition[] = [];
    const values = Array.from(this.toolCatalog.values());

    for (let i = 0; i < values.length; i++) {
      const tool = values[i];

      if (targetNamespace && tool.namespace.toLowerCase() !== targetNamespace) {
        continue;
      }

      if (targetTag && !tool.tags.some((t) => t.toLowerCase() === targetTag)) {
        continue;
      }

      if (q.length > 0) {
        const nameMatch = tool.name.toLowerCase().includes(q);
        const descMatch = tool.description.toLowerCase().includes(q);
        const tagMatch = tool.tags.some((t) => t.toLowerCase().includes(q));

        if (!nameMatch && !descMatch && !tagMatch) {
          continue;
        }
      }

      matches.push(tool);
    }

    return {
      query,
      totalMatches: matches.length,
      tools: matches,
    };
  }

  /**
   * Evaluates the active disclosure tier based on catalog size and token budget.
   */
  determineDisclosureTier(tokenBudget: number = 2000): DisclosureManifest {
    const tools = Array.from(this.toolCatalog.values());
    const totalRegistered = tools.length;
    let eagerCount = 0;
    let deferredCount = 0;

    for (let i = 0; i < tools.length; i++) {
      if (tools[i].isCore) {
        eagerCount++;
      } else {
        deferredCount++;
      }
    }

    if (deferredCount === 0) {
      return {
        totalRegistered,
        eagerCount,
        deferredCount: 0,
        activeTier: "eager",
        tokenBudget,
        summary: "All tools are loaded eagerly.",
      };
    }

    // Estimate token usage for budgeted listing (~30 tokens per tool)
    const fullListingCost = deferredCount * 30;
    // Estimate token usage for names-only (~5 tokens per tool)
    const namesListingCost = deferredCount * 5;

    let activeTier: DisclosureTier;
    let summary: string;

    if (fullListingCost <= tokenBudget) {
      activeTier = "budgeted_listing";
      summary = `Tier 1: ${deferredCount} deferred tools available with full description listings.`;
    } else if (namesListingCost <= tokenBudget) {
      activeTier = "names_only";
      summary = `Tier 2: ${deferredCount} deferred tools available in compact names-only listing.`;
    } else {
      activeTier = "search_only";
      summary = `Tier 3: ${deferredCount} deferred tools hidden behind tool_search bridge.`;
    }

    return {
      totalRegistered,
      eagerCount,
      deferredCount,
      activeTier,
      tokenBudget,
      summary,
    };
  }

  /**
   * Lists all registered deferred tools.
   */
  listAll(): readonly DeferredToolDefinition[] {
    return Array.from(this.toolCatalog.values());
  }

  /**
   * Resets catalog to defaults.
   */
  reset(): void {
    this.toolCatalog.clear();
    this.initDefaultDeferredTools();
  }
}
