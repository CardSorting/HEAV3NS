/**
 * cron-dashboard-modal.ts
 *
 * Interactive TUI Cron & Automation Dashboard Modal with Keyboard Navigation,
 * Above-the-Fold Executive KPI Ribbon, Quick Filter Pills,
 * ASCII Schedule Timeline Visualizer, Desktop Notification Trigger,
 * Blueprint Inspector, and Responsive Multi-View Support (ADR-016).
 */

import type { Component, Focusable } from "../tui.js";
import { Box } from "./box.js";
import { VStack } from "./v-stack.js";
import { Text } from "./text.js";
import { Markdown, type MarkdownTheme } from "./markdown.js";
import { matchesKey } from "../keys.js";
import type {
  AutomationBlueprint,
  CronExecutionRecord,
  CronJobManifest,
  CronJobStatus,
} from "../../core/contracts/cron.contracts.js";
import type { MonolithCronScheduler } from "../../agents/extensions/cron/monolith-cron-scheduler.js";
import { DeterministicBlueprintCatalog } from "../../tooling/extensions/cron/deterministic-blueprint-catalog.js";

const CRON_MARKDOWN_THEME: MarkdownTheme = {
  heading: (text) => `\x1b[1;36m${text}\x1b[0m`,
  link: (text) => `\x1b[4;34m${text}\x1b[0m`,
  linkUrl: (text) => `\x1b[90m${text}\x1b[0m`,
  code: (text) => `\x1b[1;33m${text}\x1b[0m`,
  codeBlock: (text) => text,
  codeBlockBorder: (text) => `\x1b[90m${text}\x1b[0m`,
  quote: (text) => `\x1b[36m${text}\x1b[0m`,
  quoteBorder: (text) => `\x1b[90m${text}\x1b[0m`,
  hr: (text) => `\x1b[90m${text}\x1b[0m`,
  listBullet: (text) => `\x1b[36m${text}\x1b[0m`,
  bold: (text) => `\x1b[1;37m${text}\x1b[0m`,
  italic: (text) => `\x1b[3m${text}\x1b[0m`,
  strikethrough: (text) => `\x1b[9m${text}\x1b[0m`,
  underline: (text) => `\x1b[4m${text}\x1b[0m`,
};

export class CronDashboardModal implements Component, Focusable {
  focused: boolean = true;
  private readonly container: Box;
  private readonly vstack: VStack;
  private readonly scheduler: MonolithCronScheduler;
  private readonly blueprintCatalog: DeterministicBlueprintCatalog;
  private readonly onClose: () => void;

  private selectedJobIndex: number = 0;
  private viewMode: "jobs" | "history" | "timeline" | "blueprints" | "health" | "metrics" = "jobs";
  private filterPreset: "all" | "active" | "paused" | "failed" = "all";
  private isShowingHelp: boolean = false;
  private isInspecting: boolean = false;
  private inspectedJob?: CronJobManifest;
  private statusMessage: string = "";

  constructor(
    scheduler: MonolithCronScheduler,
    onClose: () => void
  ) {
    this.scheduler = scheduler;
    this.blueprintCatalog = new DeterministicBlueprintCatalog();
    this.onClose = onClose;

    const bgFn = (text: string) => `\x1b[48;5;235m${text}\x1b[0m`;
    this.container = new Box(2, 1, bgFn);
    this.vstack = new VStack();
    this.container.addChild(this.vstack);

    this.rebuildView();
  }

  invalidate(): void {
    this.rebuildView();
    this.container.invalidate();
  }

