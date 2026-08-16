/**
 * fuzzy-matcher-supervisor.ts
 *
 * Master fuzzy matcher supervisor coordinating 9-strategy search and replace,
 * edit idempotency checks, indentation adaptation, Unicode normalization, and execution analytics (Phase 103 / ADR-057).
 */

import { performance } from "node:perf_hooks";
import type {
  CandidateRankingResult,
  ConflictMarkerChunk,
  ConflictResolutionResult,
  ConflictResolutionStrategy,
  FuzzyExecutionRecord,
  FuzzyMatchResult,
  FuzzyMultiMatchResult,
  FuzzyReplacementHunk,
  FuzzyStrategyName,
  IndentationHarmonizationResult,
  IndentationStyle,
  LspApplyResult,
  LspTextEdit,
  LspWorkspaceEdit,
  MultiFilePatchResult,
  MultiFileTransactionHunk,
  MultiFileTransactionResult,
  SyntaxBoundarySnapResult,
  SyntaxRepairResult,
  ThreeWayMergeOptions,
  ThreeWayMergeResult,
  UnifiedPatchResult,
} from "../../../core/contracts/fuzzy-matcher.contracts.js";
import { DeterministicFuzzyMatcher } from "../../../tooling/extensions/fuzzy/deterministic-fuzzy-matcher.js";
import { BroccoliFuzzySubstrate } from "../../../sessions/extensions/fuzzy/broccoli-fuzzy-substrate.js";

export class FuzzyMatcherSupervisor {
  private matcher: DeterministicFuzzyMatcher;
  private substrate: BroccoliFuzzySubstrate;
  private executionCounter: number;

  constructor(
    matcher: DeterministicFuzzyMatcher,
    substrate: BroccoliFuzzySubstrate
  ) {
    this.matcher = matcher;
    this.substrate = substrate;
    this.executionCounter = 0;
  }

  /**
   * Executes a fuzzy search and replace operation across the 9-strategy cascade.
   */
  findAndReplace(
    content: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false,
    options: { dryRun?: boolean } = {}
  ): FuzzyMatchResult {
    const start = performance.now();
    const result = this.matcher.findAndReplace(content, oldString, newString, replaceAll, options);
    const duration = performance.now() - start;

    if (result.success && result.strategyUsed && !options.dryRun) {
      this.executionCounter++;
      const record: FuzzyExecutionRecord = {
        id: `fuzzy-exec-${this.executionCounter}`,
        timestamp: Date.now(),
        strategyUsed: result.strategyUsed,
        matchCount: result.matchCount,
        oldStringLength: oldString.length,
        newStringLength: newString.length,
        durationMs: duration,
        similarityScore: result.similarityScore ?? 1.0,
      };
      this.substrate.recordExecution(record);
    }

    return result;
  }

  /**
   * Performs a dry-run search and replace without modifying content, generating diff and context windows.
   */
  dryRun(
    content: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): FuzzyMatchResult {
    return this.findAndReplace(content, oldString, newString, replaceAll, { dryRun: true });
  }

  /**
   * Executes an atomic multi-hunk search and replace operation across the 10-strategy cascade.
   */
  findAndReplaceMulti(
    content: string,
    hunks: readonly FuzzyReplacementHunk[],
    options: { dryRun?: boolean } = {}
  ): FuzzyMultiMatchResult {
    const start = performance.now();
    const result = this.matcher.findAndReplaceMulti(content, hunks, options);
    const duration = performance.now() - start;

    if (result.success && result.appliedHunks > 0 && !options.dryRun) {
      for (let i = 0; i < result.strategiesUsed.length; i++) {
        this.executionCounter++;
        const record: FuzzyExecutionRecord = {
          id: `fuzzy-exec-multi-${this.executionCounter}`,
          timestamp: Date.now(),
          strategyUsed: result.strategiesUsed[i],
          matchCount: 1,
          oldStringLength: hunks[i]?.oldString.length || 0,
          newStringLength: hunks[i]?.newString.length || 0,
          durationMs: duration / result.appliedHunks,
          similarityScore: 1.0,
        };
        this.substrate.recordExecution(record);
      }
    }

    return result;
  }

  /**
   * Generates a standard unified diff between original content and new content.
   */
  generateUnifiedDiff(oldText: string, newText: string, filename: string = "file"): string {
    return this.matcher.generateUnifiedDiff(oldText, newText, filename);
  }

