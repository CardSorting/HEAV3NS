/**
 * stream-diag-supervisor.ts
 *
 * Master supervisor coordinating LLM stream lifecycle metrics, upstream header capture,
 * structured retry diagnostics, and subagent attribution (Phase 130 / ADR-106 / Target #63).
 */

import { performance } from "node:perf_hooks";
import type { BroccoliStreamDiagSubstrate } from "../../../sessions/extensions/stream_diag/broccoli-stream-diag-substrate.js";
import type { DeterministicStreamDiagEngine } from "./deterministic-stream-diag-engine.js";
import type {
  StreamDiagConfig,
  StreamDiagnosticAttempt,
  StreamDiagMetrics,
  StreamDropEvent,
} from "../../../core/contracts/stream-diag.contracts.js";

export interface StartStreamAttemptOptions {
  subagentId?: string;
  delegateDepth?: number;
  midToolCall?: boolean;
}

export class StreamDiagSupervisor {
  private readonly substrate: BroccoliStreamDiagSubstrate;
  private readonly engine: DeterministicStreamDiagEngine;

  constructor(substrate: BroccoliStreamDiagSubstrate, engine: DeterministicStreamDiagEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public configure(config: Partial<StreamDiagConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): StreamDiagConfig {
    return this.substrate.getConfig();
  }

  public getMetrics(): StreamDiagMetrics {
    return this.substrate.getMetrics();
  }

  public getRecentAttempts(): StreamDiagnosticAttempt[] {
    return this.substrate.getAllAttempts();
  }

  public getDropEvents(): StreamDropEvent[] {
    return this.substrate.getDropEvents();
  }

  /**
   * Initializes a new streaming attempt for an LLM request.
   */
  public startAttempt(
    provider: string,
    model: string,
    options: StartStreamAttemptOptions = {}
  ): StreamDiagnosticAttempt {
    const attemptId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const attempt: StreamDiagnosticAttempt = {
      attemptId,
      provider,
      model,
      startedAt: performance.now(),
      chunks: 0,
      bytes: 0,
      headers: {},
      elapsedMs: 0,
      subagentId: options.subagentId,
      delegateDepth: options.delegateDepth || 0,
      midToolCall: options.midToolCall || false,
      status: "streaming",
    };

    this.substrate.recordAttempt(attempt);
    return attempt;
  }

  /**
   * Captures upstream headers and HTTP status at stream open.
   */
  public captureResponse(
    attemptId: string,
    httpStatus: number | undefined,
    headers: Record<string, string | string[] | undefined> = {}
  ): void {
    const attempt = this.substrate.getAttempt(attemptId);
    if (!attempt) return;

    const config = this.substrate.getConfig();
    const captured = this.engine.captureUpstreamHeaders(headers, config);

    attempt.httpStatus = httpStatus;
    attempt.headers = captured;
    this.substrate.recordAttempt(attempt);
  }

  /**
   * Records an incoming streaming chunk.
   */
  public recordChunk(attemptId: string, chunkBytes: number): void {
    const attempt = this.substrate.getAttempt(attemptId);
    if (!attempt) return;

    const now = performance.now();
    if (attempt.firstChunkAt === undefined) {
      attempt.firstChunkAt = now;
      attempt.ttfbMs = Math.max(0, now - attempt.startedAt);
    }

    attempt.chunks++;
    attempt.bytes += chunkBytes;
    attempt.elapsedMs = Math.max(0, now - attempt.startedAt);
    this.substrate.recordAttempt(attempt);
  }

  /**
   * Records a stream drop and retry event.
   */
  public recordDropAndRetry(
    attemptId: string,
    error: unknown,
    attemptNum: number,
    maxAttempts: number
  ): StreamDropEvent | undefined {
    const attempt = this.substrate.getAttempt(attemptId);
    if (!attempt) return undefined;

    attempt.elapsedMs = Math.max(0, performance.now() - attempt.startedAt);
    attempt.status = "retrying";
    attempt.errorSummary = (error as { message?: string })?.message || String(error);
    attempt.exceptionChain = this.engine.flattenExceptionChain(error);

    const event = this.engine.createDropEvent(attempt, error, attemptNum, maxAttempts);
    this.substrate.recordDropEvent(event);
    this.substrate.recordAttempt(attempt);

    return event;
  }

  /**
   * Marks a stream attempt as cleanly completed.
   */
  public completeAttempt(attemptId: string): void {
    const attempt = this.substrate.getAttempt(attemptId);
    if (!attempt) return;

    attempt.elapsedMs = Math.max(0, performance.now() - attempt.startedAt);
    attempt.status = "completed";

    this.substrate.recordAttempt(attempt);
    this.substrate.recordStreamSuccess(attempt.bytes, attempt.chunks, attempt.ttfbMs, attempt.elapsedMs);
  }
}
