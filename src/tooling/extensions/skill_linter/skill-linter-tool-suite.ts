/**
 * skill-linter-tool-suite.ts
 *
 * Model tool surface for Deterministic Skill Tree Linter, Frontmatter Conventions
 * & Anti-Scaffolding Guard Subsystem (Phase 135 / ADR-111 / Target #75):
 * 30 specialized model tools for linting skill markdown, inspecting frontmatter rules,
 * DSL queries, swimlanes, dashboards, and HTML/Markdown/CSV exports.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  SkillLinterGroupBy,
  SkillLinterSortBy,
  SkillLinterSortDirection,
} from "../../../core/contracts/skill-linter.contracts.js";
import { SkillLinterSupervisor } from "../../../agents/extensions/skill_linter/skill-linter-supervisor.js";
import { SkillLinterSnapshotManager } from "../../../sessions/extensions/skill_linter/skill-linter-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class SkillLinterToolSuite {
  private readonly supervisor: SkillLinterSupervisor;
  private readonly snapshotManager: SkillLinterSnapshotManager;

  constructor(supervisor: SkillLinterSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new SkillLinterSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "skill_linter_lint_skill",
        description: "Audits a skill's frontmatter, instructions prose, and scripts against standard authoring conventions.",
        parameters: {
          skillName: { type: "string", required: true, description: "Identifier name of the skill" },
          content: { type: "string", required: true, description: "Full markdown content of SKILL.md" },
          dirName: { type: "string", description: "Directory name holding the skill" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_lint_skill", args);
        },
      },
      {
        name: "skill_linter_inspect_findings",
        description: "Retrieves cached lint reports and findings across all audited skills.",
        parameters: {
          skillName: { type: "string", description: "Optional skill name filter" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_inspect_findings", args);
        },
      },
      {
        name: "skill_linter_validate_description",
        description: "Validates a skill description string against length caps and marketing buzzword rules.",
        parameters: {
          description: { type: "string", required: true, description: "Description string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_validate_description", args);
        },
      },
      {
        name: "skill_linter_parse_frontmatter",
        description: "Parses YAML frontmatter block from raw skill markdown.",
        parameters: {
          content: { type: "string", required: true, description: "Markdown content" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_parse_frontmatter", args);
        },
      },
      {
        name: "skill_linter_get_config",
        description: "Retrieves active skill linter rules and verification configuration.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_get_config", args);
        },
      },
      {
        name: "skill_linter_configure",
        description: "Updates skill linter configuration settings.",
        parameters: {
          enabled: { type: "boolean", description: "Enable or disable linter" },
          blockOnError: { type: "boolean", description: "Block invalid skills" },
          checkShellUtilities: { type: "boolean", description: "Check banned shell tools" },
          checkMarketingWords: { type: "boolean", description: "Check marketing buzzwords" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_configure", args);
        },
      },
      {
        name: "skill_linter_get_report",
        description: "Retrieves a cached skill lint report by skill name.",
        parameters: {
          skillName: { type: "string", required: true, description: "Skill identifier" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_get_report", args);
        },
      },
      {
        name: "skill_linter_list_reports",
        description: "Lists all cached skill lint reports in memory substrate.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_list_reports", args);
        },
      },
      {
        name: "skill_linter_remove_report",
        description: "Removes a cached skill report from the ledger.",
        parameters: {
          skillName: { type: "string", required: true, description: "Skill name to remove" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_remove_report", args);
        },
      },
      {
        name: "skill_linter_clear_reports",
        description: "Clears all cached skill reports from memory substrate.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_clear_reports", args);
        },
      },
      {
        name: "skill_linter_audit_health",
        description: "Audits skill tree compliance rate, error breakdown, and SLA health posture.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_audit_health", args);
        },
      },
      {
        name: "skill_linter_get_metrics",
        description: "Fetches aggregated metrics, error distributions, and audit durations.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_get_metrics", args);
        },
      },
      {
        name: "skill_linter_group_and_sort",
        description: "Organizes skill reports into multi-criteria swimlanes (status, ruleCode, severity).",
        parameters: {
          groupBy: { type: "string", description: "status, ruleCode, severity, directory" },
          sortBy: { type: "string", description: "timestamp, skillName, errors, warnings" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_group_and_sort", args);
        },
      },
      {
        name: "skill_linter_search_dsl",
        description: "Searches skill reports using Natural Query DSL (e.g. 'is:valid' or 'rule:BANNED_SHELL_TOOL').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_search_dsl", args);
        },
      },
      {
        name: "skill_linter_render_dashboard",
        description: "Renders an ANSI CLI summary card with compliance rate and health posture.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_render_dashboard", args);
        },
      },
      {
        name: "skill_linter_render_finding_card",
        description: "Renders an interactive ANSI CLI finding descriptor card.",
        parameters: {
          ruleCode: { type: "string", required: true, description: "Rule code" },
          severity: { type: "string", required: true, description: "Severity" },
          message: { type: "string", required: true, description: "Finding message" },
          suggestedFix: { type: "string", description: "Suggested fix" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_render_finding_card", args);
        },
      },
      {
        name: "skill_linter_export_html_view",
        description: "Exports skill tree linter ledger to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_export_html_view", args);
        },
      },
      {
        name: "skill_linter_export_markdown_report",
        description: "Exports skill tree linter report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_export_markdown_report", args);
        },
      },
      {
        name: "skill_linter_export_csv_report",
        description: "Exports skill tree linter ledger to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_export_csv_report", args);
        },
      },
      {
        name: "skill_linter_bulk_purge",
        description: "Atomically purges multiple skill reports from memory ledger.",
        parameters: {
          skillNamesJson: { type: "string", required: true, description: "JSON array of skill names" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_bulk_purge", args);
        },
      },
      {
        name: "skill_linter_bulk_purge_invalid",
        description: "Atomically purges all invalid skill reports with errors.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_bulk_purge_invalid", args);
        },
      },
      {
        name: "skill_linter_undo",
        description: "Reverts the last skill linter mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_undo", args);
        },
      },
      {
        name: "skill_linter_redo",
        description: "Re-applies the last undone skill linter mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_redo", args);
        },
      },
      {
        name: "skill_linter_capture_snapshot",
        description: "Captures a frame-perfect snapshot of skill linter state.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_capture_snapshot", args);
        },
      },
      {
        name: "skill_linter_restore_snapshot",
        description: "Restores skill linter state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_restore_snapshot", args);
        },
      },
      {
        name: "skill_linter_format_finding",
        description: "Formats a lint finding into a standardized string.",
        parameters: {
          ruleCode: { type: "string", required: true, description: "Rule code" },
          severity: { type: "string", required: true, description: "Severity" },
          message: { type: "string", required: true, description: "Message" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_format_finding", args);
        },
      },
      {
        name: "skill_linter_format_report",
        description: "Formats a skill lint report into a standardized summary.",
        parameters: {
          skillName: { type: "string", required: true, description: "Skill name" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_format_report", args);
        },
      },
      {
        name: "skill_linter_check_banned_tools",
        description: "Checks prose body text for banned shell tools.",
        parameters: {
          text: { type: "string", required: true, description: "Prose body text" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_check_banned_tools", args);
        },
      },
      {
        name: "skill_linter_check_buzzwords",
        description: "Checks description text for marketing buzzwords.",
        parameters: {
          description: { type: "string", required: true, description: "Description text" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_check_buzzwords", args);
        },
      },
      {
        name: "skill_linter_check_scaffolding",
        description: "Checks a list of filenames for forbidden scaffolding files.",
        parameters: {
          filesJson: { type: "string", required: true, description: "JSON array of filenames" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("skill_linter_check_scaffolding", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "skill_linter_lint_skill": {
          const skillName = String(args.skillName || "");
          const content = String(args.content || "");
          const dirName = typeof args.dirName === "string" ? args.dirName : undefined;
          const report = this.supervisor.lintSkill({
            skillName,
            rawContent: content,
            dirName,
          });
          return { success: true, report };
        }

        case "skill_linter_inspect_findings": {
          const skillName = typeof args.skillName === "string" ? args.skillName : undefined;
          if (skillName) {
            const report = this.supervisor.getReport(skillName);
            return { success: true, hasReport: !!report, report };
          }
          const reports = this.supervisor.getAllReports();
          return { success: true, totalReports: reports.length, reports };
        }

        case "skill_linter_validate_description": {
          const description = String(args.description || "");
          const result = this.supervisor.validateDescription(description);
          return { success: true, result };
        }

        case "skill_linter_parse_frontmatter": {
          const content = String(args.content || "");
          const envelope = this.supervisor.getEngine().parseSkillContent(content);
          return { success: true, envelope };
        }

        case "skill_linter_get_config": {
          const config = this.supervisor.getConfig();
          return { success: true, config };
        }

        case "skill_linter_configure": {
          this.supervisor.configure(args as any);
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "skill_linter_get_report": {
          const skillName = String(args.skillName || "");
          const report = this.supervisor.getReport(skillName);
          if (!report) return { success: false, error: `Report for skill '${skillName}' not found` };
          return { success: true, report };
        }

        case "skill_linter_list_reports": {
          const reports = this.supervisor.listReports();
          return { success: true, count: reports.length, reports };
        }

        case "skill_linter_remove_report": {
          const skillName = String(args.skillName || "");
          const ok = this.supervisor.getSubstrate().removeReport(skillName);
          return { success: ok };
        }

        case "skill_linter_clear_reports": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
        }

        case "skill_linter_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "skill_linter_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "skill_linter_group_and_sort": {
          const groupBy = (args.groupBy as SkillLinterGroupBy) || "status";
          const sortBy = (args.sortBy as SkillLinterSortBy) || "timestamp";
          const direction = (args.direction as SkillLinterSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedReports(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "skill_linter_search_dsl": {
          const query = String(args.query || "");
          const reports = this.supervisor.queryDsl(query);
          return { success: true, count: reports.length, reports };
        }

        case "skill_linter_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderSkillLinterDashboard({
            totalSkills: metrics.totalSkillsAudited,
            cleanSkills: metrics.cleanSkillsCount,
            totalErrors: metrics.totalErrorsFound,
            totalWarnings: metrics.totalWarningsFound,
            complianceRate: health.complianceRatePercent,
            healthStatus: health.healthStatus,
          });
          return { success: true, rendered };
        }

        case "skill_linter_render_finding_card": {
          const ruleCode = String(args.ruleCode || "SCHEMA_VIOLATION");
          const severity = String(args.severity || "error");
          const message = String(args.message || "");
          const suggestedFix = typeof args.suggestedFix === "string" ? args.suggestedFix : undefined;
          const rendered = BroccoliViewRenderer.renderSkillLintFindingCard({
            ruleCode,
            severity,
            message,
            suggestedFix,
          });
          return { success: true, rendered };
        }

        case "skill_linter_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "skill_linter_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "skill_linter_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "skill_linter_bulk_purge": {
          const namesJson = String(args.skillNamesJson || "[]");
          let names: string[];
          try {
            names = JSON.parse(namesJson);
          } catch {
            return { success: false, error: "skillNamesJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(names);
          return { success: true, result };
        }

        case "skill_linter_bulk_purge_invalid": {
          const result = this.supervisor.bulkPurgeInvalid();
          return { success: true, result };
        }

        case "skill_linter_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "skill_linter_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "skill_linter_capture_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const snap = this.snapshotManager.captureSnapshot(frameId);
          return { success: true, frameId, snapshot: snap };
        }

        case "skill_linter_restore_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frameId);
          return { ...res };
        }

        case "skill_linter_format_finding": {
          const ruleCode = (args.ruleCode as any) || "SCHEMA_VIOLATION";
          const severity = (args.severity as any) || "error";
          const message = String(args.message || "");
          const formatted = this.supervisor.getEngine().formatLintFinding({
            ruleCode,
            severity,
            message,
          });
          return { success: true, formatted };
        }

        case "skill_linter_format_report": {
          const skillName = String(args.skillName || "");
          const report = this.supervisor.getReport(skillName);
          if (!report) return { success: false, error: `Report for '${skillName}' not found` };
          const formatted = this.supervisor.getEngine().formatLintReport(report);
          return { success: true, formatted };
        }

        case "skill_linter_check_banned_tools": {
          const text = String(args.text || "");
          const rep = this.supervisor.lintSkill({
            skillName: "temp_check",
            rawContent: `---\nname: temp_check\ndescription: A valid description\n---\n${text}`,
          });
          const bannedFindings = rep.findings.filter((f) => f.ruleCode === "BANNED_SHELL_TOOL");
          return { success: true, hasBannedTools: bannedFindings.length > 0, findings: bannedFindings };
        }

        case "skill_linter_check_buzzwords": {
          const description = String(args.description || "");
          const rep = this.supervisor.lintSkill({
            skillName: "temp_check",
            rawContent: `---\nname: temp_check\ndescription: ${description}\n---\nProse`,
          });
          const buzzFindings = rep.findings.filter((f) => f.ruleCode === "MARKETING_BUZZWORD");
          return { success: true, hasBuzzwords: buzzFindings.length > 0, findings: buzzFindings };
        }

        case "skill_linter_check_scaffolding": {
          const filesJson = String(args.filesJson || "[]");
          const filesInDir = JSON.parse(filesJson);
          const rep = this.supervisor.lintSkill({
            skillName: "temp_check",
            rawContent: `---\nname: temp_check\ndescription: Valid\n---\nProse`,
            filesInDir,
          });
          const scaffoldFindings = rep.findings.filter((f) => f.ruleCode === "FORBIDDEN_SCAFFOLDING");
          return { success: true, hasScaffolding: scaffoldFindings.length > 0, findings: scaffoldFindings };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
