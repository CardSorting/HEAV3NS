/**
 * streaming-scrubber-supervisor.ts
 *
 * Master supervisor coordinating multi-session streaming delta filtration,
 * per-turn resets, stream completion flushes, health matrix audits, and metrics aggregation (Phase 137 / ADR-113 / Target #77).
 */

import type { BroccoliStreamingScrubberSubstrate } from "../../../sessions/extensions/streaming_scrubber/broccoli-streaming-scrubber-substrate.js";
import type { DeterministicStreamingScrubberEngine } from "./deterministic-streaming-scrubber-engine.js";
import type {
  StreamingScrubberDslQueryFilter,
  StreamingScrubberGroupBy,
  StreamingScrubberHealthAuditReport,
  StreamingScrubberMetricsReport,
  StreamingScrubberSortBy,
  StreamingScrubberSortDirection,
  StreamingScrubberState,
  StreamingScrubResult,
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

  public getSubstrate(): BroccoliStreamingScrubberSubstrate {
    return this.substrate;
  }

  public getEngine(): DeterministicStreamingScrubberEngine {
    return this.engine;
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

  public getMetricsReport(): StreamingScrubberMetricsReport {
    return this.substrate.getMetricsReport();
  }

  public auditHealth(): StreamingScrubberHealthAuditReport {
    return this.substrate.auditHealth();
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
   * Feeds delta and records rich telemetric clean event.
   */
  public feedDeltaWithMetrics(sessionId: string, delta: string): StreamingScrubResult {
    const startedAt = performance.now();
    const config = this.substrate.getConfig();
    const state = this.substrate.getSessionState(sessionId);

    const result = this.engine.feed(delta, state, config);
    this.substrate.setSessionState(sessionId, result.nextState);
    this.substrate.recordDelta({
      suppressed: result.suppressed,
      blockEntered: result.blockEntered,
      heldBackTail: result.heldBackTail,
    });

    const durationMs = Number((performance.now() - startedAt).toFixed(4));
    const emittedSize = result.visibleText.length;
    const deltaSize = delta.length;
    const suppressedSize = deltaSize > emittedSize ? deltaSize - emittedSize : 0;

    const id = `scrub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.substrate.recordEvent({
      id,
      sessionId,
      turnIndex: result.nextState.turnIndex,
      deltaSize,
      emittedSize,
      suppressedSize,
      inBlock: result.nextState.inBlock,
      durationMs,
      timestamp: Date.now(),
    });

    return {
      emittedText: result.visibleText,
      heldBackText: result.nextState.heldBuffer,
      suppressedText: suppressedSize > 0 ? "[SUPPRESSED_REASONING]" : "",
      inReasoningBlock: result.nextState.inBlock,
      deltaSize,
      emittedSize,
      durationMs,
    };
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

  public getGroupedEvents(groupBy?: StreamingScrubberGroupBy, sortBy?: StreamingScrubberSortBy, direction?: StreamingScrubberSortDirection) {
    return this.substrate.getGroupedEvents(groupBy, sortBy, direction);
  }

  public queryDsl(query: StreamingScrubberDslQueryFilter | string) {
    return this.substrate.queryEventsDsl(query);
  }

  public bulkPurge(ids: readonly string[]) {
    return this.substrate.bulkPurgeEvents(ids);
  }

  public bulkReset(sessionIds: readonly string[]) {
    return this.substrate.bulkResetSessions(sessionIds);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }
}
