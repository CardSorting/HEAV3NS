/**
 * skill-linter.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Deterministic Skill Tree Linter,
 * Frontmatter Conventions Verifier & Anti-Scaffolding Guard Subsystem (Phase 135 / ADR-111 / Target #68).
 */

export type SkillLintSeverity = "error" | "warning" | "info";

export type SkillLintRuleCode =
  | "BANNED_SHELL_TOOL"
  | "MARKETING_BUZZWORD"
  | "NAME_DIR_MISMATCH"
  | "FORBIDDEN_SCAFFOLDING"
  | "MISSING_PLATFORM_GATE"
  | "DANGLING_REFERENCE"
  | "DESCRIPTION_LENGTH"
  | "SCHEMA_VIOLATION";

export interface SkillLintFinding {
  ruleCode: SkillLintRuleCode;
  severity: SkillLintSeverity;
  message: string;
  file?: string;
  line?: number;
  suggestedFix?: string;
}

export interface SkillLintReport {
  skillName: string;
  skillDir?: string;
  isValid: boolean;
  findings: SkillLintFinding[];
  errorCount: number;
  warningCount: number;
  auditDurationMs: number;
  timestamp: number;
}

export interface SkillLinterConfig {
  enabled: boolean;
  blockOnError: boolean;
  checkShellUtilities: boolean;
  checkMarketingWords: boolean;
  checkForbiddenFiles: boolean;
  checkPlatformGates: boolean;
}

export interface SkillLinterMetrics {
  totalSkillsAudited: number;
  cleanSkillsCount: number;
  totalErrorsFound: number;
  totalWarningsFound: number;
  lastAuditDurationMs: number;
}

export interface SkillLinterWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: SkillLinterConfig;
  reports: SkillLintReport[];
  metrics: SkillLinterMetrics;
}

export const DEFAULT_SKILL_LINTER_CONFIG: SkillLinterConfig = {
  enabled: true,
  blockOnError: true,
  checkShellUtilities: true,
  checkMarketingWords: true,
  checkForbiddenFiles: true,
  checkPlatformGates: true,
};

export const SHELL_UTIL_TO_TOOL_MAP: Record<string, string> = {
  grep: "search_files",
  rg: "search_files",
  cat: "read_file",
  head: "read_file",
  tail: "read_file",
  sed: "patch",
  awk: "patch",
  find: "search_files (target='files')",
  ls: "search_files (target='files')",
};

export const MARKETING_BUZZWORDS: string[] = [
  "powerful",
  "comprehensive",
  "seamless",
  "advanced",
  "cutting-edge",
  "state-of-the-art",
  "revolutionary",
  "robust",
];

export const FORBIDDEN_SCAFFOLDING_FILES: string[] = [
  "README.md",
  "CHANGELOG.md",
  "install.sh",
  ".env",
  ".env.example",
  ".gitignore",
];
