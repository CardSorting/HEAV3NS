/**
 * clarify-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for visualizing the Clarification Subsystem,
 * pending inquiries, decision trees, resolution metrics, and SLA health audits (Phase 85 / ADR-037).
 */

import type {
  ClarifyHealthAuditReport,
  ClarifyInquiry,
  ClarifyMetricsReport,
  ClarifyWorkspaceSnapshot,
} from "../../core/contracts/clarify.contracts.js";
import { BroccoliClarifySubstrate } from "../../sessions/extensions/clarify/broccoli-clarify-substrate.js";
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export type ClarifyDashboardViewMode = "inquiries" | "trees" | "metrics" | "health" | "raw";

export class ClarifyDashboardModal {
  private readonly substrate: BroccoliClarifySubstrate;
  private viewMode: ClarifyDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliClarifySubstrate) {
    this.substrate = substrate;
    this.viewMode = "inquiries";
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

  public setViewMode(mode: ClarifyDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): ClarifyDashboardViewMode {
    const modes: ClarifyDashboardViewMode[] = ["inquiries", "trees", "metrics", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: ClarifyDashboardViewMode } {
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
        this.setViewMode("inquiries");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("trees");
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
    lines.push("║           🔍 CLARIFY & INTENT DISAMBIGUATION DASHBOARD MODAL               ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "inquiries", label: "[1] Inquiries" },
      { id: "trees", label: "[2] Decision Trees" },
      { id: "metrics", label: "[3] Telemetry" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    switch (this.viewMode) {
      case "inquiries": {
        const inquiries = this.substrate.listInquiries(15);
        if (inquiries.length === 0) {
          lines.push("║  No inquiries registered in substrate.                                     ║");
        } else {
          for (let i = 0; i < inquiries.length; i++) {
            const inq = inquiries[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const statusColor = inq.status === "pending" ? "\x1b[33m" : "\x1b[32m";
            const line = `${prefix}${inq.id.padEnd(12)} │ ${statusColor}${inq.status.padEnd(10)}\x1b[0m │ ${inq.priority.padEnd(8)} │ ${inq.question.slice(0, 32)}`;
            lines.push(`║ ${line.padEnd(74)} ║`);
          }
        }
        break;
      }

      case "trees": {
        const trees = this.substrate.listDecisionTrees();
        if (trees.length === 0) {
          lines.push("║  No decision trees active.                                                 ║");
        } else {
          for (const tree of trees) {
            lines.push(`║  🌲 ${tree.title} (${tree.treeId}) - Path: ${tree.activePath.length} steps`.padEnd(76) + " ║");
          }
        }
        break;
      }

      case "metrics": {
        const metrics = this.substrate.getClarifyMetrics();
        lines.push(`║  Total Inquiries:       ${String(metrics.totalInquiries).padEnd(50)} ║`);
        lines.push(`║  Pending Inquiries:     ${String(metrics.pendingInquiries).padEnd(50)} ║`);
        lines.push(`║  Resolved Inquiries:    ${String(metrics.resolvedInquiries).padEnd(50)} ║`);
        lines.push(`║  Auto-Resolved:         ${String(metrics.autoResolvedInquiries).padEnd(50)} ║`);
        lines.push(`║  Decision Trees:        ${String(metrics.decisionTreeCount).padEnd(50)} ║`);
        lines.push(`║  Avg Resolution Latency: ${metrics.avgResolutionLatencyMs} ms`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const health = this.substrate.auditClarifyHealth();
        const statusColor = health.healthStatus === "optimal" ? "\x1b[32m" : "\x1b[33m";
        lines.push(`║  Health Status:         ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Blocker Count:         ${String(health.blockerCount).padEnd(50)} ║`);
        lines.push(`║  Ambiguity Index:       ${String(health.ambiguityIndex).padEnd(50)} ║`);
        lines.push(`║  Auto-Resolved Rate:    ${(health.autoResolvedRate * 100).toFixed(0)}%`.padEnd(76) + " ║");
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