  private rebuildView(): void {
    while (this.vstack.children.length > 0) {
      this.vstack.children.pop();
    }

    const metrics = this.scheduler.getCronMetrics();
    const allJobs = this.scheduler.listJobs();

    // Header
    const headerText = `\x1b[1;36m⏱️  LUMI AUTOMATION & CRON HUB\x1b[0m \x1b[90m[Jobs: ${metrics.activeJobs}/${metrics.totalJobs} Active | View: ${this.viewMode.toUpperCase()}]\x1b[0m`;
    this.vstack.addChild(new Text(headerText, 0, 0));

    // Above-the-fold Executive KPI Ribbon
    const successColor = metrics.overallSuccessRatePercent >= 90 ? "\x1b[1;32m" : "\x1b[1;33m";
    const kpiText =
      `\x1b[1;37mJobs:\x1b[0m \x1b[1;36m${metrics.totalJobs}\x1b[0m | ` +
      `\x1b[1;37mActive:\x1b[0m \x1b[1;32m${metrics.activeJobs}\x1b[0m | ` +
      `\x1b[1;37mSuccess SLA:\x1b[0m ${successColor}${metrics.overallSuccessRatePercent}%\x1b[0m | ` +
      `\x1b[1;37mP95 Latency:\x1b[0m \x1b[1;33m${metrics.p95DurationMs}ms\x1b[0m | ` +
      `\x1b[1;37mExecutions:\x1b[0m \x1b[1;35m${metrics.totalExecutions}\x1b[0m`;
    this.vstack.addChild(new Text(kpiText, 0, 0));

    // Quick Filter Ribbon
    const filterText =
      `\x1b[90mFilters:\x1b[0m ` +
      `[1: ${this.filterPreset === "all" ? "\x1b[1;36mAll\x1b[0m" : "All"}] ` +
      `[2: ${this.filterPreset === "active" ? "\x1b[1;32mActive\x1b[0m" : "Active"}] ` +
      `[3: ${this.filterPreset === "paused" ? "\x1b[1;33mPaused\x1b[0m" : "Paused"}] ` +
      `[4: ${this.filterPreset === "failed" ? "\x1b[1;31mFailed\x1b[0m" : "Failed"}] ` +
      `\x1b[90m(v: Cycle View | t: Trigger | p: Pause | d: Alert)\x1b[0m`;
    this.vstack.addChild(new Text(filterText, 0, 0));
    this.vstack.addChild(new Text(`\x1b[90m${"─".repeat(76)}\x1b[0m`, 0, 0));

    if (this.statusMessage) {
      this.vstack.addChild(new Text(`\x1b[1;33mℹ ${this.statusMessage}\x1b[0m`, 0, 0));
    }

    if (this.isShowingHelp) {
      this.renderHelpView();
      return;
    }

    if (this.isInspecting && this.inspectedJob) {
      this.renderInspectorView(this.inspectedJob);
      return;
    }

    switch (this.viewMode) {
      case "jobs":
        this.renderJobsView(allJobs);
        break;
      case "history":
        this.renderHistoryView();
        break;
      case "timeline":
        this.renderTimelineView(allJobs);
        break;
      case "blueprints":
        this.renderBlueprintsView();
        break;
      case "health":
        this.renderHealthView(allJobs);
        break;
      case "metrics":
        this.renderMetricsView(metrics);
        break;
    }

    // Footer
    this.vstack.addChild(new Text(`\x1b[90m${"─".repeat(76)}\x1b[0m`, 0, 0));
    const footer = `\x1b[90m[j/k: Navigate | Enter: Inspect | t: Trigger | p: Pause/Resume | +/-: Interval | ?: Help | q: Close]\x1b[0m`;
    this.vstack.addChild(new Text(footer, 0, 0));
  }

  private renderJobsView(jobs: readonly CronJobManifest[]): void {
    let filtered = [...jobs];
    if (this.filterPreset === "active") filtered = filtered.filter((j) => j.status === "active");
    if (this.filterPreset === "paused") filtered = filtered.filter((j) => j.status === "paused");
    if (this.filterPreset === "failed") filtered = filtered.filter((j) => j.status === "failed");

    if (filtered.length === 0) {
      this.vstack.addChild(new Text(`  \x1b[90mNo cron jobs matching '${this.filterPreset}' filter.\x1b[0m`, 0, 0));
      return;
    }

    if (this.selectedJobIndex >= filtered.length) {
      this.selectedJobIndex = filtered.length - 1;
    }

    this.vstack.addChild(new Text(`\x1b[1;37m📋 REGISTERED AUTOMATION JOBS (${filtered.length})\x1b[0m:`, 0, 0));

    filtered.forEach((job, idx) => {
      const isSelected = idx === this.selectedJobIndex;
      const prefix = isSelected ? "\x1b[1;36m▶\x1b[0m " : "  ";

      const statusBadge =
        job.status === "active"
          ? "\x1b[1;32m[ACTIVE]\x1b[0m"
          : job.status === "paused"
          ? "\x1b[1;33m[PAUSED]\x1b[0m"
          : job.status === "failed"
          ? "\x1b[1;31m[FAILED]\x1b[0m"
          : "\x1b[90m[DONE]\x1b[0m";

      const sched = job.scheduleExpression || (job.intervalMs ? `${job.intervalMs / 1000}s` : "once");
      const lastOutcome = job.lastRunOutcome
        ? job.lastRunOutcome.success
          ? "\x1b[32m✓\x1b[0m"
          : "\x1b[31m✗\x1b[0m"
        : "\x1b[90m-\x1b[0m";

      const titleColor = isSelected ? "\x1b[1;36m" : "\x1b[37m";
      const line = `${prefix}${statusBadge} ${titleColor}${job.name}\x1b[0m \x1b[90m(${sched}) [Runs: ${job.totalRuns}] [Last: ${lastOutcome}]\x1b[0m`;
      this.vstack.addChild(new Text(line, 0, 0));
    });
  }

