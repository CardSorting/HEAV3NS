/**
 * heredoc-terminal.contracts.ts
 *
 * Core contracts, enums, interfaces, and regex patterns for Conservative Shell Heredoc
 * Sanitization, Subshell Trap Interception, Multi-Line Terminal Execution, and Actionable
 * Terminal Diagnostics (Phase 110 / ADR-086 / Target #43).
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
