/**
 * Cron & Automation Blueprint Contracts.
 * Absorbed under ADR-016 (AKD-DSO Osmosis Paradigm).
 *
 * Defines typed specifications for deterministic cron schedules, parameterized
 * automation blueprints, execution ledgers, and scheduler lifecycles.
 */

export type CronScheduleType = "cron" | "interval" | "once";

export type CronJobStatus = "active" | "paused" | "running" | "completed" | "failed";

export type BlueprintSlotType = "time" | "enum" | "text" | "weekdays" | "number" | "boolean";

export interface BlueprintSlot {
  readonly name: string;
  readonly type: BlueprintSlotType;
  readonly label: string;
  readonly default?: unknown;
  readonly options?: readonly string[];
  readonly optional?: boolean;
  readonly help?: string;
  readonly strict?: boolean;
}

export interface AutomationBlueprint {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly scheduleTemplate: string;
  readonly promptTemplate: string;
  readonly slots: readonly BlueprintSlot[];
  readonly defaultTags?: readonly string[];
}

export interface CronJobManifest {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly tags?: readonly string[];
  readonly scheduleType: CronScheduleType;
  readonly scheduleExpression?: string; // 5-field cron, e.g. "0 9 * * 1-5"
  readonly intervalMs?: number;         // Interval in milliseconds
  readonly targetTimestampMs?: number;  // For "once" jobs
  readonly nextRunTick?: number;
  readonly nextRunTimestampMs?: number;
  readonly prompt: string;
  readonly blueprintKey?: string;
  readonly blueprintSlots?: Readonly<Record<string, unknown>>;
  readonly status: CronJobStatus;
  readonly totalRuns: number;
  readonly consecutiveFailures?: number;
  readonly maxConsecutiveFailures?: number;
  readonly lastRunOutcome?: {
    readonly success: boolean;
    readonly timestampMs: number;
    readonly durationMs: number;
    readonly summary: string;
    readonly error?: string;
  };
  readonly createdTick: number;
  readonly createdAtMs?: number;
  readonly updatedAtMs?: number;
}

export interface CronExecutionRecord {
  readonly id: string;
  readonly jobId: string;
  readonly triggerType: "scheduled" | "manual";
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly summary: string;
  readonly error?: string;
}

export interface CronStateSnapshot {
  readonly jobs: readonly CronJobManifest[];
  readonly executionHistory: readonly CronExecutionRecord[];
  readonly timestamp: number;
  readonly snapshotTick: number;
}

// ---------------------------------------------------------------------------
// Health, Metrics & SLA Contracts
// ---------------------------------------------------------------------------

export type CronHealthStatus = "on_track" | "at_risk" | "failing" | "paused";

export interface CronHealthAuditReport {
  readonly jobId: string;
  readonly jobName: string;
  readonly healthStatus: CronHealthStatus;
  readonly totalRuns: number;
  readonly successRatePercent: number;
  readonly consecutiveFailures: number;
  readonly isCircuitBroken: boolean;
  readonly nextRunInMs?: number;
  readonly recommendations: readonly string[];
}

export interface CronMetricsReport {
  readonly totalJobs: number;
  readonly activeJobs: number;
  readonly pausedJobs: number;
  readonly totalExecutions: number;
  readonly overallSuccessRatePercent: number;
  readonly p50DurationMs: number;
  readonly p95DurationMs: number;
  readonly p99DurationMs: number;
  readonly nextScheduledExecutionMs?: number;
}

// ---------------------------------------------------------------------------
// Grouping & Swimlane Contracts
// ---------------------------------------------------------------------------

export type CronGroupBy = "status" | "scheduleType" | "category" | "health";
export type CronSortBy = "nextRun" | "recent" | "successRate" | "duration" | "name";
export type CronSortDirection = "asc" | "desc";

export interface CronGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly jobs: readonly CronJobManifest[];
}

// ---------------------------------------------------------------------------
// Notification Contracts
// ---------------------------------------------------------------------------

export type CronNotificationTrigger =
  | "job_triggered"
  | "job_succeeded"
  | "job_failed"
  | "consecutive_failure_burst"
  | "job_paused"
  | "custom";

export type CronNotificationUrgency = "low" | "normal" | "critical";

