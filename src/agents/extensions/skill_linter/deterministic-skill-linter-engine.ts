/**
 * deterministic-skill-linter-engine.ts
 *
 * Pure TypeScript deterministic engine for skill tree linting, frontmatter convention checks,
 * shell-to-native tool mappings, and anti-scaffolding guards (Phase 135 / ADR-111 / Target #68).
 */

import type {
  SkillLinterConfig,
  SkillLintFinding,
  SkillLintReport,
} from "../../../core/contracts/skill-linter.contracts.js";
import {
  FORBIDDEN_SCAFFOLDING_FILES,
  MARKETING_BUZZWORDS,
  SHELL_UTIL_TO_TOOL_MAP,
} from "../../../core/contracts/skill-linter.contracts.js";

export interface ParsedSkillEnvelope {
  name?: string;
  description?: string;
  platforms?: string[];
  body: string;
  filesInDir?: string[];
  scriptContents?: Record<string, string>;
}

const PRECOMPILED_BUZZWORD_REGEXES: Array<{ buzzword: string; regex: RegExp }> = MARKETING_BUZZWORDS.map(
  (b) => ({ buzzword: b, regex: new RegExp(`\\b${b}\\b`, "i") })
);

const PRECOMPILED_SHELL_TOOL_REGEXES: Array<{ shellUtil: string; nativeTool: string; regex: RegExp }> =
  Object.entries(SHELL_UTIL_TO_TOOL_MAP).map(([shellUtil, nativeTool]) => ({
    shellUtil,
    nativeTool,
    regex: new RegExp(`\\b(run|use|call|execute)\\s+[\`']?${shellUtil}\\b`, "i"),
  }));

