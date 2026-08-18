import type {
  DelegationOutcome,
  SwarmHealthAuditReport,
  SwarmMetricsReport,
  SwarmTaskManifest,
  SwarmTaskStatus,
} from "../../core/contracts/delegation.contracts.js";
import { MonolithSwarmDelegator } from "../../agents/extensions/delegation/monolith-swarm-delegator.js";
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export type SwarmDashboardViewMode = "tasks" | "dag" | "outcomes" | "worktrees" | "health" | "metrics";

/**
 * SwarmDashboardModal.
 * Interactive Terminal TUI Modal Component for Multi-Agent Swarm Delegation (ADR-015).
 *
 * Features:
 * - Executive KPI Ribbon
 * - Filter Presets (1: All, 2: Running, 3: Completed, 4: Failed)
 * - 6 View Modes (Tasks, DAG Hierarchy, Outcomes, Worktrees, Health SLA, Metrics)
 * - Actions: Abort, Merge Worktree, Test Notification
 */
export class SwarmDashboardModal {
  private readonly delegator: MonolithSwarmDelegator;
  private readonly onClose: () => void;

  private selectedIndex = 0;
  private statusFilter?: SwarmTaskStatus;
  private viewMode: SwarmDashboardViewMode = "tasks";
  private showHelp = false;

  constructor(delegator: MonolithSwarmDelegator, onClose: () => void) {
    this.delegator = delegator;
    this.onClose = onClose;
  }

  public render(maxWidth: number = 100): readonly string[] {
    const lines: string[] = [];
    const width = Math.max(60, maxWidth);
    const border = "─".repeat(width - 2);

    const metrics = this.delegator.getSwarmMetrics();
    const tasks = this.getFilteredTasks();

    // 1. Header
    lines.push(`┌${border}┐`);
    lines.push(this.formatLine(` 🐝 LUMI AUTONOMOUS SWARM DELEGATION HUB (ADR-015) `, width));
    lines.push(`├${border}┤`);

    // 2. Executive KPI Ribbon
    const kpiText = ` Total: ${metrics.totalTasks} | Active: ${metrics.activeTasks} | Success: ${metrics.overallSuccessRatePercent}% | Tokens: ${metrics.totalTokensUsed} | Worktrees: ${metrics.activeWorktreesCount}`;
    lines.push(this.formatLine(kpiText, width));
    lines.push(`├${border}┤`);

    // 3. View Mode Bar
    const viewTabs = [
      this.viewMode === "tasks" ? "[1: 🐝 Tasks]" : " 1: Tasks ",
      this.viewMode === "dag" ? "[2: 🌲 DAG]" : " 2: DAG ",
      this.viewMode === "outcomes" ? "[3: 📜 Outcomes]" : " 3: Outcomes ",
      this.viewMode === "worktrees" ? "[4: 🌿 Worktrees]" : " 4: Worktrees ",
      this.viewMode === "health" ? "[5: 🩺 Health]" : " 5: Health ",
      this.viewMode === "metrics" ? "[6: 📊 Metrics]" : " 6: Metrics ",
    ].join(" │ ");
    lines.push(this.formatLine(` ${viewTabs}`, width));
    lines.push(`├${border}┤`);

    // 4. Content Area
    switch (this.viewMode) {
      case "tasks":
        this.renderTasksView(lines, tasks, width);
        break;
      case "dag":
        this.renderDagView(lines, tasks, width);
        break;
      case "outcomes":
        this.renderOutcomesView(lines, width);
        break;
      case "worktrees":
        this.renderWorktreesView(lines, tasks, width);
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
      lines.push(this.formatLine(` [j/k/↑/↓] Navigate  [Enter] Inspect  [a] Abort Task  [v] Switch View  [d] Test Alert  [q] Close`, width));
    } else {
      lines.push(this.formatLine(` [v] View (${this.viewMode})  [1-4] Filters  [a] Abort  [d] Alert  [?] Help  [q] Close`, width));
    }
    lines.push(`└${border}┘`);

    return lines;
  }

