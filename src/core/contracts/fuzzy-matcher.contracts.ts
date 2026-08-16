/**
 * fuzzy-matcher.contracts.ts
 *
 * Core contracts for deterministic 11-strategy fuzzy line matching, atomic multi-hunk patching,
 * Unicode typography coordinate mapping & preservation, block-anchor resolution,
 * token-normalized code matching, escape-drift detection, Myers unified diff generation,
 * and closest-line mismatch diagnostics with word-level highlight (Phase 103 / ADR-057).
 */

export type FuzzyStrategyName =
  | "exact"
  | "line_trimmed"
  | "whitespace_normalized"
  | "indentation_flexible"
  | "escape_normalized"
  | "trimmed_boundary"
  | "comment_tolerant"
  | "token_normalized"
  | "unicode_normalized"
  | "block_anchor"
  | "context_aware";

export type FuzzyMatchSpan = readonly [startIndex: number, endIndex: number];

export interface ContextWindow {
  readonly startLine: number;
  readonly endLine: number;
  readonly beforeContext: readonly string[];
  readonly matchedLines: readonly string[];
  readonly afterContext: readonly string[];
}

export interface WordDiffHighlight {
  readonly fileToken: string;
  readonly searchToken: string;
  readonly index: number;
}

export interface ClosestLineCandidate {
  readonly lineNumber: number;
  readonly lineContent: string;
  readonly similarity: number;
  readonly snippet: string;
  readonly whitespaceDifference?: {
    readonly fileHasVisual: string;
    readonly youSentVisual: string;
  };
  readonly wordHighlights?: readonly WordDiffHighlight[];
}

export interface MismatchDiagnosis {
  readonly hasCandidate: boolean;
  readonly formattedHint: string;
  readonly candidates: readonly ClosestLineCandidate[];
  readonly whitespaceIssueDetected: boolean;
}

export interface EscapeDriftDetection {
  readonly detected: boolean;
  readonly reason: "quote_escape" | "backslash_doubling" | null;
  readonly message: string | null;
  readonly suspectSequence?: string;
}

export interface FuzzyMatchResult {
  readonly success: boolean;
  readonly modifiedContent: string;
  readonly matchCount: number;
  readonly strategyUsed: FuzzyStrategyName | null;
  readonly isIdempotent: boolean;
  readonly error: string | null;
  readonly ambiguityLocations?: string;
  readonly similarityScore?: number;
  readonly diffPreview?: string;
  readonly linesAffected?: number;
  readonly contextWindows?: readonly ContextWindow[];
  readonly diagnosticHint?: string;
  readonly escapeDrift?: EscapeDriftDetection;
}

export interface FuzzyReplacementHunk {
  readonly oldString: string;
  readonly newString: string;
  readonly replaceAll?: boolean;
}

export interface FuzzyMultiMatchResult {
  readonly success: boolean;
  readonly modifiedContent: string;
  readonly totalHunks: number;
  readonly appliedHunks: number;
  readonly isFullyIdempotent: boolean;
  readonly strategiesUsed: readonly FuzzyStrategyName[];
  readonly diffPreview?: string;
  readonly error: string | null;
  readonly failedHunkIndex?: number;
  readonly failedHunkError?: string;
}

export interface FuzzyMatcherOptions {
  readonly similarityThreshold?: number; // default 0.5
  readonly customUnicodeMap?: Record<string, string>;
  readonly enabledStrategies?: readonly FuzzyStrategyName[];
  readonly preserveIndentation?: boolean; // default true: adapt new_string base indent to target block
  readonly normalizeLineEndings?: boolean; // default true: handle CRLF/LF gracefully
  readonly dryRun?: boolean;
  readonly preserveUnicodeForUnchanged?: boolean; // default true: keep original Unicode for unchanged spans
}

export interface FuzzyExecutionRecord {
  readonly id: string;
  readonly timestamp: number;
  readonly strategyUsed: FuzzyStrategyName;
  readonly matchCount: number;
  readonly oldStringLength: number;
  readonly newStringLength: number;
  readonly durationMs: number;
  readonly similarityScore: number;
}

export interface FuzzyWorkspaceSnapshot {
  readonly executionHistory: readonly FuzzyExecutionRecord[];
  readonly totalFuzzyReplacements: number;
  readonly strategyUsageCounts: Record<string, number>;
  readonly customUnicodeMap: Record<string, string>;
  readonly similarityThreshold: number;
  readonly preserveIndentation: boolean;
  readonly normalizeLineEndings: boolean;
  readonly preserveUnicodeForUnchanged: boolean;
  readonly enabledStrategies: readonly FuzzyStrategyName[];
}
