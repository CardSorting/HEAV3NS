/**
 * integrations-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing enterprise integrations,
 * connected provider endpoints, workflow recipes, and SLA health audits (Phase 96 / ADR-126 / Target #72).
 */

import type {
  IntegrationConnection,
  IntegrationRecipe,
  IntegrationsHealthAuditReport,
  IntegrationsMetricsReport,
} from "../../core/contracts/integrations.contracts.js";
import { BroccoliIntegrationsSubstrate } from "../../sessions/extensions/integrations/broccoli-integrations-substrate.js";
import { DeterministicIntegrationsEngine } from "../../tooling/extensions/integrations/deterministic-integrations-engine.js";

export type IntegrationsDashboardViewMode = "overview" | "connections" | "recipes" | "health" | "raw";

export class IntegrationsDashboardModal {
  private readonly substrate: BroccoliIntegrationsSubstrate;
  private readonly engine: DeterministicIntegrationsEngine;
  private viewMode: IntegrationsDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliIntegrationsSubstrate, engine?: DeterministicIntegrationsEngine) {
    this.substrate = substrate;
    this.engine = engine || new DeterministicIntegrationsEngine();
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

  public setViewMode(mode: IntegrationsDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): IntegrationsDashboardViewMode {
    const modes: IntegrationsDashboardViewMode[] = ["overview", "connections", "recipes", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: IntegrationsDashboardViewMode } {
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
        this.setViewMode("connections");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("recipes");
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
    lines.push("║        🔌 ENTERPRISE INTEGRATIONS HUB & RECIPES MODAL                      ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "connections", label: "[2] Services" },
      { id: "recipes", label: "[3] Recipes" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const connections = this.substrate.listConnections();
    const recipes = this.substrate.listRecipes();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.overallStatus === "optimal" ? "\x1b[32m" : health.overallStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Connected Services:     \x1b[1m${health.activeConnections}/${health.totalConnections}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:         ${healthColor}${health.overallStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Installed Recipes:      \x1b[36m${metrics.totalRecipes}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Executions:       \x1b[35m${metrics.totalExecutions}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Requests:         \x1b[32m${metrics.totalRequests}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Error Rate:             ${metrics.errorRatePercent}%`.padEnd(76) + " ║");
        break;
      }

      case "connections": {
        if (connections.length === 0) {
          lines.push("║  No provider connections active. Connect services to enable integrations. ║");
        } else {
          for (let i = 0; i < Math.min(connections.length, 6); i++) {
            const c = connections[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const statusStr = c.isConnected ? "\x1b[32mON\x1b[0m" : "\x1b[31mOFF\x1b[0m";
            const line = `${prefix}\x1b[1m${c.provider.toUpperCase()}\x1b[0m (${c.name.slice(0, 16)}) │ ${statusStr} │ ${c.totalRequests} reqs`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "recipes": {
        if (recipes.length === 0) {
          lines.push("║  No workflow recipes installed.                                            ║");
        } else {
          for (let i = 0; i < Math.min(recipes.length, 6); i++) {
            const r = recipes[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[1m${r.title.slice(0, 24)}\x1b[0m │ ${r.category} │ ${r.steps.length} steps │ ${r.executionCount} runs`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "health": {
        const statusColor = health.overallStatus === "critical" ? "\x1b[31m" : health.overallStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:          ${statusColor}${health.overallStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Active Connections:     ${health.activeConnections}`.padEnd(76) + " ║");
        lines.push(`║  Total Executions:       ${health.totalExecutions}`.padEnd(76) + " ║");
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
