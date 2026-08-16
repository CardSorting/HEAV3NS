/**
 * broccoli-deadline-substrate.ts
 *
 * In-memory Broccolidb repository storing ESTOP sentinel state, deadline execution leases,
 * timeout policies, and audit ledgers (Phase 125 / ADR-101 / Target #58).
 */

import type {
  DeadlineConfig,
  DeadlineMetrics,
  DeadlineWorkspaceSnapshot,
  EstopState,
} from "../../../core/contracts/deadline.contracts.js";
import { DEFAULT_DEADLINE_CONFIG } from "../../../core/contracts/deadline.contracts.js";

export class BroccoliDeadlineSubstrate {
  private config: DeadlineConfig = { ...DEFAULT_DEADLINE_CONFIG };
  private estopState: EstopState = { engaged: false };
  private totalExecutions = 0;
  private timeoutsEncountered = 0;
  private estopEngagements = 0;
  private estopRejections = 0;
  private activeLeases = 0;

  public setConfig(config: Partial<DeadlineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): DeadlineConfig {
    return { ...this.config };
  }

  public getEstopState(): EstopState {
    return { ...this.estopState };
  }

  public setEstop(engaged: boolean, reason?: string, engagedBy?: string): void {
    if (engaged && !this.estopState.engaged) {
      this.estopEngagements++;
    }
    this.estopState = {
      engaged,
      reason: engaged ? reason || "Emergency Stop Engaged" : undefined,
      engagedAt: engaged ? Date.now() : undefined,
      engagedBy: engaged ? engagedBy || "system" : undefined,
    };
  }

  public recordExecutionStart(): void {
    this.totalExecutions++;
    this.activeLeases++;
  }

  public recordExecutionEnd(timedOut = false): void {
    if (this.activeLeases > 0) {
      this.activeLeases--;
    }
    if (timedOut) {
      this.timeoutsEncountered++;
    }
  }

  public recordEstopRejection(): void {
    this.estopRejections++;
  }

  public getMetrics(): DeadlineMetrics {
    return {
      totalExecutions: this.totalExecutions,
      timeoutsEncountered: this.timeoutsEncountered,
      estopEngagements: this.estopEngagements,
      estopRejections: this.estopRejections,
      activeLeases: this.activeLeases,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): DeadlineWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      estop: { ...this.estopState },
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: DeadlineWorkspaceSnapshot): void {
    this.estopState = { ...snapshot.estop };
    this.totalExecutions = snapshot.metrics.totalExecutions;
    this.timeoutsEncountered = snapshot.metrics.timeoutsEncountered;
    this.estopEngagements = snapshot.metrics.estopEngagements;
    this.estopRejections = snapshot.metrics.estopRejections;
    this.activeLeases = snapshot.metrics.activeLeases;
  }

  public clear(): void {
    this.estopState = { engaged: false };
    this.totalExecutions = 0;
    this.timeoutsEncountered = 0;
    this.estopEngagements = 0;
    this.estopRejections = 0;
    this.activeLeases = 0;
  }
}
