/**
 * broccoli-context-breakdown-substrate.ts
 *
 * In-memory Broccolidb repository storing context breakdown reports, token capacity metrics,
 * utilization trends, and configuration parameters (Phase 127 / ADR-103 / Target #60).
 */

import type {
  ContextBreakdownConfig,
  ContextBreakdownMetrics,
  ContextBreakdownReport,
  ContextBreakdownWorkspaceSnapshot,
} from "../../../core/contracts/context-breakdown.contracts.js";
import { DEFAULT_CONTEXT_BREAKDOWN_CONFIG } from "../../../core/contracts/context-breakdown.contracts.js";

export class BroccoliContextBreakdownSubstrate {
  private config: ContextBreakdownConfig = { ...DEFAULT_CONTEXT_BREAKDOWN_CONFIG };
  private latestReport?: ContextBreakdownReport;
  private totalBreakdowns = 0;
  private sumTokens = 0;
  private maxTokensObserved = 0;
  private lastUtilizationPercent = 0;

  public setConfig(config: Partial<ContextBreakdownConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): ContextBreakdownConfig {
    return { ...this.config };
  }

  public setLatestReport(report: ContextBreakdownReport): void {
    this.latestReport = {
      ...report,
      categories: report.categories.map((c) => ({ ...c })),
    };
    this.totalBreakdowns++;
    this.sumTokens += report.totalTokens;
    if (report.totalTokens > this.maxTokensObserved) {
      this.maxTokensObserved = report.totalTokens;
    }
    this.lastUtilizationPercent = report.utilizationPercent;
  }

  public getLatestReport(): ContextBreakdownReport | undefined {
    if (!this.latestReport) return undefined;
    return {
      ...this.latestReport,
      categories: this.latestReport.categories.map((c) => ({ ...c })),
    };
  }

  public getMetrics(): ContextBreakdownMetrics {
    return {
      totalBreakdowns: this.totalBreakdowns,
      avgTokensComputed: this.totalBreakdowns > 0 ? Math.round(this.sumTokens / this.totalBreakdowns) : 0,
      maxTokensObserved: this.maxTokensObserved,
      lastUtilizationPercent: this.lastUtilizationPercent,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): ContextBreakdownWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      latestReport: this.getLatestReport(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: ContextBreakdownWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.latestReport = snapshot.latestReport
      ? {
          ...snapshot.latestReport,
          categories: snapshot.latestReport.categories.map((c) => ({ ...c })),
        }
      : undefined;
    this.totalBreakdowns = snapshot.metrics.totalBreakdowns;
    this.maxTokensObserved = snapshot.metrics.maxTokensObserved;
    this.lastUtilizationPercent = snapshot.metrics.lastUtilizationPercent;
    this.sumTokens = snapshot.metrics.avgTokensComputed * snapshot.metrics.totalBreakdowns;
  }

  public clear(): void {
    this.config = { ...DEFAULT_CONTEXT_BREAKDOWN_CONFIG };
    this.latestReport = undefined;
    this.totalBreakdowns = 0;
    this.sumTokens = 0;
    this.maxTokensObserved = 0;
    this.lastUtilizationPercent = 0;
  }
}