export interface CronNotificationEvent {
  readonly jobId?: string;
  readonly title: string;
  readonly message: string;
  readonly urgency: CronNotificationUrgency;
  readonly trigger: CronNotificationTrigger;
  readonly metadata?: Record<string, unknown>;
  readonly actionUrl?: string;
}

export interface CronNotificationPreferences {
  readonly enabled: boolean;
  readonly soundEnabled: boolean;
  readonly dndEnabled: boolean;
  readonly minUrgency: CronNotificationUrgency;
  readonly allowedTriggers: readonly CronNotificationTrigger[];
}

export interface CronNotificationRecord {
  readonly id: string;
  readonly event: CronNotificationEvent;
  readonly dispatchedAtMs: number;
  readonly delivered: boolean;
  readonly read: boolean;
  readonly audioPlayed: boolean;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Query Contracts
// ---------------------------------------------------------------------------

export interface CronMutationUndoRecord {
  readonly mutationType: "create" | "update" | "delete" | "status" | "bulk";
  readonly previousManifest?: CronJobManifest;
  readonly nextManifest?: CronJobManifest;
  readonly previousManifests?: readonly CronJobManifest[];
  readonly nextManifests?: readonly CronJobManifest[];
  readonly timestampMs: number;
}

export interface CronQueryFilter {
  readonly status?: CronJobStatus;
  readonly scheduleType?: CronScheduleType;
  readonly category?: string;
  readonly tag?: string;
  readonly blueprintKey?: string;
  readonly search?: string;
}

export interface CronDslQueryFilter {
  readonly rawQuery: string;
  readonly status?: CronJobStatus;
  readonly scheduleType?: CronScheduleType;
  readonly category?: string;
  readonly healthStatus?: CronHealthStatus;
  readonly tags?: readonly string[];
  readonly isFailed?: boolean;
  readonly textTerms?: readonly string[];
}

export interface CronBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly updatedJobIds: readonly string[];
}

// ---------------------------------------------------------------------------
// BroccoliDB Table Row Schemas
// ---------------------------------------------------------------------------

export interface CronJobRow {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly category: string;
  readonly scheduleType: CronScheduleType;
  readonly scheduleExpression?: string;
  readonly intervalMs?: number;
  readonly nextRunTimestampMs?: number;
  readonly status: CronJobStatus;
  readonly totalRuns: number;
  readonly blueprintKey?: string;
  readonly tags: string;
  readonly updatedAtMs: number;
  readonly [key: string]: unknown;
}

export interface CronExecutionRow {
  readonly id: string;
  readonly jobId: string;
  readonly triggerType: "scheduled" | "manual";
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly summary: string;
  readonly [key: string]: unknown;
}

export interface CronBlueprintRow {
  readonly id: string;
  readonly key: string;
  readonly title: string;
  readonly category: string;
  readonly scheduleTemplate: string;
  readonly [key: string]: unknown;
}

export interface CronNotificationRow {
  readonly id: string;
  readonly jobId?: string;
  readonly title: string;
  readonly trigger: CronNotificationTrigger;
  readonly urgency: CronNotificationUrgency;
  readonly dispatchedAtMs: number;
  readonly read: boolean;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Core Interfaces
// ---------------------------------------------------------------------------

export interface ICronScheduler {
  registerJob(manifest: Omit<CronJobManifest, "status" | "totalRuns" | "createdTick">): CronJobManifest;
  triggerJob(jobId: string): Promise<CronExecutionRecord>;
  pauseJob(jobId: string): boolean;
  resumeJob(jobId: string): boolean;
  deleteJob(jobId: string): boolean;
  getJob(jobId: string): CronJobManifest | undefined;
  listJobs(statusFilter?: CronJobStatus): readonly CronJobManifest[];
  evaluateTick(currentTick: number, nowMs?: number): Promise<readonly CronExecutionRecord[]>;
}

export interface IBroccoliCronSubstrate {
  storeJob(job: CronJobManifest): void;
  getJob(jobId: string): CronJobManifest | undefined;
  deleteJob(jobId: string): boolean;
  listJobs(): readonly CronJobManifest[];
  recordExecution(record: CronExecutionRecord): void;
  getExecutionHistory(jobId?: string, limit?: number): readonly CronExecutionRecord[];
  clear(): void;
}

export interface ICronSnapshotManager {
  createSnapshot(snapshotTick: number): CronStateSnapshot;
  restoreSnapshot(snapshot: CronStateSnapshot): void;
}
