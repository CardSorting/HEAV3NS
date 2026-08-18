import type {
  DeadlineHealthAuditReport,
  DeadlineLease,
  DeadlineMetricsReport,
  EstopState,
} from "../../core/contracts/deadline.contracts.js";
import { BroccoliDeadlineSubstrate } from "../../sessions/extensions/deadline/broccoli-deadline-substrate.js";

export type DeadlineDashboardViewMode = "overview" | "leases" | "timeouts" | "estop" | "health" | "metrics";

/**
 * DeadlineDashboardModal.
 * Interactive Terminal TUI Modal Component for Unified Deadline & Emergency Stop Governance (ADR-101).
 *
 * Features:
 * - Executive KPI Ribbon
 * - Filter Presets (1: All, 2: Active Only, 3: Timed Out, 4: Short Deadlines)
 * - 6 View Modes (Overview, Leases, Timeouts, ESTOP, Health, Metrics)
 * - Actions: Toggle ESTOP, Abort Lease, Inspect Audit Logs, Filter Swapping
 */
export class DeadlineDashboardModal {
  private readonly substrate: BroccoliDeadlineSubstrate;
  private readonly onClose: () => void;

  private selectedIndex = 0;
  private filterMode: "all" | "active" | "timed_out" | "short" = "all";
  private viewMode: DeadlineDashboardViewMode = "overview";
  private showHelp = false;

  constructor(substrate: BroccoliDeadlineSubstrate, onClose: () => void) {
    this.substrate = substrate;
    this.onClose = onClose;
  }

  public render(maxWidth = 100): readonly string[] {
    const lines: string[] = [];
    const width = Math.max(60, maxWidth);
    const border = "─".repeat(width - 2);

    const metrics = this.substrate.getDeadlineMetrics();
    const estop = this.substrate.getEstopState();
    const leases = this.getFilteredLeases();

    // 1. Header
    lines.push(`┌${border}┐`);
    lines.push(this.formatLine(` ⏱️ LUMI UNIFIED DEADLINE & ESTOP GOVERNANCE (ADR-101) `, width));
    lines.push(`├${border}┤`);

    // 2. Executive KPI Ribbon
    const estopText = estop.engaged ? "⛔ ESTOP ENGAGED" : "🟢 ACTIVE";
    const kpiText = ` Status: ${estopText} │ Execs: ${metrics.totalExecutions} │ Timeouts: ${metrics.timeoutsEncountered} │ Leases: ${metrics.activeLeases} │ ESTOPs: ${metrics.estopEngagements}`;
    lines.push(this.formatLine(kpiText, width));
    lines.push(`├${border}┤`);

    // 3. View Mode Bar
    const viewTabs = [
      this.viewMode === "overview" ? "[1: ⏱️ Overview]" : " 1: Overview ",
      this.viewMode === "leases" ? "[2: 📋 Leases]" : " 2: Leases ",
      this.viewMode === "timeouts" ? "[3: ⌛ Timeouts]" : " 3: Timeouts ",
      this.viewMode === "estop" ? "[4: 🛑 ESTOP]" : " 4: ESTOP ",
      this.viewMode === "health" ? "[5: 🩺 Health]" : " 5: Health ",
      this.viewMode === "metrics" ? "[6: 📊 Metrics]" : " 6: Metrics ",
    ].join(" │ ");
    lines.push(this.formatLine(` ${viewTabs}`, width));
    lines.push(`├${border}┤`);

    // 4. Content Area
    switch (this.viewMode) {
      case "overview":
        this.renderOverviewView(lines, estop, metrics, width);
        break;
      case "leases":
        this.renderLeasesView(lines, leases, width);
        break;
      case "timeouts":
        this.renderTimeoutsView(lines, width);
        break;
      case "estop":
        this.renderEstopView(lines, estop, width);
        break;
      case "health":
        this.renderHealthView(lines, width);
        break;
      case "metrics":
        this.renderMetricsView(lines, metrics, width);
        break;
    }

    lines.push(`├${border}┤`);

    // 5. Footer & Keybindings
    if (this.showHelp) {
      lines.push(this.formatLine(` [j/k] Navigate  [e] Toggle ESTOP  [x] Abort Lease  [1-4] Filter  [q] Close`, width));
    } else {
      lines.push(this.formatLine(` [v] View (${this.viewMode})  [e] ESTOP  [x] Abort  [1-4] Filters  [?] Help  [q] Close`, width));
    }
    lines.push(`└${border}┘`);

    return lines;
  }

  private renderOverviewView(lines: string[], estop: EstopState, metrics: DeadlineMetricsReport, width: number): void {
    lines.push(this.formatLine(` ── Global Execution Invariants:`, width));
    lines.push(this.formatLine(`  • Default Timeout: ${this.substrate.getConfig().defaultTimeoutMs} ms (Max Safe: ${this.substrate.getConfig().maxSafeTimeoutMs} ms)`, width));
    lines.push(this.formatLine(`  • ESTOP Gating: ${this.substrate.getConfig().enforceEstopOnNewWork ? "Strict (New Work Blocked)" : "Advisory"}`, width));
    lines.push(this.formatLine(`  • Timeout Rate: ${metrics.timeoutRatePercent.toFixed(2)}% │ Throughput: ${metrics.throughputOpsPerSec.toLocaleString()} ops/sec`, width));
    lines.push(this.formatLine(`  • Duration Percentiles: P50: ${metrics.p50DurationMs} ms │ P95: ${metrics.p95DurationMs} ms`, width));
  }

