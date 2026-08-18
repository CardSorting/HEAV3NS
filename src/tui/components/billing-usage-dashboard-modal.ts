/**
 * billing-usage-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing billing accounts,
 * dual-tier credit meters, transaction ledgers, and SLA health audits (Phase 132 / ADR-108 / Target #65).
 */

import type {
  BillingAccountInfo,
  BillingTransaction,
  BillingUsageHealthAuditReport,
  BillingUsageMetricsReport,
  BillingUsageWorkspaceSnapshot,
  UsageModelDescriptor,
} from "../../core/contracts/billing-usage.contracts.js";
import { BroccoliBillingUsageSubstrate } from "../../sessions/extensions/billing_usage/broccoli-billing-usage-substrate.js";
import { DeterministicBillingUsageEngine } from "../../agents/extensions/billing_usage/deterministic-billing-usage-engine.js";

export type BillingUsageDashboardViewMode = "overview" | "transactions" | "bars" | "health" | "raw";

export class BillingUsageDashboardModal {
  private readonly substrate: BroccoliBillingUsageSubstrate;
  private readonly engine: DeterministicBillingUsageEngine;
  private viewMode: BillingUsageDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliBillingUsageSubstrate, engine?: DeterministicBillingUsageEngine) {
    this.substrate = substrate;
    this.engine = engine || new DeterministicBillingUsageEngine();
    this.viewMode = "overview";
    this.selectedIndex = 0;
    this.isVisible = false;
  }

  public open(): void {
    this.isVisible = true;
    this.selectedIndex = 0;
  }

  public close(): void {
    this.isVisible = false;
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  public setViewMode(mode: BillingUsageDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): BillingUsageDashboardViewMode {
    const modes: BillingUsageDashboardViewMode[] = ["overview", "transactions", "bars", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: BillingUsageDashboardViewMode } {
    if (!this.isVisible) return { action: "none", viewMode: this.viewMode };

    switch (key.toLowerCase()) {
      case "q":
      case "escape":
        this.close();
        return { action: "close", viewMode: this.viewMode };

      case "\t":
      case "tab":
        this.cycleViewMode();
        return { action: "render", viewMode: this.viewMode };

      case "1":
        this.setViewMode("overview");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("transactions");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("bars");
        return { action: "render", viewMode: this.viewMode };

      case "4":
        this.setViewMode("health");
        return { action: "render", viewMode: this.viewMode };

      case "5":
        this.setViewMode("raw");
        return { action: "render", viewMode: this.viewMode };

      case "j":
      case "down":
        this.selectedIndex = Math.min(this.selectedIndex + 1, 100);
        return { action: "render", viewMode: this.viewMode };

      case "k":
      case "up":
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        return { action: "render", viewMode: this.viewMode };

      default:
        return { action: "none", viewMode: this.viewMode };
    }
  }

  public render(): string {
    if (!this.isVisible) return "";

    const lines: string[] = [];
    lines.push("╔════════════════════════════════════════════════════════════════════════════╗");
    lines.push("║        💳 BILLING USAGE & TOKEN BAR TELEMETRY MODAL                        ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "transactions", label: "[2] Ledger" },
      { id: "bars", label: "[3] Usage Bars" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const desc = this.substrate.getUsageDescriptor();
    const config = this.substrate.getConfig();

    switch (this.viewMode) {
      case "overview": {
        const metrics = this.substrate.getMetrics();
        lines.push(`║  Account ID:         \x1b[1m${this.substrate.getAccountInfo().accountId}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Account Status:     \x1b[32m${desc.status.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Spendable:    \x1b[1;36m$${desc.totalSpendableUsd.toFixed(2)}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Plan Remaining:     $${desc.planRemainingUsd.toFixed(2)} / $${desc.planAllowanceUsd.toFixed(2)}`.padEnd(76) + " ║");
        lines.push(`║  Top-Up Credits:     $${desc.topupRemainingUsd.toFixed(2)}`.padEnd(76) + " ║");
        lines.push(`║  Lifetime Spent:     $${metrics.totalSpentUsd.toFixed(2)}`.padEnd(76) + " ║");
        if (desc.renewalFormatted) {
          lines.push(`║  Renewal Date:       ${desc.renewalFormatted}`.padEnd(76) + " ║");
        }
        break;
      }

      case "transactions": {
        const txs = this.substrate.listTransactions(10);
        if (txs.length === 0) {
          lines.push("║  No billing transactions recorded yet.                                    ║");
        } else {
          for (let i = 0; i < txs.length; i++) {
            const t = txs[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[1m${t.id.slice(0, 14)}\x1b[0m │ \x1b[32m${t.type.toUpperCase()}\x1b[0m │ $${t.amountUsd.toFixed(4)} │ ${t.reason || "-"}`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "bars": {
        if (desc.planBar) {
          const bar = this.engine.renderAsciiBar(desc.planBar.fillFraction, 24);
          lines.push(`║  [Plan Allowance]    $${desc.planRemainingUsd.toFixed(2)} / $${desc.planAllowanceUsd.toFixed(2)}`.padEnd(76) + " ║");
          lines.push(`║  ${bar} (${desc.planBar.pctUsed}% used)`.padEnd(76) + " ║");
          lines.push("║                                                                            ║");
        }
        if (desc.topupBar) {
          const bar = this.engine.renderAsciiBar(desc.topupBar.fillFraction, 24);
          lines.push(`║  [Top-Up Balance]    $${desc.topupRemainingUsd.toFixed(2)} (Rolls over)`.padEnd(76) + " ║");
          lines.push(`║  ${bar}`.padEnd(76) + " ║");
        }
        break;
      }

      case "health": {
        const health = this.substrate.auditHealth();
        const statusColor = health.healthStatus === "exhausted_critical" ? "\x1b[31m" : health.healthStatus === "low_funds" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:      ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Spendable Funds:    \x1b[32m$${health.totalSpendableUsd.toFixed(2)}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Low Balance Alert:  ${health.isLowBalance ? "YES" : "NO"}`.padEnd(76) + " ║");
        lines.push(`║  Exhausted:          ${health.isExhausted ? "YES" : "NO"}`.padEnd(76) + " ║");
        for (const rec of health.recommendations) {
          lines.push(`║  💡 ${rec.slice(0, 68)}`.padEnd(76) + " ║");
        }
        break;
      }

      case "raw": {
        const snapshot = this.substrate.exportSnapshot();
        const rawJson = JSON.stringify(snapshot, null, 2).split("\n");
        for (const r of rawJson.slice(0, 10)) {
          lines.push(`║  ${r.slice(0, 72)}`.padEnd(76) + " ║");
        }
        break;
      }
    }

    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");
    lines.push("║ [Tab] Cycle View  [1-5] Direct View  [j/k] Navigate  [q/Esc] Close Modal   ║");
    lines.push("╚════════════════════════════════════════════════════════════════════════════╝");

    return lines.join("\n");
  }
}