  /**
   * Applies a standard unified diff patch directly to content.
   */
  applyUnifiedPatch(content: string, patch: string): UnifiedPatchResult {
    return this.matcher.applyUnifiedPatch(content, patch);
  }

  /**
   * Applies standard SEARCH/REPLACE blocks (Aider / LLM convention) to content.
   */
  applySearchReplaceBlocks(
    content: string,
    blockText: string,
    options: { dryRun?: boolean } = {}
  ): FuzzyMultiMatchResult {
    return this.matcher.applySearchReplaceBlocks(content, blockText, options);
  }

  /**
   * Finds and replaces text centered near an expected line number hint.
   */
  findAndReplaceAtLine(
    content: string,
    oldString: string,
    newString: string,
    lineHint: number,
    lineTolerance: number = 15,
    options: { dryRun?: boolean } = {}
  ): FuzzyMatchResult {
    return this.matcher.findAndReplaceAtLine(content, oldString, newString, lineHint, lineTolerance, options);
  }

  /**
   * Applies a unified diff patch spanning multiple files in memory.
   */
  applyMultiFileUnifiedPatch(
    fileContents: Record<string, string>,
    multiFilePatch: string
  ): MultiFilePatchResult {
    return this.matcher.applyMultiFileUnifiedPatch(fileContents, multiFilePatch);
  }

  /**
   * Parses git conflict markers from content into structured records.
   */
  parseConflictMarkers(content: string): ConflictMarkerChunk[] {
    return this.matcher.parseConflictMarkers(content);
  }

  /**
   * Resolves git conflict markers deterministically using specified strategy or custom resolver.
   */
  resolveConflictMarkers(
    content: string,
    strategy: ConflictResolutionStrategy | ((chunk: ConflictMarkerChunk) => string) = "take_ours"
  ): ConflictResolutionResult {
    return this.matcher.resolveConflictMarkers(content, strategy);
  }

  /**
   * Detects the dominant indentation style (spaces vs tabs, size, confidence) of content.
   */
  detectIndentationStyle(content: string): IndentationStyle {
    return this.matcher.detectIndentationStyle(content);
  }

  /**
   * Harmonizes snippet indentation to proportionally match target document's prevailing style.
   */
  harmonizeIndentation(targetContent: string, snippet: string): IndentationHarmonizationResult {
    return this.matcher.harmonizeIndentation(targetContent, snippet);
  }

  /**
   * Snaps character start/end coordinates to the nearest balanced syntax and word boundaries.
   */
  snapToSyntaxBoundaries(content: string, start: number, end: number): SyntaxBoundarySnapResult {
    return this.matcher.snapToSyntaxBoundaries(content, start, end);
  }

  /**
   * Executes an atomic multi-file transaction across memory file maps with complete rollback on any error.
   */
  applyMultiFileTransaction(
    fileContents: Record<string, string>,
    transactions: MultiFileTransactionHunk[],
    options: { dryRun?: boolean } = {}
  ): MultiFileTransactionResult {
    return this.matcher.applyMultiFileTransaction(fileContents, transactions, options);
  }

  /**
   * Performs a 3-way merge between baseContent, oursContent, and theirsContent.
   */
  threeWayMerge(
    baseContent: string,
    oursContent: string,
    theirsContent: string,
    options: ThreeWayMergeOptions = {}
  ): ThreeWayMergeResult {
    return this.matcher.threeWayMerge(baseContent, oursContent, theirsContent, options);
  }

  /**
   * Applies an array of LSP-compliant 0-indexed TextEdit objects to content.
   */
  applyLspTextEdits(content: string, edits: readonly LspTextEdit[]): LspApplyResult {
    return this.matcher.applyLspTextEdits(content, edits);
  }

  /**
   * Converts fuzzy replacement hunks into standard 0-indexed LSP TextEdit objects.
   */
  fuzzyHunksToLspEdits(content: string, hunks: readonly FuzzyReplacementHunk[]): LspTextEdit[] {
    return this.matcher.fuzzyHunksToLspEdits(content, hunks);
  }

  /**
   * Applies an LSP WorkspaceEdit across multiple files in memory with atomic rollback.
   */
  applyLspWorkspaceEdit(
    fileContents: Record<string, string>,
    workspaceEdit: LspWorkspaceEdit,
    options: { dryRun?: boolean } = {}
  ): MultiFileTransactionResult {
    return this.matcher.applyLspWorkspaceEdit(fileContents, workspaceEdit, options);
  }

