/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 145: Zero-Dependency Broccoli Execution Trace Recorder
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/orchestration/ExecutionTrace.ts).
 * In-memory telemetry execution trace event stream recorder emitting structured execution events,
 * with ring-buffer FIFO auto-truncation and session ID filtering. Zero external npm dependencies.
 */

import { randomUUID } from "node:crypto";

export type ExecutionTraceEventKind =
  | "execution_started"
  | "execution_completed"
  | "execution_failed"
  | "verification_started"
  | "verification_completed"
  | "rollback_started"
  | "rollback_completed"
  | "step_applied"
  | "step_skipped";

export interface ExecutionTraceEvent {
  eventId: string;
  sessionId: string;
  correlationId?: string;
  intentId?: string;
  kind: ExecutionTraceEventKind;
  timestamp: number;
  detail: Record<string, unknown>;
}

export class BroccoliExecutionTraceRecorder {
  private readonly events: ExecutionTraceEvent[] = [];
  private readonly maxEvents: number;

  constructor(maxEvents = 500) {
    this.maxEvents = maxEvents;
  }

  /**
   * Emits a new execution trace event to the ring buffer.
   */
  public emit(
    sessionId: string,
    kind: ExecutionTraceEventKind,
    detail: Record<string, unknown> = {},
    options: { correlationId?: string; intentId?: string } = {}
  ): ExecutionTraceEvent {
    const event: ExecutionTraceEvent = {
      eventId: randomUUID(),
      sessionId,
      correlationId: options.correlationId,
      intentId: options.intentId,
      kind,
      timestamp: Date.now(),
      detail,
    };

    this.events.push(event);

    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    return event;
  }

  /**
   * Retrieves events filtered by session ID.
   */
  public getEvents(sessionId?: string): ExecutionTraceEvent[] {
    if (!sessionId) return [...this.events];
    return this.events.filter((e) => e.sessionId === sessionId);
  }

  /**
   * Clears all recorded execution trace events.
   */
  public clear(): void {
    this.events.length = 0;
  }
}
