import type {
  AutomationBlueprint,
  CronBulkMutationResult,
  CronDslQueryFilter,
  CronExecutionRecord,
  CronExecutionRow,
  CronGroupBy,
  CronGroupedLane,
  CronHealthAuditReport,
  CronHealthStatus,
  CronJobManifest,
  CronJobRow,
  CronJobStatus,
  CronMetricsReport,
  CronMutationUndoRecord,
  CronNotificationEvent,
  CronNotificationPreferences,
  CronNotificationRecord,
  CronNotificationRow,
  CronQueryFilter,
  CronScheduleType,
  CronSortBy,
  CronSortDirection,
  CronStateSnapshot,
  IBroccoliCronSubstrate,
} from "../../../core/contracts/cron.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";
import { AnchoredCronJobManager } from "../../../tooling/extensions/cron/anchored-cron-job-manager.js";
import { CronDesktopNotificationDispatcher } from "../../../tooling/extensions/cron/cron-notification-dispatcher.js";

/**
 * BroccoliCronSubstrate.
 * Absorbed under ADR-016 (AKD-DSO Osmosis Paradigm).
 *
 * Provides zero-GC in-memory substrate caching of scheduled cron jobs,
 * automation blueprints, execution logs, health metrics, and CDC reactivity inside BroccoliDB.
 */
export class BroccoliCronSubstrate implements IBroccoliCronSubstrate {
  private readonly jobManager: AnchoredCronJobManager;
  private readonly notificationDispatcher: CronDesktopNotificationDispatcher;
  private readonly undoStack: CronMutationUndoRecord[] = [];
  private readonly redoStack: CronMutationUndoRecord[] = [];

  private static readonly MAX_UNDO_STACK = 100;

  // BroccoliDB Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private jobsTable?: IDbTable<CronJobRow>;
  private executionsTable?: IDbTable<CronExecutionRow>;
  private notifsTable?: IDbTable<CronNotificationRow>;

  constructor(
    jobManager = new AnchoredCronJobManager(),
    dbKernel?: IBroccoliDatabaseKernel,
    notificationPreferences?: Partial<CronNotificationPreferences>
  ) {
    this.jobManager = jobManager;
    this.dbKernel = dbKernel;
    this.notificationDispatcher = new CronDesktopNotificationDispatcher(notificationPreferences);

    if (this.dbKernel) {
      this.initBroccoliDbTables();
    }
  }

  private initBroccoliDbTables(): void {
    if (!this.dbKernel) return;

    this.jobsTable = this.dbKernel.getTable<CronJobRow>("cron_jobs");
    this.executionsTable = this.dbKernel.getTable<CronExecutionRow>("cron_executions");
    this.notifsTable = this.dbKernel.getTable<CronNotificationRow>("cron_notifications");

    try {
      this.jobsTable.createIndex("status");
      this.jobsTable.createIndex("scheduleType");
      this.jobsTable.createIndex("category");
      this.jobsTable.createIndex("blueprintKey");
      this.jobsTable.createSortedIndex("nextRunTimestampMs");
      this.executionsTable.createIndex("jobId");
      this.executionsTable.createSortedIndex("startedAtMs");
    } catch {
      // Non-blocking
    }

    // CDC Subscription
    try {
      this.jobsTable.subscribe((change) => {
        if (change.operation === "UPDATE" && change.after) {
          const job = change.after;
          if (job.status === "failed") {
            this.notificationDispatcher.dispatch({
              jobId: job.id,
              title: `Cron Job Failed`,
              message: `Job '${job.name}' encountered repeated failures`,
              urgency: "critical",
              trigger: "job_failed",
            }).catch(() => {});
          }
        }
      });
    } catch {
      // Non-blocking
    }
  }

  // ---------------------------------------------------------------------------
  // Core Substrate Interface Methods
  // ---------------------------------------------------------------------------

