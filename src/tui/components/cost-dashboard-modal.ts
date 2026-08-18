import type {
  CostHealthAuditReport,
  CostMetricsReport,
  TokenUsageLedgerEntry,
} from "../../core/contracts/cost-governance.contracts.js";
import { BroccoliCostSubstrate } from "../../sessions/extensions/cost/broccoli-cost-substrate.js";
import { DeterministicCostGovernor } from "../../tooling/extensions/cost/deterministic-cost-governor.js";

export type CostDashboardViewMode = "overview" | "ledger" | "pricing" | "burnrate" | "health" | "metrics";

/**
 * CostDashboardModal.
 * Interactive Terminal TUI Modal Component for Deterministic Model Pricing, Token Accounting & Cost Governance (ADR-042).
 *
 * Features:
 * - Executive KPI Ribbon
 * - Filter Presets (1: All, 2: Cached, 3: Premium >$0.05, 4: Economy <$0.005)
 * - 6 View Modes (Overview, Ledger, Pricing, Burn Rate, Health, Metrics)
 * - Actions: Clear Turn Entry, View Pricing, Filter Cycling
 */
export class CostDashboardModal {
  private readonly substrate: BroccoliCostSubstrate;
  private readonly governor: DeterministicCostGovernor;
  private readonly onClose: () => void;

  private selectedIndex = 0;
  private filterMode: "all" | "cached" | "premium" | "economy" = "all";
  private viewMode: CostDashboardViewMode = "overview";
  private showHelp = false;

  constructor(
    substrate: BroccoliCostSubstrate,
    governor?: DeterministicCostGovernor,
    onClose?: () => void
  ) {
    this.substrate = substrate;
    this.governor = governor ?? new DeterministicCostGovernor();
    this.onClose = onClose ?? (() => {});
  }

  public render(maxWidth = 100): readonly string[] {
    const lines: string[] = [];
    const width = Math.max(60, maxWidth);
    const border = "─".repeat(width - 2);

    const metrics = this.substrate.getCostMetrics();
    const entries = this.getFilteredEntries();

    // 1. Header
    lines.push(`┌${border}┐`);
    lines.push(this.formatLine(` 💰 LUMI COST GOVERNANCE & TOKEN ACCOUNTING (ADR-042) `, width));
    lines.push(`├${border}┤`);

    // 2. Executive KPI Ribbon
    const kpiText = ` Spend: ${metrics.formattedTotalCostLabel} │ Tokens: ${metrics.totalTokens.toLocaleString()} │ Turns: ${metrics.totalTurns} │ Cached: ${metrics.totalCachedPromptTokens.toLocaleString()} │ HardCap: ${metrics.hardCapBreached ? "⛔ BREACHED" : "🟢 OK"}`;
    lines.push(this.formatLine(kpiText, width));
    lines.push(`├${border}┤`);

    // 3. View Mode Bar
    const viewTabs = [
      this.viewMode === "overview" ? "[1: 💰 Overview]" : " 1: Overview ",
      this.viewMode === "ledger" ? "[2: 📜 Ledger]" : " 2: Ledger ",
      this.viewMode === "pricing" ? "[3: 🏷️ Pricing]" : " 3: Pricing ",
      this.viewMode === "burnrate" ? "[4: 🔥 BurnRate]" : " 4: BurnRate ",
      this.viewMode === "health" ? "[5: 🩺 Health]" : " 5: Health ",
      this.viewMode === "metrics" ? "[6: 📊 Metrics]" : " 6: Metrics ",
    ].join(" │ ");
    lines.push(this.formatLine(` ${viewTabs}`, width));
    lines.push(`├${border}┤`);

    // 4. Content Area
    switch (this.viewMode) {
      case "overview":
        this.renderOverviewView(lines, metrics, width);
        break;
      case "ledger":
        this.renderLedgerView(lines, entries, width);
        break;
      case "pricing":
        this.renderPricingView(lines, width);
        break;
      case "burnrate":
        this.renderBurnRateView(lines, metrics, width);
        break;
      case "health":
        this.renderHealthView(lines, width);
        break;
      case "metrics":
        this.renderMetricsView(lines, metrics, width);
        break;
    }

    lines.push(`├${border}┤`);

    // 5. Footer & Keybindings
    if (this.showHelp) {
      lines.push(this.formatLine(` [j/k] Navigate  [x] Clear Entry  [1-4] Filter  [v] View Mode  [q] Close`, width));
    } else {
      lines.push(this.formatLine(` [v] View (${this.viewMode})  [x] Clear Entry  [1-4] Filters  [?] Help  [q] Close`, width));
    }
    lines.push(`└${border}┘`);

    return lines;
  }

  private renderOverviewView(lines: string[], metrics: CostMetricsReport, width: number): void {
    lines.push(this.formatLine(` ── Cost & Token Governance Architecture:`, width));
    lines.push(this.formatLine(`  • Cumulative Session Spend: ${metrics.formattedTotalCostLabel} (${metrics.totalCostMicroCents.toLocaleString()} micro-cents)`, width));
    lines.push(this.formatLine(`  • Total Tokens Consumed: ${metrics.totalTokens.toLocaleString()} (Prompt: ${metrics.totalPromptTokens.toLocaleString()}, Completion: ${metrics.totalCompletionTokens.toLocaleString()})`, width));
    lines.push(this.formatLine(`  • Prompt Cache Savings: ${metrics.totalCachedPromptTokens.toLocaleString()} cached tokens reused`, width));
    lines.push(this.formatLine(`  • Average Burn Rate: $${metrics.burnRatePerTurnUsd.toFixed(4)} per turn across ${metrics.totalTurns} turn(s)`, width));
    lines.push(this.formatLine(`  • Integer Arithmetic Invariant: Zero float drift guaranteed (< 1 micro-cent error)`, width));
  }

