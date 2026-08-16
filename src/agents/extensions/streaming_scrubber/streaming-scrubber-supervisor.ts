/**
 * streaming-scrubber-supervisor.ts
 *
 * Master supervisor coordinating multi-session streaming delta filtration,
 * per-turn resets, stream completion flushes, and metrics aggregation (Phase 137 / ADR-113 / Target #70).
 */

import type { BroccoliStreamingScrubberSubstrate } from "../../../sessions/extensions/streaming_scrubber/broccoli-streaming-scrubber-substrate.js";
import type { DeterministicStreamingScrubberEngine } from "./deterministic-streaming-scrubber-engine.js";
import type {
  StreamingScrubberState,
  StreamingThinkScrubberConfig,
  StreamingThinkScrubberMetrics,
} from "../../../core/contracts/streaming-think-scrubber.contracts.js";

export class StreamingScrubberSupervisor {
  private readonly substrate: BroccoliStreamingScrubberSubstrate;
  private readonly engine: DeterministicStreamingScrubberEngine;

  constructor(
    substrate: BroccoliStreamingScrubberSubstrate,
    engine: DeterministicStreamingScrubberEngine
  ) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public configure(config: Partial<StreamingThinkScrubberConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): StreamingThinkScrubberConfig {
    return this.substrate.getConfig();
  }

  public getMetrics(): StreamingThinkScrubberMetrics {
    return this.substrate.getMetrics();
  }

  public resetSession(sessionId: string): void {
    this.substrate.resetSession(sessionId);
  }

  public getSessionState(sessionId: string): StreamingScrubberState {
    return this.substrate.getSessionState(sessionId);
  }

  /**
   * Feeds a delta chunk for a session and returns visible sanitized text.
   */
  public feedDelta(sessionId: string, delta: string): string {
    const config = this.substrate.getConfig();
    const state = this.substrate.getSessionState(sessionId);

    const result = this.engine.feed(delta, state, config);
    this.substrate.setSessionState(sessionId, result.nextState);
    this.substrate.recordDelta({
      suppressed: result.suppressed,
      blockEntered: result.blockEntered,
      heldBackTail: result.heldBackTail,
    });

    return result.visibleText;
  }

  /**
   * Flushes held-back buffer at stream completion.
   */
  public flushStream(sessionId: string): string {
    const config = this.substrate.getConfig();
    const state = this.substrate.getSessionState(sessionId);

    const result = this.engine.flush(state, config);
    this.substrate.setSessionState(sessionId, result.nextState);
    this.substrate.recordFlush();

    return result.tailText;
  }

  /**
   * Simulates full stream feeding and flushing for a sequence of delta chunks.
   */
  public simulateStream(
    deltas: readonly string[],
    configOverride?: Partial<StreamingThinkScrubberConfig>
  ): {
    emissions: string[];
    accumulatedText: string;
    totalSuppressedDeltas: number;
  } {
    const config: StreamingThinkScrubberConfig = {
      ...this.substrate.getConfig(),
      ...configOverride,
    };

    let state: StreamingScrubberState = {
      inBlock: false,
      heldBuffer: "",
      lastEmittedEndedNewline: true,
      turnIndex: 0,
    };

    const emissions: string[] = [];
    let totalSuppressedDeltas = 0;

    for (const delta of deltas) {
      const res = this.engine.feed(delta, state, config);
      state = res.nextState;
      if (res.suppressed) {
        totalSuppressedDeltas++;
      }
      if (res.visibleText) {
        emissions.push(res.visibleText);
      }
    }

    const flushRes = this.engine.flush(state, config);
    if (flushRes.tailText) {
      emissions.push(flushRes.tailText);
    }

    return {
      emissions,
      accumulatedText: emissions.join(""),
      totalSuppressedDeltas,
    };
  }
}
