/**
 * deterministic-reasoning-scrubber.ts
 *
 * Deterministic streaming reasoning scrubber with dynamic chunk-boundary tag lookahead,
 * zero-GC state machines, dynamic user-driven timeout floors, and customizable thinking budgets (Phase 102 / ADR-056).
 */

import { performance } from "node:perf_hooks";
import type {
  ReasoningBlock,
  ReasoningEffortLevel,
  ReasoningScrubberOptions,
  ReasoningTagPair,
  ReasoningTimeoutConfig,
  ScrubbedStreamChunk,
} from "../../../core/contracts/reasoning.contracts.js";

export const DEFAULT_REASONING_TAG_PAIRS: readonly ReasoningTagPair[] = [
  { openTag: "<think>", closeTag: "</think>" },
  { openTag: "<thinking>", closeTag: "</thinking>" },
  { openTag: "<reasoning>", closeTag: "</reasoning>" },
  { openTag: "<thought>", closeTag: "</thought>" },
  { openTag: "<REASONING_SCRATCHPAD>", closeTag: "</REASONING_SCRATCHPAD>" },
];

export const KNOWN_REASONING_TIMEOUT_FLOORS: readonly ReasoningTimeoutConfig[] = [
  { modelSlug: "o1", floorSeconds: 300, recommendedEffort: "high", maxThinkingTokens: 32768 },
  { modelSlug: "o3", floorSeconds: 300, recommendedEffort: "high", maxThinkingTokens: 65536 },
  { modelSlug: "deepseek-r1", floorSeconds: 240, recommendedEffort: "max", maxThinkingTokens: 65536 },
  { modelSlug: "claude-3-7-sonnet", floorSeconds: 240, recommendedEffort: "high", maxThinkingTokens: 64000 },
  { modelSlug: "qwq", floorSeconds: 180, recommendedEffort: "medium", maxThinkingTokens: 32768 },
  { modelSlug: "qwen-2.5-coder", floorSeconds: 120, recommendedEffort: "low", maxThinkingTokens: 16384 },
  { modelSlug: "nemotron", floorSeconds: 180, recommendedEffort: "medium", maxThinkingTokens: 32768 },
  { modelSlug: "gemini-2.0-flash-thinking", floorSeconds: 180, recommendedEffort: "medium", maxThinkingTokens: 32768 },
];

export const DEFAULT_BUDGET_MAPPING: Record<ReasoningEffortLevel, number> = {
  none: 0,
  low: 4096,
  medium: 16384,
  high: 32768,
  max: 65536,
};

export class DeterministicReasoningScrubber {
  private tagPairs: ReasoningTagPair[];
  private maxOpenTagLength: number;
  private maxCloseTagLength: number;

  private customTimeoutFloors: Map<string, number>;
  private timeoutConfigs: Map<string, ReasoningTimeoutConfig>;
  private defaultTimeoutFloorSeconds: number;

  private budgetMapping: Map<ReasoningEffortLevel, number>;

  private inReasoningBlock: boolean;
  private activeOpenTag: string | null;
  private activeCloseTag: string | null;
  private pendingBuffer: string;
  private currentBlockContent: string;
  private currentBlockStartTime: number;
  private blockCounter: number;
  private completedBlocks: ReasoningBlock[];

