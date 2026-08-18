/**
 * title-insights-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing session titles,
 * cognitive metrics, 7x24 activity heatmaps, and SLA health audits (Target #42 / Phase 109 / ADR-085).
 */

import type {
  ConversationInsightsReport,
  SessionTitleRecord,
  TitleInsightsHealthAuditReport,
  TitleInsightsMetricsReport,
  TitleInsightsWorkspaceSnapshot,
} from "../../core/contracts/title-insights.contracts.js";
import { BroccoliTitleInsightsSubstrate } from "../../sessions/extensions/title_insights/broccoli-title-insights-substrate.js";
import { DeterministicTitleGenerator } from "../../agents/extensions/title_insights/deterministic-title-generator.js";

export type TitleInsightsDashboardViewMode = "titles" | "overview" | "activity" | "health" | "raw";

export class TitleInsightsDashboardModal {
  private readonly substrate: BroccoliTitleInsightsSubstrate;
  private readonly titleGenerator: DeterministicTitleGenerator;
  private viewMode: TitleInsightsDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliTitleInsightsSubstrate, titleGenerator?: DeterministicTitleGenerator) {
    this.substrate = substrate;
    this.titleGenerator = titleGenerator || new DeterministicTitleGenerator();
    this.viewMode = "titles";
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

  public setViewMode(mode: TitleInsightsDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): TitleInsightsDashboardViewMode {
    const modes: TitleInsightsDashboardViewMode[] = ["titles", "overview", "activity", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: TitleInsightsDashboardViewMode } {
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
        this.setViewMode("titles");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("overview");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("activity");
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
    lines.push("║        🏷️ CONVERSATION TITLE & EPISTEMIC INSIGHTS MODAL                    ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "titles", label: "[1] Titles" },
      { id: "overview", label: "[2] Overview" },
      { id: "activity", label: "[3] Activity" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    switch (this.viewMode) {
      case "titles": {
        const list = this.substrate.listTitles();
        if (list.length === 0) {
          lines.push("║  No session titles generated yet.                                          ║");
        } else {
          for (let i = 0; i < list.length; i++) {
            const t = list[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[1m${t.sessionId.slice(0, 14)}...\x1b[0m │ ${t.title.slice(0, 32).padEnd(32)} │ \x1b[32m${t.provenance.toUpperCase()}\x1b[0m`;
            lines.push(`║ ${line.padEnd(78)} ║`);
          }
        }
        break;
      }

      case "overview": {
        const report = this.substrate.generateInsightsReport(30);
        lines.push(`║  Total Sessions:     ${report.overview.totalSessions}`.padEnd(76) + " ║");
        lines.push(`║  Total Messages:     ${report.overview.totalMessages}`.padEnd(76) + " ║");
        lines.push(`║  Total Tool Calls:   ${report.overview.totalToolCalls}`.padEnd(76) + " ║");
        lines.push(`║  Total Spend (USD):  $${report.overview.totalCostUsd.toFixed(4)}`.padEnd(76) + " ║");
        lines.push(`║  Cache Efficiency:   ${report.overview.cacheEfficiencyRate}%`.padEnd(76) + " ║");
        break;
      }

      case "activity": {
        const events = this.substrate.listActivityEvents();
        lines.push(`║  Total Activity Events: \x1b[1;36m${events.length}\x1b[0m`.padEnd(85) + " ║");
        for (const e of events.slice(-5)) {
          const line = `  [${new Date(e.timestamp).toISOString().slice(11, 19)}] ${e.eventType} (${e.platform}/${e.model})`;
          lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
        }
        break;
      }

      case "health": {
        const health = this.substrate.auditHealth();
        const statusColor = health.healthStatus === "critical_desync" ? "\x1b[31m" : "\x1b[32m";
        lines.push(`║  Health Status:      ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Titles:       \x1b[32m${health.totalTitles}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  LLM Upgraded:       ${health.llmTitlesCount}`.padEnd(76) + " ║");
        lines.push(`║  Instant Derived:    ${health.derivedTitlesCount}`.padEnd(76) + " ║");
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
