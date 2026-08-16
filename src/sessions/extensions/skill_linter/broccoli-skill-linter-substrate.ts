/**
 * broccoli-skill-linter-substrate.ts
 *
 * In-memory Broccolidb repository for caching skill lint reports, rules,
 * quality metrics, and anti-scaffolding logs (Phase 135 / ADR-111 / Target #68).
 */

import type {
  SkillLinterConfig,
  SkillLinterMetrics,
  SkillLinterWorkspaceSnapshot,
  SkillLintReport,
} from "../../../core/contracts/skill-linter.contracts.js";
import { DEFAULT_SKILL_LINTER_CONFIG } from "../../../core/contracts/skill-linter.contracts.js";

export class BroccoliSkillLinterSubstrate {
  private config: SkillLinterConfig = { ...DEFAULT_SKILL_LINTER_CONFIG };
  private reports = new Map<string, SkillLintReport>();
  private metrics: SkillLinterMetrics = {
    totalSkillsAudited: 0,
    cleanSkillsCount: 0,
    totalErrorsFound: 0,
    totalWarningsFound: 0,
    lastAuditDurationMs: 0,
  };

  public setConfig(config: Partial<SkillLinterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): SkillLinterConfig {
    return { ...this.config };
  }

  public storeReport(report: SkillLintReport): void {
    this.reports.set(report.skillName, { ...report });
    this.metrics.totalSkillsAudited++;
    this.metrics.lastAuditDurationMs = report.auditDurationMs;
    this.metrics.totalErrorsFound += report.errorCount;
    this.metrics.totalWarningsFound += report.warningCount;

    if (report.isValid && report.findings.length === 0) {
      this.metrics.cleanSkillsCount++;
    }
  }

  public getReport(skillName: string): SkillLintReport | undefined {
    return this.reports.get(skillName);
  }

  public getAllReports(): SkillLintReport[] {
    return Array.from(this.reports.values());
  }

  public getMetrics(): SkillLinterMetrics {
    return { ...this.metrics };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): SkillLinterWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      reports: this.getAllReports(),
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: SkillLinterWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.reports.clear();
    for (const report of snapshot.reports) {
      this.reports.set(report.skillName, { ...report });
    }
    this.metrics = { ...snapshot.metrics };
  }

  public clear(): void {
    this.config = { ...DEFAULT_SKILL_LINTER_CONFIG };
    this.reports.clear();
    this.metrics = {
      totalSkillsAudited: 0,
      cleanSkillsCount: 0,
      totalErrorsFound: 0,
      totalWarningsFound: 0,
      lastAuditDurationMs: 0,
    };
  }
}
