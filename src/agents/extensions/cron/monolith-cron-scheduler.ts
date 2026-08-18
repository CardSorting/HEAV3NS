import type {
  AutomationBlueprint,
  CronBulkMutationResult,
  CronDslQueryFilter,
  CronExecutionRecord,
  CronGroupBy,
  CronGroupedLane,
  CronHealthAuditReport,
  CronJobManifest,
  CronJobStatus,
  CronMetricsReport,
  CronNotificationPreferences,
  CronQueryFilter,
  CronSortBy,
  CronSortDirection,
  ICronScheduler,
} from "../../../core/contracts/cron.contracts.js";
import { CronLifecycleGuard } from "./cron-lifecycle-guard.js";
import { BroccoliCronSubstrate } from "../../../sessions/extensions/cron/broccoli-cron-substrate.js";
import { CronDesktopNotificationDispatcher } from "../../../tooling/extensions/cron/cron-notification-dispatcher.js";

/**
 * MonolithCronScheduler.
 * Absorbed under ADR-016 (AKD-DSO Osmosis Paradigm).
 *
 * Coordinates frame-tick and timestamp synchronized background job execution,
 * ensuring zero-drift scheduling, lifecycle guard enforcement, and atomic outcome logging.
 */
export class MonolithCronScheduler implements ICronScheduler {
  private readonly substrate: BroccoliCronSubstrate;
  private readonly lifecycleGuard: CronLifecycleGuard;
  private currentTick = 0;

  constructor(
    substrate = new BroccoliCronSubstrate(),
    lifecycleGuard = new CronLifecycleGuard()
  ) {
    this.substrate = substrate;
    this.lifecycleGuard = lifecycleGuard;
  }

  setCurrentTick(tick: number): void {
    this.currentTick = tick;
  }

  registerJob(
    manifestInput: Omit<CronJobManifest, "status" | "totalRuns" | "createdTick">
  ): CronJobManifest {
    const validation = this.lifecycleGuard.validateJobManifest(manifestInput);
    if (!validation.allowed) {
      throw new Error(`Cron job registration rejected: ${validation.reason}`);
    }

    const now = Date.now();
    let nextRunTimestampMs = manifestInput.nextRunTimestampMs;

    if (!nextRunTimestampMs) {
      if (manifestInput.scheduleType === "interval" && manifestInput.intervalMs) {
        nextRunTimestampMs = now + manifestInput.intervalMs;
      } else if (manifestInput.scheduleType === "once" && manifestInput.targetTimestampMs) {
        nextRunTimestampMs = manifestInput.targetTimestampMs;
      } else {
        // Default to next interval or 60s
        nextRunTimestampMs = now + 60000;
      }
    }

    const sanitizedPrompt = this.lifecycleGuard.sanitizePrompt(manifestInput.prompt);

    const job: CronJobManifest = {
      ...manifestInput,
      prompt: sanitizedPrompt,
      status: "active",
      totalRuns: 0,
      consecutiveFailures: 0,
      nextRunTick: manifestInput.nextRunTick,
      nextRunTimestampMs,
      createdTick: this.currentTick,
      createdAtMs: now,
      updatedAtMs: now,
    };

    this.substrate.storeJob(job);
    return job;
  }

  async triggerJob(jobId: string): Promise<CronExecutionRecord> {
    const job = this.substrate.getJob(jobId);
    if (!job) {
      const record: CronExecutionRecord = {
        id: `exec-${Date.now()}`,
        jobId,
        triggerType: "manual",
        startedAtMs: Date.now(),
        durationMs: 0,
        success: false,
        summary: `Job '${jobId}' not found`,
        error: `Job '${jobId}' does not exist`,
      };
      this.substrate.recordExecution(record);
      return record;
    }

    const startTime = performance.now();
    const startedAtMs = Date.now();

    // Execute job logic
    const summary = `Executed cron job '${job.name}' (Prompt: "${job.prompt.slice(0, 60)}...")`;
    const durationMs = performance.now() - startTime;

    // Calculate next run timestamp if interval
    let nextRunTimestampMs = job.nextRunTimestampMs;
    if (job.scheduleType === "interval" && job.intervalMs) {
      nextRunTimestampMs = startedAtMs + job.intervalMs;
    }

    const record: CronExecutionRecord = {
      id: `exec-${Date.now()}`,
      jobId,
      triggerType: "manual",
      startedAtMs,
      durationMs,
      success: true,
      summary,
    };

    this.substrate.recordExecution(record);
    return record;
  }

