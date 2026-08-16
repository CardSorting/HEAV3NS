/**
 * reasoning-supervisor.ts
 *
 * Master reasoning supervisor coordinating real-time stream scrubbing, reasoning effort tuning,
 * dynamic timeout floors, customizable tag parsing, and thinking budget governance (Phase 102 / ADR-056).
 */

import type {
  ReasoningBlock,
  ReasoningEffortLevel,
  ReasoningTagPair,
  ReasoningTimeoutConfig,
  ScrubbedStreamChunk,
} from "../../../core/contracts/reasoning.contracts.js";
import { DeterministicReasoningScrubber } from "../../../tooling/extensions/reasoning/deterministic-reasoning-scrubber.js";
import { BroccoliReasoningSubstrate } from "../../../sessions/extensions/reasoning/broccoli-reasoning-substrate.js";

export class ReasoningSupervisor {
  private scrubber: DeterministicReasoningScrubber;
  private substrate: BroccoliReasoningSubstrate;

  constructor(
    scrubber: DeterministicReasoningScrubber,
    substrate: BroccoliReasoningSubstrate
  ) {
    this.scrubber = scrubber;
    this.substrate = substrate;
  }

  /**
   * Processes a live streaming delta through the chunk-boundary scrubber.
   */
  scrubStreamDelta(delta: string): ScrubbedStreamChunk {
    const chunk = this.scrubber.feed(delta);
    if (chunk.completedBlocks.length > 0) {
      for (let i = 0; i < chunk.completedBlocks.length; i++) {
        this.substrate.addBlock(chunk.completedBlocks[i]);
      }
    }
    const visibleTokens = Math.ceil(chunk.visibleDelta.length / 4);
    const reasoningTokens = Math.ceil(chunk.reasoningDelta.length / 4);
    this.substrate.recordTokens(reasoningTokens, visibleTokens);
    return chunk;
  }

  /**
   * Flushes stream tail at end-of-stream.
   */
  flushStream(): ScrubbedStreamChunk {
    const chunk = this.scrubber.flush();
    if (chunk.completedBlocks.length > 0) {
      for (let i = 0; i < chunk.completedBlocks.length; i++) {
        this.substrate.addBlock(chunk.completedBlocks[i]);
      }
    }
    const visibleTokens = Math.ceil(chunk.visibleDelta.length / 4);
    const reasoningTokens = Math.ceil(chunk.reasoningDelta.length / 4);
    this.substrate.recordTokens(reasoningTokens, visibleTokens);
    return chunk;
  }

  /**
   * Resets the streaming scrubber for a new turn.
   */
  resetStream(): void {
    this.scrubber.reset();
  }

  /**
   * Scrubs a complete static message text.
   */
  scrubCompleteText(fullText: string): { visibleText: string; reasoningBlocks: readonly ReasoningBlock[] } {
    const res = this.scrubber.scrubCompleteText(fullText);
    for (let i = 0; i < res.reasoningBlocks.length; i++) {
      this.substrate.addBlock(res.reasoningBlocks[i]);
    }
    return res;
  }

  // ---------------------------------------------------------------------------
  // Dynamic Tag Configuration
  // ---------------------------------------------------------------------------

  registerTagPair(pair: ReasoningTagPair): void {
    this.scrubber.registerTagPair(pair);
    this.substrate.setTagPairs(this.scrubber.getTagPairs());
  }

  removeTagPair(openTag: string): boolean {
    const removed = this.scrubber.removeTagPair(openTag);
    if (removed) {
      this.substrate.setTagPairs(this.scrubber.getTagPairs());
    }
    return removed;
  }

  setTagPairs(pairs: readonly ReasoningTagPair[]): void {
    this.scrubber.setTagPairs(pairs);
    this.substrate.setTagPairs(pairs);
  }

  getTagPairs(): readonly ReasoningTagPair[] {
    return this.scrubber.getTagPairs();
  }

  // ---------------------------------------------------------------------------
  // Dynamic Timeout Floors
  // ---------------------------------------------------------------------------

  registerTimeoutConfig(config: ReasoningTimeoutConfig): void {
    this.scrubber.registerTimeoutConfig(config);
  }

  setTimeoutFloor(modelSlug: string, floorSeconds: number): void {
    this.scrubber.setTimeoutFloor(modelSlug, floorSeconds);
    this.substrate.setTimeoutFloor(modelSlug, floorSeconds);
  }

  removeTimeoutFloor(modelSlug: string): boolean {
    const removed = this.scrubber.removeTimeoutFloor(modelSlug);
    if (removed) {
      this.substrate.removeTimeoutFloor(modelSlug);
    }
    return removed;
  }

  setDefaultTimeoutFloor(seconds: number): void {
    this.scrubber.setDefaultTimeoutFloor(seconds);
    this.substrate.setDefaultTimeoutFloor(seconds);
  }

  getDefaultTimeoutFloor(): number {
    return this.scrubber.getDefaultTimeoutFloor();
  }

  getTimeoutFloor(modelSlug: string): number {
    const customFloors = this.substrate.getTimeoutFloors();
    return this.scrubber.getReasoningTimeoutFloor(modelSlug, customFloors);
  }

  getAllTimeoutFloors(): Record<string, number> {
    return this.scrubber.getAllTimeoutFloors();
  }

  // ---------------------------------------------------------------------------
  // Dynamic Effort Levels & Thinking Budgets
  // ---------------------------------------------------------------------------

  setEffortLevel(level: ReasoningEffortLevel): void {
    this.substrate.setEffortLevel(level);
  }

  getEffortLevel(): ReasoningEffortLevel {
    return this.substrate.getEffortLevel();
  }

  setEffortBudget(effort: ReasoningEffortLevel, tokenLimit: number): void {
    this.scrubber.setEffortBudget(effort, tokenLimit);
    this.substrate.setEffortBudget(effort, tokenLimit);
  }

  setBudgetMapping(mapping: Partial<Record<ReasoningEffortLevel, number>>): void {
    this.scrubber.setBudgetMapping(mapping);
    for (const [level, tokens] of Object.entries(mapping)) {
      if (tokens !== undefined) {
        this.substrate.setEffortBudget(level as ReasoningEffortLevel, tokens);
      }
    }
  }

  getBudgetMapping(): Record<ReasoningEffortLevel, number> {
    return this.scrubber.getBudgetMapping();
  }

  getThinkingBudgetTokens(): number {
    return this.scrubber.getReasoningEffortTokenLimit(this.substrate.getEffortLevel());
  }

  // ---------------------------------------------------------------------------
  // Metrics & Inspection
  // ---------------------------------------------------------------------------

  getRecordedReasoningBlocks(): readonly ReasoningBlock[] {
    return this.substrate.getBlocks();
  }

  getReasoningMetrics(): { totalReasoningTokens: number; totalVisibleTokens: number } {
    return this.substrate.getMetrics();
  }

  clearReasoningState(): void {
    this.scrubber.reset();
    this.substrate.clearBlocks();
  }
}
