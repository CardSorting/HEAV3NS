import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  AutomationBlueprint,
  CronGroupBy,
  CronJobManifest,
  CronJobStatus,
  CronScheduleType,
  CronSortBy,
  CronSortDirection,
  ICronScheduler,
} from "../../../core/contracts/cron.contracts.js";
import { MonolithCronScheduler } from "../../../agents/extensions/cron/monolith-cron-scheduler.js";
import { DeterministicBlueprintCatalog } from "./deterministic-blueprint-catalog.js";
import { CronSnapshotManager } from "../../../sessions/extensions/cron/cron-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

/**
 * CronToolSuite.
 * Absorbed under ADR-016 (AKD-DSO Osmosis Paradigm).
 *
 * Model tool suite enabling AI agents to schedule, inspect, trigger, audit,
 * and manage background recurring jobs and automation blueprints deterministically.
 */
export class CronToolSuite {
  private readonly scheduler: MonolithCronScheduler;
  private readonly blueprintCatalog: DeterministicBlueprintCatalog;
  private readonly snapshotManager: CronSnapshotManager;

  constructor(
    scheduler: ICronScheduler,
    blueprintCatalog = new DeterministicBlueprintCatalog()
  ) {
    this.scheduler = scheduler as MonolithCronScheduler;
    this.blueprintCatalog = blueprintCatalog;
    this.snapshotManager = new CronSnapshotManager(this.scheduler.getSubstrate());
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "cron_list_jobs",
        description: "List all scheduled background cron jobs, status, recurrence schedules, and execution history.",
        parameters: {
          status: { type: "string", description: "Optional filter by status: 'active', 'paused', 'running', 'completed', 'failed'." },
        },
        execute: async (args: Record<string, unknown>) => {
          const status = typeof args.status === "string" ? (args.status as CronJobStatus) : undefined;
          const jobs = this.scheduler.listJobs(status);
          return { success: true, jobs };
        },
      },
      {
        name: "cron_get_job",
        description: "Retrieve complete specification and execution status for a specific scheduled job.",
        parameters: {
          jobId: { type: "string", required: true, description: "Job ID to retrieve" },
        },
        execute: async (args: Record<string, unknown>) => {
          const jobId = String(args.jobId || "");
          const job = this.scheduler.getJob(jobId);
          return { success: job !== undefined, job };
        },
      },
      {
        name: "cron_create_job",
        description: "Create a new recurring cron job, interval timer, or instantiate an automation blueprint.",
        parameters: {
          name: { type: "string", required: true, description: "Descriptive name for the scheduled job." },
          prompt: { type: "string", description: "Instruction prompt executed when the job triggers." },
          scheduleType: { type: "string", description: "Schedule type: 'cron' (default), 'interval', or 'once'." },
          scheduleExpression: { type: "string", description: "5-field cron expression (e.g. '0 9 * * 1-5')." },
          intervalMs: { type: "number", description: "Interval duration in milliseconds (for 'interval' type)." },
          category: { type: "string", description: "Category grouping (e.g. 'operations', 'security', 'maintenance')." },
          tags: { type: "string", description: "Comma-separated tags (e.g. 'backup,p0')." },
          blueprintKey: { type: "string", description: "Optional blueprint key to instantiate." },
          blueprintSlots: { type: "string", description: "JSON-encoded dictionary of slot values." },
        },
        execute: async (args: Record<string, unknown>) => {
          const nameStr = String(args.name ?? "Untitled Job");
          const blueprintKey = typeof args.blueprintKey === "string" ? args.blueprintKey : undefined;

          if (blueprintKey) {
            let slotValues: Record<string, unknown> = {};
            if (typeof args.blueprintSlots === "string" && args.blueprintSlots.trim().length > 0) {
              try {
                slotValues = JSON.parse(args.blueprintSlots);
              } catch {
                return { success: false, error: "Failed to parse blueprintSlots JSON dictionary" };
              }
            }
            const jobId = `job-${Date.now()}`;
            const materialized = this.blueprintCatalog.materializeBlueprint(blueprintKey, jobId, slotValues);
            const job = this.scheduler.registerJob(materialized);
            return { success: true, job };
          }

          const prompt = String(args.prompt ?? "");
          if (!prompt) {
            return { success: false, error: "Prompt is required when blueprintKey is not provided" };
          }

          const scheduleType = (args.scheduleType as CronScheduleType) || "cron";
          const scheduleExpression = typeof args.scheduleExpression === "string" ? args.scheduleExpression : "0 9 * * 1-5";
          const intervalMs = typeof args.intervalMs === "number" ? args.intervalMs : undefined;
          const category = typeof args.category === "string" ? args.category : "general";
          const tags = typeof args.tags === "string" ? args.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

          const job = this.scheduler.registerJob({
            id: `job-${Date.now()}`,
            name: nameStr,
            scheduleType,
            scheduleExpression,
            intervalMs,
            category,
            tags,
            prompt,
          });

          return { success: true, job };
        },
      },
      {
        name: "cron_trigger_job",
        description: "Manually trigger an existing scheduled job immediately out-of-schedule.",
        parameters: {
          jobId: { type: "string", required: true, description: "Identifier of the cron job to trigger." },
        },
        execute: async (args: Record<string, unknown>) => {
          const jobId = String(args.jobId ?? "");
          const outcome = await this.scheduler.triggerJob(jobId);
          return { success: outcome.success, outcome };
        },
      },
      {
        name: "cron_pause_job",
        description: "Pause an active cron job to temporarily halt scheduled execution.",
        parameters: {
          jobId: { type: "string", required: true, description: "Identifier of the cron job to pause." },
        },
        execute: async (args: Record<string, unknown>) => {
          const jobId = String(args.jobId ?? "");
          const success = this.scheduler.pauseJob(jobId);
          return { success, jobId, status: "paused" };
        },
      },
      {
        name: "cron_resume_job",
        description: "Resume a paused cron job to restore scheduled execution.",
        parameters: {
          jobId: { type: "string", required: true, description: "Identifier of the cron job to resume." },
        },
        execute: async (args: Record<string, unknown>) => {
          const jobId = String(args.jobId ?? "");
          const success = this.scheduler.resumeJob(jobId);
          return { success, jobId, status: "active" };
        },
      },
      {
        name: "cron_delete_job",
        description: "Permanently delete a scheduled cron job.",
        parameters: {
          jobId: { type: "string", required: true, description: "Identifier of the cron job to delete." },
        },
        execute: async (args: Record<string, unknown>) => {
          const jobId = String(args.jobId ?? "");
          const success = this.scheduler.deleteJob(jobId);
          return { success, jobId, deleted: success };
        },
      },
      {
        name: "cron_list_blueprints",
        description: "List all parameterized automation blueprint templates available in the catalog.",
        parameters: {
          category: { type: "string", description: "Optional category filter: 'productivity', 'operations', 'maintenance', 'security', 'performance'." },
        },
        execute: async (args: Record<string, unknown>) => {
          const category = typeof args.category === "string" ? args.category : undefined;
          const blueprints = this.blueprintCatalog.listBlueprints(category);
          return { success: true, blueprints };
        },
      },
      {
        name: "cron_get_blueprint",
        description: "Retrieve slot specifications and template definitions for an automation blueprint.",
        parameters: {
          key: { type: "string", required: true, description: "Blueprint key (e.g. 'daily_summary')" },
        },
        execute: async (args: Record<string, unknown>) => {
          const key = String(args.key || "");
          const blueprint = this.blueprintCatalog.getBlueprint(key);
          return { success: blueprint !== undefined, blueprint };
        },
      },
      {
        name: "cron_instantiate_blueprint",
        description: "Instantiate and register an automation blueprint into the active scheduler.",
        parameters: {
          key: { type: "string", required: true, description: "Blueprint key to instantiate." },
          slotValues: { type: "string", description: "JSON dictionary of slot parameter values." },
        },
        execute: async (args: Record<string, unknown>) => {
          const key = String(args.key || "");
          let slots: Record<string, unknown> = {};
          if (typeof args.slotValues === "string" && args.slotValues.trim().length > 0) {
            try {
              slots = JSON.parse(args.slotValues);
            } catch {
              return { success: false, error: "Failed to parse slotValues JSON dictionary" };
            }
          }
          const jobId = `job-${Date.now()}`;
          const materialized = this.blueprintCatalog.materializeBlueprint(key, jobId, slots);
          const job = this.scheduler.registerJob(materialized);
          return { success: true, job };
        },
      },
      {
        name: "cron_get_execution_history",
        description: "Fetch historical execution ledger records across jobs.",
        parameters: {
          jobId: { type: "string", description: "Optional job ID filter" },
          limit: { type: "number", description: "Max records to return (default: 50)" },
        },
        execute: async (args: Record<string, unknown>) => {
          const jobId = typeof args.jobId === "string" ? args.jobId : undefined;
          const limit = typeof args.limit === "number" ? args.limit : 50;
          const history = this.scheduler.getSubstrate().getExecutionHistory(jobId, limit);
          return { success: true, history };
        },
      },
      {
        name: "cron_audit_health",
        description: "Perform comprehensive SLA health auditing, failure streak detection, and recommendations.",
        parameters: {
          jobId: { type: "string", required: true, description: "Job ID to audit" },
        },
        execute: async (args: Record<string, unknown>) => {
          const jobId = String(args.jobId || "");
          const audit = this.scheduler.auditJobHealth(jobId);
          return { success: audit !== null, audit };
        },
      },
      {
        name: "cron_get_metrics",
        description: "Get aggregate scheduler telemetry: success rates, P50/P95/P99 latency, and upcoming runs.",
        parameters: {},
        execute: async () => {
          const metrics = this.scheduler.getCronMetrics();
          return { success: true, metrics };
        },
      },
      {
        name: "cron_group_and_sort",
        description: "Group and sort scheduled jobs into multi-criteria swimlane lanes.",
        parameters: {
          groupBy: { type: "string", description: "Group by: 'status', 'scheduleType', 'category', 'health'" },
          sortBy: { type: "string", description: "Sort by: 'nextRun', 'recent', 'successRate', 'duration', 'name'" },
          direction: { type: "string", description: "Sort direction: 'asc' or 'desc'" },
        },
        execute: async (args: Record<string, unknown>) => {
          const groupBy = (args.groupBy as CronGroupBy) || "status";
          const sortBy = (args.sortBy as CronSortBy) || "nextRun";
          const direction = (args.direction as CronSortDirection) || "asc";
          const lanes = this.scheduler.getGroupedJobs(groupBy, sortBy, direction);
          return { success: true, lanes };
        },
      },
      {
        name: "cron_search_dsl",
        description: "Search scheduled jobs using natural query DSL (e.g. 'status:active type:interval tag:p0 #backup').",
        parameters: {
          query: { type: "string", required: true, description: "Natural query DSL string" },
        },
        execute: async (args: Record<string, unknown>) => {
          const query = String(args.query || "");
          const results = this.scheduler.queryJobsDsl(query);
          return { success: true, results };
        },
      },
      {
        name: "cron_bulk_update",
        description: "Apply batch mutations across multiple scheduled jobs atomically.",
        parameters: {
          jobIds: { type: "string", required: true, description: "Comma-separated list of job IDs" },
          status: { type: "string", description: "New status to apply" },
          category: { type: "string", description: "New category to assign" },
        },
        execute: async (args: Record<string, unknown>) => {
          const jobIds = String(args.jobIds || "").split(",").map((s) => s.trim()).filter(Boolean);
          const status = typeof args.status === "string" ? (args.status as CronJobStatus) : undefined;
          const category = typeof args.category === "string" ? args.category : undefined;

          const res = this.scheduler.bulkUpdateJobs(jobIds, { status, category });
          return { success: res.modifiedCount > 0, result: res };
        },
      },
      {
        name: "cron_undo",
        description: "Undo the last scheduled job creation, mutation, or status change.",
        parameters: {},
        execute: async () => {
          const success = this.scheduler.undo();
          return { success };
        },
      },
      {
        name: "cron_redo",
        description: "Redo the previously undone scheduled job mutation.",
        parameters: {},
        execute: async () => {
          const success = this.scheduler.redo();
          return { success };
        },
      },
      {
        name: "cron_export_html",
        description: "Export the full scheduler state into an interactive single-page HTML dashboard application.",
        parameters: {
          jobId: { type: "string", description: "Optional specific job ID to focus on" },
        },
        execute: async (args: Record<string, unknown>) => {
          const jobId = typeof args.jobId === "string" ? args.jobId : undefined;
          const html = this.scheduler.exportInteractiveHtmlView(jobId);
          return { success: true, html };
        },
      },
      {
        name: "cron_export_markdown",
        description: "Export the scheduler overview and job status matrix as GitHub-flavored Markdown.",
        parameters: {},
        execute: async () => {
          const markdown = this.scheduler.exportMarkdownReport();
          return { success: true, markdown };
        },
      },
      {
        name: "cron_export_csv",
        description: "Export scheduled jobs and metrics as a CSV spreadsheet.",
        parameters: {},
        execute: async () => {
          const csv = this.scheduler.exportCsvReport();
          return { success: true, csv };
        },
      },
      {
        name: "cron_render_dashboard",
        description: "Render a human-readable ANSI CLI dashboard for a scheduled job.",
        parameters: {
          jobId: { type: "string", required: true, description: "Job ID to render" },
        },
        execute: async (args: Record<string, unknown>) => {
          const jobId = String(args.jobId || "");
          const job = this.scheduler.getJob(jobId);
          if (!job) return { success: false, error: `Job '${jobId}' not found` };
          const rendered = BroccoliViewRenderer.renderCronDashboard(job as any);
          return { success: true, rendered };
        },
      },
      {
        name: "cron_render_timeline",
        description: "Render an ASCII schedule timeline chart of upcoming cron jobs.",
        parameters: {},
        execute: async () => {
          const jobs = this.scheduler.listJobs();
          const rendered = BroccoliViewRenderer.renderCronScheduleTimeline(jobs as any);
          return { success: true, rendered };
        },
      },
      {
        name: "cron_send_notification",
        description: "Dispatch a desktop or terminal notification event for a scheduled automation.",
        parameters: {
          jobId: { type: "string", description: "Associated job ID" },
          title: { type: "string", required: true, description: "Notification title" },
          message: { type: "string", required: true, description: "Notification body message" },
          urgency: { type: "string", description: "Urgency: 'low', 'normal', 'critical'" },
        },
        execute: async (args: Record<string, unknown>) => {
          const res = await this.scheduler.getNotificationDispatcher().dispatch({
            jobId: typeof args.jobId === "string" ? args.jobId : undefined,
            title: String(args.title || "LUMI Automation"),
            message: String(args.message || ""),
            urgency: (args.urgency as any) || "normal",
            trigger: "custom",
          });
          return { success: res.dispatched, result: res };
        },
      },
      {
        name: "cron_get_notifications",
        description: "Retrieve history of dispatched cron notifications.",
        parameters: {
          limit: { type: "number", description: "Max records to return (default: 50)" },
          unreadOnly: { type: "boolean", description: "Filter only unread notifications" },
        },
        execute: async (args: Record<string, unknown>) => {
          const limit = typeof args.limit === "number" ? args.limit : 50;
          const unreadOnly = Boolean(args.unreadOnly);
          const history = this.scheduler.getNotificationDispatcher().getHistory(limit, unreadOnly);
          return { success: true, notifications: history };
        },
      },
      {
        name: "cron_configure_notifications",
        description: "Update desktop notification preferences (sound, DND, min urgency).",
        parameters: {
          enabled: { type: "boolean", description: "Master enable flag" },
          soundEnabled: { type: "boolean", description: "Enable audio chimes" },
          dndEnabled: { type: "boolean", description: "Enable Do Not Disturb" },
          minUrgency: { type: "string", description: "Minimum urgency threshold: 'low', 'normal', 'critical'" },
        },
        execute: async (args: Record<string, unknown>) => {
          const updates: Record<string, unknown> = {};
          if (args.enabled !== undefined) updates.enabled = Boolean(args.enabled);
          if (args.soundEnabled !== undefined) updates.soundEnabled = Boolean(args.soundEnabled);
          if (args.dndEnabled !== undefined) updates.dndEnabled = Boolean(args.dndEnabled);
          if (args.minUrgency !== undefined) updates.minUrgency = args.minUrgency;

          const prefs = this.scheduler.getNotificationDispatcher().updatePreferences(updates as any);
          return { success: true, preferences: prefs };
        },
      },
      {
        name: "cron_reset_circuit_breaker",
        description: "Reset the circuit breaker on a failing job, clearing consecutive failure counters and restoring active status.",
        parameters: {
          jobId: { type: "string", required: true, description: "Job ID to reset" },
        },
        execute: async (args: Record<string, unknown>) => {
          const jobId = String(args.jobId || "");
          const job = this.scheduler.getJob(jobId);
          if (!job) return { success: false, error: `Job '${jobId}' not found` };

          this.scheduler.getSubstrate().storeJob({
            ...job,
            status: "active",
            consecutiveFailures: 0,
            updatedAtMs: Date.now(),
          });
          return { success: true, jobId, status: "active", consecutiveFailures: 0 };
        },
      },
      {
        name: "cron_schedule_quick_timer",
        description: "Convenience helper to schedule a one-shot or recurring interval timer with a simple delay in seconds.",
        parameters: {
          name: { type: "string", required: true, description: "Name of the timer" },
          prompt: { type: "string", required: true, description: "Instruction to execute when timer expires" },
          delaySeconds: { type: "number", required: true, description: "Delay in seconds until execution" },
          isRecurring: { type: "boolean", description: "If true, repeats every delaySeconds indefinitely" },
        },
        execute: async (args: Record<string, unknown>) => {
          const name = String(args.name || "Quick Timer");
          const prompt = String(args.prompt || "");
          const delaySeconds = Number(args.delaySeconds) || 60;
          const isRecurring = Boolean(args.isRecurring);

          const job = this.scheduler.registerJob({
            id: `timer-${Date.now()}`,
            name,
            scheduleType: isRecurring ? "interval" : "once",
            intervalMs: isRecurring ? delaySeconds * 1000 : undefined,
            targetTimestampMs: !isRecurring ? Date.now() + delaySeconds * 1000 : undefined,
            prompt,
          });

          return { success: true, job };
        },
      },
      {
        name: "cron_schedule_recurring",
        description: "Convenience helper to schedule a recurring cron job with a 5-field cron expression.",
        parameters: {
          name: { type: "string", required: true, description: "Name of the recurring job" },
          prompt: { type: "string", required: true, description: "Instruction prompt to execute" },
          cronExpression: { type: "string", required: true, description: "5-field cron expression (e.g. '0 9 * * 1-5')" },
          category: { type: "string", description: "Category grouping" },
        },
        execute: async (args: Record<string, unknown>) => {
          const name = String(args.name || "Recurring Job");
          const prompt = String(args.prompt || "");
          const cronExpression = String(args.cronExpression || "0 9 * * 1-5");
          const category = typeof args.category === "string" ? args.category : "general";

          const job = this.scheduler.registerJob({
            id: `cron-${Date.now()}`,
            name,
            scheduleType: "cron",
            scheduleExpression: cronExpression,
            category,
            prompt,
          });

          return { success: true, job };
        },
      },
      {
        name: "cron_snapshot_create",
        description: "Capture an O(1) state snapshot of all scheduled jobs and execution ledgers.",
        parameters: {
          tick: { type: "number", description: "Snapshot tick identifier" },
        },
        execute: async (args: Record<string, unknown>) => {
          const tick = typeof args.tick === "number" ? args.tick : 0;
          const snapshot = this.snapshotManager.createSnapshot(tick);
          return { success: true, snapshot };
        },
      },
      {
        name: "cron_snapshot_restore",
        description: "Restore scheduler state from a previously captured snapshot.",
        parameters: {
          snapshotTick: { type: "number", description: "Snapshot tick to restore from recent snapshots" },
        },
        execute: async (args: Record<string, unknown>) => {
          const recents = this.snapshotManager.getRecentSnapshots();
          if (recents.length === 0) return { success: false, error: "No snapshots available" };
          const target = typeof args.snapshotTick === "number" ? recents.find((s) => s.snapshotTick === args.snapshotTick) || recents[recents.length - 1] : recents[recents.length - 1];
          this.snapshotManager.restoreSnapshot(target);
          return { success: true, restoredTick: target.snapshotTick };
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    cwd?: string
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown }> {
    const tool = this.getTools().find((t) => t.name === name);
    if (!tool) {
      return { success: false, error: `Tool '${name}' not found in CronToolSuite` };
    }
    const res = (await tool.execute(args, cwd ?? process.cwd())) as Record<string, unknown>;
    const data = res.job ?? res.jobs ?? res.blueprints ?? res.rendered ?? res.audit ?? res.metrics ?? res;
    return { success: !!res.success, data, ...res };
  }
}
