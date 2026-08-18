/**
 * computer-use-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for visualizing Virtual Display actions,
 * Set-of-Marks UI element trees, resolution metrics, and SLA health audits (Phase 88 / ADR-040).
 */

import type {
  ComputerActionResult,
  ComputerUseHealthAuditReport,
  ComputerUseMetricsReport,
  ComputerWorkspaceSnapshot,
  UiElement,
} from "../../core/contracts/computer-use.contracts.js";
import { BroccoliDisplaySubstrate } from "../../sessions/extensions/computer-use/broccoli-display-substrate.js";
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export type ComputerUseDashboardViewMode = "actions" | "elements" | "metrics" | "health" | "raw";

export class ComputerUseDashboardModal {
  private readonly substrate: BroccoliDisplaySubstrate;
  private viewMode: ComputerUseDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliDisplaySubstrate) {
    this.substrate = substrate;
    this.viewMode = "actions";
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

  public setViewMode(mode: ComputerUseDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): ComputerUseDashboardViewMode {
    const modes: ComputerUseDashboardViewMode[] = ["actions", "elements", "metrics", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: ComputerUseDashboardViewMode } {
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
        this.setViewMode("actions");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("elements");
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
    lines.push("║           🖥️ VIRTUAL DISPLAY & COMPUTER USE DASHBOARD MODAL                 ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "actions", label: "[1] Actions" },
      { id: "elements", label: "[2] Elements" },
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
      case "actions": {
        const list = this.substrate.listActions(15);
        if (list.length === 0) {
          lines.push("║  No display actions recorded in substrate.                                 ║");
        } else {
          for (let i = 0; i < list.length; i++) {
            const act = list[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const statusColor = act.success ? "\x1b[32m" : "\x1b[31m";
            const line = `${prefix}${act.actionId ?? "act_none"} │ ${act.action.padEnd(12)} │ ${statusColor}${act.success ? "SUCCESS" : "FAILURE"}\x1b[0m │ Frame #${act.frame.frameIndex} │ ${act.durationMs} ms`;
            lines.push(`║ ${line.padEnd(74)} ║`);
          }
        }
        break;
      }

      case "elements": {
        const snap = this.substrate.exportSnapshot();
        const actions = this.substrate.listActions(1);
        const elements = actions.length > 0 ? actions[0].frame.elements : [];
        if (elements.length === 0) {
          lines.push(`║  Window Count: ${snap.windowCount} │ Element Density: ${snap.elementCount} elements`.padEnd(76) + " ║");
        } else {
          for (const el of elements.slice(0, 8)) {
            lines.push(`║  [#${el.id}] ${el.role.padEnd(8)}: ${el.label.slice(0, 30)} (${el.bounds.x},${el.bounds.y})`.padEnd(76) + " ║");
          }
        }
        break;
      }

      case "metrics": {
        const metrics = this.substrate.getMetrics();
        lines.push(`║  Total Actions:         ${String(metrics.totalActions).padEnd(50)} ║`);
        lines.push(`║  Successful:            ${String(metrics.successfulActions).padEnd(50)} ║`);
        lines.push(`║  Failed:                ${String(metrics.failedActions).padEnd(50)} ║`);
        lines.push(`║  Overall Success Rate:  ${(metrics.overallSuccessRate * 100).toFixed(0)}%`.padEnd(76) + " ║");
        lines.push(`║  Resolution:            ${metrics.displayResolution.padEnd(50)} ║`);
        lines.push(`║  Avg Latency:           ${metrics.avgActionLatencyMs} ms (p95: ${metrics.p95ActionLatencyMs} ms)`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const health = this.substrate.auditHealth();
        const statusColor = health.healthStatus === "optimal" ? "\x1b[32m" : "\x1b[33m";
        lines.push(`║  Health Status:         ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Success Rate:          ${(health.overallSuccessRate * 100).toFixed(0)}%`.padEnd(76) + " ║");
        lines.push(`║  Window Count:          ${String(health.windowCount).padEnd(50)} ║`);
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
