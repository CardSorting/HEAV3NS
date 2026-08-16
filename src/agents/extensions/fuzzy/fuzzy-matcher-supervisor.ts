/**
 * fuzzy-matcher-supervisor.ts
 *
 * Master fuzzy matcher supervisor coordinating 9-strategy search and replace,
 * edit idempotency checks, indentation adaptation, Unicode normalization, and execution analytics (Phase 103 / ADR-057).
 */

import { performance } from "node:perf_hooks";
import type {
  FuzzyExecutionRecord,
  FuzzyMatchResult,
  FuzzyStrategyName,
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
