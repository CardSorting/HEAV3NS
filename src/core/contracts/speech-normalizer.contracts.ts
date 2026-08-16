/**
 * speech-normalizer.contracts.ts
 *
 * Core contracts, enums, and interfaces for Deterministic Speech Text Normalizer,
 * Non-Spoken Block Stripper & Symbol Expansion Subsystem (Phase 115 / ADR-091 / Target #48).
 */

export interface SpeechNormalizationOptions {
  readonly maxChars?: number;
  readonly flattenNewlines?: boolean;
  readonly expandSymbols?: boolean;
  readonly stripMarkdown?: boolean;
  readonly stripReasoning?: boolean;
  readonly customLexicon?: Readonly<Record<string, string>>;
}

export interface SpeechNormalizationResult {
  readonly originalText: string;
  readonly spokenScript: string;
  readonly charCountBefore: number;
  readonly charCountAfter: number;
  readonly strippedBlockCount: number;
  readonly expandedSymbolCount: number;
}

export type LexiconCategory = "currency" | "unit" | "symbol" | "temperature" | "custom";

export interface SpeechLexiconEntry {
  readonly term: string;
  readonly replacement: string;
  readonly caseSensitive: boolean;
  readonly category: LexiconCategory;
}

export interface SpeechWorkspaceSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly lexicon: readonly SpeechLexiconEntry[];
  readonly metrics: {
    readonly totalNormalizations: number;
    readonly totalCharsProcessed: number;
    readonly totalBlocksStripped: number;
  };
}