  /**
   * Validates structural syntax of a code snippet and auto-repairs unbalanced brackets or unclosed strings.
   */
  validateAndRepairCodeBlock(codeSnippet: string): SyntaxRepairResult {
    return this.matcher.validateAndRepairCodeBlock(codeSnippet);
  }

  /**
   * Computes semantic Jaccard and Levenshtein similarity to rank candidate match spans for a search snippet.
   */
  rankCandidateMatches(content: string, searchSnippet: string, limit: number = 5): CandidateRankingResult {
    return this.matcher.rankCandidateMatches(content, searchSnippet, limit);
  }

  /**
   * Verifies if the requested edit has already landed in the content.
   */
  checkIdempotency(content: string, oldString: string, newString: string): boolean {
    return this.matcher.isAlreadyApplied(content, oldString, newString);
  }

  // ---------------------------------------------------------------------------
  // Dynamic Configuration & Strategy Control
  // ---------------------------------------------------------------------------

  setCustomUnicodeMapping(char: string, replacement: string): void {
    this.matcher.setCustomUnicodeMapping(char, replacement);
    this.substrate.setCustomUnicodeMapping(char, replacement);
  }

  getUnicodeMap(): Record<string, string> {
    return this.matcher.getUnicodeMap();
  }

  setSimilarityThreshold(threshold: number): void {
    this.matcher.setSimilarityThreshold(threshold);
    this.substrate.setSimilarityThreshold(threshold);
  }

  getSimilarityThreshold(): number {
    return this.matcher.getSimilarityThreshold();
  }

  enableStrategy(name: FuzzyStrategyName): void {
    this.matcher.enableStrategy(name);
    this.substrate.setEnabledStrategies(this.matcher.getEnabledStrategies());
  }

  disableStrategy(name: FuzzyStrategyName): void {
    this.matcher.disableStrategy(name);
    this.substrate.setEnabledStrategies(this.matcher.getEnabledStrategies());
  }

  setEnabledStrategies(strategies: readonly FuzzyStrategyName[]): void {
    this.matcher.setEnabledStrategies(strategies);
    this.substrate.setEnabledStrategies(strategies);
  }

  getEnabledStrategies(): readonly FuzzyStrategyName[] {
    return this.matcher.getEnabledStrategies();
  }

  setPreserveIndentation(enabled: boolean): void {
    this.matcher.setPreserveIndentation(enabled);
    this.substrate.setPreserveIndentation(enabled);
  }

  getPreserveIndentation(): boolean {
    return this.matcher.getPreserveIndentation();
  }

  setNormalizeLineEndings(enabled: boolean): void {
    this.matcher.setNormalizeLineEndings(enabled);
    this.substrate.setNormalizeLineEndings(enabled);
  }

  getNormalizeLineEndings(): boolean {
    return this.matcher.getNormalizeLineEndings();
  }

  setPreserveUnicodeForUnchanged(enabled: boolean): void {
    this.matcher.setPreserveUnicodeForUnchanged(enabled);
    this.substrate.setPreserveUnicodeForUnchanged(enabled);
  }

  getPreserveUnicodeForUnchanged(): boolean {
    return this.matcher.getPreserveUnicodeForUnchanged();
  }

  /**
   * Diagnoses why old_string failed to match content, finding similar lines and detecting whitespace issues.
   */
  diagnoseMismatch(oldString: string, content: string): ReturnType<DeterministicFuzzyMatcher["diagnoseMismatch"]> {
    return this.matcher.diagnoseMismatch(oldString, content);
  }

  /**
   * Generates a "Did you mean..." hint string for no-match situations.
   */
  formatNoMatchHint(oldString: string, content: string): string {
    return this.matcher.formatNoMatchHint(oldString, content);
  }

  // ---------------------------------------------------------------------------
  // Analytics & History
  // ---------------------------------------------------------------------------

  getExecutionHistory(): readonly FuzzyExecutionRecord[] {
    return this.substrate.getHistory();
  }

  getStrategyAnalytics(): {
    totalReplacements: number;
    strategyUsageCounts: Record<string, number>;
  } {
    return {
      totalReplacements: this.substrate.getTotalReplacements(),
      strategyUsageCounts: this.substrate.getStrategyUsageCounts(),
    };
  }

  clearHistory(): void {
    this.substrate.clearHistory();
  }
}
