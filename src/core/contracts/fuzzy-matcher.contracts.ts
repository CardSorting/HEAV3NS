/**
 * fuzzy-matcher.contracts.ts
 *
 * Core contracts for deterministic 12-strategy fuzzy line matching, atomic multi-hunk patching,
 * SEARCH/REPLACE block parsing & application, line-hint biased matching, multi-file patch orchestration,
 * ellipsis-wildcard block matching, unified diff patch parsing & application,
 * Unicode typography coordinate mapping & preservation, block-anchor resolution,
 * token-normalized code matching, escape-drift detection, and closest-line mismatch diagnostics (Phase 103 / ADR-057).
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
  | "ellipsis_wildcard"
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

export interface SearchReplaceBlock {
  readonly filename?: string;
  readonly oldString: string;
  readonly newString: string;
}

export interface UnifiedPatchHunk {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  readonly lines: readonly string[];
}

export interface UnifiedPatchResult {
  readonly success: boolean;
  readonly modifiedContent: string;
  readonly hunksParsed: number;
  readonly hunksApplied: number;
  readonly error: string | null;
  readonly diffPreview?: string;
}

export interface MultiFilePatchResult {
  readonly success: boolean;
  readonly fileResults: Record<string, UnifiedPatchResult>;
  readonly totalFiles: number;
  readonly successfulFiles: number;
  readonly error: string | null;
}

export interface ConflictMarkerChunk {
  readonly startLine: number;
  readonly endLine: number;
  readonly oursHeader: string;
  readonly oursContent: string;
  readonly baseContent?: string;
  readonly theirsHeader: string;
  readonly theirsContent: string;
}

export type ConflictResolutionStrategy =
  | "take_ours"
  | "take_theirs"
  | "take_both_ours_first"
  | "take_both_theirs_first";

export interface ConflictResolutionResult {
  readonly success: boolean;
  readonly modifiedContent: string;
  readonly conflictsFound: number;
  readonly conflictsResolved: number;
  readonly chunks: readonly ConflictMarkerChunk[];
  readonly error: string | null;
}

export interface IndentationStyle {
  readonly type: "spaces" | "tabs" | "mixed";
  readonly size: number; // e.g. 2, 4, 8 (or 1 for tabs)
  readonly confidence: number; // 0..1
}

export interface IndentationHarmonizationResult {
  readonly originalSnippet: string;
  readonly harmonizedSnippet: string;
  readonly detectedStyle: IndentationStyle;
  readonly linesAdjusted: number;
}

export interface SyntaxBoundarySnapResult {
  readonly originalStart: number;
  readonly originalEnd: number;
  readonly snappedStart: number;
  readonly snappedEnd: number;
  readonly snappedSubstring: string;
  readonly adjustmentMade: boolean;
}

export interface MultiFileTransactionHunk {
  readonly filePath: string;
  readonly hunks?: readonly FuzzyReplacementHunk[];
  readonly searchReplaceBlocks?: string;
  readonly unifiedPatch?: string;
}

export interface MultiFileTransactionResult {
  readonly success: boolean;
  readonly committedFiles: Record<string, string>;
  readonly totalFilesTargeted: number;
  readonly totalFilesModified: number;
  readonly rollbackTriggered: boolean;
  readonly fileErrors: Record<string, string>;
  readonly error: string | null;
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

export type ThreeWayMergeConflictResolution =
  | "markers"
  | "ours"
  | "theirs"
  | "both_ours_first"
  | "both_theirs_first";

export interface ThreeWayMergeOptions {
  readonly conflictResolution?: ThreeWayMergeConflictResolution;
  readonly oursLabel?: string;
  readonly theirsLabel?: string;
  readonly baseLabel?: string;
}

export interface ThreeWayMergeHunk {
  readonly type: "clean_base" | "clean_ours" | "clean_theirs" | "conflict";
  readonly baseLines: readonly string[];
  readonly oursLines: readonly string[];
  readonly theirsLines: readonly string[];
}

export interface ThreeWayMergeResult {
  readonly success: boolean;
  readonly mergedContent: string;
  readonly cleanHunksApplied: number;
  readonly conflictCount: number;
  readonly conflictChunks: readonly ConflictMarkerChunk[];
  readonly error: string | null;
}

export interface LspPosition {
  readonly line: number;
  readonly character: number;
}

export interface LspRange {
  readonly start: LspPosition;
  readonly end: LspPosition;
}

export interface LspTextEdit {
  readonly range: LspRange;
  readonly newText: string;
}

export interface LspWorkspaceEdit {
  readonly changes: Record<string, readonly LspTextEdit[]>;
}

export interface LspApplyResult {
  readonly success: boolean;
  readonly modifiedContent: string;
  readonly editsApplied: number;
  readonly error: string | null;
}

export interface SyntaxBalanceIssue {
  readonly type: "unmatched_bracket" | "unclosed_string" | "unclosed_tag";
  readonly token: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export interface SyntaxRepairResult {
  readonly isValid: boolean;
  readonly repairedCode: string;
  readonly issuesFound: readonly SyntaxBalanceIssue[];
  readonly repairsApplied: readonly string[];
}

export interface CandidateMatchScore {
  readonly span: FuzzyMatchSpan;
  readonly startLine: number;
  readonly endLine: number;
  readonly jaccardSimilarity: number;
  readonly levenshteinSimilarity: number;
  readonly combinedScore: number;
  readonly candidateSnippet: string;
  readonly contextLines: readonly string[];
}

export interface CandidateRankingResult {
  readonly bestMatch: CandidateMatchScore | null;
  readonly candidates: readonly CandidateMatchScore[];
  readonly totalEvaluated: number;
  readonly searchSnippet: string;
}

// ---------------------------------------------------------------------------
// Patience Diff & Semantic Hunk Clustering Contracts
// ---------------------------------------------------------------------------

export interface PatienceDiffOptions {
  readonly contextLines?: number;
  readonly ignoreWhitespace?: boolean;
}

export interface PatienceDiffHunk {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  readonly lines: readonly string[];
}

export interface PatienceDiffResult {
  readonly diffText: string;
  readonly hunks: readonly PatienceDiffHunk[];
  readonly uniqueCommonLinesMatched: number;
  readonly totalLinesChanged: number;
  readonly hasChanges: boolean;
}

// ---------------------------------------------------------------------------
// Lexical Token Stream Align Contracts
// ---------------------------------------------------------------------------

export type LexicalTokenType = "IDENT" | "KEYWORD" | "PUNCT" | "STRING" | "NUMBER" | "COMMENT" | "WHITESPACE";

export interface LexicalToken {
  readonly type: LexicalTokenType;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

export interface TokenStreamMatchOptions {
  readonly ignoreComments?: boolean;
  readonly ignoreWhitespace?: boolean;
  readonly caseSensitive?: boolean;
}

export interface TokenStreamMatchResult {
  readonly success: boolean;
  readonly modifiedContent: string;
  readonly matchSpan: FuzzyMatchSpan | null;
  readonly tokensMatched: number;
  readonly error: string | null;
}

// ---------------------------------------------------------------------------
// Semantic Merge Conflict Explainer Contracts
// ---------------------------------------------------------------------------

export interface MergeResolutionCandidate {
  readonly strategy: string;
  readonly description: string;
  readonly resolvedContent: string;
  readonly confidenceScore: number;
}

export interface ConflictBlockAnalysis {
  readonly conflictIndex: number;
  readonly startLine: number;
  readonly endLine: number;
  readonly baseSnippet: string;
  readonly oursSnippet: string;
  readonly theirsSnippet: string;
  readonly conflictCategory: "overlapping_edit" | "addition_collision" | "deletion_conflict" | "reformat_conflict";
  readonly proposedResolutions: readonly MergeResolutionCandidate[];
}

export interface SemanticConflictExplanation {
  readonly totalConflicts: number;
  readonly analyses: readonly ConflictBlockAnalysis[];
  readonly summary: string;
  readonly autoResolvable: boolean;
}

// ---------------------------------------------------------------------------
// Deterministic Inverse Patch Contracts
// ---------------------------------------------------------------------------

export interface InversePatchHunk {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  readonly lines: readonly string[];
}

export interface InversePatchResult {
  readonly success: boolean;
  readonly inverseDiff: string;
  readonly invertedHunks: readonly InversePatchHunk[];
  readonly originalLength: number;
  readonly modifiedLength: number;
  readonly error: string | null;
}

export interface MultiFileInversePatchResult {
  readonly success: boolean;
  readonly inversePatchText: string;
  readonly fileInverseDiffs: Record<string, string>;
  readonly totalFiles: number;
  readonly error: string | null;
}

