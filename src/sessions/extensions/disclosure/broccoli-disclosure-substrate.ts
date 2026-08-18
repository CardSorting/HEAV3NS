/**
 * broccoli-disclosure-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for registered tool catalogs,
 * deferred schemas, and dynamic activation ledgers (Phase 91 / ADR-043 / Target #83).
 */

import type {
  DeferredToolDefinition,
  DeferredToolRow,
  DisclosureTier,
  IBroccoliToolDisclosureSubstrate,
  ToolDisclosureAuditRow,
  ToolDisclosureBulkMutationResult,
  ToolDisclosureConfig,
  ToolDisclosureDslQueryFilter,
  ToolDisclosureGroupBy,
  ToolDisclosureGroupedLane,
  ToolDisclosureHealthAuditReport,
  ToolDisclosureHealthStatus,
  ToolDisclosureMetrics,
  ToolDisclosureMetricsReport,
  ToolDisclosureMutationUndoRecord,
  ToolDisclosureSortBy,
  ToolDisclosureSortDirection,
  ToolDisclosureWorkspaceSnapshot,
} from "../../../core/contracts/tool-disclosure.contracts.js";
import { DEFAULT_TOOL_DISCLOSURE_CONFIG } from "../../../core/contracts/tool-disclosure.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliDisclosureSubstrate implements IBroccoliToolDisclosureSubstrate {
  private config: ToolDisclosureConfig = { ...DEFAULT_TOOL_DISCLOSURE_CONFIG };
  private readonly toolCatalog = new Map<string, DeferredToolDefinition>();
  private readonly activatedTools = new Set<string>();
  private readonly activationHistory: string[] = [];
  private activeTier: DisclosureTier = "budgeted_listing";

  private totalSearches = 0;
  private totalSchemasEmitted = 0;

  private readonly undoStack: ToolDisclosureMutationUndoRecord[] = [];
  private readonly redoStack: ToolDisclosureMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private toolsTable?: IDbTable<DeferredToolRow>;
  private auditsTable?: IDbTable<ToolDisclosureAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.toolsTable = dbKernel.getTable<DeferredToolRow>("deferred_tool_definitions");
      this.auditsTable = dbKernel.getTable<ToolDisclosureAuditRow>("disclosure_audits");
    }
    this.initDefaultDeferredTools();
  }

  private initDefaultDeferredTools(): void {
    const defaults: DeferredToolDefinition[] = [
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

    for (const tool of defaults) {
      this.registerToolDirect(tool);
    }
  }

  private registerToolDirect(tool: DeferredToolDefinition): void {
    this.toolCatalog.set(tool.name, tool);
    if (this.toolsTable) {
      this.toolsTable.put(tool.name, {
        name: tool.name,
        namespace: tool.namespace,
        description: tool.description,
        parametersJson: JSON.stringify(tool.parameters),
        isCore: tool.isCore,
        tags: tool.tags,
        isActivated: this.activatedTools.has(tool.name),
        registeredAt: Date.now(),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  public setConfig(config: Partial<ToolDisclosureConfig>): void {
    const prev = this.exportSnapshot();
    this.config = { ...this.config, ...config };
    this.pushUndoRecord("config_change", prev);
  }

  public getConfig(): ToolDisclosureConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: ToolDisclosureMutationUndoRecord["mutationType"], prev: ToolDisclosureWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliDisclosureSubstrate.MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  public undo(): boolean {
    const record = this.undoStack.pop();
    if (!record) return false;

    this.redoStack.push({
      mutationType: record.mutationType,
      previousSnapshot: this.exportSnapshot(),
      nextSnapshot: record.previousSnapshot,
      timestampMs: Date.now(),
    });

    this.importSnapshot(record.previousSnapshot);
    return true;
  }

  public redo(): boolean {
    const record = this.redoStack.pop();
    if (!record) return false;

    this.undoStack.push({
      mutationType: record.mutationType,
      previousSnapshot: this.exportSnapshot(),
      nextSnapshot: record.nextSnapshot,
      timestampMs: Date.now(),
    });

    this.importSnapshot(record.nextSnapshot);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Tool Catalog Operations
  // ---------------------------------------------------------------------------

  public registerTool(tool: DeferredToolDefinition): void {
    const prev = this.exportSnapshot();
    this.registerToolDirect(tool);
    this.pushUndoRecord("register_tool", prev);
  }

  public getTool(name: string): DeferredToolDefinition | undefined {
    return this.toolCatalog.get(name);
  }

  public listTools(): readonly DeferredToolDefinition[] {
    return Array.from(this.toolCatalog.values());
  }

  public removeTool(name: string): boolean {
    const exists = this.toolCatalog.has(name);
    if (!exists) return false;

    const prev = this.exportSnapshot();
    this.toolCatalog.delete(name);
    this.activatedTools.delete(name);
    if (this.toolsTable) this.toolsTable.delete(name);

    this.pushUndoRecord("clear", prev);
    return true;
  }

  public activateTool(name: string): boolean {
    if (!this.toolCatalog.has(name)) return false;
    const prev = this.exportSnapshot();
    this.activatedTools.add(name);
    this.activationHistory.push(name);
    this.totalSchemasEmitted++;

    if (this.toolsTable) {
      const tool = this.toolCatalog.get(name)!;
      this.toolsTable.put(name, {
        name: tool.name,
        namespace: tool.namespace,
        description: tool.description,
        parametersJson: JSON.stringify(tool.parameters),
        isCore: tool.isCore,
        tags: tool.tags,
        isActivated: true,
        registeredAt: Date.now(),
      });
    }

    this.pushUndoRecord("activate_tool", prev);
    return true;
  }

  public deactivateTool(name: string): boolean {
    if (!this.activatedTools.has(name)) return false;
    const prev = this.exportSnapshot();
    this.activatedTools.delete(name);
    this.pushUndoRecord("clear", prev);
    return true;
  }

  public getActivatedTools(): readonly string[] {
    return Array.from(this.activatedTools);
  }

  public setActiveTier(tier: DisclosureTier): void {
    this.activeTier = tier;
  }

  public getActiveTier(): DisclosureTier {
    return this.activeTier;
  }

  public recordSearch(): void {
    this.totalSearches++;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): ToolDisclosureHealthAuditReport {
    let healthStatus: ToolDisclosureHealthStatus = "optimal";
    const recommendations: string[] = [];

    const tools = Array.from(this.toolCatalog.values());
    const total = tools.length;
    let eager = 0;
    let deferred = 0;

    for (const t of tools) {
      if (t.isCore) eager++;
      else deferred++;
    }

    if (total === 0) {
      healthStatus = "degraded";
      recommendations.push("Tool catalog is empty.");
    }

    if (deferred > 50 && this.activeTier === "eager") {
      healthStatus = "critical";
      recommendations.push("Excessive deferred tools loaded eagerly. Consider switching to budgeted_listing tier.");
    }

    return {
      totalRegistered: total,
      eagerCount: eager,
      deferredCount: deferred,
      activatedCount: this.activatedTools.size,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): ToolDisclosureMetrics {
    const total = this.toolCatalog.size;
    const activated = this.activatedTools.size;
    const deferred = total - activated;
    const estimatedSaved = deferred * 30; // Approx 30 tokens per deferred schema not injected

    return {
      totalRegisteredTools: total,
      totalActivatedTools: activated,
      totalSearchesPerformed: this.totalSearches,
      totalSchemasEmitted: this.totalSchemasEmitted,
      estimatedTokensSaved: estimatedSaved,
    };
  }

  public getMetricsReport(): ToolDisclosureMetricsReport {
    const metrics = this.getMetrics();
    const toolsByNamespace: Record<string, number> = {};
    const toolsByTag: Record<string, number> = {};

    for (const tool of this.toolCatalog.values()) {
      toolsByNamespace[tool.namespace] = (toolsByNamespace[tool.namespace] || 0) + 1;
      for (const tag of tool.tags) {
        toolsByTag[tag] = (toolsByTag[tag] || 0) + 1;
      }
    }

    return {
      ...metrics,
      toolsByNamespace,
      toolsByTag,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedTools(
    groupBy: ToolDisclosureGroupBy = "namespace",
    sortBy: ToolDisclosureSortBy = "name",
    direction: ToolDisclosureSortDirection = "asc"
  ): readonly ToolDisclosureGroupedLane[] {
    const lanes = new Map<string, DeferredToolRow[]>();
    const allRows: DeferredToolRow[] = Array.from(this.toolCatalog.values()).map((t) => ({
      name: t.name,
      namespace: t.namespace,
      description: t.description,
      parametersJson: JSON.stringify(t.parameters),
      isCore: t.isCore,
      tags: t.tags,
      isActivated: this.activatedTools.has(t.name),
      registeredAt: Date.now(),
    }));

    for (const tool of allRows) {
      let key = "default";
      switch (groupBy) {
        case "namespace":
          key = tool.namespace;
          break;
        case "isCore":
          key = tool.isCore ? "core" : "deferred";
          break;
        case "tier":
          key = this.activeTier;
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(tool);
    }

    const result: ToolDisclosureGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "name") cmp = a.name.localeCompare(b.name);
        else if (sortBy === "namespace") cmp = a.namespace.localeCompare(b.namespace);
        else if (sortBy === "registeredAt") cmp = a.registeredAt - b.registeredAt;
        return direction === "asc" ? cmp : -cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        tools: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryToolsDsl(query: ToolDisclosureDslQueryFilter | string): readonly DeferredToolRow[] {
    const parsed: ToolDisclosureDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const allRows: DeferredToolRow[] = Array.from(this.toolCatalog.values()).map((t) => ({
      name: t.name,
      namespace: t.namespace,
      description: t.description,
      parametersJson: JSON.stringify(t.parameters),
      isCore: t.isCore,
      tags: t.tags,
      isActivated: this.activatedTools.has(t.name),
      registeredAt: Date.now(),
    }));

    return allRows.filter((tool) => {
      if (parsed.namespace && tool.namespace.toLowerCase() !== parsed.namespace.toLowerCase()) return false;
      if (parsed.isCore !== undefined && tool.isCore !== parsed.isCore) return false;
      if (parsed.isActivated !== undefined && tool.isActivated !== parsed.isActivated) return false;
      if (parsed.tag && !tool.tags.some((t) => t.toLowerCase() === parsed.tag!.toLowerCase())) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${tool.name} ${tool.namespace} ${tool.description} ${tool.tags.join(" ")}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): ToolDisclosureDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let namespace: string | undefined;
    let isCore: boolean | undefined;
    let isActivated: boolean | undefined;
    let tag: string | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("ns:") || tok.startsWith("namespace:")) {
        namespace = tok.split(":")[1];
      } else if (tok === "is:core") {
        isCore = true;
      } else if (tok === "is:deferred") {
        isCore = false;
      } else if (tok === "is:active" || tok === "is:activated") {
        isActivated = true;
      } else if (tok.startsWith("tag:")) {
        tag = tok.split(":")[1];
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      namespace,
      isCore,
      isActivated,
      tag,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeTools(names: readonly string[]): ToolDisclosureBulkMutationResult {
    const prev = this.exportSnapshot();
    let modified = 0;

    for (const name of names) {
      if (this.toolCatalog.has(name)) {
        this.toolCatalog.delete(name);
        this.activatedTools.delete(name);
        if (this.toolsTable) this.toolsTable.delete(name);
        modified++;
      }
    }

    this.pushUndoRecord("clear", prev);
    return {
      matchedCount: names.length,
      modifiedCount: modified,
      affectedToolNames: names,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const tools = this.listTools();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Progressive Tool Disclosure Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>🔍 LUMI Tool Disclosure Gateway</h1>
  <p style="color: #94a3b8;">Tiered Schema Delivery & Dynamic Activation (Phase 91 / ADR-043)</p>
  
  <div class="grid">
    <div class="card"><div>Registered Tools</div><div class="metric-val">${metrics.totalRegisteredTools}</div></div>
    <div class="card"><div>Activated Tools</div><div class="metric-val" style="color:#10b981;">${metrics.totalActivatedTools}</div></div>
    <div class="card"><div>Tokens Saved (~est)</div><div class="metric-val" style="color:#a855f7;">${metrics.estimatedTokensSaved}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Tool Catalog Ledger</h2>
  <table>
    <thead><tr><th>Tool Name</th><th>Namespace</th><th>Description</th><th>Status</th><th>Tags</th></tr></thead>
    <tbody>
      ${tools.map((t) => `<tr><td><code>${t.name}</code></td><td>${t.namespace}</td><td>${t.description}</td><td>${this.activatedTools.has(t.name) ? '<span style="color:#22c55e;">ACTIVATED</span>' : '<span style="color:#94a3b8;">DEFERRED</span>'}</td><td>${t.tags.join(", ")}</td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const tools = this.listTools();

    let md = `# LUMI Progressive Tool Disclosure Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Total Registered:** \`${metrics.totalRegisteredTools}\` | **Activated:** \`${metrics.totalActivatedTools}\` | **Tokens Saved:** \`~${metrics.estimatedTokensSaved}\`\n\n`;
    md += `## Tool Catalog Ledger (${tools.length})\n\n`;
    md += `| Tool Name | Namespace | Description | Status | Tags |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const t of tools) {
      const status = this.activatedTools.has(t.name) ? "**ACTIVATED**" : "DEFERRED";
      md += `| \`${t.name}\` | ${t.namespace} | ${t.description} | ${status} | \`${t.tags.join(",")}\` |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "name,namespace,description,isCore,isActivated,tags\n";
    const rows = Array.from(this.toolCatalog.values()).map((t) => {
      const isAct = this.activatedTools.has(t.name);
      return `"${t.name}","${t.namespace}","${t.description.replace(/"/g, '""')}",${t.isCore},${isAct},"${t.tags.join(";")}"`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): ToolDisclosureWorkspaceSnapshot {
    const tools = Array.from(this.toolCatalog.values());
    const deferredCount = tools.filter((t) => !t.isCore).length;

    return {
      snapshotId: `snap-${Date.now()}`,
      totalTools: tools.length,
      deferredToolsCount: deferredCount,
      registeredTools: tools,
      activatedTools: Array.from(this.activatedTools),
      activeTier: this.activeTier,
      metrics: this.getMetrics(),
      config: this.getConfig(),
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: ToolDisclosureWorkspaceSnapshot): void {
    if (snapshot.config) this.config = { ...snapshot.config };
    this.activeTier = snapshot.activeTier;
    this.activatedTools.clear();
    for (const name of snapshot.activatedTools) {
      this.activatedTools.add(name);
    }
    if (snapshot.registeredTools) {
      this.toolCatalog.clear();
      for (const tool of snapshot.registeredTools) {
        this.registerToolDirect(tool);
      }
    }
  }

  public clear(): void {
    this.config = { ...DEFAULT_TOOL_DISCLOSURE_CONFIG };
    this.toolCatalog.clear();
    this.activatedTools.clear();
    this.activationHistory.length = 0;
    this.activeTier = "budgeted_listing";
    this.totalSearches = 0;
    this.totalSchemasEmitted = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