  private renderHistoryView(): void {
    const history = this.scheduler.getSubstrate().getExecutionHistory(undefined, 10);
    this.vstack.addChild(new Text(`\x1b[1;37m📜 RECENT EXECUTION LEDGER (${history.length})\x1b[0m:`, 0, 0));

    if (history.length === 0) {
      this.vstack.addChild(new Text(`  \x1b[90mNo execution records logged yet.\x1b[0m`, 0, 0));
      return;
    }

    for (const h of history) {
      const outcome = h.success ? "\x1b[1;32m[PASS]\x1b[0m" : "\x1b[1;31m[FAIL]\x1b[0m";
      const timeStr = new Date(h.startedAtMs).toISOString().substring(11, 19);
      const line = `  ${outcome} \x1b[90m${timeStr}\x1b[0m \x1b[37m${h.jobId}\x1b[0m \x1b[33m(${h.durationMs.toFixed(1)}ms)\x1b[0m - ${h.summary.slice(0, 45)}`;
      this.vstack.addChild(new Text(line, 0, 0));
    }
  }

  private renderTimelineView(jobs: readonly CronJobManifest[]): void {
    this.vstack.addChild(new Text(`\x1b[1;37m⏱️  SCHEDULE TIMELINE CHART\x1b[0m:`, 0, 0));
    for (const j of jobs) {
      const inSec = j.nextRunTimestampMs ? Math.max(0, Math.round((j.nextRunTimestampMs - Date.now()) / 1000)) : -1;
      const timeStr = inSec >= 0 ? `in ${inSec}s` : "inactive";
      const icon = j.status === "active" ? "\x1b[32m●\x1b[0m" : j.status === "paused" ? "\x1b[33m⏸\x1b[0m" : "\x1b[31m✗\x1b[0m";
      const line = `  ${icon} [${j.status.padEnd(7)}] \x1b[37m${j.name.slice(0, 25).padEnd(25)}\x1b[0m ── \x1b[36m${j.scheduleType.padEnd(8)}\x1b[0m ── \x1b[90m${timeStr}\x1b[0m`;
      this.vstack.addChild(new Text(line, 0, 0));
    }
  }

  private renderBlueprintsView(): void {
    const bps = this.blueprintCatalog.listBlueprints();
    this.vstack.addChild(new Text(`\x1b[1;37m📦 AUTOMATION BLUEPRINT CATALOG (${bps.length})\x1b[0m:`, 0, 0));
    for (const b of bps) {
      const line = `  \x1b[1;36m${b.title}\x1b[0m \x1b[90m[${b.key}]\x1b[0m \x1b[33m(${b.scheduleTemplate})\x1b[0m - ${b.description.slice(0, 50)}`;
      this.vstack.addChild(new Text(line, 0, 0));
    }
  }

  private renderHealthView(jobs: readonly CronJobManifest[]): void {
    this.vstack.addChild(new Text(`\x1b[1;37m🩺 SLA HEALTH AUDIT & DIAGNOSTICS\x1b[0m:`, 0, 0));
    for (const j of jobs) {
      const audit = this.scheduler.auditJobHealth(j.id);
      if (!audit) continue;

      const icon = audit.healthStatus === "on_track" ? "\x1b[32m✓\x1b[0m" : audit.healthStatus === "at_risk" ? "\x1b[33m⚠\x1b[0m" : "\x1b[31m✗\x1b[0m";
      const line = `  ${icon} \x1b[1;37m${j.name}\x1b[0m: [Success: \x1b[32m${audit.successRatePercent}%\x1b[0m] [Failures: \x1b[31m${audit.consecutiveFailures}\x1b[0m] [${audit.healthStatus.toUpperCase()}]`;
      this.vstack.addChild(new Text(line, 0, 0));
    }
  }

