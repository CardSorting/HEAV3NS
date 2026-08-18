/**
 * heredoc-terminal.contracts.ts
 *
 * Core contracts, enums, interfaces, and regex patterns for Conservative Shell Heredoc
 * Sanitization, Subshell Trap Interception, Multi-Line Terminal Execution, and Actionable
 * Terminal Diagnostics (Phase 110 / ADR-086 / Target #86).
 */

export type HeredocInterpreterType =
  | "python"
  | "node"
  | "osascript"
  | "cat"
  | "bash"
  | "sh"
  | "ruby"
  | "perl"
  | "unknown";

export type CommandRiskLevel = "clean" | "low" | "medium" | "high" | "blocked";

export type TerminalDiagnosticCategory =
  | "missing_module"
  | "port_collision"
  | "permission_denied"
  | "missing_command"
  | "git_conflict"
  | "syntax_error"
  | "timeout"
  | "generic";

/**
 * Allowlisted inert heredoc consumers.
 * Commands whose (quoted, inert) heredoc bodies are safe to mask because the body
 * is program text/data for that interpreter, not shell syntax executed by the command line.
 */
export const INERT_HEREDOC_CONSUMER_PATTERN =
  /^\s*(?:[A-Z_][A-Z0-9_]*=\S+\s+)*(?:env\s+)?(?:[A-Za-z0-9_./-]+\/)?(?:python(?:3(?:\.\d+)*)?|node|osascript|cat)(?=\s|$)/i;

/**
 * Known dangerous shell commands and fork-bomb patterns that must be blocked or heavily flagged.
 */
export const DANGEROUS_SHELL_PATTERNS = [
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // Fork bomb
  />\s*\/dev\/sda/i, // Disk overwrite
  /mkfs\.\w+\s+\/dev/i, // Filesystem overwrite
  /dd\s+if=\/dev\/zero\s+of=\/dev/i, // Direct drive wipe
  /\brm\s+-(?:rf?|fr?)\s+(?:\/\s*|\/\*|\.\/|~)\s*$/, // Root rm -rf
  /\bchmod\s+-R\s+777\s+\/\s*$/, // Root chmod 777
] as const;

export interface HeredocOperatorSpec {
  readonly delimiter: string;
  readonly stripTabs: boolean;
  readonly isQuoted: boolean;
  readonly openerEndOffset: number;
}

export interface HeredocBodySpan {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly delimiter: string;
  readonly stripTabs: boolean;
  readonly isQuoted: boolean;
  readonly interpreter: HeredocInterpreterType;
  readonly originalBodyText: string;
  readonly maskedBodyText: string;
}

export interface HeredocSanitizationResult {
  readonly originalCommand: string;
  readonly sanitizedCommand: string;
  readonly hasHeredocs: boolean;
  readonly maskedBodiesCount: number;
  readonly preservedLineCount: number;
  readonly hadAmbiguity: boolean;
  readonly hadListOperator: boolean;
  readonly hadNestedScope: boolean;
  readonly inertSpans: readonly HeredocBodySpan[];
  readonly latencyMs: number;
}

export interface CommandSafetyClassification {
  readonly command: string;
  readonly isSafe: boolean;
  readonly riskLevel: CommandRiskLevel;
  readonly hasBackgroundOperator: boolean;
  readonly isCompound: boolean;
  readonly interpreter: HeredocInterpreterType;
  readonly matchedDangerousPatterns: readonly string[];
  readonly reason: string;
  readonly suggestedSanitization?: string;
}

export interface ScriptHeredocOptions {
  readonly interpreter?: HeredocInterpreterType;
  readonly customInterpreterCommand?: string;
  readonly delimiter?: string;
  readonly stripTabs?: boolean;
  readonly environmentVars?: Record<string, string>;
  readonly extraArgs?: readonly string[];
}

export interface ScriptHeredocResult {
  readonly scriptText: string;
  readonly interpreter: HeredocInterpreterType;
  readonly delimiter: string;
  readonly synthesizedCommandLine: string;
  readonly totalLines: number;
}

export interface TerminalDiagnosticHint {
  readonly category: TerminalDiagnosticCategory;
  readonly title: string;
  readonly description: string;
  readonly suggestedCommand?: string;
  readonly confidence: number; // 0.0 - 1.0
  readonly matchedSignature?: string;
}

export interface TerminalExecutionDiagnostics {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly executionTimeMs?: number;
  readonly isRecoverable: boolean;
  readonly primaryHint?: TerminalDiagnosticHint;
  readonly allHints: readonly TerminalDiagnosticHint[];
  readonly rootCauseSummary: string;
}

export interface HeredocSanitizationLogRecord {
  readonly recordId: string;
  readonly timestamp: number;
  readonly commandLength: number;
  readonly maskedBodiesCount: number;
  readonly hadAmbiguity: boolean;
  readonly latencyMs: number;
  readonly riskLevel: CommandRiskLevel;
}

export interface HeredocTerminalConfig {
  readonly maxLogHistory: number;
  readonly maxDiagnosticsHistory: number;
  readonly maxMaskedLength: number;
  readonly enableStrictForkBombGuard: boolean;
  readonly allowQuotedHeredocsOnly: boolean;
}

