/**
 * [LAYER: AGENTS EXTENSION]
 * Pass 157: Zero-Dependency Broccoli Query Loop Orchestrator
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/QueryLoop.ts).
 * Orchestrates the autonomous execution of an agentic turn, tracking turn counts, tool execution rounds,
 * token consumption, and context window compaction barrier checks. Zero external npm dependencies.
 */

export interface QueryLoopState {
  turnCount: number;
  toolRounds: number;
  tokensUsed: number;
  status: "active" | "completed" | "failed" | "compacting";
  lastCompactedTurn?: number;
}

export class BroccoliQueryLoopOrchestrator {
  private state: QueryLoopState;
  private readonly contextWindowLimit: number;
  private readonly compactThresholdPercent: number;

  constructor(contextWindowLimit = 200_000, compactThresholdPercent = 0.8) {
    this.contextWindowLimit = contextWindowLimit;
    this.compactThresholdPercent = compactThresholdPercent;
    this.state = {
      turnCount: 0,
      toolRounds: 0,
      tokensUsed: 0,
      status: "active",
    };
  }

  /**
   * Advances the loop state by one turn tick.
   */
  public advanceTurn(tokenDelta = 1000): QueryLoopState {
    this.state.turnCount++;
    this.state.tokensUsed += tokenDelta;

    const threshold = this.contextWindowLimit * this.compactThresholdPercent;
    if (this.state.tokensUsed >= threshold) {
      this.state.status = "compacting";
      this.state.lastCompactedTurn = this.state.turnCount;
    } else {
      this.state.status = "active";
    }

    return { ...this.state };
  }

  /**
   * Records a completed tool execution round.
   */
  public recordToolRound(roundCount = 1): void {
    this.state.toolRounds += roundCount;
  }

  /**
   * Resets token usage post-compaction barrier resolution.
   */
  public resetAfterCompaction(compactedTokenCount: number): void {
    this.state.tokensUsed = compactedTokenCount;
    this.state.status = "active";
  }

  /**
   * Returns current query loop state metrics.
   */
  public getState(): QueryLoopState {
    return { ...this.state };
  }
}
