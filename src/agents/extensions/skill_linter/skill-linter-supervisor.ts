/**
 * skill-linter-supervisor.ts
 *
 * Master supervisor coordinating skill package audits, report caching in substrate,
 * description validation, and quality metrics tracking (Phase 135 / ADR-111 / Target #68).
 */

import type { BroccoliSkillLinterSubstrate } from "../../../sessions/extensions/skill_linter/broccoli-skill-linter-substrate.js";
import type { DeterministicSkillLinterEngine } from "./deterministic-skill-linter-engine.js";
import type {
  SkillLinterConfig,
  SkillLinterMetrics,
  SkillLintReport,
} from "../../../core/contracts/skill-linter.contracts.js";

export class SkillLinterSupervisor {
  private readonly substrate: BroccoliSkillLinterSubstrate;
  private readonly engine: DeterministicSkillLinterEngine;

  constructor(substrate: BroccoliSkillLinterSubstrate, engine: DeterministicSkillLinterEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public configure(config: Partial<SkillLinterConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): SkillLinterConfig {
    return this.substrate.getConfig();
  }

  public getMetrics(): SkillLinterMetrics {
    return this.substrate.getMetrics();
  }

  public getReport(skillName: string): SkillLintReport | undefined {
    return this.substrate.getReport(skillName);
  }

  public getAllReports(): SkillLintReport[] {
    return this.substrate.getAllReports();
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
}