  constructor(options: ReasoningScrubberOptions = {}) {
    this.tagPairs = options.customTagPairs ? [...options.customTagPairs] : [...DEFAULT_REASONING_TAG_PAIRS];
    this.maxOpenTagLength = 0;
    this.maxCloseTagLength = 0;
    this.recalculateTagLengths();

    this.customTimeoutFloors = new Map<string, number>();
    if (options.customTimeoutFloors) {
      for (const [slug, floor] of Object.entries(options.customTimeoutFloors)) {
        this.customTimeoutFloors.set(slug.toLowerCase(), floor);
      }
    }

    this.timeoutConfigs = new Map<string, ReasoningTimeoutConfig>();
    for (let i = 0; i < KNOWN_REASONING_TIMEOUT_FLOORS.length; i++) {
      const cfg = KNOWN_REASONING_TIMEOUT_FLOORS[i];
      this.timeoutConfigs.set(cfg.modelSlug.toLowerCase(), cfg);
    }
    if (options.customTimeoutConfigs) {
      for (let i = 0; i < options.customTimeoutConfigs.length; i++) {
        const cfg = options.customTimeoutConfigs[i];
        this.timeoutConfigs.set(cfg.modelSlug.toLowerCase(), cfg);
      }
    }

    this.defaultTimeoutFloorSeconds = options.defaultTimeoutFloorSeconds ?? 90;

    this.budgetMapping = new Map<ReasoningEffortLevel, number>();
    for (const [level, tokens] of Object.entries(DEFAULT_BUDGET_MAPPING)) {
      this.budgetMapping.set(level as ReasoningEffortLevel, tokens);
    }
    if (options.customBudgetMapping) {
      for (const [level, tokens] of Object.entries(options.customBudgetMapping)) {
        if (tokens !== undefined) {
          this.budgetMapping.set(level as ReasoningEffortLevel, tokens);
        }
      }
    }

    this.inReasoningBlock = false;
    this.activeOpenTag = null;
    this.activeCloseTag = null;
    this.pendingBuffer = "";
    this.currentBlockContent = "";
    this.currentBlockStartTime = 0;
    this.blockCounter = 0;
    this.completedBlocks = [];
  }

  private recalculateTagLengths(): void {
    let maxOpen = 0;
    let maxClose = 0;
    for (let i = 0; i < this.tagPairs.length; i++) {
      if (this.tagPairs[i].openTag.length > maxOpen) maxOpen = this.tagPairs[i].openTag.length;
      if (this.tagPairs[i].closeTag.length > maxClose) maxClose = this.tagPairs[i].closeTag.length;
    }
    this.maxOpenTagLength = maxOpen;
    this.maxCloseTagLength = maxClose;
  }

  // ---------------------------------------------------------------------------
  // Dynamic Tag Configuration
  // ---------------------------------------------------------------------------

  registerTagPair(pair: ReasoningTagPair): void {
    // Replace if exists, or append
    const existingIdx = this.tagPairs.findIndex(
      (p) => p.openTag.toLowerCase() === pair.openTag.toLowerCase()
    );
    if (existingIdx >= 0) {
      this.tagPairs[existingIdx] = pair;
    } else {
      this.tagPairs.push(pair);
    }
    this.recalculateTagLengths();
  }

  removeTagPair(openTag: string): boolean {
    const idx = this.tagPairs.findIndex(
      (p) => p.openTag.toLowerCase() === openTag.toLowerCase()
    );
    if (idx >= 0) {
      this.tagPairs.splice(idx, 1);
      this.recalculateTagLengths();
      return true;
    }
    return false;
  }

  setTagPairs(pairs: readonly ReasoningTagPair[]): void {
    this.tagPairs = [...pairs];
    this.recalculateTagLengths();
  }

  getTagPairs(): readonly ReasoningTagPair[] {
    return [...this.tagPairs];
  }

  resetTagPairsToDefaults(): void {
    this.tagPairs = [...DEFAULT_REASONING_TAG_PAIRS];
    this.recalculateTagLengths();
  }

  // ---------------------------------------------------------------------------
  // Dynamic Timeout Floors
  // ---------------------------------------------------------------------------

  registerTimeoutConfig(config: ReasoningTimeoutConfig): void {
    this.timeoutConfigs.set(config.modelSlug.toLowerCase(), config);
  }

  setTimeoutFloor(modelSlug: string, floorSeconds: number): void {
    this.customTimeoutFloors.set(modelSlug.toLowerCase(), floorSeconds);
  }

  removeTimeoutFloor(modelSlug: string): boolean {
    return this.customTimeoutFloors.delete(modelSlug.toLowerCase());
  }

  setDefaultTimeoutFloor(seconds: number): void {
    this.defaultTimeoutFloorSeconds = seconds;
  }

  getDefaultTimeoutFloor(): number {
    return this.defaultTimeoutFloorSeconds;
  }

