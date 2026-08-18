/**
 * broccoli-cost-substrate.ts
 *
 * In-memory zero-GC Broccolidb repository for model pricing catalogs, per-turn usage ledgers,
 * and session budget metrics (Phase 90 / ADR-042).
 */

import type {
  BudgetCapConfig,
  CostAuditRow,
  CostBudgetRow,
  CostBulkMutationResult,
  CostDslQueryFilter,
  CostGroupBy,
  CostGroupedLane,
  CostHealthAuditReport,
  CostHealthStatus,
  CostLedgerRow,
  CostMetricsReport,
  CostMutationUndoRecord,
  CostPricingTierRow,
  CostSortBy,
  CostSortDirection,
  CostGovernanceWorkspaceSnapshot,
  IBroccoliCostSubstrate,
  TokenUsageLedgerEntry,
} from "../../../core/contracts/cost-governance.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliCostSubstrate implements IBroccoliCostSubstrate {
  private ledger: TokenUsageLedgerEntry[];
  private readonly auditLogs: CostAuditRow[] = [];
  private totalTokens: number;
  private totalPromptTokens: number;
  private totalCompletionTokens: number;
  private totalCachedPromptTokens: number;
  private totalCostMicroCents: number;
  private hardCapBreached: boolean;

  private readonly undoStack: CostMutationUndoRecord[] = [];
  private readonly redoStack: CostMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private ledgersTable?: IDbTable<CostLedgerRow>;
  private tiersTable?: IDbTable<CostPricingTierRow>;
  private budgetsTable?: IDbTable<CostBudgetRow>;
  private auditsTable?: IDbTable<CostAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    this.ledger = [];
    this.totalTokens = 0;
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.totalCachedPromptTokens = 0;
    this.totalCostMicroCents = 0;
    this.hardCapBreached = false;
    this.dbKernel = dbKernel;

    if (this.dbKernel) {
      this.initBroccoliDbTables();
    }
  }

  private initBroccoliDbTables(): void {
    if (!this.dbKernel) return;

    this.ledgersTable = this.dbKernel.getTable<CostLedgerRow>("cost_ledgers");
    this.tiersTable = this.dbKernel.getTable<CostPricingTierRow>("cost_pricing_tiers");
    this.budgetsTable = this.dbKernel.getTable<CostBudgetRow>("cost_budgets");
    this.auditsTable = this.dbKernel.getTable<CostAuditRow>("cost_audits");

    try {
      this.ledgersTable.createIndex("modelId");
      this.ledgersTable.createIndex("turnIndex");
      this.ledgersTable.createIndex("timestamp");
    } catch {
      // Non-blocking
    }
  }

  public recordTurnUsage(entry: TokenUsageLedgerEntry): void {
    const prevSnap = this.exportSnapshot();

    this.ledger.push(entry);
    this.totalPromptTokens += entry.promptTokens;
    this.totalCompletionTokens += entry.completionTokens;
    this.totalCachedPromptTokens += entry.cachedPromptTokens;
    this.totalTokens = this.totalPromptTokens + this.totalCompletionTokens;
    this.totalCostMicroCents += entry.estimatedCostMicroCents;

    if (this.ledger.length > 1000) {
      this.ledger.shift();
    }

    if (this.ledgersTable) {
      const rowId = `turn_${entry.turnIndex}_${entry.timestamp}`;
      this.ledgersTable.put(rowId, {
        id: rowId,
        turnIndex: entry.turnIndex,
        modelId: entry.modelId,
        promptTokens: entry.promptTokens,
        completionTokens: entry.completionTokens,
        cachedPromptTokens: entry.cachedPromptTokens,
        estimatedCostMicroCents: entry.estimatedCostMicroCents,
        estimatedCostUsd: entry.estimatedCostUsd,
        formattedCostLabel: entry.formattedCostLabel,
        timestamp: entry.timestamp,
      });
    }

    this.recordAudit("record_turn", "system", `Turn #${entry.turnIndex} cost ${entry.formattedCostLabel}`, entry.estimatedCostUsd);
    this.recordUndo({
      mutationType: "record",
      previousSnapshot: prevSnap,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
  }

  public setHardCapBreached(breached: boolean): void {
    this.hardCapBreached = breached;
    if (breached) {
      this.recordAudit("hard_cap_breach", "governor", "Budget hard cap exceeded; work blocked", this.totalCostMicroCents / 1_000_000);
    }
  }

  public getTotalMicroCents(): number {
    return this.totalCostMicroCents;
  }

  public listLedger(limit: number = 20): readonly TokenUsageLedgerEntry[] {
    return this.ledger.slice(-limit);
  }

  public recordAudit(action: string, operator: string, reason: string, amountUsd?: number): void {
    const row: CostAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action,
      operator,
      reason,
      amountUsd,
      timestamp: Date.now(),
    };
    this.auditLogs.unshift(row);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
    if (this.auditsTable) {
      this.auditsTable.put(row.id, row);
    }
  }

  public getAuditLogs(limit = 50): readonly CostAuditRow[] {
    return this.auditLogs.slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Budget Diagnostics
  // ---------------------------------------------------------------------------

  public auditCostHealth(budgetCap?: BudgetCapConfig): CostHealthAuditReport {
    const totalCostUsd = Number((this.totalCostMicroCents / 1_000_000).toFixed(6));
    const maxBudget = budgetCap?.maxSessionCostUsd;
    const remainingBudgetUsd = typeof maxBudget === "number" ? Math.max(0, maxBudget - totalCostUsd) : undefined;

    // Calculate model usages to find top spender
    const modelCosts: Record<string, number> = {};
    for (const e of this.ledger) {
      modelCosts[e.modelId] = (modelCosts[e.modelId] || 0) + e.estimatedCostUsd;
    }
    let topModelId = "none";
    let highestCost = -1;
    for (const [model, cost] of Object.entries(modelCosts)) {
      if (cost > highestCost) {
        highestCost = cost;
        topModelId = model;
      }
    }

    const burnRateUsdPerHour = this.ledger.length > 1
      ? (totalCostUsd / Math.max(1, (this.ledger[this.ledger.length - 1].timestamp - this.ledger[0].timestamp) / 3600000))
      : totalCostUsd;

    let healthStatus: CostHealthStatus = "optimal";
    if (this.hardCapBreached || (typeof maxBudget === "number" && totalCostUsd >= maxBudget)) {
      healthStatus = "budget_exceeded";
    } else if (typeof maxBudget === "number" && totalCostUsd >= maxBudget * 0.8) {
      healthStatus = "near_ceiling";
    } else if (totalCostUsd > 10.0) {
      healthStatus = "healthy";
    }

    const recommendations: string[] = [];
    if (healthStatus === "budget_exceeded") {
      recommendations.push("Hard cap budget exceeded! Increase maxSessionCostUsd or optimize prompt token caching.");
    } else if (healthStatus === "near_ceiling") {
      recommendations.push(`Session cost has reached ${(totalCostUsd / maxBudget! * 100).toFixed(0)}% of ceiling limit ($${maxBudget!.toFixed(2)}).`);
    }
    if (topModelId !== "none" && topModelId.includes("4o") && !topModelId.includes("mini")) {
      recommendations.push(`High cost tier detected for '${topModelId}'. Consider route delegation to lightweight reasoning models.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("Token burn rate and budget consumption are within optimal parameters.");
    }

    return {
      totalCostUsd,
      remainingBudgetUsd,
      burnRateUsdPerHour: Number(burnRateUsdPerHour.toFixed(4)),
      healthStatus,
      hardCapBreached: this.hardCapBreached,
      topModelId,
      recommendations,
    };
  }

  public getCostMetrics(): CostMetricsReport {
    const totalCostUsd = Number((this.totalCostMicroCents / 1_000_000).toFixed(6));
    const formattedTotalCostLabel =
      totalCostUsd < 0.01
        ? totalCostUsd <= 0
          ? "$0.00"
          : `~$${totalCostUsd.toFixed(4)}`
        : `~$${totalCostUsd.toFixed(2)}`;

    const modelUsageCounts: Record<string, number> = {};
    for (const e of this.ledger) {
      modelUsageCounts[e.modelId] = (modelUsageCounts[e.modelId] || 0) + 1;
    }

    const burnRatePerTurnUsd = this.ledger.length > 0
      ? Number((totalCostUsd / this.ledger.length).toFixed(6))
      : 0;

    return {
      totalTokens: this.totalTokens,
      totalPromptTokens: this.totalPromptTokens,
      totalCompletionTokens: this.totalCompletionTokens,
      totalCachedPromptTokens: this.totalCachedPromptTokens,
      totalCostMicroCents: this.totalCostMicroCents,
      totalCostUsd,
      formattedTotalCostLabel,
      totalTurns: this.ledger.length,
      hardCapBreached: this.hardCapBreached,
      burnRatePerTurnUsd,
      modelUsageCounts,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedCosts(
    groupBy: CostGroupBy = "model",
    sortBy: CostSortBy = "cost",
    direction: CostSortDirection = "desc"
  ): readonly CostGroupedLane[] {
    const laneMap = new Map<string, { title: string; items: TokenUsageLedgerEntry[] }>();

    for (const entry of this.ledger) {
      let key = "default";
      let title = "Default";

      switch (groupBy) {
        case "model":
          key = entry.modelId;
          title = `Model: ${entry.modelId}`;
          break;
        case "provider":
          key = entry.modelId.includes("claude") ? "anthropic" : entry.modelId.includes("gpt") ? "openai" : "nous";
          title = `Provider: ${key.toUpperCase()}`;
          break;
        case "tier":
          key = entry.estimatedCostUsd >= 0.05 ? "premium" : entry.estimatedCostUsd >= 0.005 ? "standard" : "economy";
          title = `${key.toUpperCase()} COST TIER`;
          break;
        case "status":
          key = entry.cachedPromptTokens > 0 ? "cached" : "standard";
          title = entry.cachedPromptTokens > 0 ? "⚡ PROMPT CACHED" : "STANDARD TURN";
          break;
      }

      if (!laneMap.has(key)) {
        laneMap.set(key, { title, items: [] });
      }
      laneMap.get(key)!.items.push(entry);
    }

    const lanes: CostGroupedLane[] = [];
    for (const [key, group] of laneMap.entries()) {
      group.items.sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case "cost":
            cmp = b.estimatedCostUsd - a.estimatedCostUsd;
            break;
          case "tokens":
            cmp = (b.promptTokens + b.completionTokens) - (a.promptTokens + a.completionTokens);
            break;
          case "timestamp":
            cmp = b.timestamp - a.timestamp;
            break;
          case "turnIndex":
            cmp = b.turnIndex - a.turnIndex;
            break;
        }
        return direction === "desc" ? cmp : -cmp;
      });

      const laneCost = group.items.reduce((sum, e) => sum + e.estimatedCostUsd, 0);

      lanes.push({
        key,
        title: group.title,
        count: group.items.length,
        totalCostUsd: Number(laneCost.toFixed(6)),
        entries: group.items,
      });
    }

    return lanes;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public parseDslQuery(rawQuery: string): CostDslQueryFilter {
    const tokens = rawQuery.trim().split(/\s+/);
    let modelId: string | undefined;
    let provider: string | undefined;
    let minCostUsd: number | undefined;
    let maxCostUsd: number | undefined;
    let minTokens: number | undefined;
    let isCached: boolean | undefined;
    const textTerms: string[] = [];

    for (const token of tokens) {
      if (!token) continue;
      const lower = token.toLowerCase();

      if (lower.startsWith("model:")) {
        modelId = lower.split(":")[1];
      } else if (lower.startsWith("provider:")) {
        provider = lower.split(":")[1];
      } else if (lower.startsWith("cost>") || lower.startsWith("min_cost:")) {
        minCostUsd = Number(lower.replace(/[^0-9.]/g, ""));
      } else if (lower.startsWith("cost<") || lower.startsWith("max_cost:")) {
        maxCostUsd = Number(lower.replace(/[^0-9.]/g, ""));
      } else if (lower.startsWith("tokens>") || lower.startsWith("min_tokens:")) {
        minTokens = Number(lower.replace(/[^0-9]/g, ""));
      } else if (lower === "is:cached" || lower === "cached:true") {
        isCached = true;
      } else if (lower === "is:uncached" || lower === "cached:false") {
        isCached = false;
      } else {
        textTerms.push(lower);
      }
    }

    return {
      rawQuery,
      modelId,
      provider,
      minCostUsd,
      maxCostUsd,
      minTokens,
      isCached,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  public queryCostsDsl(query: CostDslQueryFilter | string): readonly TokenUsageLedgerEntry[] {
    const filter = typeof query === "string" ? this.parseDslQuery(query) : query;
    let result = [...this.ledger];

    if (filter.modelId) {
      result = result.filter((e) => e.modelId.toLowerCase().includes(filter.modelId!));
    }
    if (filter.minCostUsd !== undefined) {
      result = result.filter((e) => e.estimatedCostUsd >= filter.minCostUsd!);
    }
    if (filter.maxCostUsd !== undefined) {
      result = result.filter((e) => e.estimatedCostUsd <= filter.maxCostUsd!);
    }
    if (filter.minTokens !== undefined) {
      result = result.filter((e) => (e.promptTokens + e.completionTokens) >= filter.minTokens!);
    }
    if (filter.isCached !== undefined) {
      result = result.filter((e) => (e.cachedPromptTokens > 0) === filter.isCached);
    }
    if (filter.textTerms && filter.textTerms.length > 0) {
      result = result.filter((e) => {
        const haystack = `${e.turnIndex} ${e.modelId} ${e.formattedCostLabel}`.toLowerCase();
        return filter.textTerms!.every((term) => haystack.includes(term));
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Bulk Ledger Mutations & Undo / Redo
  // ---------------------------------------------------------------------------

  public bulkClearLedger(turnIndices: readonly number[]): CostBulkMutationResult {
    const prevSnap = this.exportSnapshot();
    const set = new Set(turnIndices);
    const initialLen = this.ledger.length;

    this.ledger = this.ledger.filter((e) => !set.has(e.turnIndex));
    const modifiedCount = initialLen - this.ledger.length;

    // Recalculate totals
    this.totalPromptTokens = this.ledger.reduce((sum, e) => sum + e.promptTokens, 0);
    this.totalCompletionTokens = this.ledger.reduce((sum, e) => sum + e.completionTokens, 0);
    this.totalCachedPromptTokens = this.ledger.reduce((sum, e) => sum + e.cachedPromptTokens, 0);
    this.totalTokens = this.totalPromptTokens + this.totalCompletionTokens;
    this.totalCostMicroCents = this.ledger.reduce((sum, e) => sum + e.estimatedCostMicroCents, 0);

    this.recordAudit("bulk_clear", "user", `Bulk cleared ${modifiedCount} turn entries`);
    this.recordUndo({
      mutationType: "bulk",
      previousSnapshot: prevSnap,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });

    return {
      matchedCount: turnIndices.length,
      modifiedCount,
      updatedTurnIndices: turnIndices,
    };
  }

  private recordUndo(record: CostMutationUndoRecord): void {
    this.undoStack.push(record);
    if (this.undoStack.length > BroccoliCostSubstrate.MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  public undo(): boolean {
    const rec = this.undoStack.pop();
    if (!rec) return false;

    this.importSnapshot(rec.previousSnapshot);
    this.redoStack.push(rec);
    return true;
  }

  public redo(): boolean {
    const rec = this.redoStack.pop();
    if (!rec) return false;

    this.importSnapshot(rec.nextSnapshot);
    this.undoStack.push(rec);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Snapshot Import / Export
  // ---------------------------------------------------------------------------

  public exportSnapshot(): CostGovernanceWorkspaceSnapshot {
    const totalCostUsd = Number((this.totalCostMicroCents / 1_000_000).toFixed(6));
    const formattedTotalCostLabel =
      totalCostUsd < 0.01
        ? totalCostUsd <= 0
          ? "$0.00"
          : `~$${totalCostUsd.toFixed(4)}`
        : `~$${totalCostUsd.toFixed(2)}`;

    return {
      totalTokens: this.totalTokens,
      totalPromptTokens: this.totalPromptTokens,
      totalCompletionTokens: this.totalCompletionTokens,
      totalCachedPromptTokens: this.totalCachedPromptTokens,
      totalCostMicroCents: this.totalCostMicroCents,
      totalCostUsd,
      formattedTotalCostLabel,
      totalTurns: this.ledger.length,
      hardCapBreached: this.hardCapBreached,
      timestamp: Date.now(),
      ledger: [...this.ledger],
    };
  }

  public importSnapshot(snapshot: CostGovernanceWorkspaceSnapshot): void {
    this.totalTokens = snapshot.totalTokens;
    this.totalPromptTokens = snapshot.totalPromptTokens;
    this.totalCompletionTokens = snapshot.totalCompletionTokens;
    this.totalCachedPromptTokens = snapshot.totalCachedPromptTokens;
    this.totalCostMicroCents = snapshot.totalCostMicroCents;
    this.hardCapBreached = snapshot.hardCapBreached;
    if (snapshot.ledger) {
      this.ledger = [...snapshot.ledger];
    } else {
      this.ledger = this.ledger.slice(0, snapshot.totalTurns);
    }
  }

  public clear(): void {
    this.ledger = [];
    this.auditLogs.length = 0;
    this.totalTokens = 0;
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.totalCachedPromptTokens = 0;
    this.totalCostMicroCents = 0;
    this.hardCapBreached = false;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  // ---------------------------------------------------------------------------
  // Export Renderers (HTML, Markdown, CSV)
  // ---------------------------------------------------------------------------

  public exportMarkdownReport(): string {
    const metrics = this.getCostMetrics();

    let md = `# 💰 LUMI Cost Governance & Token Accounting Report (ADR-042)\n\n`;
    md += `**Total Cost**: ${metrics.formattedTotalCostLabel} | **Tokens**: ${metrics.totalTokens.toLocaleString()} | **Turns**: ${metrics.totalTurns} | **Burn Rate**: $${metrics.burnRatePerTurnUsd.toFixed(4)}/turn\n\n`;
    md += `## 📜 Per-Turn Usage Ledger\n\n`;
    md += `| Turn | Model | Prompt Tokens | Completion Tokens | Cached Tokens | Estimated Cost |\n`;
    md += `|---|---|---|---|---|---|\n`;

    for (const e of this.ledger) {
      md += `| #${e.turnIndex} | \`${e.modelId}\` | ${e.promptTokens.toLocaleString()} | ${e.completionTokens.toLocaleString()} | ${e.cachedPromptTokens.toLocaleString()} | **${e.formattedCostLabel}** |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const lines = ["turnIndex,modelId,promptTokens,completionTokens,cachedPromptTokens,estimatedCostMicroCents,estimatedCostUsd,formattedCostLabel,timestamp"];

    for (const e of this.ledger) {
      lines.push(`${e.turnIndex},${e.modelId},${e.promptTokens},${e.completionTokens},${e.cachedPromptTokens},${e.estimatedCostMicroCents},${e.estimatedCostUsd},"${e.formattedCostLabel}",${e.timestamp}`);
    }

    return lines.join("\n");
  }

  public exportInteractiveHtmlView(): string {
    const metrics = this.getCostMetrics();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Cost Governance & Token Accounting (ADR-042)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg-base: #030712;
      --bg-surface: #0f172a;
      --bg-card: #1e293b;
      --card-border: #334155;
      --text-primary: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg-base);
      color: var(--text-primary);
      padding: 1.5rem;
      min-height: 100vh;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--card-border);
    }
    .brand { font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 0.6rem; }
    .kpi-ribbon {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .kpi-card {
      background: var(--bg-surface);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.2rem;
    }
    .kpi-val { font-size: 1.6rem; font-weight: 700; }
    .kpi-label { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; }
    .cost-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--bg-surface);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--card-border);
    }
    .cost-table th, .cost-table td { padding: 0.9rem 1.2rem; text-align: left; font-size: 0.9rem; }
    .cost-table th { background: #1e293b; color: var(--text-muted); text-transform: uppercase; font-size: 0.75rem; }
    .cost-table tr:hover td { background: rgba(16, 185, 129, 0.05); }
    .badge { padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>💰 LUMI COST GOVERNANCE & TOKEN ACCOUNTING</span>
      <span style="font-size: 0.75rem; color: var(--text-muted); background: #1e293b; padding: 0.15rem 0.5rem; border-radius: 99px;">ADR-042</span>
    </div>
    <div style="font-size: 0.85rem; color: var(--text-muted);">
      Total Turns: <strong>${metrics.totalTurns}</strong> │ Total Tokens: <strong>${metrics.totalTokens.toLocaleString()}</strong>
    </div>
  </header>

  <div class="kpi-ribbon">
    <div class="kpi-card">
      <div class="kpi-val" style="color: #10b981;">${metrics.formattedTotalCostLabel}</div>
      <div class="kpi-label">Total Spend</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #38bdf8;">${metrics.totalTokens.toLocaleString()}</div>
      <div class="kpi-label">Total Tokens</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #f59e0b;">${metrics.totalCachedPromptTokens.toLocaleString()}</div>
      <div class="kpi-label">Cached Tokens</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #8b5cf6;">$${metrics.burnRatePerTurnUsd.toFixed(4)}</div>
      <div class="kpi-label">Avg / Turn</div>
    </div>
  </div>

  <table class="cost-table">
    <thead>
      <tr>
        <th>Turn</th>
        <th>Model</th>
        <th>Prompt</th>
        <th>Completion</th>
        <th>Cached</th>
        <th>Cost</th>
      </tr>
    </thead>
    <tbody>
      ${this.ledger
        .map(
          (e) => `
        <tr>
          <td><strong>#${e.turnIndex}</strong></td>
          <td><code>${e.modelId}</code></td>
          <td>${e.promptTokens.toLocaleString()}</td>
          <td>${e.completionTokens.toLocaleString()}</td>
          <td>${e.cachedPromptTokens.toLocaleString()}</td>
          <td><strong style="color: var(--accent);">${e.formattedCostLabel}</strong></td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;
  }
}