  public storeJob(job: CronJobManifest): void {
    const prev = this.jobManager.getJob(job.id);
    this.jobManager.storeJob(job);

    if (this.jobsTable) {
      const row: CronJobRow = {
        id: job.id,
        name: job.name,
        description: job.description,
        category: job.category || "general",
        scheduleType: job.scheduleType,
        scheduleExpression: job.scheduleExpression,
        intervalMs: job.intervalMs,
        nextRunTimestampMs: job.nextRunTimestampMs,
        status: job.status,
        totalRuns: job.totalRuns,
        blueprintKey: job.blueprintKey,
        tags: (job.tags || []).join(","),
        updatedAtMs: Date.now(),
      };
      this.jobsTable.put(job.id, row);
    }

    // Record undo
    this.recordUndo({
      mutationType: prev ? "update" : "create",
      previousManifest: prev,
      nextManifest: job,
      timestampMs: Date.now(),
    });
  }

  public getJob(jobId: string): CronJobManifest | undefined {
    return this.jobManager.getJob(jobId);
  }

  public deleteJob(jobId: string): boolean {
    const prev = this.jobManager.getJob(jobId);
    const deleted = this.jobManager.deleteJob(jobId);

    if (deleted && this.jobsTable) {
      this.jobsTable.delete(jobId);
    }

    if (deleted && prev) {
      this.recordUndo({
        mutationType: "delete",
        previousManifest: prev,
        timestampMs: Date.now(),
      });
    }

    return deleted;
  }

  public listJobs(statusFilter?: CronJobStatus): readonly CronJobManifest[] {
    return this.jobManager.listJobs(statusFilter);
  }

  public recordExecution(record: CronExecutionRecord): void {
    this.jobManager.recordExecution(record);

    if (this.executionsTable) {
      const row: CronExecutionRow = {
        id: record.id,
        jobId: record.jobId,
        triggerType: record.triggerType,
        startedAtMs: record.startedAtMs,
        durationMs: record.durationMs,
        success: record.success,
        summary: record.summary,
      };
      this.executionsTable.put(record.id, row);
    }

    // Update job consecutive failures & circuit breaker if failing
    const job = this.jobManager.getJob(record.jobId);
    if (job) {
      const consecutive = record.success ? 0 : (job.consecutiveFailures || 0) + 1;
      const maxFailures = job.maxConsecutiveFailures || 5;

      let nextStatus = job.status;
      if (!record.success && consecutive >= maxFailures && job.status === "active") {
        nextStatus = "failed";
        this.notificationDispatcher.dispatch({
          jobId: job.id,
          title: `Circuit Breaker Tripped`,
          message: `Job '${job.name}' auto-paused after ${consecutive} consecutive failures.`,
          urgency: "critical",
          trigger: "consecutive_failure_burst",
        }).catch(() => {});
      }

      const updatedJob: CronJobManifest = {
        ...job,
        status: nextStatus,
        totalRuns: job.totalRuns + 1,
        consecutiveFailures: consecutive,
        lastRunOutcome: {
          success: record.success,
          timestampMs: record.startedAtMs,
          durationMs: record.durationMs,
          summary: record.summary,
          error: record.error,
        },
        updatedAtMs: Date.now(),
      };

      this.jobManager.storeJob(updatedJob);
      if (this.jobsTable) {
        this.jobsTable.put(updatedJob.id, {
          id: updatedJob.id,
          name: updatedJob.name,
          category: updatedJob.category || "general",
          scheduleType: updatedJob.scheduleType,
          status: updatedJob.status,
          totalRuns: updatedJob.totalRuns,
          tags: (updatedJob.tags || []).join(","),
          updatedAtMs: Date.now(),
        });
      }
    }
  }

  public getExecutionHistory(jobId?: string, limit?: number): readonly CronExecutionRecord[] {
    return this.jobManager.getExecutionHistory(jobId, limit);
  }