  getAllTimeoutFloors(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [slug, floor] of this.customTimeoutFloors.entries()) {
      out[slug] = floor;
    }
    return out;
  }

  getReasoningTimeoutFloor(modelSlug: string, perRequestFloors: Record<string, number> = {}): number {
    const slugLower = modelSlug.toLowerCase();

    // 1. Per-request override
    if (perRequestFloors[slugLower] !== undefined) {
      return perRequestFloors[slugLower];
    }

    // 2. User-configured custom floor
    if (this.customTimeoutFloors.has(slugLower)) {
      return this.customTimeoutFloors.get(slugLower)!;
    }

    // 3. Exact or substring match in timeoutConfigs
    for (const [key, cfg] of this.timeoutConfigs.entries()) {
      if (slugLower.includes(key)) {
        return cfg.floorSeconds;
      }
    }

    // 4. Default fallback floor
    return this.defaultTimeoutFloorSeconds;
  }

  // ---------------------------------------------------------------------------
  // Dynamic Adaptive Thinking Token Budgets
  // ---------------------------------------------------------------------------

  setEffortBudget(effort: ReasoningEffortLevel, tokenLimit: number): void {
    this.budgetMapping.set(effort, tokenLimit);
  }

  setBudgetMapping(mapping: Partial<Record<ReasoningEffortLevel, number>>): void {
    for (const [level, tokens] of Object.entries(mapping)) {
      if (tokens !== undefined) {
        this.budgetMapping.set(level as ReasoningEffortLevel, tokens);
      }
    }
  }

  getBudgetMapping(): Record<ReasoningEffortLevel, number> {
    const out: Record<string, number> = {};
    for (const [level, tokens] of this.budgetMapping.entries()) {
      out[level] = tokens;
    }
    return out as Record<ReasoningEffortLevel, number>;
  }

  getReasoningEffortTokenLimit(effort: ReasoningEffortLevel): number {
    return this.budgetMapping.get(effort) ?? (DEFAULT_BUDGET_MAPPING[effort] ?? 16384);
  }

  // ---------------------------------------------------------------------------
  // Streaming Scrubbing Logic
  // ---------------------------------------------------------------------------

  /**
   * Resets the streaming state machine for a new turn.
   */
  reset(): void {
    this.inReasoningBlock = false;
    this.activeOpenTag = null;
    this.activeCloseTag = null;
    this.pendingBuffer = "";
    this.currentBlockContent = "";
    this.currentBlockStartTime = 0;
    this.completedBlocks = [];
  }

  /**
   * Feeds an incoming streaming text delta through the chunk-boundary tag scrubber.
   */
  feed(delta: string): ScrubbedStreamChunk {
    if (!delta) {
      return {
        visibleDelta: "",
        reasoningDelta: "",
        inReasoningBlock: this.inReasoningBlock,
        tagPending: this.pendingBuffer.length > 0,
        completedBlocks: [],
      };
    }

    const working = this.pendingBuffer + delta;
    this.pendingBuffer = "";

    let visibleDelta = "";
    let reasoningDelta = "";
    const newlyCompleted: ReasoningBlock[] = [];
    let idx = 0;

    while (idx < working.length) {
      if (!this.inReasoningBlock) {
        // Look for open tag match
        let foundOpen: ReasoningTagPair | null = null;
        for (let t = 0; t < this.tagPairs.length; t++) {
          const pair = this.tagPairs[t];
          const remaining = working.slice(idx);
          if (remaining.toLowerCase().startsWith(pair.openTag.toLowerCase())) {
            foundOpen = pair;
            break;
          }
        }

        if (foundOpen) {
          this.inReasoningBlock = true;
          this.activeOpenTag = foundOpen.openTag;
          this.activeCloseTag = foundOpen.closeTag;
          this.currentBlockContent = "";
          this.currentBlockStartTime = performance.now();
          idx += foundOpen.openTag.length;
          continue;
        }

        // Check if the tail could be a prefix of an open tag (only if it starts with the first character of any open tag)
        let matchesOpenPrefix = false;
        for (let t = 0; t < this.tagPairs.length; t++) {
          if (working[idx] === this.tagPairs[t].openTag[0]) {
            matchesOpenPrefix = true;
            break;
          }
        }

        if (matchesOpenPrefix) {
          const remainingLen = working.length - idx;
          if (remainingLen < this.maxOpenTagLength) {
            const tail = working.slice(idx);
            let couldBePrefix = false;
            for (let t = 0; t < this.tagPairs.length; t++) {
              if (this.tagPairs[t].openTag.toLowerCase().startsWith(tail.toLowerCase())) {
                couldBePrefix = true;
                break;
              }
            }
            if (couldBePrefix) {
              this.pendingBuffer = tail;
              break;
            }
          }
        }

        visibleDelta += working[idx];
        idx++;
      } else {
        // Inside reasoning block: look for matching close tag
        const targetClose = this.activeCloseTag || "</think>";
        const remaining = working.slice(idx);
        if (remaining.toLowerCase().startsWith(targetClose.toLowerCase())) {
          // Close tag matched
          const duration = performance.now() - this.currentBlockStartTime;
          this.blockCounter++;
          const block: ReasoningBlock = {
            id: `reasoning-block-${this.blockCounter}`,
            tag: this.activeOpenTag || "<think>",
            content: this.currentBlockContent,
            startIndex: idx,
            endIndex: idx + targetClose.length,
            completed: true,
            durationMs: duration,
            estimatedTokens: Math.ceil(this.currentBlockContent.length / 4),
          };
          this.completedBlocks.push(block);
          newlyCompleted.push(block);

          this.inReasoningBlock = false;
          this.activeOpenTag = null;
          this.activeCloseTag = null;
          this.currentBlockContent = "";
          idx += targetClose.length;
          continue;
        }

        // Check if the tail could be a prefix of the close tag
        if (working[idx] === targetClose[0]) {
          const remainingLen = working.length - idx;
          if (remainingLen < targetClose.length) {
            const tail = working.slice(idx);
            if (targetClose.toLowerCase().startsWith(tail.toLowerCase())) {
              this.pendingBuffer = tail;
              break;
            }
          }
        }

        this.currentBlockContent += working[idx];
        reasoningDelta += working[idx];
        idx++;
      }
    }

    return {
      visibleDelta,
      reasoningDelta,
      inReasoningBlock: this.inReasoningBlock,
      tagPending: this.pendingBuffer.length > 0,
      completedBlocks: newlyCompleted,
    };
  }

  /**
   * Flushes any remaining pending buffer at the end of the stream.
   */
  flush(): ScrubbedStreamChunk {
    if (!this.pendingBuffer) {
      return {
        visibleDelta: "",
        reasoningDelta: "",
        inReasoningBlock: this.inReasoningBlock,
        tagPending: false,
        completedBlocks: [],
      };
    }

    const remaining = this.pendingBuffer;
    this.pendingBuffer = "";

    if (this.inReasoningBlock) {
      this.currentBlockContent += remaining;
      const duration = performance.now() - this.currentBlockStartTime;
      this.blockCounter++;
      const block: ReasoningBlock = {
        id: `reasoning-block-${this.blockCounter}`,
        tag: this.activeOpenTag || "<think>",
        content: this.currentBlockContent,
        startIndex: 0,
        endIndex: this.currentBlockContent.length,
        completed: false,
        durationMs: duration,
        estimatedTokens: Math.ceil(this.currentBlockContent.length / 4),
      };
      this.completedBlocks.push(block);
      return {
        visibleDelta: "",
        reasoningDelta: remaining,
        inReasoningBlock: false,
        tagPending: false,
        completedBlocks: [block],
      };
    }

    // Pending buffer turned out not to be an open tag; flush as visible prose
    return {
      visibleDelta: remaining,
      reasoningDelta: "",
      inReasoningBlock: false,
      tagPending: false,
      completedBlocks: [],
    };
  }

  /**
   * Helper to scrub a complete static text string in one pass.
   */
  scrubCompleteText(fullText: string): { visibleText: string; reasoningBlocks: readonly ReasoningBlock[] } {
    this.reset();
    const chunk = this.feed(fullText);
    const tail = this.flush();
    return {
      visibleText: chunk.visibleDelta + tail.visibleDelta,
      reasoningBlocks: [...this.completedBlocks],
    };
  }

  getCompletedBlocks(): readonly ReasoningBlock[] {
    return this.completedBlocks;
  }
}
