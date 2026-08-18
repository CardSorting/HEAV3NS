/**
 * skill-linter.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Deterministic Skill Tree Linter,
 * Frontmatter Conventions Verifier & Anti-Scaffolding Guard Subsystem (Phase 135 / ADR-111 / Target #75).
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

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Row Schemas
// ---------------------------------------------------------------------------

export interface SkillLintReportRow {
  skillName: string;
  skillDir: string;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  findingsCount: number;
  auditDurationMs: number;
  timestamp: number;
  [key: string]: unknown;
}

export interface SkillLintFindingRow {
  id: string;
  skillName: string;
  ruleCode: SkillLintRuleCode;
  severity: SkillLintSeverity;
  message: string;
  file?: string;
  line?: number;
  suggestedFix?: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface SkillLintAuditRow {
  auditId: string;
  totalSkills: number;
  cleanSkills: number;
  totalErrors: number;
  totalWarnings: number;
  healthStatus: SkillLinterHealthStatus;
  timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Health Matrix & Telemetry Reports
// ---------------------------------------------------------------------------

export type SkillLinterHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface SkillLinterHealthAuditReport {
  totalSkillsAudited: number;
  cleanSkillsCount: number;
  totalErrorsFound: number;
  totalWarningsFound: number;
  complianceRatePercent: number;
  healthStatus: SkillLinterHealthStatus;
  recommendations: string[];
}

export interface SkillLinterMetricsReport {
  totalSkillsAudited: number;
  cleanSkillsCount: number;
  totalErrorsFound: number;
  totalWarningsFound: number;
  avgAuditDurationMs: number;
  errorsByRuleCode: Record<string, number>;
  reportsByStatus: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Swimlane Grouping
// ---------------------------------------------------------------------------

export type SkillLinterGroupBy = "status" | "ruleCode" | "severity" | "directory";
export type SkillLinterSortBy = "timestamp" | "skillName" | "errors" | "warnings";
export type SkillLinterSortDirection = "asc" | "desc";

export interface SkillLinterGroupedLane {
  key: string;
  title: string;
  count: number;
  reports: readonly SkillLintReport[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search
// ---------------------------------------------------------------------------

export interface SkillLinterDslQueryFilter {
  rawQuery?: string;
  valid?: boolean;
  ruleCode?: SkillLintRuleCode;
  severity?: SkillLintSeverity;
  skillName?: string;
  textTerms?: string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Bulk Operations
// ---------------------------------------------------------------------------

export interface SkillLinterMutationUndoRecord {
  mutationType: "add_report" | "bulk_purge" | "clear" | "config_change";
  previousSnapshot: SkillLinterWorkspaceSnapshot;
  nextSnapshot: SkillLinterWorkspaceSnapshot;
  timestampMs: number;
}

export interface SkillLinterBulkMutationResult {
  matchedCount: number;
  modifiedCount: number;
  affectedSkillNames: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Core Interface
// ---------------------------------------------------------------------------

export interface IBroccoliSkillLinterSubstrate {
  recordReport(report: SkillLintReport): void;
  getReport(skillName: string): SkillLintReport | undefined;
  listReports(): readonly SkillLintReport[];
  removeReport(skillName: string): boolean;
  clear(): void;

  auditHealth(): SkillLinterHealthAuditReport;
  getMetrics(): SkillLinterMetricsReport;
  getGroupedReports(
    groupBy?: SkillLinterGroupBy,
    sortBy?: SkillLinterSortBy,
    direction?: SkillLinterSortDirection
  ): readonly SkillLinterGroupedLane[];
  queryReportsDsl(query: SkillLinterDslQueryFilter | string): readonly SkillLintReport[];

  bulkPurgeReports(skillNames: readonly string[]): SkillLinterBulkMutationResult;
  bulkPurgeInvalid(): SkillLinterBulkMutationResult;

  undo(): boolean;
  redo(): boolean;

  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;

  exportSnapshot(): SkillLinterWorkspaceSnapshot;
  importSnapshot(snapshot: SkillLinterWorkspaceSnapshot): void;
}
