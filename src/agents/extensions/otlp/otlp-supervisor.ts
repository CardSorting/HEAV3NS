/**
 * otlp-supervisor.ts
 *
 * Supervisor orchestrator for OpenTelemetry (OTLP) Distributed Tracing (Phase 98 / ADR-128).
 * Governs W3C traceparent propagation, span lifecycle, visual flame graph compilation,
 * bottleneck diagnostics, telemetry exporter dispatch, and health matrix metrics.
 */

import { randomBytes } from "node:crypto";
import type {
  OtlpBottleneckReport,
  OtlpExporterConfig,
  OtlpFlameGraphSegment,
  OtlpHealthMatrix,
  OtlpSpan,
  SpanKind,
  SpanStatusCode,
  W3CTraceContext,
} from "../../../core/contracts/otlp.contracts.js";
import { BroccoliOtlpSubstrate } from "../../../sessions/extensions/otlp/broccoli-otlp-substrate.js";
import { DeterministicOtlpEngine } from "../../../tooling/extensions/otlp/deterministic-otlp-engine.js";

export class OtlpSupervisor {
  private readonly substrate: BroccoliOtlpSubstrate;
  private readonly engine: DeterministicOtlpEngine;

  constructor(substrate: BroccoliOtlpSubstrate, engine: DeterministicOtlpEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public isSkillEnabled(): boolean {
    return this.substrate.getConfig().enabled;
  }

  public getConfig(): OtlpExporterConfig {
    return this.substrate.getConfig();
  }

  public updateConfig(updates: Partial<OtlpExporterConfig>): OtlpExporterConfig {
    return this.substrate.updateConfig(updates);
  }

  /**
   * Starts a new root or child span with W3C TraceContext.
   */
  public startSpan(
    name: string,
    kind: SpanKind = "INTERNAL",
    parentTraceparent?: string,
    attributes: Record<string, string | number | boolean> = {}
  ): { span: OtlpSpan; traceContext: W3CTraceContext } {
    const parentContext = parentTraceparent ? this.engine.parseW3CTraceparent(parentTraceparent) : undefined;
    const traceContext = this.engine.generateW3CTraceContext(parentContext);
    const spanId = traceContext.parentSpanId || randomBytes(8).toString("hex");

    const span: OtlpSpan = {
      traceId: traceContext.traceId,
      spanId,
      parentSpanId: parentContext?.parentSpanId,
      name,
      kind,
      startTimeUnixNano: Date.now() * 1_000_000,
      status: { code: "UNSET" },
      attributes,
      events: [],
      links: [],
    };

    if (this.isSkillEnabled()) {
      this.substrate.startSpan(span);
    }

    return { span, traceContext };
  }

  /**
   * Ends an active span with duration and status code.
   */
  public endSpan(
    spanId: string,
    statusCode: SpanStatusCode = "OK",
    statusDescription?: string,
    additionalAttributes: Record<string, string | number | boolean> = {}
  ): OtlpSpan | undefined {
    if (!this.isSkillEnabled()) {
      return undefined;
    }

    const active = this.substrate.getActiveSpan(spanId);
    const mergedAttributes = active ? { ...active.attributes, ...additionalAttributes } : additionalAttributes;

    return this.substrate.endSpan(spanId, {
      status: { code: statusCode, description: statusDescription },
      attributes: mergedAttributes,
    });
  }

  public addSpanEvent(
    spanId: string,
    name: string,
    attributes: Record<string, string | number | boolean> = {}
  ): boolean {
    if (!this.isSkillEnabled()) return false;
    const active = this.substrate.getActiveSpan(spanId);
    if (!active) return false;
    const event = { name, timestamp: Date.now(), attributes };
    const updated = { ...active, events: [...(active.events || []), event] };
    this.substrate.upsertActiveSpan(updated);
    return true;
  }

  /**
   * Renders visual ASCII trace waterfall timeline.
   */
  public renderWaterfallTimeline(traceId?: string): string {
    const spans = this.substrate.listCompletedSpans(traceId);
    return this.engine.renderWaterfallTimeline(spans);
  }

  /**
   * Renders visual ASCII flame graph.
   */
  public renderFlameGraph(traceId?: string): { asciiFlameGraph: string; segments: readonly OtlpFlameGraphSegment[] } {
    const spans = this.substrate.listCompletedSpans(traceId);
    return this.engine.renderFlameGraph(spans);
  }

  /**
   * Automatically diagnoses bottlenecks in completed spans.
   */
  public diagnoseBottlenecks(traceId?: string): OtlpBottleneckReport {
    const spans = this.substrate.listCompletedSpans(traceId);
    return this.engine.diagnoseBottlenecks(spans);
  }

  public getTraceSpans(traceId: string): readonly OtlpSpan[] {
    return this.substrate.listCompletedSpans(traceId);
  }

  /**
   * Filters spans by tag, category, error state, or minimum latency.
   */
  public filterSpans(options: {
    tagKey?: string;
    tagValue?: string;
    onlyErrors?: boolean;
    minDurationMs?: number;
    traceId?: string;
  } = {}): readonly OtlpSpan[] {
    let spans = this.substrate.listCompletedSpans(options.traceId);

    if (options.onlyErrors) {
      spans = spans.filter((s) => s.status.code === "ERROR");
    }

    if (typeof options.minDurationMs === "number") {
      spans = spans.filter((s) => (s.durationMs || 0) >= (options.minDurationMs || 0));
    }

    if (options.tagKey) {
      spans = spans.filter((s) => {
        const val = s.attributes[options.tagKey!];
        if (options.tagValue !== undefined) {
          return String(val) === String(options.tagValue);
        }
        return val !== undefined;
      });
    }

    return spans;
  }

  public listActiveSpans(): readonly OtlpSpan[] {
    return this.substrate.listActiveSpans();
  }

  public exportTracePayload(serviceName = "lumi-agent", traceId?: string): string {
    const spans = this.substrate.listCompletedSpans(traceId);
    return this.engine.serializeOtlpJson(spans, serviceName);
  }

  public flushSpanBuffer(): { success: boolean; flushedSpansCount: number; message: string } {
    const count = this.substrate.listCompletedSpans().length;
    this.substrate.clearBuffer();
    return {
      success: true,
      flushedSpansCount: count,
      message: `✓ Flushed ${count} spans from in-memory ring buffer.`,
    };
  }

  public inspectHealth(): OtlpHealthMatrix {
    const cfg = this.substrate.getConfig();
    const active = this.substrate.listActiveSpans();
    const completed = this.substrate.listCompletedSpans();
    const snap = this.substrate.exportSnapshot();

    const avgLatency = completed.length > 0
      ? completed.reduce((sum, s) => sum + (s.durationMs || 0), 0) / completed.length
      : 0;

    return {
      enabled: cfg.enabled,
      totalSpansRecorded: snap.totalSpansRecorded,
      activeSpansCount: active.length,
      ringBufferCapacity: 1000,
      totalTracesCompleted: snap.totalTracesCompleted,
      averageTurnLatencyMs: Number(avgLatency.toFixed(2)),
      exportQueueDepth: completed.length,
      status: !cfg.enabled ? "DISABLED" : "HEALTHY",
      timestamp: Date.now(),
    };
  }
}
