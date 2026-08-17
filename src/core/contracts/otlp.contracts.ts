/**
 * otlp.contracts.ts
 *
 * Core contracts for the OpenTelemetry (OTLP) Distributed Tracing & Observability Subsystem (Phase 98 / ADR-128).
 * Defines W3C TraceContext propagation, OTLP spans, visual flame graphs, bottleneck diagnostics,
 * and telemetry exporter configurations under the AKD-DSO Monolith architecture.
 */

export type SpanKind =
  | "INTERNAL"
  | "SERVER"
  | "CLIENT"
  | "PRODUCER"
  | "CONSUMER";

export type SpanStatusCode = "UNSET" | "OK" | "ERROR";

export interface W3CTraceContext {
  readonly version: string;
  readonly traceId: string;
  readonly parentSpanId?: string;
  readonly traceFlags: string;
  readonly traceState?: string;
  readonly rawTraceparent: string;
}

export interface SpanEvent {
  readonly name: string;
  readonly timestamp: number;
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
}

export interface SpanLink {
  readonly traceId: string;
  readonly spanId: string;
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
}

export interface OtlpSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTimeUnixNano: number;
  readonly endTimeUnixNano?: number;
  readonly durationMs?: number;
  readonly status: {
    readonly code: SpanStatusCode;
    readonly description?: string;
  };
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
  readonly events: readonly SpanEvent[];
  readonly links: readonly SpanLink[];
}

export interface OtlpFlameGraphSegment {
  readonly spanId: string;
  readonly name: string;
  readonly durationMs: number;
  readonly percentageOfTotal: number;
  readonly category: "MODEL" | "TOOL" | "DATABASE" | "GATEWAY" | "SWARM" | "INTERNAL";
  readonly emoji: string;
}

export interface OtlpBottleneckReport {
  readonly traceId: string;
  readonly totalDurationMs: number;
  readonly slowestSpan: OtlpSpan;
  readonly slowestSpanPercent: number;
  readonly recommendations: readonly string[];
  readonly detectedAt: number;
}

export interface OtlpExporterConfig {
  readonly enabled: boolean;
  readonly endpointUrl: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly samplingRate: number; // 0.0 to 1.0
  readonly batchSize: number;
  readonly maxQueueSize: number;
  readonly exportTimeoutMs: number;
  readonly compression: "none" | "gzip";
}

export interface OtlpTracePayload {
  readonly resourceSpans: readonly {
    readonly resource: {
      readonly attributes: readonly { readonly key: string; readonly value: { readonly stringValue?: string; readonly intValue?: number } }[];
    };
    readonly scopeSpans: readonly {
      readonly scope: { readonly name: string; readonly version: string };
      readonly spans: readonly OtlpSpan[];
    }[];
  }[];
}

export interface OtlpHealthMatrix {
  readonly enabled: boolean;
  readonly totalSpansRecorded: number;
  readonly activeSpansCount: number;
  readonly ringBufferCapacity: number;
  readonly totalTracesCompleted: number;
  readonly averageTurnLatencyMs: number;
  readonly exportQueueDepth: number;
  readonly lastExportAt?: number;
  readonly status: "HEALTHY" | "DEGRADED" | "DISABLED";
  readonly timestamp: number;
}

export interface OtlpSubstrateSnapshot {
  readonly activeSpans: readonly OtlpSpan[];
  readonly completedSpans: readonly OtlpSpan[];
  readonly config: OtlpExporterConfig;
  readonly totalSpansRecorded: number;
  readonly totalTracesCompleted: number;
}
