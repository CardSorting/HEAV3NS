import type {
  CronExecutionRecord,
  CronJobManifest,
  CronJobStatus,
} from "../../../core/contracts/cron.contracts.js";

/**
 * AnchoredCronJobManager.
 * Absorbed under ADR-016 (AKD-DSO Osmosis Paradigm).
 *
 * Coordinates in-memory cron job manifest records, execution histories,
 * and state transitions with bounded ring buffer audit trails.
 */
export class AnchoredCronJobManager {
  private readonly jobs = new Map<string, CronJobManifest>();
  private readonly executionHistory: CronExecutionRecord[] = [];
  private readonly maxHistoryLimit = 200;

  storeJob(job: CronJobManifest): void {
    this.jobs.set(job.id, Object.freeze({ ...job }));
  }

  getJob(jobId: string): CronJobManifest | undefined {
    return this.jobs.get(jobId);
  }

  deleteJob(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  updateJobStatus(jobId: string, status: CronJobStatus): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    this.jobs.set(jobId, Object.freeze({
      ...job,
      status,
    }));
    return true;
  }

  updateJobRunOutcome(
    jobId: string,
    outcome: { success: boolean; timestampMs: number; durationMs: number; summary: string; error?: string },
    nextRunTimestampMs?: number
  ): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    this.jobs.set(jobId, Object.freeze({
      ...job,
      totalRuns: job.totalRuns + 1,
      lastRunOutcome: Object.freeze(outcome),
      nextRunTimestampMs: nextRunTimestampMs ?? job.nextRunTimestampMs,
    }));
    return true;
  }

  listJobs(statusFilter?: CronJobStatus): readonly CronJobManifest[] {
    const allJobs = Array.from(this.jobs.values());
    if (statusFilter) {
      return Object.freeze(allJobs.filter((j) => j.status === statusFilter));
    }
    return Object.freeze(allJobs);
  }

  recordExecution(record: CronExecutionRecord): void {
    this.executionHistory.unshift(Object.freeze(record));
    if (this.executionHistory.length > this.maxHistoryLimit) {
      this.executionHistory.pop();
    }
  }

  getExecutionHistory(jobId?: string, limit = 50): readonly CronExecutionRecord[] {
    if (jobId) {
      return Object.freeze(this.executionHistory.filter((r) => r.jobId === jobId).slice(0, limit));
    }
    return Object.freeze(this.executionHistory.slice(0, limit));
  }

  clear(): void {
    this.jobs.clear();
    this.executionHistory.length = 0;
  }

  getJobCount(): number {
    return this.jobs.size;
  }
}
