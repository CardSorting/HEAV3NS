/**
 * wallet-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for visualizing Autonomous Agent Wallet portfolios,
 * dangerous token allowances, transaction simulations, and SLA health audits (Phase 91/93 / ADR-123 / ADR-043).
 */

import type {
  WalletHealthAuditReport,
  WalletMetricsReport,
  WalletPortfolio,
  WalletSubstrateSnapshot,
} from "../../core/contracts/wallet.contracts.js";
import { BroccoliWalletSubstrate } from "../../sessions/extensions/wallet/broccoli-wallet-substrate.js";
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export type WalletDashboardViewMode = "portfolios" | "allowances" | "simulations" | "health" | "raw";

export class WalletDashboardModal {
  private readonly substrate: BroccoliWalletSubstrate;
  private viewMode: WalletDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliWalletSubstrate) {
    this.substrate = substrate;
    this.viewMode = "portfolios";
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

  public setViewMode(mode: WalletDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): WalletDashboardViewMode {
    const modes: WalletDashboardViewMode[] = ["portfolios", "allowances", "simulations", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: WalletDashboardViewMode } {
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
        this.setViewMode("portfolios");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("allowances");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("simulations");
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
    lines.push("║           👛 AUTONOMOUS AGENT WALLET & DEFI DASHBOARD MODAL                ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "portfolios", label: "[1] Portfolios" },
      { id: "allowances", label: "[2] Allowances" },
      { id: "simulations", label: "[3] Simulations" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    switch (this.viewMode) {
      case "portfolios": {
        const list = this.substrate.listPortfolios();
        if (list.length === 0) {
          lines.push("║  No tracked wallet portfolios in substrate.                                ║");
        } else {
          for (let i = 0; i < list.length; i++) {
            const p = list[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}${p.chain.padEnd(8)} │ ${p.address.slice(0, 14)}... │ \x1b[32m$${p.totalPortfolioValueUsd.toFixed(2)}\x1b[0m │ ${p.tokens.length} tokens`;
            lines.push(`║ ${line.padEnd(74)} ║`);
          }
        }
        break;
      }

      case "allowances": {
        const list = this.substrate.exportSnapshot().allowances;
        if (list.length === 0) {
          lines.push("║  No token allowances recorded.                                             ║");
        } else {
          for (let i = 0; i < list.length; i++) {
            const a = list[i];
            const riskColor = a.riskTier === "CRITICAL_REVOKE_RECOMMENDED" ? "\x1b[31m" : "\x1b[32m";
            const line = `  ${a.tokenSymbol.padEnd(6)} -> ${a.spenderAddress.slice(0, 12)}... │ ${riskColor}${a.riskTier}\x1b[0m`;
            lines.push(`║ ${line.padEnd(80)} ║`);
          }
        }
        break;
      }

      case "simulations": {
        const list = this.substrate.listSimulations(10);
        if (list.length === 0) {
          lines.push("║  No transaction simulations executed.                                      ║");
        } else {
          for (let i = 0; i < list.length; i++) {
            const s = list[i];
            const statusColor = s.success ? "\x1b[32m" : "\x1b[31m";
            const line = `  ${s.simulationId.slice(0, 16)} │ ${s.chain.padEnd(8)} │ ${statusColor}${s.success ? "SUCCESS" : "FAILED"}\x1b[0m │ \x1b[33m${s.riskTier}\x1b[0m`;
            lines.push(`║ ${line.padEnd(80)} ║`);
          }
        }
        break;
      }

      case "health": {
        const health = this.substrate.auditHealth();
        const statusColor = health.healthStatus === "critical_risk" ? "\x1b[31m" : "\x1b[32m";
        lines.push(`║  Health Status:           ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Portfolio Value:   \x1b[32m$${health.totalPortfolioValueUsd.toFixed(2)}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Simulation Success Rate: ${health.simulationSuccessRate}%`.padEnd(76) + " ║");
        lines.push(`║  Critical Allowances:     ${health.criticalAllowancesCount}`.padEnd(76) + " ║");
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