  public clear(): void {
    this.jobManager.clear();
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  public getJobManager(): AnchoredCronJobManager {
    return this.jobManager;
  }

  public getNotificationDispatcher(): CronDesktopNotificationDispatcher {
    return this.notificationDispatcher;
  }

  // ---------------------------------------------------------------------------
  // Health & SLA Audit Diagnostics
  // ---------------------------------------------------------------------------

  public auditJobHealth(jobId: string): CronHealthAuditReport | null {
    const job = this.jobManager.getJob(jobId);
    if (!job) return null;

    const history = this.jobManager.getExecutionHistory(jobId, 50);
    const totalRuns = history.length;
    const passedRuns = history.filter((r) => r.success).length;
    const successRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 100;
    const consecutive = job.consecutiveFailures || 0;
    const maxFailures = job.maxConsecutiveFailures || 5;
    const isCircuitBroken = consecutive >= maxFailures || job.status === "failed";

    let healthStatus: CronHealthStatus = "on_track";
    if (job.status === "paused") {
      healthStatus = "paused";
    } else if (isCircuitBroken || successRate < 60) {
      healthStatus = "failing";
    } else if (successRate < 90 || consecutive > 0) {
      healthStatus = "at_risk";
    }

    const recommendations: string[] = [];
    if (isCircuitBroken) {
      recommendations.push(`Circuit breaker tripped after ${consecutive} failures. Review error logs and reset status to active.`);
    }
    if (successRate < 80 && totalRuns >= 5) {
      recommendations.push(`Low success rate (${successRate}%). Investigate target system availability or increase timeout.`);
    }
    if (job.scheduleType === "interval" && job.intervalMs && job.intervalMs < 10000) {
      recommendations.push(`High-frequency interval (<10s). Ensure task execution latency is well below interval boundary.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("Job health is optimal. Execution pacing adheres to deterministic SLAs.");
    }

    const nextRunInMs = job.nextRunTimestampMs ? Math.max(0, job.nextRunTimestampMs - Date.now()) : undefined;

    return {
      jobId: job.id,
      jobName: job.name,
      healthStatus,
      totalRuns,
      successRatePercent: successRate,
      consecutiveFailures: consecutive,
      isCircuitBroken,
      nextRunInMs,
      recommendations,
    };
  }

  public getCronMetrics(): CronMetricsReport {
    const jobs = this.jobManager.listJobs();
    const allHistory = this.jobManager.getExecutionHistory(undefined, 500);

    const activeJobs = jobs.filter((j) => j.status === "active").length;
    const pausedJobs = jobs.filter((j) => j.status === "paused").length;
    const totalExecutions = allHistory.length;

    const successfulExecs = allHistory.filter((r) => r.success).length;
    const overallSuccessRate = totalExecutions > 0 ? Math.round((successfulExecs / totalExecutions) * 100) : 100;

    const durations = allHistory.map((r) => r.durationMs).sort((a, b) => a - b);
    const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
    const p99 = durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0;

    const upcoming = jobs
      .filter((j) => j.status === "active" && j.nextRunTimestampMs && j.nextRunTimestampMs > Date.now())
      .map((j) => j.nextRunTimestampMs!)
      .sort((a, b) => a - b);

    return {
      totalJobs: jobs.length,
      activeJobs,
      pausedJobs,
      totalExecutions,
      overallSuccessRatePercent: overallSuccessRate,
      p50DurationMs: Number(p50.toFixed(2)),
      p95DurationMs: Number(p95.toFixed(2)),
      p99DurationMs: Number(p99.toFixed(2)),
      nextScheduledExecutionMs: upcoming.length > 0 ? upcoming[0] : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedJobs(
    groupBy: CronGroupBy = "status",
    sortBy: CronSortBy = "nextRun",
    direction: CronSortDirection = "asc"
  ): readonly CronGroupedLane[] {
    const all = [...this.jobManager.listJobs()];
    const laneMap = new Map<string, { title: string; jobs: CronJobManifest[] }>();

    for (const job of all) {
      let key = "default";
      let title = "Default";

      switch (groupBy) {
        case "status":
          key = job.status;
          title = job.status.toUpperCase();
          break;
        case "scheduleType":
          key = job.scheduleType;
          title = `${job.scheduleType.toUpperCase()} SCHEDULES`;
          break;
        case "category":
          key = (job.category || "general").toLowerCase();
          title = (job.category || "General").toUpperCase();
          break;
        case "health": {
          const audit = this.auditJobHealth(job.id);
          key = audit?.healthStatus || "on_track";
          title = `${(audit?.healthStatus || "ON_TRACK").toUpperCase()} HEALTH`;
          break;
        }
      }

      if (!laneMap.has(key)) {
        laneMap.set(key, { title, jobs: [] });
      }
      laneMap.get(key)!.jobs.push(job);
    }

    // Sort within each lane
    const lanes: CronGroupedLane[] = [];
    for (const [key, group] of laneMap.entries()) {
      group.jobs.sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case "nextRun":
            cmp = (a.nextRunTimestampMs || 0) - (b.nextRunTimestampMs || 0);
            break;
          case "recent":
            cmp = (b.updatedAtMs || b.createdAtMs || 0) - (a.updatedAtMs || a.createdAtMs || 0);
            break;
          case "duration":
            cmp = (a.lastRunOutcome?.durationMs || 0) - (b.lastRunOutcome?.durationMs || 0);
            break;
          case "name":
            cmp = a.name.localeCompare(b.name);
            break;
          case "successRate": {
            const auditA = this.auditJobHealth(a.id)?.successRatePercent || 100;
            const auditB = this.auditJobHealth(b.id)?.successRatePercent || 100;
            cmp = auditA - auditB;
            break;
          }
        }
        return direction === "asc" ? cmp : -cmp;
      });

      lanes.push({
        key,
        title: group.title,
        count: group.jobs.length,
        jobs: group.jobs,
      });
    }

    return lanes;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search
  // ---------------------------------------------------------------------------

  public parseDslQuery(rawQuery: string): CronDslQueryFilter {
    const tokens = rawQuery.trim().split(/\s+/);
    let status: CronJobStatus | undefined;
    let scheduleType: CronScheduleType | undefined;
    let category: string | undefined;
    let healthStatus: CronHealthStatus | undefined;
    const tags: string[] = [];
    let isFailed: boolean | undefined;
    const textTerms: string[] = [];

    for (const token of tokens) {
      if (!token) continue;
      const lower = token.toLowerCase();

      if (lower.startsWith("status:")) {
        const val = lower.split(":")[1] as CronJobStatus;
        if (["active", "paused", "running", "completed", "failed"].includes(val)) {
          status = val;
        }
      } else if (lower.startsWith("type:") || lower.startsWith("sched:")) {
        const val = lower.split(":")[1] as CronScheduleType;
        if (["cron", "interval", "once"].includes(val)) {
          scheduleType = val;
        }
      } else if (lower.startsWith("cat:") || lower.startsWith("category:")) {
        category = lower.split(":")[1];
      } else if (lower.startsWith("health:")) {
        const val = lower.split(":")[1] as CronHealthStatus;
        if (["on_track", "at_risk", "failing", "paused"].includes(val)) {
          healthStatus = val;
        }
      } else if (lower.startsWith("tag:") || lower.startsWith("#")) {
        const t = lower.startsWith("#") ? lower.slice(1) : lower.split(":")[1];
        if (t) tags.push(t);
      } else if (lower === "is:failed" || lower === "is:broken") {
        isFailed = true;
      } else {
        textTerms.push(lower);
      }
    }

    return {
      rawQuery,
      status,
      scheduleType,
      category,
      healthStatus,
      tags: tags.length > 0 ? tags : undefined,
      isFailed,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  public queryJobsDsl(dslFilterOrQuery: CronDslQueryFilter | string): readonly CronJobManifest[] {
    const filter = typeof dslFilterOrQuery === "string" ? this.parseDslQuery(dslFilterOrQuery) : dslFilterOrQuery;
    let result = [...this.jobManager.listJobs()];

    if (filter.status) {
      result = result.filter((j) => j.status === filter.status);
    }
    if (filter.scheduleType) {
      result = result.filter((j) => j.scheduleType === filter.scheduleType);
    }
    if (filter.category) {
      result = result.filter((j) => (j.category || "general").toLowerCase() === filter.category!.toLowerCase());
    }
    if (filter.healthStatus) {
      result = result.filter((j) => {
        const audit = this.auditJobHealth(j.id);
        return audit?.healthStatus === filter.healthStatus;
      });
    }
    if (filter.tags && filter.tags.length > 0) {
      result = result.filter((j) => {
        const jTags = (j.tags || []).map((t) => t.toLowerCase());
        return filter.tags!.every((tag) => jTags.includes(tag.toLowerCase()));
      });
    }
    if (filter.isFailed) {
      result = result.filter((j) => j.status === "failed" || (j.consecutiveFailures || 0) > 0);
    }
    if (filter.textTerms && filter.textTerms.length > 0) {
      result = result.filter((j) => {
        const haystack = `${j.name} ${j.description || ""} ${j.prompt} ${j.category || ""}`.toLowerCase();
        return filter.textTerms!.every((term) => haystack.includes(term));
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkUpdateJobs(
    jobIds: readonly string[],
    updates: Partial<Pick<CronJobManifest, "status" | "category" | "intervalMs" | "tags">>
  ): CronBulkMutationResult {
    const updatedIds: string[] = [];
    const prevManifests: CronJobManifest[] = [];
    const nextManifests: CronJobManifest[] = [];

    for (const id of jobIds) {
      const job = this.jobManager.getJob(id);
      if (!job) continue;

      prevManifests.push(job);
      const updated: CronJobManifest = {
        ...job,
        status: updates.status ?? job.status,
        category: updates.category ?? job.category,
        intervalMs: updates.intervalMs ?? job.intervalMs,
        tags: updates.tags ?? job.tags,
        updatedAtMs: Date.now(),
      };

      this.jobManager.storeJob(updated);
      nextManifests.push(updated);
      updatedIds.push(id);
    }

    if (updatedIds.length > 0) {
      this.recordUndo({
        mutationType: "bulk",
        previousManifests: prevManifests,
        nextManifests,
        timestampMs: Date.now(),
      });
    }

    return {
      matchedCount: jobIds.length,
      modifiedCount: updatedIds.length,
      updatedJobIds: updatedIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Mutation Undo / Redo Stacks
  // ---------------------------------------------------------------------------

  private recordUndo(record: CronMutationUndoRecord): void {
    this.undoStack.push(record);
    if (this.undoStack.length > BroccoliCronSubstrate.MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  public undo(): boolean {
    const rec = this.undoStack.pop();
    if (!rec) return false;

    if (rec.mutationType === "create" && rec.nextManifest) {
      this.jobManager.deleteJob(rec.nextManifest.id);
    } else if (rec.mutationType === "delete" && rec.previousManifest) {
      this.jobManager.storeJob(rec.previousManifest);
    } else if (rec.mutationType === "update" && rec.previousManifest) {
      this.jobManager.storeJob(rec.previousManifest);
    } else if (rec.mutationType === "bulk" && rec.previousManifests) {
      for (const m of rec.previousManifests) {
        this.jobManager.storeJob(m);
      }
    }

    this.redoStack.push(rec);
    return true;
  }

  public redo(): boolean {
    const rec = this.redoStack.pop();
    if (!rec) return false;

    if (rec.mutationType === "create" && rec.nextManifest) {
      this.jobManager.storeJob(rec.nextManifest);
    } else if (rec.mutationType === "delete" && rec.previousManifest) {
      this.jobManager.deleteJob(rec.previousManifest.id);
    } else if (rec.mutationType === "update" && rec.nextManifest) {
      this.jobManager.storeJob(rec.nextManifest);
    } else if (rec.mutationType === "bulk" && rec.nextManifests) {
      for (const m of rec.nextManifests) {
        this.jobManager.storeJob(m);
      }
    }

    this.undoStack.push(rec);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Export Renderers (HTML, Markdown, CSV, JSON)
  // ---------------------------------------------------------------------------

  public exportMarkdownReport(): string {
    const jobs = this.jobManager.listJobs();
    const metrics = this.getCronMetrics();

    let md = `# ⏱️ LUMI Cron & Automation Scheduler Report\n\n`;
    md += `**Total Jobs**: ${metrics.totalJobs} | **Active**: ${metrics.activeJobs} | **Paused**: ${metrics.pausedJobs} | **Success Rate**: ${metrics.overallSuccessRatePercent}%\n\n`;
    md += `| Job Name | Type | Schedule | Status | Runs | Last Duration | Health |\n`;
    md += `|---|---|---|---|---|---|---|\n`;

    for (const j of jobs) {
      const audit = this.auditJobHealth(j.id);
      const sched = j.scheduleExpression || (j.intervalMs ? `${j.intervalMs / 1000}s` : "once");
      const dur = j.lastRunOutcome ? `${j.lastRunOutcome.durationMs.toFixed(1)}ms` : "N/A";
      md += `| **${j.name}** | \`${j.scheduleType}\` | \`${sched}\` | \`${j.status}\` | ${j.totalRuns} | ${dur} | ${audit?.healthStatus.toUpperCase()} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const jobs = this.jobManager.listJobs();
    const lines = ["id,name,category,scheduleType,scheduleExpression,intervalMs,status,totalRuns,consecutiveFailures"];

    for (const j of jobs) {
      const cleanName = `"${j.name.replace(/"/g, '""')}"`;
      lines.push(`${j.id},${cleanName},${j.category || "general"},${j.scheduleType},${j.scheduleExpression || ""},${j.intervalMs || ""},${j.status},${j.totalRuns},${j.consecutiveFailures || 0}`);
    }

    return lines.join("\n");
  }

  public exportInteractiveHtmlView(activeJobId?: string): string {
    const jobs = this.jobManager.listJobs();
    const metrics = this.getCronMetrics();
    const history = this.jobManager.getExecutionHistory(undefined, 100);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Automation & Cron Hub (ADR-016)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg-base: #030712;
      --bg-surface: #0f172a;
      --bg-card: #1e293b;
      --card-border: #334155;
      --text-primary: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.25);
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg-base);
      color: var(--text-primary);
      padding: 1.5rem;
      min-height: 100vh;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--card-border);
    }
    .brand { font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 0.6rem; }
    .kpi-ribbon {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .kpi-card {
      background: var(--bg-surface);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .kpi-val { font-size: 1.5rem; font-weight: 700; }
    .kpi-label { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; }
    .jobs-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--bg-surface);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--card-border);
    }
    .jobs-table th, .jobs-table td { padding: 0.9rem 1.2rem; text-align: left; font-size: 0.9rem; }
    .jobs-table th { background: #1e293b; color: var(--text-muted); text-transform: uppercase; font-size: 0.75rem; }
    .jobs-table tr:hover td { background: rgba(56, 189, 248, 0.05); }
    .badge { padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .badge-active { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .badge-paused { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .badge-failed { background: rgba(239, 68, 68, 0.2); color: #f87171; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>⏱️ LUMI AUTOMATION & CRON HUB</span>
      <span style="font-size: 0.75rem; color: var(--text-muted); background: #1e293b; padding: 0.15rem 0.5rem; border-radius: 99px;">ADR-016</span>
    </div>
    <div style="font-size: 0.85rem; color: var(--text-muted);">
      Active Jobs: <strong>${metrics.activeJobs}/${metrics.totalJobs}</strong>
    </div>
  </header>

  <div class="kpi-ribbon">
    <div class="kpi-card">
      <div class="kpi-val" style="color: #38bdf8;">${metrics.totalJobs}</div>
      <div><div class="kpi-label">Registered Jobs</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #10b981;">${metrics.overallSuccessRatePercent}%</div>
      <div><div class="kpi-label">Success Rate SLA</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #f59e0b;">${metrics.p95DurationMs}ms</div>
      <div><div class="kpi-label">P95 Execution Latency</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #818cf8;">${metrics.totalExecutions}</div>
      <div><div class="kpi-label">Total Executions</div></div>
    </div>
  </div>

  <table class="jobs-table">
    <thead>
      <tr>
        <th>Job Name</th>
        <th>Schedule Type</th>
        <th>Expression / Interval</th>
        <th>Status</th>
        <th>Runs</th>
        <th>Last Outcome</th>
      </tr>
    </thead>
    <tbody>
      ${jobs
        .map(
          (j) => `
        <tr>
          <td><strong>${j.name}</strong><br><small style="color:var(--text-muted);">${j.id}</small></td>
          <td><code>${j.scheduleType}</code></td>
          <td><code>${j.scheduleExpression || (j.intervalMs ? j.intervalMs + "ms" : "once")}</code></td>
          <td><span class="badge badge-${j.status}">${j.status}</span></td>
          <td>${j.totalRuns}</td>
          <td>${j.lastRunOutcome ? (j.lastRunOutcome.success ? "✓ OK" : "✗ FAIL") + ` (${j.lastRunOutcome.durationMs.toFixed(1)}ms)` : "Pending"}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;
  }
}
