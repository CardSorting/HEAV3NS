/**
 * broccoli-reasoning-substrate.ts
 *
 * In-memory Broccolidb repository for streaming reasoning blocks, thinking summaries,
 * custom tag pairs, dynamic timeout floors, budget mappings, and token metrics (Phase 102 / ADR-056).
 */

import type {
  ReasoningBlock,
  ReasoningEffortLevel,
  ReasoningTagPair,
  ReasoningWorkspaceSnapshot,
} from "../../../core/contracts/reasoning.contracts.js";
import { DEFAULT_REASONING_TAG_PAIRS, DEFAULT_BUDGET_MAPPING } from "../../../tooling/extensions/reasoning/deterministic-reasoning-scrubber.js";

export class BroccoliReasoningSubstrate {
  private blocks: ReasoningBlock[];
  private effortLevel: ReasoningEffortLevel;
  private customTimeoutFloors: Map<string, number>;
  private customBudgetMapping: Map<ReasoningEffortLevel, number>;
  private registeredTagPairs: ReasoningTagPair[];
  private defaultTimeoutFloorSeconds: number;
  private totalReasoningTokens: number;
  private totalVisibleTokens: number;

  constructor() {
    this.blocks = [];
    this.effortLevel = "medium";
    this.customTimeoutFloors = new Map<string, number>();
    this.customBudgetMapping = new Map<ReasoningEffortLevel, number>();
    for (const [level, tokens] of Object.entries(DEFAULT_BUDGET_MAPPING)) {
      this.customBudgetMapping.set(level as ReasoningEffortLevel, tokens);
    }
    this.registeredTagPairs = [...DEFAULT_REASONING_TAG_PAIRS];
    this.defaultTimeoutFloorSeconds = 90;
    this.totalReasoningTokens = 0;
    this.totalVisibleTokens = 0;
  }

  addBlock(block: ReasoningBlock): void {
    this.blocks.push(block);
    this.totalReasoningTokens += block.estimatedTokens;
  }

  getBlocks(): readonly ReasoningBlock[] {
    return this.blocks;
  }

  clearBlocks(): void {
    this.blocks = [];
  }

  setEffortLevel(level: ReasoningEffortLevel): void {
    this.effortLevel = level;
  }

  getEffortLevel(): ReasoningEffortLevel {
    return this.effortLevel;
  }

  setTimeoutFloor(modelSlug: string, floorSeconds: number): void {
    this.customTimeoutFloors.set(modelSlug.toLowerCase(), floorSeconds);
  }

  removeTimeoutFloor(modelSlug: string): boolean {
    return this.customTimeoutFloors.delete(modelSlug.toLowerCase());
  }

  getTimeoutFloor(modelSlug: string): number | undefined {
    return this.customTimeoutFloors.get(modelSlug.toLowerCase());
  }

  getTimeoutFloors(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, value] of this.customTimeoutFloors.entries()) {
      out[key] = value;
    }
    return out;
  }

  setDefaultTimeoutFloor(seconds: number): void {
    this.defaultTimeoutFloorSeconds = seconds;
  }

  getDefaultTimeoutFloor(): number {
    return this.defaultTimeoutFloorSeconds;
  }

  setEffortBudget(effort: ReasoningEffortLevel, tokenLimit: number): void {
    this.customBudgetMapping.set(effort, tokenLimit);
  }

  getBudgetMapping(): Record<ReasoningEffortLevel, number> {
    const out: Record<string, number> = {};
    for (const [level, tokens] of this.customBudgetMapping.entries()) {
      out[level] = tokens;
    }
    return out as Record<ReasoningEffortLevel, number>;
  }

  setTagPairs(pairs: readonly ReasoningTagPair[]): void {
    this.registeredTagPairs = [...pairs];
  }

  getTagPairs(): readonly ReasoningTagPair[] {
    return [...this.registeredTagPairs];
  }

  recordTokens(reasoningTokens: number, visibleTokens: number): void {
    this.totalReasoningTokens += reasoningTokens;
    this.totalVisibleTokens += visibleTokens;
  }

  getMetrics(): { totalReasoningTokens: number; totalVisibleTokens: number } {
    return {
      totalReasoningTokens: this.totalReasoningTokens,
      totalVisibleTokens: this.totalVisibleTokens,
    };
  }

  toSnapshot(): ReasoningWorkspaceSnapshot {
    return {
      activeBlocks: [],
      completedBlocks: [...this.blocks],
      currentEffortLevel: this.effortLevel,
      totalReasoningTokensConsumed: this.totalReasoningTokens,
      totalVisibleTokensEmitted: this.totalVisibleTokens,
      customTimeoutFloors: this.getTimeoutFloors(),
      customBudgetMapping: this.getBudgetMapping(),
      registeredTagPairs: this.getTagPairs(),
      defaultTimeoutFloorSeconds: this.defaultTimeoutFloorSeconds,
    };
  }

  restoreSnapshot(snapshot: ReasoningWorkspaceSnapshot): void {
    this.blocks = [...snapshot.completedBlocks];
    this.effortLevel = snapshot.currentEffortLevel;
    this.totalReasoningTokens = snapshot.totalReasoningTokensConsumed;
    this.totalVisibleTokens = snapshot.totalVisibleTokensEmitted;
    this.defaultTimeoutFloorSeconds = snapshot.defaultTimeoutFloorSeconds ?? 90;

    this.customTimeoutFloors.clear();
    if (snapshot.customTimeoutFloors) {
      for (const [key, val] of Object.entries(snapshot.customTimeoutFloors)) {
        this.customTimeoutFloors.set(key, val);
      }
    }

    this.customBudgetMapping.clear();
    if (snapshot.customBudgetMapping) {
      for (const [key, val] of Object.entries(snapshot.customBudgetMapping)) {
        this.customBudgetMapping.set(key as ReasoningEffortLevel, val);
      }
    }

    if (snapshot.registeredTagPairs) {
      this.registeredTagPairs = [...snapshot.registeredTagPairs];
    }
  }
}
