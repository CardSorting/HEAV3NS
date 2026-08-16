/**
 * reasoning.contracts.ts
 *
 * Core contracts for deterministic streaming reasoning scrubbing, chunk-boundary
 * tag parsing, dynamic timeout floors, and adaptive thinking budgets (Phase 102 / ADR-056).
 */

export type ReasoningEffortLevel = "none" | "low" | "medium" | "high" | "max";

export interface ReasoningTagPair {
  readonly openTag: string;
  readonly closeTag: string;
}

export interface ReasoningBlock {
  readonly id: string;
  readonly tag: string;
  readonly content: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly completed: boolean;
  readonly durationMs: number;
  readonly estimatedTokens: number;
}

export interface ScrubbedStreamChunk {
  readonly visibleDelta: string;
  readonly reasoningDelta: string;
  readonly inReasoningBlock: boolean;
  readonly tagPending: boolean;
  readonly completedBlocks: readonly ReasoningBlock[];
}

export interface ReasoningTimeoutConfig {
  readonly modelSlug: string;
  readonly floorSeconds: number;
  readonly recommendedEffort: ReasoningEffortLevel;
  readonly maxThinkingTokens: number;
}

export interface ReasoningScrubberOptions {
  readonly customTagPairs?: readonly ReasoningTagPair[];
  readonly customTimeoutFloors?: Record<string, number>;
  readonly customTimeoutConfigs?: readonly ReasoningTimeoutConfig[];
  readonly customBudgetMapping?: Partial<Record<ReasoningEffortLevel, number>>;
  readonly defaultTimeoutFloorSeconds?: number;
}

export interface ReasoningWorkspaceSnapshot {
  readonly activeBlocks: readonly ReasoningBlock[];
  readonly completedBlocks: readonly ReasoningBlock[];
  readonly currentEffortLevel: ReasoningEffortLevel;
  readonly totalReasoningTokensConsumed: number;
  readonly totalVisibleTokensEmitted: number;
  readonly customTimeoutFloors: Record<string, number>;
  readonly customBudgetMapping: Record<string, number>;
  readonly registeredTagPairs: readonly ReasoningTagPair[];
  readonly defaultTimeoutFloorSeconds: number;
}