  private renderLedgerView(lines: string[], entries: readonly TokenUsageLedgerEntry[], width: number): void {
    if (entries.length === 0) {
      lines.push(this.formatLine(" (No turn usage records in this view)", width));
      return;
    }

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const isSelected = i === this.selectedIndex;
      const marker = isSelected ? "▶" : " ";
      const modelStr = e.modelId.slice(0, 18).padEnd(18);
      const tokenStr = `in:${e.promptTokens} out:${e.completionTokens}${e.cachedPromptTokens > 0 ? ` (cached:${e.cachedPromptTokens})` : ""}`;
      const row = `${marker} #${String(e.turnIndex).padEnd(3)} ${modelStr} │ ${e.formattedCostLabel.padEnd(10)} │ ${tokenStr}`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderPricingView(lines: string[], width: number): void {
    lines.push(this.formatLine(` ── Model Pricing Catalog (ADR-042):`, width));
    const models = ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet", "deepseek-chat", "hermes-3-llama-3.1-405b"];
    for (const m of models) {
      const tier = this.governor.getTier(m);
      const row = ` • ${tier.modelId.padEnd(26)} [$${tier.promptCostPerMillion.toFixed(2)}/M in, $${tier.completionCostPerMillion.toFixed(2)}/M out]`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderBurnRateView(lines: string[], metrics: CostMetricsReport, width: number): void {
    lines.push(this.formatLine(` ── Token Burn Rate & Spend Velocity:`, width));
    lines.push(this.formatLine(`  • Average Cost Per Turn: $${metrics.burnRatePerTurnUsd.toFixed(4)}`, width));
    lines.push(this.formatLine(`  • Model Distribution:`, width));
    for (const [model, count] of Object.entries(metrics.modelUsageCounts)) {
      lines.push(this.formatLine(`    - ${model}: ${count} turn(s)`, width));
    }
  }

  private renderHealthView(lines: string[], width: number): void {
    const audit = this.substrate.auditCostHealth();
    lines.push(this.formatLine(` Health Status: ${audit.healthStatus.toUpperCase()} │ Top Spender: ${audit.topModelId}`, width));
    lines.push(this.formatLine(` Estimated Burn Rate: $${audit.burnRateUsdPerHour.toFixed(4)}/hour`, width));
    lines.push(this.formatLine(` ── Diagnostic Recommendations:`, width));
    for (const r of audit.recommendations) {
      lines.push(this.formatLine(`  • ${r}`, width));
    }
  }

  private renderMetricsView(lines: string[], metrics: CostMetricsReport, width: number): void {
    lines.push(this.formatLine(` Cumulative Spend: ${metrics.formattedTotalCostLabel} (${metrics.totalCostMicroCents} µ-cents)`, width));
    lines.push(this.formatLine(` Total Tokens: ${metrics.totalTokens.toLocaleString()} │ Prompt: ${metrics.totalPromptTokens.toLocaleString()} │ Compl: ${metrics.totalCompletionTokens.toLocaleString()}`, width));
    lines.push(this.formatLine(` Cached Prompt Tokens: ${metrics.totalCachedPromptTokens.toLocaleString()} (${metrics.totalPromptTokens > 0 ? ((metrics.totalCachedPromptTokens / metrics.totalPromptTokens) * 100).toFixed(1) : "0"}% cache hit)`, width));
  }

  public handleInput(key: string): void {
    const entries = this.getFilteredEntries();

    switch (key) {
      case "j":
      case "down":
        if (this.selectedIndex < entries.length - 1) {
          this.selectedIndex++;
        }
        break;

      case "k":
      case "up":
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
        }
        break;

      case "1":
        this.filterMode = "all";
        this.selectedIndex = 0;
        break;
      case "2":
        this.filterMode = "cached";
        this.selectedIndex = 0;
        break;
      case "3":
        this.filterMode = "premium";
        this.selectedIndex = 0;
        break;
      case "4":
        this.filterMode = "economy";
        this.selectedIndex = 0;
        break;

      case "v": {
        const modes: CostDashboardViewMode[] = ["overview", "ledger", "pricing", "burnrate", "health", "metrics"];
        const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
        this.viewMode = modes[nextIdx];
        break;
      }

      case "x": {
        const currentEntry = entries[this.selectedIndex];
        if (currentEntry) {
          this.substrate.bulkClearLedger([currentEntry.turnIndex]);
        }
        break;
      }

      case "?":
        this.showHelp = !this.showHelp;
        break;

      case "q":
      case "escape":
        this.onClose();
        break;
    }
  }

  private getFilteredEntries(): readonly TokenUsageLedgerEntry[] {
    let list = this.substrate.listLedger(100);
    if (this.filterMode === "cached") {
      list = list.filter((e) => e.cachedPromptTokens > 0);
    } else if (this.filterMode === "premium") {
      list = list.filter((e) => e.estimatedCostUsd >= 0.05);
    } else if (this.filterMode === "economy") {
      list = list.filter((e) => e.estimatedCostUsd < 0.005);
    }
    return list;
  }

  private formatLine(content: string, width: number): string {
    const cleanContent = content.length > width - 4 ? content.slice(0, width - 4) : content;
    const padding = Math.max(0, width - 2 - cleanContent.length);
    return `│${cleanContent}${" ".repeat(padding)}│`;
  }
}