  private renderMetricsView(metrics: any): void {
    this.vstack.addChild(new Text(`\x1b[1;37m📊 EXECUTION LATENCY & RELIABILITY METRICS\x1b[0m:`, 0, 0));
    this.vstack.addChild(new Text(`  P50 Duration: \x1b[32m${metrics.p50DurationMs} ms\x1b[0m`, 0, 0));
    this.vstack.addChild(new Text(`  P95 Duration: \x1b[33m${metrics.p95DurationMs} ms\x1b[0m`, 0, 0));
    this.vstack.addChild(new Text(`  P99 Duration: \x1b[31m${metrics.p99DurationMs} ms\x1b[0m`, 0, 0));
    this.vstack.addChild(new Text(`  Overall Success Rate: \x1b[1;32m${metrics.overallSuccessRatePercent}%\x1b[0m`, 0, 0));
  }

  private renderHelpView(): void {
    this.vstack.addChild(new Text(`\x1b[1;36m📖 KEYBOARD SHORTCUTS & HELP\x1b[0m:`, 0, 0));
    this.vstack.addChild(new Text(`  \x1b[1;37mj / k\x1b[0m       - Navigate jobs up/down`, 0, 0));
    this.vstack.addChild(new Text(`  \x1b[1;37mEnter\x1b[0m       - Inspect selected job details`, 0, 0));
    this.vstack.addChild(new Text(`  \x1b[1;37mt\x1b[0m           - Trigger immediate manual run`, 0, 0));
    this.vstack.addChild(new Text(`  \x1b[1;37mp\x1b[0m           - Toggle pause / resume`, 0, 0));
    this.vstack.addChild(new Text(`  \x1b[1;37m+ / -\x1b[0m       - Adjust interval +/- 5s`, 0, 0));
    this.vstack.addChild(new Text(`  \x1b[1;37mv\x1b[0m           - Cycle view modes (jobs/history/timeline/blueprints/health/metrics)`, 0, 0));
    this.vstack.addChild(new Text(`  \x1b[1;37m1 - 4\x1b[0m       - Filter by all / active / paused / failed`, 0, 0));
    this.vstack.addChild(new Text(`  \x1b[1;37md\x1b[0m           - Test desktop notification dispatch`, 0, 0));
    this.vstack.addChild(new Text(`  \x1b[1;37m? / Esc\x1b[0m     - Toggle help / dismiss inspector`, 0, 0));
    this.vstack.addChild(new Text(`  \x1b[1;37mq\x1b[0m           - Close modal`, 0, 0));
  }

  private renderInspectorView(job: CronJobManifest): void {
    const audit = this.scheduler.auditJobHealth(job.id);
    this.vstack.addChild(new Text(`\x1b[1;36m🔍 JOB INSPECTOR: ${job.name}\x1b[0m`, 0, 0));
    this.vstack.addChild(new Text(`  ID: \x1b[90m${job.id}\x1b[0m | Status: \x1b[1;32m${job.status.toUpperCase()}\x1b[0m | Type: \x1b[36m${job.scheduleType}\x1b[0m`, 0, 0));
    this.vstack.addChild(new Text(`  Prompt: \x1b[37m"${job.prompt}"\x1b[0m`, 0, 0));
    this.vstack.addChild(new Text(`  Total Runs: \x1b[33m${job.totalRuns}\x1b[0m | Consecutive Failures: \x1b[31m${job.consecutiveFailures || 0}\x1b[0m`, 0, 0));
    if (audit) {
      this.vstack.addChild(new Text(`  Health: \x1b[1;32m${audit.healthStatus.toUpperCase()}\x1b[0m (Success Rate: ${audit.successRatePercent}%)`, 0, 0));
      for (const rec of audit.recommendations) {
        this.vstack.addChild(new Text(`  💡 \x1b[90m${rec}\x1b[0m`, 0, 0));
      }
    }
  }

