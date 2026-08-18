/**
 * turn-retry-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for visualizing Turn Retry State Machines,
 * one-shot recovery guards, adaptive restart signals, and SLA health audits (Phase 131 / ADR-107).
 */

import type {
  TurnRetryHealthAuditReport,
  TurnRetryMetricsReport,
  TurnRetryStateDescriptor,
  TurnRetryWorkspaceSnapshot,
} from "../../core/contracts/turn-retry.contracts.js";
import { BroccoliTurnRetrySubstrate } from "../../sessions/extensions/turn_retry/broccoli-turn-retry-substrate.js";
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export type TurnRetryDashboardViewMode = "states" | "guards" | "metrics" | "health" | "raw";

export class TurnRetryDashboardModal {
  private readonly substrate: BroccoliTurnRetrySubstrate;
  private viewMode: TurnRetryDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliTurnRetrySubstrate) {
    this.substrate = substrate;
    this.viewMode = "states";
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

  public setViewMode(mode: TurnRetryDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): TurnRetryDashboardViewMode {
    const modes: TurnRetryDashboardViewMode[] = ["states", "guards", "metrics", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: TurnRetryDashboardViewMode } {
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
        this.setViewMode("states");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("guards");
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
    lines.push("║           🔄 TURN RETRY & ONE-SHOT RECOVERY DASHBOARD MODAL                 ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "states", label: "[1] States" },
      { id: "guards", label: "[2] Guards" },
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
      case "states": {
        const states = this.substrate.listStates(15);
        if (states.length === 0) {
          lines.push("║  No turn retry states registered in substrate.                            ║");
        } else {
          for (let i = 0; i < states.length; i++) {
            const state = states[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const statusColor = state.status === "recovered" ? "\x1b[32m" : (state.status === "exhausted" ? "\x1b[31m" : "\x1b[33m");
            const line = `${prefix}${state.stateId.padEnd(16)} │ Turn #${String(state.turnIndex).padEnd(4)} │ ${statusColor}${state.status.toUpperCase().padEnd(10)}\x1b[0m │ ${state.errorCategory ?? "general"}`;
            lines.push(`║ ${line.padEnd(74)} ║`);
          }
        }
        break;
      }

      case "guards": {
        const states = this.substrate.listStates(5);
        if (states.length === 0) {
          lines.push("║  No active guard states.                                                   ║");
        } else {
          for (const s of states) {
            const activeGuards = Object.entries(s.guards).filter(([_, v]) => v).map(([k]) => k);
            lines.push(`║  ⚡ ${s.stateId} (Turn #${s.turnIndex}): ${activeGuards.length > 0 ? activeGuards.join(", ") : "no guards tripped"}`.slice(0, 76).padEnd(76) + " ║");
          }
        }
        break;
      }

      case "metrics": {
        const metrics = this.substrate.getTurnRetryMetrics();
        lines.push(`║  Total States:          ${String(metrics.totalStates).padEnd(50)} ║`);
        lines.push(`║  Recovered Turns:       ${String(metrics.recoveredCount).padEnd(50)} ║`);
        lines.push(`║  Exhausted Turns:       ${String(metrics.exhaustedCount).padEnd(50)} ║`);
        lines.push(`║  Recovery Success Rate: ${(metrics.recoverySuccessRate * 100).toFixed(0)}%`.padEnd(76) + " ║");
        lines.push(`║  Guards Triggered:      ${String(metrics.totalGuardsTriggered).padEnd(50)} ║`);
        lines.push(`║  Signals Emitted:       ${String(metrics.totalSignalsEmitted).padEnd(50)} ║`);
        break;
      }

      case "health": {
        const health = this.substrate.auditTurnRetryHealth();
        const statusColor = health.healthStatus === "optimal" ? "\x1b[32m" : "\x1b[33m";
        lines.push(`║  Health Status:         ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Recovery Rate:         ${(health.recoverySuccessRate * 100).toFixed(0)}%`.padEnd(76) + " ║");
        lines.push(`║  Guard Exhaustion:      ${(health.guardExhaustionIndex * 100).toFixed(1)}%`.padEnd(76) + " ║");
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