export class DeterministicSkillLinterEngine {
  /**
   * Parses standard YAML frontmatter block from SKILL.md content.
   */
  public parseSkillContent(rawContent: string): ParsedSkillEnvelope {
    const trimmed = rawContent.trim();
    if (!trimmed.startsWith("---")) {
      return { body: trimmed };
    }

    const endFenceIndex = trimmed.indexOf("---", 3);
    if (endFenceIndex === -1) {
      return { body: trimmed };
    }

    const frontmatterText = trimmed.substring(3, endFenceIndex).trim();
    const body = trimmed.substring(endFenceIndex + 3).trim();

    let name: string | undefined;
    let description: string | undefined;
    let platforms: string[] | undefined;

    const lines = frontmatterText.split("\n");
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      const key = line.substring(0, colonIdx).trim().toLowerCase();
      const val = line.substring(colonIdx + 1).trim();

      if (key === "name") {
        name = val.replace(/^['"]|['"]$/g, "");
      } else if (key === "description") {
        description = val.replace(/^['"]|['"]$/g, "");
      } else if (key === "platforms") {
        platforms = val
          .replace(/[\[\]'"]/g, "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    return {
      name,
      description,
      platforms,
      body,
    };
  }

  /**
   * Deeply lints a skill envelope against all active authoring rules.
   */
  public lintSkill(
    skillName: string,
    envelope: ParsedSkillEnvelope,
    config: SkillLinterConfig,
    dirName?: string
  ): SkillLintReport {
    const startTime = performance.now();
    const findings: SkillLintFinding[] = [];

    // 1. Schema & Name Checks
    if (!envelope.name) {
      findings.push({
        ruleCode: "SCHEMA_VIOLATION",
        severity: "error",
        message: "Missing 'name' in skill YAML frontmatter.",
        suggestedFix: `Add 'name: "${skillName}"' to the YAML frontmatter.`,
      });
    } else if (dirName && envelope.name !== dirName) {
      findings.push({
        ruleCode: "NAME_DIR_MISMATCH",
        severity: "error",
        message: `Skill name '${envelope.name}' does not match directory name '${dirName}'.`,
        suggestedFix: `Rename skill name to '${dirName}' or rename directory.`,
      });
    }

    // 2. Description Checks
    if (!envelope.description || envelope.description.trim().length === 0) {
      findings.push({
        ruleCode: "SCHEMA_VIOLATION",
        severity: "error",
        message: "Missing 'description' in skill YAML frontmatter.",
        suggestedFix: "Provide a concise 1-2 sentence description explaining when to activate this skill.",
      });
    } else {
      if (envelope.description.length > 250) {
        findings.push({
          ruleCode: "DESCRIPTION_LENGTH",
          severity: "warning",
          message: `Description is ${envelope.description.length} chars (exceeds recommended 250 chars).`,
          suggestedFix: "Shorten description to reduce prompt budgeting overhead.",
        });
      }

      if (config.checkMarketingWords) {
        const descLower = envelope.description.toLowerCase();
        for (let i = 0; i < PRECOMPILED_BUZZWORD_REGEXES.length; i++) {
          const item = PRECOMPILED_BUZZWORD_REGEXES[i];
          if (item.regex.test(descLower)) {
            findings.push({
              ruleCode: "MARKETING_BUZZWORD",
              severity: "warning",
              message: `Description contains marketing buzzword '${item.buzzword}'.`,
              suggestedFix: `Remove '${item.buzzword}' and state functional trigger criteria concisely.`,
            });
          }
        }
      }
    }

    // 3. Banned Shell Tools in Body Prose
    if (config.checkShellUtilities && envelope.body) {
      const bodyLower = envelope.body.toLowerCase();
      for (let i = 0; i < PRECOMPILED_SHELL_TOOL_REGEXES.length; i++) {
        const item = PRECOMPILED_SHELL_TOOL_REGEXES[i];
        if (item.regex.test(bodyLower)) {
          findings.push({
            ruleCode: "BANNED_SHELL_TOOL",
            severity: "warning",
            message: `Prose recommends shell utility '${item.shellUtil}' instead of native model tool '${item.nativeTool}'.`,
            suggestedFix: `Update instructions to use native model tool '${item.nativeTool}'.`,
          });
        }
      }
    }

    // 4. Forbidden Scaffolding Files in Directory
    if (config.checkForbiddenFiles && envelope.filesInDir) {
      for (const file of envelope.filesInDir) {
        const basename = file.substring(file.lastIndexOf("/") + 1);
        if (FORBIDDEN_SCAFFOLDING_FILES.includes(basename)) {
          findings.push({
            ruleCode: "FORBIDDEN_SCAFFOLDING",
            severity: "error",
            message: `Forbidden scaffolding file '${basename}' detected in skill bundle.`,
            file: basename,
            suggestedFix: `Delete '${basename}' to keep the skill bundle dense and free of boilerplate.`,
          });
        }
      }
    }

    // 5. Missing Platform Gates on POSIX Primitives
    if (config.checkPlatformGates && envelope.scriptContents && (!envelope.platforms || envelope.platforms.length === 0)) {
      const posixPatterns = ["fcntl", "termios", "osascript", "systemctl", "apt-get"];
      for (const [scriptName, scriptCode] of Object.entries(envelope.scriptContents)) {
        for (const pattern of posixPatterns) {
          if (scriptCode.includes(pattern)) {
            findings.push({
              ruleCode: "MISSING_PLATFORM_GATE",
              severity: "warning",
              message: `Script '${scriptName}' uses POSIX primitive '${pattern}' without 'platforms:' frontmatter gate.`,
              file: scriptName,
              suggestedFix: "Add 'platforms: [linux, darwin]' to YAML frontmatter if script is not cross-platform.",
            });
            break;
          }
        }
      }
    }

    const errorCount = findings.filter((f) => f.severity === "error").length;
    const warningCount = findings.filter((f) => f.severity === "warning").length;
    const isValid = config.blockOnError ? errorCount === 0 : true;

    return {
      skillName,
      skillDir: dirName,
      isValid,
      findings,
      errorCount,
      warningCount,
      auditDurationMs: performance.now() - startTime,
      timestamp: Date.now(),
    };
  }

  public formatLintFinding(finding: SkillLintFinding): string {
    const sev = finding.severity.toUpperCase();
    const loc = finding.file ? ` (${finding.file}${finding.line ? `:${finding.line}` : ""})` : "";
    return `[${sev}:${finding.ruleCode}]${loc} ${finding.message}`;
  }

  public formatLintReport(report: SkillLintReport): string {
    const status = report.isValid ? "VALID" : "INVALID";
    return `[SKILL-LINT:${status}] "${report.skillName}" - ${report.errorCount} errors, ${report.warningCount} warnings (${report.auditDurationMs.toFixed(2)}ms)`;
  }
}