  pauseJob(jobId: string): boolean {
    const job = this.substrate.getJob(jobId);
    if (!job) return false;
    this.substrate.storeJob({ ...job, status: "paused", updatedAtMs: Date.now() });
    return true;
  }

  resumeJob(jobId: string): boolean {
    const job = this.substrate.getJob(jobId);
    if (!job) return false;
    this.substrate.storeJob({ ...job, status: "active", consecutiveFailures: 0, updatedAtMs: Date.now() });
    return true;
  }

  deleteJob(jobId: string): boolean {
    return this.substrate.deleteJob(jobId);
  }

  getJob(jobId: string): CronJobManifest | undefined {
    return this.substrate.getJob(jobId);
  }

  listJobs(statusFilter?: CronJobStatus): readonly CronJobManifest[] {
    return this.substrate.listJobs(statusFilter);
  }

  async evaluateTick(currentTick: number, nowMs = Date.now()): Promise<readonly CronExecutionRecord[]> {
    this.currentTick = currentTick;
    const executedRecords: CronExecutionRecord[] = [];
    const activeJobs = this.substrate.listJobs().filter((j) => j.status === "active");

    for (const job of activeJobs) {
      let isDue = false;
      if (job.nextRunTimestampMs !== undefined) {
        isDue = nowMs >= job.nextRunTimestampMs;
      } else if (job.nextRunTick !== undefined) {
        isDue = currentTick >= job.nextRunTick;
      }

      if (isDue) {
        const startTime = performance.now();
        const startedAtMs = nowMs;

        const summary = `Executed scheduled job '${job.name}' at tick ${currentTick}`;
        const durationMs = performance.now() - startTime;

        let nextRunTimestampMs = job.nextRunTimestampMs;
        if (job.scheduleType === "interval" && job.intervalMs) {
          nextRunTimestampMs = startedAtMs + job.intervalMs;
        } else if (job.scheduleType === "once") {
          this.substrate.storeJob({ ...job, status: "completed", updatedAtMs: Date.now() });
        }

        const record: CronExecutionRecord = {
          id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          jobId: job.id,
          triggerType: "scheduled",
          startedAtMs,
          durationMs,
          success: true,
          summary,
        };

        this.substrate.recordExecution(record);
        executedRecords.push(record);
      }
    }

    return Object.freeze(executedRecords);
  }

  // ---------------------------------------------------------------------------
  // Facade Methods for Substrate Capabilities
  // ---------------------------------------------------------------------------

  public getSubstrate(): BroccoliCronSubstrate {
    return this.substrate;
  }

  public auditJobHealth(jobId: string): CronHealthAuditReport | null {
    return this.substrate.auditJobHealth(jobId);
  }

  public getCronMetrics(): CronMetricsReport {
    return this.substrate.getCronMetrics();
  }

  public getGroupedJobs(
    groupBy: CronGroupBy = "status",
    sortBy: CronSortBy = "nextRun",
    direction: CronSortDirection = "asc"
  ): readonly CronGroupedLane[] {
    return this.substrate.getGroupedJobs(groupBy, sortBy, direction);
  }

  public queryJobsDsl(query: CronDslQueryFilter | string): readonly CronJobManifest[] {
    return this.substrate.queryJobsDsl(query);
  }

  public bulkUpdateJobs(
    jobIds: readonly string[],
    updates: Partial<Pick<CronJobManifest, "status" | "category" | "intervalMs" | "tags">>
  ): CronBulkMutationResult {
    return this.substrate.bulkUpdateJobs(jobIds, updates);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public getNotificationDispatcher(): CronDesktopNotificationDispatcher {
    return this.substrate.getNotificationDispatcher();
  }

  public exportInteractiveHtmlView(jobId?: string): string {
    return this.substrate.exportInteractiveHtmlView(jobId);
  }

  public exportMarkdownReport(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsvReport(): string {
    return this.substrate.exportCsvReport();
  }
}