export const DEFAULT_HEREDOC_TERMINAL_CONFIG: HeredocTerminalConfig = {
  maxLogHistory: 500,
  maxDiagnosticsHistory: 200,
  maxMaskedLength: 100000,
  enableStrictForkBombGuard: true,
  allowQuotedHeredocsOnly: false,
};

export interface HeredocTerminalWorkspaceSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly totalSanitizations: number;
  readonly totalMaskedBodies: number;
  readonly totalDangerousCommandsBlocked: number;
  readonly totalDiagnosticsGenerated: number;
  readonly recentLogs: readonly HeredocSanitizationLogRecord[];
  readonly recentDiagnostics: readonly TerminalExecutionDiagnostics[];
}

// ---------------------------------------------------------------------------
// Hybrid BroccoliDB Row Schemas & SLA Health Reporting
// ---------------------------------------------------------------------------

export interface HeredocSanitizationRow {
  readonly recordId: string;
  readonly originalCommandPreview: string;
  readonly sanitizedCommandPreview: string;
  readonly hasHeredocs: boolean;
  readonly maskedBodiesCount: number;
  readonly riskLevel: CommandRiskLevel;
  readonly hadAmbiguity: boolean;
  readonly latencyMs: number;
  readonly timestamp: number;
}

export interface HeredocDiagnosticRow {
  readonly diagId: string;
  readonly exitCode: number;
  readonly category: TerminalDiagnosticCategory;
  readonly title: string;
  readonly rootCauseSummary: string;
  readonly isRecoverable: boolean;
  readonly executionTimeMs: number;
  readonly timestamp: number;
}

export interface HeredocAuditRow {
  readonly auditId: string;
  readonly timestamp: number;
  readonly totalSanitizations: number;
  readonly totalMaskedBodies: number;
  readonly totalDangerousCommandsBlocked: number;
  readonly totalDiagnosticsGenerated: number;
  readonly healthStatus: HeredocTerminalHealthStatus;
}

export type HeredocTerminalHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface HeredocTerminalHealthAuditReport {
  readonly timestamp: number;
  readonly healthStatus: HeredocTerminalHealthStatus;
  readonly totalSanitizations: number;
  readonly totalMaskedBodies: number;
  readonly totalDangerousCommandsBlocked: number;
  readonly totalDiagnosticsGenerated: number;
  readonly avgSanitizationLatencyMs: number;
  readonly cleanRatioPercent: number;
  readonly recommendations: readonly string[];
}

export interface HeredocTerminalMetricsReport {
  readonly totalSanitizations: number;
  readonly totalMaskedBodies: number;
  readonly totalDangerousCommandsBlocked: number;
  readonly totalDiagnosticsGenerated: number;
  readonly riskLevelBreakdown: Record<CommandRiskLevel, number>;
  readonly diagnosticCategoryBreakdown: Record<TerminalDiagnosticCategory, number>;
  readonly avgSanitizationLatencyMs: number;
}

export type HeredocTerminalGroupBy = "riskLevel" | "category" | "hasHeredocs";
export type HeredocTerminalSortBy = "timestamp" | "latencyMs" | "commandLength";
export type HeredocTerminalSortDirection = "asc" | "desc";

export interface HeredocTerminalGroupedLane {
  readonly laneKey: string;
  readonly label: string;
  readonly count: number;
  readonly records: readonly HeredocSanitizationRow[];
}

export interface HeredocTerminalDslQueryFilter {
  readonly risk?: CommandRiskLevel;
  readonly category?: TerminalDiagnosticCategory;
  readonly hasHeredocs?: boolean;
  readonly query?: string;
}

export interface HeredocTerminalMutationUndoRecord {
  readonly mutationId: string;
  readonly timestamp: number;
  readonly action: string;
  readonly snapshot: HeredocTerminalWorkspaceSnapshot;
}

export interface HeredocTerminalBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly deletedIds: readonly string[];
}

export interface IBroccoliHeredocTerminalSubstrate {
  recordSanitization(record: HeredocSanitizationLogRecord, originalCommand?: string, sanitizedCommand?: string): void;
  recordDiagnostic(diag: TerminalExecutionDiagnostics): void;
  getRecentLogs(): readonly HeredocSanitizationLogRecord[];
  getRecentDiagnostics(): readonly TerminalExecutionDiagnostics[];
  getConfig(): HeredocTerminalConfig;
  updateConfig(patch: Partial<HeredocTerminalConfig>): void;
  clear(): void;

  exportSnapshot(): HeredocTerminalWorkspaceSnapshot;
  importSnapshot(snapshot: HeredocTerminalWorkspaceSnapshot): void;

  auditHealth(): HeredocTerminalHealthAuditReport;
  getMetricsReport(): HeredocTerminalMetricsReport;
  getGroupedRecords(
    groupBy?: HeredocTerminalGroupBy,
    sortBy?: HeredocTerminalSortBy,
    direction?: HeredocTerminalSortDirection
  ): readonly HeredocTerminalGroupedLane[];
  queryRecordsDsl(query: HeredocTerminalDslQueryFilter | string): readonly HeredocSanitizationRow[];

  bulkPurgeRecords(recordIds: readonly string[]): HeredocTerminalBulkMutationResult;

  undo(): boolean;
  redo(): boolean;

  exportHtml(): string;
  exportMarkdown(): string;
  exportCsv(): string;
}
