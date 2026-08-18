/**
 * thread-context-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing async thread contexts,
 * execution dispatch audit trails, security callback inheritance, and SLA health (Phase 133 / ADR-109 / Target #66).
 */

import type {
  AsyncTurnContextDescriptor,
  ExecutionDispatchEvent,
  ThreadContextHealthAuditReport,
  ThreadContextMetricsReport,
  ThreadContextWorkspaceSnapshot,
} from "../../core/contracts/thread-context.contracts.js";
import { BroccoliThreadContextSubstrate } from "../../sessions/extensions/thread_context/broccoli-thread-context-substrate.js";
import { DeterministicThreadContextEngine } from "../../agents/extensions/thread_context/deterministic-thread-context-engine.js";

export type ThreadContextDashboardViewMode = "contexts" | "dispatches" | "security" | "health" | "raw";

export class ThreadContextDashboardModal {
  private readonly substrate: BroccoliThreadContextSubstrate;
  private readonly engine: DeterministicThreadContextEngine;
  private viewMode: ThreadContextDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliThreadContextSubstrate, engine?: DeterministicThreadContextEngine) {
    this.substrate = substrate;
    this.engine = engine || new DeterministicThreadContextEngine();
    this.viewMode = "contexts";
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

  public setViewMode(mode: ThreadContextDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): ThreadContextDashboardViewMode {
    const modes: ThreadContextDashboardViewMode[] = ["contexts", "dispatches", "security", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: ThreadContextDashboardViewMode } {
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
        this.setViewMode("contexts");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("dispatches");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("security");
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
    lines.push("║        🧵 ASYNC CONTEXT PROPAGATION & SECURITY MODAL                       ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "contexts", label: "[1] Contexts" },
      { id: "dispatches", label: "[2] Dispatches" },
      { id: "security", label: "[3] Security" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    switch (this.viewMode) {
      case "contexts": {
        const list = this.substrate.listContexts();
        if (list.length === 0) {
          lines.push("║  No active async thread contexts registered.                              ║");
        } else {
          for (let i = 0; i < list.length; i++) {
            const c = list[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[1m${c.contextId.slice(0, 16)}\x1b[0m │ \x1b[32m${c.platform.toUpperCase()}\x1b[0m │ Interactive: ${c.isInteractive ? "YES" : "NO"} │ Approvals: ${c.hasApprovalCallback ? "YES" : "NO"}`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "dispatches": {
        const dispatches = this.substrate.listDispatches();
        if (dispatches.length === 0) {
          lines.push("║  No execution dispatches recorded yet.                                    ║");
        } else {
          for (const d of dispatches.slice(-6)) {
            const line = `  [${new Date(d.timestamp).toISOString().slice(11, 19)}] ${d.action} (${d.contextId.slice(0, 12)})`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "security": {
        const metrics = this.substrate.getMetrics();
        const config = this.substrate.getConfig();
        lines.push(`║  Fail-Closed Policy:     ${config.failClosedOnMissingApproval ? "\x1b[32mENABLED\x1b[0m" : "\x1b[31mDISABLED\x1b[0m"}`.padEnd(85) + " ║");
        lines.push(`║  Approvals Inherited:    \x1b[1;36m${metrics.totalApprovalsInherited}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Fail-Closed Blocks:     \x1b[31m${metrics.totalFailClosedBlocks}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Executions Wrapped:     ${metrics.totalExecutionsWrapped}`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const health = this.substrate.auditHealth();
        const statusColor = health.healthStatus === "critical_leak" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:          ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Active Contexts:        \x1b[32m${health.activeContexts}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Spawned:          ${health.totalContexts}`.padEnd(76) + " ║");
        lines.push(`║  Total Dispatches:       ${health.totalDispatches}`.padEnd(76) + " ║");
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