  private renderTasksView(lines: string[], tasks: readonly SwarmTaskManifest[], width: number): void {
    if (tasks.length === 0) {
      lines.push(this.formatLine(" (No subagent tasks registered)", width));
      return;
    }

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const isSelected = i === this.selectedIndex;
      const marker = isSelected ? "▶" : " ";
      const statusIcon = t.status === "completed" ? "✓" : t.status === "running" ? "●" : t.status === "failed" ? "✗" : "○";
      const branchStr = t.worktree ? ` [${t.worktree.branchName}]` : "";

      const row = `${marker} ${statusIcon} [${t.status.padEnd(9)}] ${t.id.slice(0, 16).padEnd(16)} D${t.depth} │ ${t.goal.slice(0, 30)}${branchStr}`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderDagView(lines: string[], tasks: readonly SwarmTaskManifest[], width: number): void {
    const rawDag = BroccoliViewRenderer.renderSwarmDagGraph(tasks);
    const dagLines = rawDag.split("\n");
    for (const d of dagLines) {
      lines.push(this.formatLine(d, width));
    }
  }

  private renderOutcomesView(lines: string[], width: number): void {
    const outcomes = this.delegator.getSubstrate().getOutcomes(undefined, 10);
    if (outcomes.length === 0) {
      lines.push(this.formatLine(" (No historical execution outcomes recorded)", width));
      return;
    }

    for (const o of outcomes) {
      const icon = o.success ? "✓" : "✗";
      const row = ` ${icon} [${o.taskId}] ${o.summary.slice(0, 45)} ── ${(o.durationMs).toFixed(1)}ms (${o.tokenUsage} tok)`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderWorktreesView(lines: string[], tasks: readonly SwarmTaskManifest[], width: number): void {
    const withWorktrees = tasks.filter((t) => Boolean(t.worktree));
    if (withWorktrees.length === 0) {
      lines.push(this.formatLine(" (No isolated worktrees active)", width));
      return;
    }

    for (const t of withWorktrees) {
      const wt = t.worktree!;
      const row = ` 🌿 [${t.id}] Branch: ${wt.branchName} │ Path: ${wt.worktreePath.slice(0, 30)}`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderHealthView(lines: string[], width: number): void {
    const audit = this.delegator.auditSwarmHealth();
    lines.push(this.formatLine(` Overall Health: ${audit.healthStatus.toUpperCase()} (Success: ${audit.overallSuccessRatePercent}%)`, width));
    lines.push(this.formatLine(` Max Depth: ${audit.maxDepthReached} │ Exhausted Budgets: ${audit.budgetExhaustedTasks}`, width));
    lines.push(this.formatLine(` ── Recommendations:`, width));
    for (const r of audit.recommendations) {
      lines.push(this.formatLine(`  • ${r}`, width));
    }
  }

  private renderMetricsView(lines: string[], metrics: SwarmMetricsReport, width: number): void {
    lines.push(this.formatLine(` Total Tasks: ${metrics.totalTasks} (Active: ${metrics.activeTasks}, Completed: ${metrics.completedTasks}, Failed: ${metrics.failedTasks})`, width));
    lines.push(this.formatLine(` Total Tokens: ${metrics.totalTokensUsed} │ Tool Calls: ${metrics.totalToolCalls}`, width));
    lines.push(this.formatLine(` Duration P50: ${metrics.p50DurationMs}ms │ P95: ${metrics.p95DurationMs}ms │ P99: ${metrics.p99DurationMs}ms`, width));
    lines.push(this.formatLine(` Active Worktrees: ${metrics.activeWorktreesCount}`, width));
  }

  public handleInput(key: string): void {
    const tasks = this.getFilteredTasks();

    switch (key) {
      case "j":
      case "down":
        if (this.selectedIndex < tasks.length - 1) {
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
        this.statusFilter = undefined;
        this.selectedIndex = 0;
        break;
      case "2":
        this.statusFilter = "running";
        this.selectedIndex = 0;
        break;
      case "3":
        this.statusFilter = "completed";
        this.selectedIndex = 0;
        break;
      case "4":
        this.statusFilter = "failed";
        this.selectedIndex = 0;
        break;

      case "v": {
        const modes: SwarmDashboardViewMode[] = ["tasks", "dag", "outcomes", "worktrees", "health", "metrics"];
        const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
        this.viewMode = modes[nextIdx];
        break;
      }

      case "a": {
        const current = tasks[this.selectedIndex];
        if (current && current.status === "running") {
          this.delegator.abortTask(current.id, "Aborted via TUI Modal");
        }
        break;
      }

      case "d": {
        this.delegator.getNotificationDispatcher().dispatch({
          title: "Swarm Diagnostic Alert",
          message: "TUI Manual Notification Triggered",
          urgency: "normal",
          trigger: "custom",
        }).catch(() => {});
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

  private getFilteredTasks(): readonly SwarmTaskManifest[] {
    return this.delegator.listTasks(this.statusFilter);
  }

  private formatLine(content: string, width: number): string {
    const cleanContent = content.length > width - 4 ? content.slice(0, width - 4) : content;
    const padding = Math.max(0, width - 2 - cleanContent.length);
    return `│${cleanContent}${" ".repeat(padding)}│`;
  }
}
