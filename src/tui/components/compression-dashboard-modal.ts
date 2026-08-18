/**
 * compression-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for visualizing Semantic Context Compression,
 * trajectory summaries, token budget allocations, and SLA health audits (Phase 86 / ADR-038).
 */

import type {
  CompressedTurnSummary,
  CompressionHealthAuditReport,
  CompressionMetricsReport,
  CompressionStateSnapshot,
} from "../../core/contracts/compression.contracts.js";
import { BroccoliCompressionSubstrate } from "../../sessions/extensions/compaction/broccoli-compression-substrate.js";
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export type CompressionDashboardViewMode = "summaries" | "budget" | "metrics" | "health" | "raw";

export class CompressionDashboardModal {
  private readonly substrate: BroccoliCompressionSubstrate;
  private viewMode: CompressionDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliCompressionSubstrate) {
    this.substrate = substrate;
    this.viewMode = "summaries";
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

  public setViewMode(mode: CompressionDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): CompressionDashboardViewMode {
    const modes: CompressionDashboardViewMode[] = ["summaries", "budget", "metrics", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: CompressionDashboardViewMode } {
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
        this.setViewMode("summaries");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("budget");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("metrics");
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
    lines.push("║           📦 CONTEXT COMPRESSION & COMPACTOR DASHBOARD MODAL               ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "summaries", label: "[1] Summaries" },
      { id: "budget", label: "[2] Budget" },
      { id: "metrics", label: "[3] Telemetry" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;33m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    switch (this.viewMode) {
      case "summaries": {
        const list = this.substrate.listSummaries(15);
        if (list.length === 0) {
          lines.push("║  No compacted trajectory summaries in substrate.                          ║");
        } else {
          for (let i = 0; i < list.length; i++) {
            const s = list[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const saved = Math.max(0, s.originalTokens - s.compressedTokens);
            const line = `${prefix}${s.id.padEnd(14)} │ #${s.sourceTurnStart}-#${s.sourceTurnEnd} │ ${s.originalTokens}t -> ${s.compressedTokens}t │ \x1b[32m+${saved} saved\x1b[0m`;
            lines.push(`║ ${line.padEnd(74)} ║`);
          }
        }
        break;
      }

      case "budget": {
        lines.push("║  Head-Tail Token Budget Allocations:                                       ║");
        lines.push("║    • Head Anchors (System/Persona):  15% Context Reservation               ║");
        lines.push("║    • Middle Active History:          Compacted into Structured Blocks      ║");
        lines.push("║    • Tail Working Memory:            25% Context Reservation               ║");
        lines.push("║    • Summary Budget Window:           5% Max Context Limit                 ║");
        break;
      }

      case "metrics": {
        const metrics = this.substrate.getMetrics();
        lines.push(`║  Total Summaries:       ${String(metrics.totalSummaries).padEnd(50)} ║`);
        lines.push(`║  Compacted Turns:       ${String(metrics.totalCompactedTurns).padEnd(50)} ║`);
        lines.push(`║  Tokens Saved:          \x1b[32m${metrics.totalTokensSaved.toLocaleString()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Overall Savings Rate:  ${metrics.overallSavingsPercentage}%`.padEnd(76) + " ║");
        lines.push(`║  Avg Original:          ${metrics.avgOriginalTokens} tokens`.padEnd(76) + " ║");
        lines.push(`║  Avg Compressed:        ${metrics.avgCompressedTokens} tokens`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const health = this.substrate.auditHealth();
        const statusColor = health.healthStatus === "optimal" ? "\x1b[32m" : "\x1b[33m";
        lines.push(`║  Health Status:         ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Avg Compression Ratio: ${(health.avgCompressionRatio * 100).toFixed(0)}% of original size`.padEnd(76) + " ║");
        lines.push(`║  Overflow Risk Score:   ${(health.overflowRiskScore * 100).toFixed(0)}%`.padEnd(76) + " ║");
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
