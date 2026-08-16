/**
 * broccoli-self-repo-guard-substrate.ts
 *
 * In-memory Broccolidb repository for caching self-repository guard configuration,
 * incident audit logs, and mutation safety metrics (Phase 138 / ADR-114 / Target #71).
 */

import type {
  SelfRepoGuardConfig,
  SelfRepoGuardIncident,
  SelfRepoGuardMetrics,
  SelfRepoGuardWorkspaceSnapshot,
} from "../../../core/contracts/self-repo-guard.contracts.js";
import { DEFAULT_SELF_REPO_GUARD_CONFIG } from "../../../core/contracts/self-repo-guard.contracts.js";

export class BroccoliSelfRepoGuardSubstrate {
  private config: SelfRepoGuardConfig = { ...DEFAULT_SELF_REPO_GUARD_CONFIG };
  private metrics: SelfRepoGuardMetrics = {
    totalCommandsInspected: 0,
    destructiveGitMutationsBlocked: 0,
    safeGitOperationsPassed: 0,
    foreignRepoMutationsAllowed: 0,
  };
  private readonly incidents: SelfRepoGuardIncident[] = [];

  public setConfig(config: Partial<SelfRepoGuardConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): SelfRepoGuardConfig {
    return { ...this.config };
  }

  public recordCommandInspected(): void {
    this.metrics.totalCommandsInspected++;
  }

  public recordBlockedIncident(incident: SelfRepoGuardIncident): void {
    this.metrics.destructiveGitMutationsBlocked++;
    this.incidents.push({ ...incident });
    if (this.incidents.length > 500) {
      this.incidents.shift();
    }
  }

  public recordSafeOperation(): void {
    this.metrics.safeGitOperationsPassed++;
  }

  public recordForeignMutation(): void {
    this.metrics.foreignRepoMutationsAllowed++;
  }

  public getMetrics(): SelfRepoGuardMetrics {
    return { ...this.metrics };
  }

  public getIncidents(): readonly SelfRepoGuardIncident[] {
    return [...this.incidents];
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): SelfRepoGuardWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
      incidents: this.getIncidents(),
    };
  }

  public restoreSnapshot(snapshot: SelfRepoGuardWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.metrics = { ...snapshot.metrics };
    this.incidents.length = 0;
    this.incidents.push(...snapshot.incidents);
  }

  public clear(): void {
    this.config = { ...DEFAULT_SELF_REPO_GUARD_CONFIG };
    this.metrics = {
      totalCommandsInspected: 0,
      destructiveGitMutationsBlocked: 0,
      safeGitOperationsPassed: 0,
      foreignRepoMutationsAllowed: 0,
    };
    this.incidents.length = 0;
  }
}
