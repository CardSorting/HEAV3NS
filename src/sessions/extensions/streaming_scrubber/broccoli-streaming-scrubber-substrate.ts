/**
 * broccoli-streaming-scrubber-substrate.ts
 *
 * In-memory Broccolidb repository for caching streaming think scrubber configuration,
 * active session delta states, and metrics (Phase 137 / ADR-113 / Target #70).
 */

import type {
  StreamingScrubberState,
  StreamingThinkScrubberConfig,
  StreamingThinkScrubberMetrics,
  StreamingThinkScrubberWorkspaceSnapshot,
} from "../../../core/contracts/streaming-think-scrubber.contracts.js";
import { DEFAULT_STREAMING_THINK_SCRUBBER_CONFIG } from "../../../core/contracts/streaming-think-scrubber.contracts.js";

export class BroccoliStreamingScrubberSubstrate {
  private config: StreamingThinkScrubberConfig = { ...DEFAULT_STREAMING_THINK_SCRUBBER_CONFIG };
  private metrics: StreamingThinkScrubberMetrics = {
    totalDeltasProcessed: 0,
    reasoningChunksSuppressed: 0,
    heldBackTailEmissions: 0,
    blocksEncountered: 0,
    flushesExecuted: 0,
  };
  private readonly sessionStates = new Map<string, StreamingScrubberState>();

  public setConfig(config: Partial<StreamingThinkScrubberConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): StreamingThinkScrubberConfig {
    return { ...this.config };
  }

  public getSessionState(sessionId: string): StreamingScrubberState {
    const existing = this.sessionStates.get(sessionId);
    if (existing) {
      return { ...existing };
    }
    const initial: StreamingScrubberState = {
      inBlock: false,
      heldBuffer: "",
      lastEmittedEndedNewline: true,
      turnIndex: 0,
    };
    this.sessionStates.set(sessionId, initial);
    return { ...initial };
  }

  public setSessionState(sessionId: string, state: StreamingScrubberState): void {
    this.sessionStates.set(sessionId, { ...state });
  }

  public resetSession(sessionId: string): void {
    this.sessionStates.set(sessionId, {
      inBlock: false,
      heldBuffer: "",
      lastEmittedEndedNewline: true,
      turnIndex: (this.sessionStates.get(sessionId)?.turnIndex || 0) + 1,
    });
  }

  public recordDelta(params: {
    suppressed?: boolean;
    blockEntered?: boolean;
    heldBackTail?: boolean;
  }): void {
    this.metrics.totalDeltasProcessed++;
    if (params.suppressed) {
      this.metrics.reasoningChunksSuppressed++;
    }
    if (params.blockEntered) {
      this.metrics.blocksEncountered++;
    }
    if (params.heldBackTail) {
      this.metrics.heldBackTailEmissions++;
    }
  }

  public recordFlush(): void {
    this.metrics.flushesExecuted++;
  }

  public getMetrics(): StreamingThinkScrubberMetrics {
    return { ...this.metrics };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): StreamingThinkScrubberWorkspaceSnapshot {
    const sessionStatesObj: Record<string, StreamingScrubberState> = {};
    for (const [key, val] of this.sessionStates.entries()) {
      sessionStatesObj[key] = { ...val };
    }

    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
      sessionStates: sessionStatesObj,
    };
  }

  public restoreSnapshot(snapshot: StreamingThinkScrubberWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.metrics = { ...snapshot.metrics };
    this.sessionStates.clear();
    for (const [key, val] of Object.entries(snapshot.sessionStates)) {
      this.sessionStates.set(key, { ...val });
    }
  }

  public clear(): void {
    this.config = { ...DEFAULT_STREAMING_THINK_SCRUBBER_CONFIG };
    this.metrics = {
      totalDeltasProcessed: 0,
      reasoningChunksSuppressed: 0,
      heldBackTailEmissions: 0,
      blocksEncountered: 0,
      flushesExecuted: 0,
    };
    this.sessionStates.clear();
  }
}
