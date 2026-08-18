/**
 * execution-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for visualizing Sandboxed Code Executions,
 * programmatic tool call traces, security policies, and SLA health audits (Phase 82 / ADR-034).
 */

import type {
  ExecutionHealthAuditReport,
  ExecutionMetricsReport,
  ExecutionRecord,
  ExecutionWorkspaceSnapshot,
  ProgrammaticToolCall,
} from "../../core/contracts/execution.contracts.js";
import { BroccoliExecutionSubstrate } from "../../sessions/extensions/execution/broccoli-execution-substrate.js";
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export type ExecutionDashboardViewMode = "executions" | "toolCalls" | "metrics" | "health" | "raw";

export class ExecutionDashboardModal {
  private readonly substrate: BroccoliExecutionSubstrate;
  private viewMode: ExecutionDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliExecutionSubstrate) {
    this.substrate = substrate;
    this.viewMode = "executions";
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

  public setViewMode(mode: ExecutionDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): ExecutionDashboardViewMode {
    const modes: ExecutionDashboardViewMode[] = ["executions", "toolCalls", "metrics", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: ExecutionDashboardViewMode } {
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
        this.setViewMode("executions");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("toolCalls");
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
    lines.push("║           ⚡ CODE EXECUTION & TOOL CALLING DASHBOARD MODAL                  ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "executions", label: "[1] Executions" },
      { id: "toolCalls", label: "[2] Tool Calls" },
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
      case "executions": {
        const list = this.substrate.listExecutions(15);
        if (list.length === 0) {
          lines.push("║  No executions recorded in substrate.                                     ║");
        } else {
          for (let i = 0; i < list.length; i++) {
            const exec = list[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const statusColor = exec.result.success ? "\x1b[32m" : "\x1b[31m";
            const line = `${prefix}${exec.id.padEnd(12)} │ ${exec.language.padEnd(10)} │ ${statusColor}${exec.result.status.toUpperCase().padEnd(10)}\x1b[0m │ ${exec.code.slice(0, 30)}`;
            lines.push(`║ ${line.padEnd(74)} ║`);
          }
        }
        break;
      }

      case "toolCalls": {
        const calls = this.substrate.listToolCalls(undefined, 10);
        if (calls.length === 0) {
          lines.push("║  No programmatic tool calls recorded.                                      ║");
        } else {
          for (const tc of calls) {
            lines.push(`║  🔧 ${tc.toolName.padEnd(20)} (${tc.executionTimeMs} ms) - success=${tc.success}`.padEnd(76) + " ║");
          }
        }
        break;
      }

      case "metrics": {
        const metrics = this.substrate.getExecutionMetrics();
        lines.push(`║  Total Executions:      ${String(metrics.totalExecutions).padEnd(50)} ║`);
        lines.push(`║  Successful:            ${String(metrics.successCount).padEnd(50)} ║`);
        lines.push(`║  Failed:                ${String(metrics.failureCount).padEnd(50)} ║`);
        lines.push(`║  Overall Success Rate:  ${(metrics.overallSuccessRate * 100).toFixed(0)}%`.padEnd(76) + " ║");
        lines.push(`║  Total Tool Calls:      ${String(metrics.totalToolCalls).padEnd(50)} ║`);
        lines.push(`║  Avg Duration:          ${metrics.avgExecutionTimeMs} ms (p95: ${metrics.p95ExecutionTimeMs} ms)`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const health = this.substrate.auditExecutionHealth();
        const statusColor = health.healthStatus === "optimal" ? "\x1b[32m" : "\x1b[33m";
        lines.push(`║  Health Status:         ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Success Rate:          ${(health.overallSuccessRate * 100).toFixed(0)}%`.padEnd(76) + " ║");
        lines.push(`║  Security Blocked:      ${String(health.securityBlockedCount).padEnd(50)} ║`);
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
