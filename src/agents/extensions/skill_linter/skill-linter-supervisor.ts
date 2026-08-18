/**
 * skill-linter-supervisor.ts
 *
 * Master supervisor coordinating skill package audits, report caching in substrate,
 * frontmatter validation, health matrix audits, and quality metrics tracking (Phase 135 / ADR-111 / Target #75).
 */

import type { BroccoliSkillLinterSubstrate } from "../../../sessions/extensions/skill_linter/broccoli-skill-linter-substrate.js";
import type { DeterministicSkillLinterEngine } from "./deterministic-skill-linter-engine.js";
import type {
  SkillLinterConfig,
  SkillLinterDslQueryFilter,
  SkillLinterGroupBy,
  SkillLinterHealthAuditReport,
  SkillLinterMetricsReport,
  SkillLinterSortBy,
  SkillLinterSortDirection,
  SkillLintReport,
} from "../../../core/contracts/skill-linter.contracts.js";

export class SkillLinterSupervisor {
  private readonly substrate: BroccoliSkillLinterSubstrate;
  private readonly engine: DeterministicSkillLinterEngine;

  constructor(substrate: BroccoliSkillLinterSubstrate, engine: DeterministicSkillLinterEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public getSubstrate(): BroccoliSkillLinterSubstrate {
    return this.substrate;
  }

  public getEngine(): DeterministicSkillLinterEngine {
    return this.engine;
  }

  public configure(config: Partial<SkillLinterConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): SkillLinterConfig {
    return this.substrate.getConfig();
  }

  public getMetrics(): SkillLinterMetricsReport {
    return this.substrate.getMetrics();
  }

  public auditHealth(): SkillLinterHealthAuditReport {
    return this.substrate.auditHealth();
  }

  public getReport(skillName: string): SkillLintReport | undefined {
    return this.substrate.getReport(skillName);
  }

  public getAllReports(): SkillLintReport[] {
    return this.substrate.getAllReports();
  }

  public listReports(): readonly SkillLintReport[] {
    return this.substrate.listReports();
  }

  /**
   * Performs a comprehensive lint of a skill package or raw markdown string.
   */
  public lintSkill(params: {
    skillName: string;
    rawContent: string;
    dirName?: string;
    filesInDir?: string[];
    scriptContents?: Record<string, string>;
  }): SkillLintReport {
    const config = this.substrate.getConfig();
    const envelope = this.engine.parseSkillContent(params.rawContent);
    envelope.filesInDir = params.filesInDir;
    envelope.scriptContents = params.scriptContents;

    const report = this.engine.lintSkill(params.skillName, envelope, config, params.dirName);
    this.substrate.storeReport(report);
    return report;
  }

  /**
   * Fast validation of a skill prompt description for budget compliance.
   */
  public validateDescription(description: string): { isValid: boolean; warnings: string[] } {
    const config = this.substrate.getConfig();
    const report = this.engine.lintSkill(
      "test_skill",
      {
        name: "test_skill",
        description,
        body: "test body",
      },
      config
    );

    const warnings = report.findings.map((f) => f.message);
    return {
      isValid: report.errorCount === 0,
      warnings,
    };
  }

  public getGroupedReports(groupBy?: SkillLinterGroupBy, sortBy?: SkillLinterSortBy, direction?: SkillLinterSortDirection) {
    return this.substrate.getGroupedReports(groupBy, sortBy, direction);
  }

  public queryDsl(query: SkillLinterDslQueryFilter | string) {
    return this.substrate.queryReportsDsl(query);
  }

  public bulkPurge(skillNames: readonly string[]) {
    return this.substrate.bulkPurgeReports(skillNames);
  }

  public bulkPurgeInvalid() {
    return this.substrate.bulkPurgeInvalid();
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }
}
