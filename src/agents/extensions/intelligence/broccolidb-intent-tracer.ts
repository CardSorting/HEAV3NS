/**
 * [LAYER: AGENTS EXTENSION]
 * Pass 146: Zero-Dependency Broccoli Intent Tracer
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/IntentTracer.ts).
 * Tracks high-level agent intentions across tool execution phases (startIntent, endIntent, failIntent),
 * measuring latency statistics, capability counts, and active intent maps. Zero external npm dependencies.
 */

import { randomUUID } from "node:crypto";

export interface CapabilityIntent {
  intentId: string;
  capabilityName: string;
  sessionId: string;
  startedAt: number;
  correlationId?: string;
  agentId?: string;
  taskId?: string;
  priority?: "low" | "normal" | "high" | "critical";
  durability?: "ephemeral" | "buffered" | "durable";
}

export interface IntentTrace {
  intentId: string;
  capabilityName: string;
  sessionId: string;
  durationMs: number;
  status: "completed" | "failed";
  error?: string;
  endedAt: number;
}

export interface IntentTracerHealth {
  totalIntents: number;
  completedIntents: number;
  failedIntents: number;
  activeIntentsCount: number;
  meanLatencyMs: number;
}

export class BroccoliIntentTracer {
  private readonly buffer: IntentTrace[] = [];
  private readonly activeIntents = new Map<string, CapabilityIntent>();
  private totalIntents = 0;
  private completedIntents = 0;
  private failedIntents = 0;
  private totalLatencyMs = 0;
  private readonly maxBuffer: number;

  constructor(maxBuffer = 500) {
    this.maxBuffer = maxBuffer;
  }

  /**
   * Starts tracking a new capability intent.
   */
  public startIntent(params: {
    capabilityName: string;
    sessionId: string;
    correlationId?: string;
    agentId?: string;
    taskId?: string;
    priority?: "low" | "normal" | "high" | "critical";
    durability?: "ephemeral" | "buffered" | "durable";
  }): CapabilityIntent {
    const intentId = randomUUID();
    const intent: CapabilityIntent = {
      intentId,
      capabilityName: params.capabilityName,
      sessionId: params.sessionId,
      startedAt: Date.now(),
      correlationId: params.correlationId,
      agentId: params.agentId,
      taskId: params.taskId,
      priority: params.priority,
      durability: params.durability,
    };

    this.activeIntents.set(intentId, intent);
    this.totalIntents++;
    return intent;
  }

  /**
   * Completes an active intent.
   */
  public endIntent(intentId: string): IntentTrace | undefined {
    const active = this.activeIntents.get(intentId);
    if (!active) return undefined;

    this.activeIntents.delete(intentId);
    const now = Date.now();
    const durationMs = now - active.startedAt;
    this.completedIntents++;
    this.totalLatencyMs += durationMs;

    const trace: IntentTrace = {
      intentId,
      capabilityName: active.capabilityName,
      sessionId: active.sessionId,
      durationMs,
      status: "completed",
      endedAt: now,
    };

    this.pushBuffer(trace);
    return trace;
  }

  /**
   * Fails an active intent with an error.
   */
  public failIntent(intentId: string, error: string): IntentTrace | undefined {
    const active = this.activeIntents.get(intentId);
    if (!active) return undefined;

    this.activeIntents.delete(intentId);
    const now = Date.now();
    const durationMs = now - active.startedAt;
    this.failedIntents++;
    this.totalLatencyMs += durationMs;

    const trace: IntentTrace = {
      intentId,
      capabilityName: active.capabilityName,
      sessionId: active.sessionId,
      durationMs,
      status: "failed",
      error,
      endedAt: now,
    };

    this.pushBuffer(trace);
    return trace;
  }

  private pushBuffer(trace: IntentTrace): void {
    this.buffer.push(trace);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }
  }

  /**
   * Returns current health and performance metrics for the intent tracer.
   */
  public getHealth(): IntentTracerHealth {
    const totalFinished = this.completedIntents + this.failedIntents;
    const meanLatencyMs = totalFinished > 0 ? this.totalLatencyMs / totalFinished : 0;

    return {
      totalIntents: this.totalIntents,
      completedIntents: this.completedIntents,
      failedIntents: this.failedIntents,
      activeIntentsCount: this.activeIntents.size,
      meanLatencyMs,
    };
  }
}
