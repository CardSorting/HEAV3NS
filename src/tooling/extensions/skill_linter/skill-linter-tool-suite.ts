/**
 * skill-linter-tool-suite.ts
 *
 * Model tool definitions exposing Skill Tree Linting, Conventions Verification
 * & Anti-Scaffolding Guards (Phase 135 / ADR-111 / Target #68).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { SkillLinterSupervisor } from "../../../agents/extensions/skill_linter/skill-linter-supervisor.js";

export class SkillLinterToolSuite {
  private readonly supervisor: SkillLinterSupervisor;

  constructor(supervisor: SkillLinterSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "skill_linter_lint_skill",
        description: "Audits a skill's frontmatter, instructions prose, and scripts against standard authoring conventions.",
        parameters: {
          skillName: {
            type: "string",
            description: "Identifier name of the skill.",
            required: true,
          },
          content: {
            type: "string",
            description: "Full markdown content of SKILL.md.",
            required: true,
          },
          dirName: {
            type: "string",
            description: "Directory name holding the skill, to check for name-dir mismatches.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const skillName = String(args.skillName || "");
          const content = String(args.content || "");
          const dirName = typeof args.dirName === "string" ? args.dirName : undefined;

          const report = this.supervisor.lintSkill({
            skillName,
            rawContent: content,
            dirName,
          });

          return {
            success: true,
            report,
          };
        },
      },
      {
        name: "skill_linter_inspect_findings",
        description: "Retrieves cached lint reports and findings across all audited skills.",
        parameters: {
          skillName: {
            type: "string",
            description: "Optional skill name to filter findings for.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const skillName = typeof args.skillName === "string" ? args.skillName : undefined;
          if (skillName) {
            const report = this.supervisor.getReport(skillName);
            return {
              success: true,
              hasReport: !!report,
              report,
            };
          }

          const reports = this.supervisor.getAllReports();
          return {
            success: true,
            totalReports: reports.length,
            reports,
          };
        },
      },
      {
        name: "skill_linter_validate_description",
        description: "Validates a skill description string against length caps and marketing buzzword rules.",
        parameters: {
          description: {
            type: "string",
            description: "Prompt description string to validate.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const description = String(args.description || "");
          const result = this.supervisor.validateDescription(description);
          return {
            success: true,
            isValid: result.isValid,
            warnings: result.warnings,
          };
        },
      },
      {
        name: "skill_linter_configure",
        description: "Configures active skill linter rules, marketing word checks, and blocking thresholds.",
        parameters: {
          enabled: {
            type: "boolean",
            description: "Whether skill linting is enabled.",
            required: false,
          },
          blockOnError: {
            type: "boolean",
            description: "Whether error-level findings block skill creation.",
            required: false,
          },
          checkMarketingWords: {
            type: "boolean",
            description: "Whether to check descriptions for buzzwords.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const enabled = typeof args.enabled === "boolean" ? args.enabled : undefined;
          const blockOnError = typeof args.blockOnError === "boolean" ? args.blockOnError : undefined;
          const checkMarketingWords =
            typeof args.checkMarketingWords === "boolean" ? args.checkMarketingWords : undefined;

          this.supervisor.configure({
            enabled,
            blockOnError,
            checkMarketingWords,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "skill_linter_get_metrics",
        description: "Retrieves skill quality metrics, clean skill counts, and violation statistics.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          return {
            success: true,
            metrics,
          };
        },
      },
    ];
  }
}