  private renderLeasesView(lines: string[], leases: readonly DeadlineLease[], width: number): void {
    if (leases.length === 0) {
      lines.push(this.formatLine(" (No execution leases recorded)", width));
      return;
    }

    for (let i = 0; i < leases.length; i++) {
      const l = leases[i];
      const isSelected = i === this.selectedIndex;
      const marker = isSelected ? "▶" : " ";
      const statusBadge = `[${l.status.toUpperCase()}]`;
      const durStr = l.durationMs !== undefined ? `${l.durationMs}ms` : "running";

      const row = `${marker} ${statusBadge} ${l.leaseId} (${l.timeoutMs}ms) │ ${l.actionName.slice(0, 24)} │ ${durStr}`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderTimeoutsView(lines: string[], width: number): void {
    const timeouts = this.substrate.listLeases("timed_out");
    if (timeouts.length === 0) {
      lines.push(this.formatLine(" (No timeout incidents recorded)", width));
      return;
    }

    lines.push(this.formatLine(` ── Recorded Timeout Incidents (${timeouts.length} total):`, width));
    for (const t of timeouts) {
      lines.push(this.formatLine(` • [TIMEOUT] ${t.leaseId}: "${t.actionName}" exceeded ${t.timeoutMs}ms limit`, width));
    }
  }

  private renderEstopView(lines: string[], estop: EstopState, width: number): void {
    lines.push(this.formatLine(` ── Emergency Stop (ESTOP) Invariants:`, width));
    lines.push(this.formatLine(`  • Active Engagement: ${estop.engaged ? "⛔ ENGAGED" : "🟢 DISENGAGED"}`, width));
    if (estop.engaged) {
      lines.push(this.formatLine(`  • Engagement Reason: ${estop.reason || "Operator Intervention"}`, width));
      lines.push(this.formatLine(`  • Engaged By: ${estop.engagedBy || "system"} at ${estop.engagedAt ? new Date(estop.engagedAt).toISOString() : "unknown"}`, width));
    }

    const audits = this.substrate.getAuditLogs(5);
    lines.push(this.formatLine(` ── Recent Audit Ledger:`, width));
    for (const a of audits) {
      lines.push(this.formatLine(`  [${a.action.toUpperCase()}] By ${a.operator}: "${a.reason}"`, width));
    }
  }

  private renderHealthView(lines: string[], width: number): void {
    const audit = this.substrate.auditDeadlineHealth();
    lines.push(this.formatLine(` SLA Health Status: ${audit.healthStatus.toUpperCase()} │ Breaches: ${audit.slaBreachCount}`, width));
    lines.push(this.formatLine(` Latency: Avg: ${audit.avgLatencyMs}ms │ P95: ${audit.p95LatencyMs}ms`, width));
    lines.push(this.formatLine(` ── Diagnostic Recommendations:`, width));
    for (const r of audit.recommendations) {
      lines.push(this.formatLine(`  • ${r}`, width));
    }
  }

  private renderMetricsView(lines: string[], metrics: DeadlineMetricsReport, width: number): void {
    lines.push(this.formatLine(` Total: ${metrics.totalExecutions} │ Timeouts: ${metrics.timeoutsEncountered} │ Active Leases: ${metrics.activeLeases}`, width));
    lines.push(this.formatLine(` Statuses: Active: ${metrics.statusCounts.active} │ Done: ${metrics.statusCounts.completed} │ Timed Out: ${metrics.statusCounts.timed_out} │ Aborted: ${metrics.statusCounts.aborted}`, width));
    lines.push(this.formatLine(` Performance: Throughput: ${metrics.throughputOpsPerSec.toLocaleString()} ops/s │ P50: ${metrics.p50DurationMs}ms │ P95: ${metrics.p95DurationMs}ms`, width));
  }

  public handleInput(key: string): void {
    const leases = this.getFilteredLeases();

    switch (key) {
      case "j":
      case "down":
        if (this.selectedIndex < leases.length - 1) {
          this.selectedIndex++;
        }
        break;

      case "k":
      case "up":
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
        }
        break;

      case "1":
        this.filterMode = "all";
        this.selectedIndex = 0;
        break;
      case "2":
        this.filterMode = "active";
        this.selectedIndex = 0;
        break;
      case "3":
        this.filterMode = "timed_out";
        this.selectedIndex = 0;
        break;
      case "4":
        this.filterMode = "short";
        this.selectedIndex = 0;
        break;

      case "v": {
        const modes: DeadlineDashboardViewMode[] = ["overview", "leases", "timeouts", "estop", "health", "metrics"];
        const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
        this.viewMode = modes[nextIdx];
        break;
      }

      case "e": {
        const current = this.substrate.getEstopState();
        this.substrate.setEstop(!current.engaged, current.engaged ? undefined : "TUI Operator manual toggle", "tui_operator");
        break;
      }

      case "x": {
        const currentLease = leases[this.selectedIndex];
        if (currentLease && currentLease.status === "active") {
          this.substrate.abortLease(currentLease.leaseId, "Aborted from TUI modal");
        }
        break;
      }

      case "?":
        this.showHelp = !this.showHelp;
        break;

      case "q":
      case "escape":
        this.onClose();
        break;
    }
  }

  private getFilteredLeases(): readonly DeadlineLease[] {
    let list = this.substrate.listLeases();
    if (this.filterMode === "active") {
      list = list.filter((l) => l.status === "active");
    } else if (this.filterMode === "timed_out") {
      list = list.filter((l) => l.status === "timed_out");
    } else if (this.filterMode === "short") {
      list = list.filter((l) => l.timeoutMs <= 5000);
    }
    return list;
  }

  private formatLine(content: string, width: number): string {
    const cleanContent = content.length > width - 4 ? content.slice(0, width - 4) : content;
    const padding = Math.max(0, width - 2 - cleanContent.length);
    return `│${cleanContent}${" ".repeat(padding)}│`;
  }
}
