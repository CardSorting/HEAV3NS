/**
 * batch-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for visualizing the SWE Benchmark & Batch Evaluation Subsystem,
 * benchmark runs, task queues, pass rates, and SLA health audits (Phase 84 / ADR-036).
 */

import type {
  BatchHealthAuditReport,
  BatchMetricsReport,
  BatchRunState,
  BatchTaskItem,
  BatchWorkspaceSnapshot,
} from "../../core/contracts/batch.contracts.js";
import { BroccoliBatchSubstrate } from "../../sessions/extensions/batch/broccoli-batch-substrate.js";
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export type BatchDashboardViewMode = "tasks" | "runs" | "metrics" | "health" | "raw";

export class BatchDashboardModal {
  private readonly substrate: BroccoliBatchSubstrate;
  private viewMode: BatchDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliBatchSubstrate) {
    this.substrate = substrate;
    this.viewMode = "tasks";
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

  public setViewMode(mode: BatchDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): BatchDashboardViewMode {
    const modes: BatchDashboardViewMode[] = ["tasks", "runs", "metrics", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: BatchDashboardViewMode } {
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
        this.setViewMode("tasks");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("runs");
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
    lines.push("║           📊 SWE BENCHMARK & BATCH EVALUATION DASHBOARD MODAL               ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "tasks", label: "[1] Tasks" },
      { id: "runs", label: "[2] Runs" },
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
      case "tasks": {
        const tasks = this.substrate.listTasks(undefined, 15);
        if (tasks.length === 0) {
          lines.push("║  No batch tasks registered in substrate.                                   ║");
        } else {
          for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const result = this.substrate.getResult(task.id);
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const statusColor = result?.passed ? "\x1b[32m" : (result ? "\x1b[31m" : "\x1b[33m");
            const statusStr = result ? (result.passed ? "PASSED" : "FAILED") : "PENDING";
            const line = `${prefix}${task.id.padEnd(12)} │ ${statusColor}${statusStr.padEnd(8)}\x1b[0m │ ${task.benchmarkType.padEnd(12)} │ ${task.prompt.slice(0, 30)}`;
            lines.push(`║ ${line.padEnd(74)} ║`);
          }
        }
        break;
      }

      case "runs": {
        const runs = this.substrate.listRuns(10);
        if (runs.length === 0) {
          lines.push("║  No benchmark runs active.                                                 ║");
        } else {
          for (const run of runs) {
            lines.push(`║  🏃 ${run.title.slice(0, 30)} (${run.runId}) - Pass Rate: ${(run.metrics.passRate * 100).toFixed(0)}%`.padEnd(76) + " ║");
          }
        }
        break;
      }

      case "metrics": {
        const metrics = this.substrate.getBatchMetrics();
        lines.push(`║  Total Runs:            ${String(metrics.totalRuns).padEnd(50)} ║`);
        lines.push(`║  Total Tasks:           ${String(metrics.totalTasks).padEnd(50)} ║`);
        lines.push(`║  Completed Tasks:       ${String(metrics.completedTasks).padEnd(50)} ║`);
        lines.push(`║  Failed Tasks:          ${String(metrics.failedTasks).padEnd(50)} ║`);
        lines.push(`║  Overall Pass Rate:     ${(metrics.overallPassRate * 100).toFixed(0)}%`.padEnd(76) + " ║");
        lines.push(`║  Avg Task Duration:     ${metrics.avgTaskDurationMs} ms (p95: ${metrics.p95DurationMs} ms)`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const health = this.substrate.auditBatchHealth();
        const statusColor = health.healthStatus === "optimal" ? "\x1b[32m" : "\x1b[33m";
        lines.push(`║  Health Status:         ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Pass Rate:             ${(health.overallPassRate * 100).toFixed(0)}%`.padEnd(76) + " ║");
        lines.push(`║  Failed Task Count:     ${String(health.failedTasks).padEnd(50)} ║`);
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
