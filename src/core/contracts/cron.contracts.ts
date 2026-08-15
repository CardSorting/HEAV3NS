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
  readonly lastRunOutcome?: {
    readonly success: boolean;
    readonly timestampMs: number;
    readonly durationMs: number;
    readonly summary: string;
    readonly error?: string;
  };
  readonly createdTick: number;
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
