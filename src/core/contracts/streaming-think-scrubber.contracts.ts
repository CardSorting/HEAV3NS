/**
 * streaming-think-scrubber.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Streaming Reasoning Tag Scrubber,
 * Boundary Gated Holdback Buffer & Live Delta Filter Subsystem (Phase 137 / ADR-113 / Target #70).
 */

export type ReasoningTagName =
  | "think"
  | "thinking"
  | "reasoning"
  | "thought"
  | "REASONING_SCRATCHPAD";

export interface StreamingScrubberState {
  inBlock: boolean;
  heldBuffer: string;
  lastEmittedEndedNewline: boolean;
  turnIndex: number;
}

export interface StreamingThinkScrubberConfig {
  enabled: boolean;
  tagNames: readonly string[];
  preserveProseMentions: boolean;
  discardUnterminatedOnFlush: boolean;
}

export interface StreamingThinkScrubberMetrics {
  totalDeltasProcessed: number;
  reasoningChunksSuppressed: number;
  heldBackTailEmissions: number;
  blocksEncountered: number;
  flushesExecuted: number;
}

export interface StreamingThinkScrubberWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: StreamingThinkScrubberConfig;
  metrics: StreamingThinkScrubberMetrics;
  sessionStates: Record<string, StreamingScrubberState>;
}

export const DEFAULT_REASONING_TAG_NAMES: readonly string[] = [
  "think",
  "thinking",
  "reasoning",
  "thought",
  "REASONING_SCRATCHPAD",
];

export const DEFAULT_STREAMING_THINK_SCRUBBER_CONFIG: StreamingThinkScrubberConfig = {
  enabled: true,
  tagNames: DEFAULT_REASONING_TAG_NAMES,
  preserveProseMentions: true,
  discardUnterminatedOnFlush: true,
};
