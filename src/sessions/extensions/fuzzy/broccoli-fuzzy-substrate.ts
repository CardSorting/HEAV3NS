/**
 * broccoli-fuzzy-substrate.ts
 *
 * In-memory Broccolidb repository for fuzzy match executions, strategy frequency analytics,
 * custom Unicode mappings, similarity thresholds, and indentation preservation configs (Phase 103 / ADR-057).
 */

import type {
  FuzzyExecutionRecord,
  FuzzyStrategyName,
  FuzzyWorkspaceSnapshot,
} from "../../../core/contracts/fuzzy-matcher.contracts.js";
import { ALL_STRATEGIES, DEFAULT_UNICODE_MAP } from "../../../tooling/extensions/fuzzy/deterministic-fuzzy-matcher.js";

export class BroccoliFuzzySubstrate {
  private history: FuzzyExecutionRecord[];
  private strategyUsageCounts: Map<FuzzyStrategyName, number>;
  private customUnicodeMap: Map<string, string>;
  private similarityThreshold: number;
  private preserveIndentation: boolean;
  private normalizeLineEndings: boolean;
  private enabledStrategies: Set<FuzzyStrategyName>;
  private totalReplacements: number;

  constructor() {
    this.history = [];
    this.strategyUsageCounts = new Map<FuzzyStrategyName, number>();
    this.customUnicodeMap = new Map<string, string>();
    for (const [k, v] of Object.entries(DEFAULT_UNICODE_MAP)) {
      this.customUnicodeMap.set(k, v);
    }
    this.similarityThreshold = 0.5;
    this.preserveIndentation = true;
    this.normalizeLineEndings = true;
    this.enabledStrategies = new Set<FuzzyStrategyName>(ALL_STRATEGIES);
    this.totalReplacements = 0;
  }

  recordExecution(record: FuzzyExecutionRecord): void {
    this.history.push(record);
    this.totalReplacements += record.matchCount;
    const current = this.strategyUsageCounts.get(record.strategyUsed) || 0;
    this.strategyUsageCounts.set(record.strategyUsed, current + record.matchCount);
  }

  getHistory(): readonly FuzzyExecutionRecord[] {
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
  }

  getStrategyUsageCounts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.strategyUsageCounts.entries()) {
      out[k] = v;
    }
    return out;
  }

  setCustomUnicodeMapping(char: string, replacement: string): void {
    this.customUnicodeMap.set(char, replacement);
  }

  getUnicodeMap(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.customUnicodeMap.entries()) {
      out[k] = v;
    }
    return out;
  }

  setSimilarityThreshold(threshold: number): void {
    this.similarityThreshold = Math.max(0.1, Math.min(1.0, threshold));
  }

  getSimilarityThreshold(): number {
    return this.similarityThreshold;
  }

  setPreserveIndentation(enabled: boolean): void {
    this.preserveIndentation = enabled;
  }

  getPreserveIndentation(): boolean {
    return this.preserveIndentation;
  }

  setNormalizeLineEndings(enabled: boolean): void {
    this.normalizeLineEndings = enabled;
  }

  getNormalizeLineEndings(): boolean {
    return this.normalizeLineEndings;
  }

  setEnabledStrategies(strategies: readonly FuzzyStrategyName[]): void {
    this.enabledStrategies = new Set<FuzzyStrategyName>(strategies);
  }

  getEnabledStrategies(): readonly FuzzyStrategyName[] {
    return ALL_STRATEGIES.filter((s) => this.enabledStrategies.has(s));
  }

  getTotalReplacements(): number {
    return this.totalReplacements;
  }

  toSnapshot(): FuzzyWorkspaceSnapshot {
    return {
      executionHistory: [...this.history],
      totalFuzzyReplacements: this.totalReplacements,
      strategyUsageCounts: this.getStrategyUsageCounts(),
      customUnicodeMap: this.getUnicodeMap(),
      similarityThreshold: this.similarityThreshold,
      preserveIndentation: this.preserveIndentation,
      normalizeLineEndings: this.normalizeLineEndings,
      enabledStrategies: this.getEnabledStrategies(),
    };
  }

  restoreSnapshot(snapshot: FuzzyWorkspaceSnapshot): void {
    this.history = [...snapshot.executionHistory];
    this.totalReplacements = snapshot.totalFuzzyReplacements;
    this.similarityThreshold = snapshot.similarityThreshold;
    this.preserveIndentation = snapshot.preserveIndentation ?? true;
    this.normalizeLineEndings = snapshot.normalizeLineEndings ?? true;

    this.enabledStrategies = new Set<FuzzyStrategyName>(snapshot.enabledStrategies ?? ALL_STRATEGIES);

    this.strategyUsageCounts.clear();
    for (const [k, v] of Object.entries(snapshot.strategyUsageCounts)) {
      this.strategyUsageCounts.set(k as FuzzyStrategyName, v);
    }

    this.customUnicodeMap.clear();
    for (const [k, v] of Object.entries(snapshot.customUnicodeMap)) {
      this.customUnicodeMap.set(k, v);
    }
  }
}
