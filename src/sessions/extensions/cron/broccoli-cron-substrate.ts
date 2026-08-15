import type {
  CronExecutionRecord,
  CronJobManifest,
  IBroccoliCronSubstrate,
} from "../../../core/contracts/cron.contracts.js";
import { AnchoredCronJobManager } from "../../../tooling/extensions/cron/anchored-cron-job-manager.js";

/**
 * BroccoliCronSubstrate.
 * Absorbed under ADR-016 (AKD-DSO Osmosis Paradigm).
 *
 * Provides zero-GC in-memory substrate caching of scheduled cron jobs,
 * automation blueprints, and execution logs inside Broccolidb.
 */
export class BroccoliCronSubstrate implements IBroccoliCronSubstrate {
  private readonly jobManager: AnchoredCronJobManager;

  constructor(jobManager = new AnchoredCronJobManager()) {
    this.jobManager = jobManager;
  }

  storeJob(job: CronJobManifest): void {
    this.jobManager.storeJob(job);
  }

  getJob(jobId: string): CronJobManifest | undefined {
    return this.jobManager.getJob(jobId);
  }

  deleteJob(jobId: string): boolean {
    return this.jobManager.deleteJob(jobId);
  }

  listJobs(): readonly CronJobManifest[] {
    return this.jobManager.listJobs();
  }

  recordExecution(record: CronExecutionRecord): void {
    this.jobManager.recordExecution(record);
  }

  getExecutionHistory(jobId?: string, limit?: number): readonly CronExecutionRecord[] {
    return this.jobManager.getExecutionHistory(jobId, limit);
  }

  clear(): void {
    this.jobManager.clear();
  }

  getJobManager(): AnchoredCronJobManager {
    return this.jobManager;
  }
}
