import type {
  CompressionPolicy,
  IHeadTailBudgetGovernor,
  TokenWindowBudget,
} from "../../../core/contracts/compression.contracts.js";

/**
 * Head-Tail Mathematical Budget Governor.
 *
 * Implements mathematical context window partitioning to protect foundational
 * system prompt anchors (head) and immediate conversational focus (tail),
 * while targeting older middle turns for deterministic compaction.
 */
export class HeadTailBudgetGovernor implements IHeadTailBudgetGovernor {
  private readonly defaultMaxLimit: number;
  private readonly policy: CompressionPolicy;

  constructor(defaultMaxLimit = 128000, policy: CompressionPolicy = "balanced") {
    this.defaultMaxLimit = defaultMaxLimit;
    this.policy = policy;
  }

  calculateBudget(totalTokens: number, maxLimit?: number): TokenWindowBudget {
    const limit = maxLimit ?? this.defaultMaxLimit;
    
    // Threshold multipliers based on policy
    let thresholdRatio = 0.80; // balanced
    let headRatio = 0.15;
    let tailRatio = 0.25;
    let summaryRatio = 0.05;

    if (this.policy === "aggressive") {
      thresholdRatio = 0.65;
      headRatio = 0.10;
      tailRatio = 0.20;
      summaryRatio = 0.04;
    } else if (this.policy === "conservative") {
      thresholdRatio = 0.90;
      headRatio = 0.20;
      tailRatio = 0.30;
      summaryRatio = 0.08;
    }

    const compressionThreshold = Math.floor(limit * thresholdRatio);
    const headReservedTokens = Math.floor(limit * headRatio);
    const tailReservedTokens = Math.floor(limit * tailRatio);
    const summaryBudgetTokens = Math.floor(limit * summaryRatio);

    return {
      totalTokens,
      maxContextLimit: limit,
      compressionThreshold,
      headReservedTokens,
      tailReservedTokens,
      summaryBudgetTokens,
    };
  }

  shouldCompress(currentTokens: number, budget: TokenWindowBudget): boolean {
    return currentTokens >= budget.compressionThreshold;
  }

  partitionTurns<T>(
    turns: readonly T[],
    headCount = 2,
    tailCount = 4
  ): { head: readonly T[]; middle: readonly T[]; tail: readonly T[] } {
    if (turns.length <= headCount + tailCount) {
      return {
        head: turns,
        middle: [],
        tail: [],
      };
    }

    const head = turns.slice(0, headCount);
    const tail = turns.slice(turns.length - tailCount);
    const middle = turns.slice(headCount, turns.length - tailCount);

    return { head, middle, tail };
  }
}
