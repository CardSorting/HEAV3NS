/**
 * tool-execution-guard-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for inspecting batch execution segments,
 * parallelism plans, loop guardrail violations, and runtime health matrix (Phase 94 / ADR-046 / Phase 130 / ADR-106 / Target #85).
 */

import type {
  ToolExecutionGuardHealthAuditReport,
  ToolExecutionGuardMetricsReport,
  ToolExecutionSegmentRow,
  ToolLoopViolationRow,
} from "../../core/contracts/tool-execution-segment.contracts.js";
import { BroccoliExecutionGuardSubstrate } from "../../sessions/extensions/execution_guard/broccoli-execution-guard-substrate.js";
import { DeterministicToolSegmenter } from "../../tooling/extensions/execution_guard/deterministic-tool-segmenter.js";

export type ToolExecutionGuardDashboardViewMode = "overview" | "plans" | "violations" | "health" | "raw";

export class ToolExecutionGuardDashboardModal {
  private readonly substrate: BroccoliExecutionGuardSubstrate;
  private readonly segmenter: DeterministicToolSegmenter;
  private viewMode: ToolExecutionGuardDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliExecutionGuardSubstrate, segmenter?: DeterministicToolSegmenter) {
    this.substrate = substrate;
    this.segmenter = segmenter || new DeterministicToolSegmenter();
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

  public setViewMode(mode: ToolExecutionGuardDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): ToolExecutionGuardDashboardViewMode {
    const modes: ToolExecutionGuardDashboardViewMode[] = ["overview", "plans", "violations", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: ToolExecutionGuardDashboardViewMode } {
    if (!this.isVisible) return { action: "none", viewMode: this.viewMode };

    switch (key.toLowerCase()) {
      case "escape":
      case "q":
        this.close();
        return { action: "close", viewMode: this.viewMode };
      case "\t":
      case "tab":
        this.cycleViewMode();
        return { action: "render", viewMode: this.viewMode };
      case "arrowup":
      case "k":
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        return { action: "render", viewMode: this.viewMode };
      case "arrowdown":
      case "j":
        this.selectedIndex++;
        return { action: "render", viewMode: this.viewMode };
      default:
        return { action: "none", viewMode: this.viewMode };
    }
  }

  public render(): string {
    if (!this.isVisible) return "";

    const lines: string[] = [];
    const width = 80;
    const border = "─".repeat(width - 2);

    lines.push(`┌${border}┐`);
    lines.push(`│  🛡️ TOOL EXECUTION GUARD & LOOP FIREWALL DASHBOARD (Target #85)           │`);
    lines.push(
      `│  [TAB] View: \x1b[1;36m${this.viewMode.toUpperCase()}\x1b[0m | [↑/↓] Navigate | [Q/ESC] Close                     │`
    );
    lines.push(`├${border}┤`);

    switch (this.viewMode) {
      case "overview":
        lines.push(...this.renderOverview());
        break;
      case "plans":
        lines.push(...this.renderPlans());
        break;
      case "violations":
        lines.push(...this.renderViolations());
        break;
      case "health":
        lines.push(...this.renderHealth());
        break;
      case "raw":
        lines.push(...this.renderRaw());
        break;
    }

    lines.push(`└${border}┘`);
    return lines.join("\n");
  }

  private renderOverview(): string[] {
    const lines: string[] = [];
    const metrics: ToolExecutionGuardMetricsReport = this.substrate.getMetricsReport();
    const config = this.segmenter.getConfig();

    lines.push(`│  📊 Execution Guard Overview & Metrics:                                    │`);
    lines.push(`│    Total Plans: \x1b[1;36m${metrics.totalPlansPlanned}\x1b[0m | Segments: \x1b[1;32m${metrics.totalSegmentsExecuted}\x1b[0m                     │`);
    lines.push(`│    Parallel Batches: \x1b[1;35m${metrics.parallelBatchesCreated}\x1b[0m | Barriers Enforced: \x1b[33m${metrics.sequentialBarriersEnforced}\x1b[0m         │`);
    lines.push(`│    Violations Detected: \x1b[1;31m${metrics.totalViolationsDetected}\x1b[0m | Blocked Invocations: \x1b[1;33m${metrics.blockedInvocations}\x1b[0m       │`);
    lines.push(`│    Aborted Turns: \x1b[1;31m${metrics.abortedTurns}\x1b[0m                                               │`);
    lines.push(`│                                                                            │`);
    lines.push(`│  ⚙️ Active Policy & Limits:                                               │`);
    lines.push(`│    Max Consecutive Calls: ${config.maxConsecutiveIdenticalCalls} (Threshold)                         │`);
    lines.push(`│    Warn Threshold: \x1b[1;33m${config.warnThreshold}\x1b[0m | Abort Threshold: \x1b[1;31m${config.abortThreshold}\x1b[0m                 │`);
    lines.push(`│    Max Parallel Batch Size: ${config.maxParallelBatchSize}                                            │`);
    lines.push(`│    Fail-Safe Mutating Default: ${config.failSafeMutatingDefault ? "YES" : "NO"}                                   │`);
    return lines;
  }

  private renderPlans(): string[] {
    const lines: string[] = [];
    const latestSegments = this.substrate.getLatestSegments();

    lines.push(`│  📋 Latest Execution Batch Segments (${latestSegments.length} total):                     │`);
    if (latestSegments.length === 0) {
      lines.push(`│    (No execution segments recorded)                                        │`);
    } else {
      const slice = latestSegments.slice(-5);
      for (const seg of slice) {
        const segSummary = seg.toolCalls.map((c) => c.toolName).join(", ");
        lines.push(`│  • Seg #${seg.segmentIndex} [${seg.mode.toUpperCase()}] ${seg.toolCalls.length} tools: ${segSummary.slice(0, 45)}`);
      }
    }
    return lines;
  }

  private renderViolations(): string[] {
    const lines: string[] = [];
    const violations: readonly ToolLoopViolationRow[] = this.substrate.getViolationRows();

    lines.push(`│  🚨 Detected Loop Violations (${violations.length} total):                           │`);
    if (violations.length === 0) {
      lines.push(`│    (No loop violations detected)                                           │`);
    } else {
      const slice = violations.slice(-5);
      for (const v of slice) {
        lines.push(
          `│  • Frame #${v.frameIndex} | Tool: \x1b[1;31m${v.toolName}\x1b[0m | Rep: ${v.repetitionCount} | Action: \x1b[33m${v.actionTaken}\x1b[0m`
        );
      }
    }
    return lines;
  }

  private renderHealth(): string[] {
    const lines: string[] = [];
    const health: ToolExecutionGuardHealthAuditReport = this.substrate.auditHealth();
    const statusColor = health.healthStatus === "optimal" || health.healthStatus === "healthy" ? "\x1b[1;32m" : health.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";

    lines.push(`│  🏥 Subsystem SLA Health Audit:                                            │`);
    lines.push(`│    Status: ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m                                                    │`);
    lines.push(`│    Plans: ${health.totalPlans} | Segments: ${health.totalSegments} | Violations: ${health.totalViolations}             │`);
    lines.push(`│    Blocked: ${health.blockedViolations} | Aborted: ${health.abortViolations} | Parallel Ratio: ${health.parallelRatioPercent}%    │`);
    if (health.recommendations.length > 0) {
      lines.push(`│    Recommendation: ${health.recommendations[0].slice(0, 50)}`);
    }
    return lines;
  }

  private renderRaw(): string[] {
    const lines: string[] = [];
    const metrics = this.substrate.getMetricsReport();
    lines.push(`│  📄 Raw JSON Metrics Dump:                                                 │`);
    const jsonStr = JSON.stringify(metrics, null, 2);
    for (const l of jsonStr.split("\n").slice(0, 10)) {
      lines.push(`│    ${l.slice(0, 72)}`);
    }
    return lines;
  }
}
