/**
 * Semantic Context Compression & Trajectory Pruning Contracts
 *
 * Defines typed contracts, schemas, and interfaces for the Deterministic
 * Context Compression & Trajectory Compaction subsystem (K_comp).
 */

export type CompressionPolicy = "aggressive" | "balanced" | "conservative";

export interface TokenWindowBudget {
  readonly totalTokens: number;
  readonly maxContextLimit: number;
  readonly compressionThreshold: number;
  readonly headReservedTokens: number;
  readonly tailReservedTokens: number;
  readonly summaryBudgetTokens: number;
}

export interface CompressedTurnSummary {
  readonly id: string;
  readonly sourceTurnStart: number;
  readonly sourceTurnEnd: number;
  readonly originalTokens: number;
  readonly compressedTokens: number;
  readonly summaryText: string;
  readonly resolvedGoals: readonly string[];
  readonly pendingGoals: readonly string[];
  readonly timestampMs: number;
}

export interface ToolPruningPolicy {
  readonly maxOutputChars: number;
  readonly stripBase64Data: boolean;
  readonly preserveExitCodes: boolean;
  readonly collapseRepeatedLines: boolean;
}

export interface CompressionStateSnapshot {
  readonly summaries: readonly CompressedTurnSummary[];
  readonly totalCompactedTurns: number;
  readonly totalTokensSaved: number;
  readonly snapshotTick: number;
}

export interface IHeadTailBudgetGovernor {
  calculateBudget(totalTokens: number, maxLimit?: number): TokenWindowBudget;
  shouldCompress(currentTokens: number, budget: TokenWindowBudget): boolean;
  partitionTurns<T>(turns: readonly T[], headCount: number, tailCount: number): { head: readonly T[]; middle: readonly T[]; tail: readonly T[] };
}

export interface IDeterministicToolPruner {
  pruneToolResult(rawOutput: string, policy?: Partial<ToolPruningPolicy>): { prunedText: string; originalChars: number; prunedChars: number; wasPruned: boolean };
}

export interface IBroccoliCompressionSubstrate {
  recordSummary(summary: CompressedTurnSummary): void;
  getSummary(id: string): CompressedTurnSummary | undefined;
  listSummaries(): readonly CompressedTurnSummary[];
  getLatestSummary(): CompressedTurnSummary | undefined;
  clear(): void;
}

export interface ICompressionSnapshotManager {
  createSnapshot(tick: number): CompressionStateSnapshot;
  restoreSnapshot(snapshot: CompressionStateSnapshot): void;
}

export interface ITrajectoryCompactorEngine {
  compactTrajectory(
    turns: readonly { turnIndex: number; role: string; content: string }[],
    budget: TokenWindowBudget
  ): {
    compactedTurns: readonly { turnIndex: number; role: string; content: string }[];
    summary?: CompressedTurnSummary;
    tokensSaved: number;
  };
}
