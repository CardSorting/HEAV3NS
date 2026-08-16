/**
 * fuzzy-matcher.contracts.ts
 *
 * Core contracts for deterministic 9-strategy fuzzy line matching, Unicode typography
 * normalization, block-anchor resolution, indentation preservation, and edit idempotency (Phase 103 / ADR-057).
 */

export type FuzzyStrategyName =
  | "exact"
  | "line_trimmed"
  | "whitespace_normalized"
  | "indentation_flexible"
  | "escape_normalized"
  | "trimmed_boundary"
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
}

export interface FuzzyMatcherOptions {
  readonly similarityThreshold?: number; // default 0.5
  readonly customUnicodeMap?: Record<string, string>;
  readonly enabledStrategies?: readonly FuzzyStrategyName[];
  readonly preserveIndentation?: boolean; // default true: adapt new_string base indent to target block
  readonly normalizeLineEndings?: boolean; // default true: handle CRLF/LF gracefully
  readonly dryRun?: boolean;
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
  readonly enabledStrategies: readonly FuzzyStrategyName[];
}
