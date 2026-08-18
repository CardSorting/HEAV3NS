/**
 * tool-disclosure-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for inspecting registered tool schemas,
 * dynamic disclosure tiers, search catalog, and health posture (Phase 91 / ADR-043 / Target #83).
 */

import type {
  ToolDisclosureHealthAuditReport,
  ToolDisclosureMetricsReport,
  DeferredToolDefinition,
} from "../../core/contracts/tool-disclosure.contracts.js";
import { BroccoliDisclosureSubstrate } from "../../sessions/extensions/disclosure/broccoli-disclosure-substrate.js";
import { DeterministicToolDiscloser } from "../../tooling/extensions/disclosure/deterministic-tool-discloser.js";

export type ToolDisclosureDashboardViewMode = "overview" | "tools" | "config" | "health" | "raw";

export class ToolDisclosureDashboardModal {
  private readonly substrate: BroccoliDisclosureSubstrate;
  private readonly discloser: DeterministicToolDiscloser;
  private viewMode: ToolDisclosureDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliDisclosureSubstrate, discloser?: DeterministicToolDiscloser) {
    this.substrate = substrate;
    this.discloser = discloser || new DeterministicToolDiscloser();
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

  public setViewMode(mode: ToolDisclosureDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): ToolDisclosureDashboardViewMode {
    const modes: ToolDisclosureDashboardViewMode[] = ["overview", "tools", "config", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: ToolDisclosureDashboardViewMode } {
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
        this.setViewMode("tools");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("config");
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
    lines.push("║        🔍 PROGRESSIVE TOOL DISCLOSURE & DYNAMIC SCHEMA MODAL                ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "tools", label: "[2] Tools" },
      { id: "config", label: "[3] Config" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const tools = this.substrate.listTools();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();
    const config = this.substrate.getConfig();
    const activated = this.substrate.getActivatedTools();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Registered Tools:      \x1b[1m${metrics.totalRegisteredTools}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Activated Tools:       \x1b[32m${metrics.totalActivatedTools}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Tokens Saved (~est):   \x1b[35m~${metrics.estimatedTokensSaved}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Searches Performed:    \x1b[36m${metrics.totalSearchesPerformed}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Active Tier:           \x1b[1;33m${this.substrate.getActiveTier().toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:        ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        break;
      }

      case "tools": {
        if (tools.length === 0) {
          lines.push("║  No tools registered in catalog.                                          ║");
        } else {
          for (let i = 0; i < Math.min(tools.length, 6); i++) {
            const t = tools[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const isAct = activated.includes(t.name);
            const status = isAct ? "\x1b[32m[ACT]\x1b[0m" : "\x1b[90m[DEF]\x1b[0m";
            const line = `${prefix}${status} \x1b[1m${t.name}\x1b[0m (${t.namespace}) - ${t.description.slice(0, 32)}`;
            lines.push(`║ ${line.slice(0, 72).padEnd(80)} ║`);
          }
        }
        break;
      }

      case "config": {
        lines.push(`║  Default Tier:            ${config.defaultTier}`.padEnd(76) + " ║");
        lines.push(`║  Eager Token Budget:      ${config.eagerTokenBudget} tokens`.padEnd(76) + " ║");
        lines.push(`║  Max Search Results:      ${config.maxSearchResults}`.padEnd(76) + " ║");
        lines.push(`║  Auto-Activate On Search: ${config.autoActivateOnSearch ? '\x1b[32menabled\x1b[0m' : '\x1b[33mdisabled\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Active Tier:             ${this.substrate.getActiveTier()}`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "critical" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:           ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Registered:        ${health.totalRegistered}`.padEnd(76) + " ║");
        lines.push(`║  Eager Tools:             ${health.eagerCount}`.padEnd(76) + " ║");
        lines.push(`║  Deferred Tools:          ${health.deferredCount}`.padEnd(76) + " ║");
        lines.push(`║  Activated Tools:         ${health.activatedCount}`.padEnd(76) + " ║");
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