  handleInput(key: string): void {
    const allJobs = this.scheduler.listJobs();
    let filtered = [...allJobs];
    if (this.filterPreset === "active") filtered = filtered.filter((j) => j.status === "active");
    if (this.filterPreset === "paused") filtered = filtered.filter((j) => j.status === "paused");
    if (this.filterPreset === "failed") filtered = filtered.filter((j) => j.status === "failed");

    const selectedJob = filtered[this.selectedJobIndex];

    if (key === "q") {
      this.onClose();
      return;
    }

    if (key === "?" || key === "h") {
      this.isShowingHelp = !this.isShowingHelp;
      this.statusMessage = "";
      this.invalidate();
      return;
    }

    if (key === "\x1b" || key === "Escape") {
      if (this.isShowingHelp) {
        this.isShowingHelp = false;
      } else if (this.isInspecting) {
        this.isInspecting = false;
      } else {
        this.onClose();
      }
      this.invalidate();
      return;
    }

    if (key === "1") {
      this.filterPreset = "all";
      this.selectedJobIndex = 0;
      this.invalidate();
      return;
    }
    if (key === "2") {
      this.filterPreset = "active";
      this.selectedJobIndex = 0;
      this.invalidate();
      return;
    }
    if (key === "3") {
      this.filterPreset = "paused";
      this.selectedJobIndex = 0;
      this.invalidate();
      return;
    }
    if (key === "4") {
      this.filterPreset = "failed";
      this.selectedJobIndex = 0;
      this.invalidate();
      return;
    }

    if (key === "v") {
      const modes: Array<"jobs" | "history" | "timeline" | "blueprints" | "health" | "metrics"> = [
        "jobs",
        "history",
        "timeline",
        "blueprints",
        "health",
        "metrics",
      ];
      const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
      this.viewMode = modes[nextIdx];
      this.statusMessage = `View: ${this.viewMode.toUpperCase()}`;
      this.invalidate();
      return;
    }

    if (key === "j" || key === "Down" || key === "\x1b[B") {
      if (filtered.length > 0) {
        this.selectedJobIndex = (this.selectedJobIndex + 1) % filtered.length;
        this.invalidate();
      }
      return;
    }

    if (key === "k" || key === "Up" || key === "\x1b[A") {
      if (filtered.length > 0) {
        this.selectedJobIndex = (this.selectedJobIndex - 1 + filtered.length) % filtered.length;
        this.invalidate();
      }
      return;
    }

    if (key === "\r" || key === "\n" || key === "Enter") {
      if (selectedJob) {
        this.inspectedJob = selectedJob;
        this.isInspecting = !this.isInspecting;
        this.invalidate();
      }
      return;
    }

    if (key === "t" && selectedJob) {
      this.scheduler.triggerJob(selectedJob.id).then(() => {
        this.statusMessage = `Triggered job '${selectedJob.name}'`;
        this.invalidate();
      });
      return;
    }

    if (key === "p" && selectedJob) {
      if (selectedJob.status === "active") {
        this.scheduler.pauseJob(selectedJob.id);
        this.statusMessage = `Paused job '${selectedJob.name}'`;
      } else {
        this.scheduler.resumeJob(selectedJob.id);
        this.statusMessage = `Resumed job '${selectedJob.name}'`;
      }
      this.invalidate();
      return;
    }

    if ((key === "+" || key === "=") && selectedJob && selectedJob.intervalMs) {
      const nextInterval = selectedJob.intervalMs + 5000;
      this.scheduler.getSubstrate().storeJob({
        ...selectedJob,
        intervalMs: nextInterval,
        updatedAtMs: Date.now(),
      });
      this.statusMessage = `Interval increased to ${nextInterval / 1000}s`;
      this.invalidate();
      return;
    }

    if ((key === "-" || key === "_") && selectedJob && selectedJob.intervalMs) {
      const nextInterval = Math.max(1000, selectedJob.intervalMs - 5000);
      this.scheduler.getSubstrate().storeJob({
        ...selectedJob,
        intervalMs: nextInterval,
        updatedAtMs: Date.now(),
      });
      this.statusMessage = `Interval decreased to ${nextInterval / 1000}s`;
      this.invalidate();
      return;
    }

    if (key === "d") {
      this.scheduler.getNotificationDispatcher().dispatch({
        title: "Test Alert",
        message: "Interactive notification dispatched from TUI modal",
        urgency: "normal",
        trigger: "custom",
      }).then(() => {
        this.statusMessage = "Test alert dispatched!";
        this.invalidate();
      });
      return;
    }
  }

  render(width: number): string[] {
    return this.container.render(width);
  }
}
