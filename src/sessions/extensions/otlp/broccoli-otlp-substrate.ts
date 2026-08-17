/**
 * broccoli-otlp-substrate.ts
 *
 * In-memory Zero-GC Broccolidb substrate for OpenTelemetry (OTLP) Distributed Tracing (Phase 98 / ADR-128).
 * Manages active in-flight spans, completed span ring buffers (1,000 capacity), trace associations,
 * and O(1) state snapshotting under the AKD-DSO Monolith architecture.
 */

import type {
  OtlpExporterConfig,
  OtlpSpan,
  OtlpSubstrateSnapshot,
  W3CTraceContext,
} from "../../../core/contracts/otlp.contracts.js";

const DEFAULT_OTLP_CONFIG: OtlpExporterConfig = {
  enabled: false, // Fail-closed default
  endpointUrl: "http://localhost:4318/v1/traces",
  headers: {},
  samplingRate: 1.0,
  batchSize: 50,
  maxQueueSize: 1000,
  exportTimeoutMs: 5000,
  compression: "none",
};

export class BroccoliOtlpSubstrate {
  private config: OtlpExporterConfig = { ...DEFAULT_OTLP_CONFIG };
  private readonly activeSpans = new Map<string, OtlpSpan>();
  private readonly completedSpansRing: OtlpSpan[] = [];
  private readonly maxRingCapacity = 1000;
  private totalSpansRecorded = 0;
  private totalTracesCompleted = 0;

  public getConfig(): OtlpExporterConfig {
    return { ...this.config, headers: { ...this.config.headers } };
  }

  public updateConfig(updates: Partial<OtlpExporterConfig>): OtlpExporterConfig {
    this.config = {
      ...this.config,
      ...updates,
      headers: updates.headers ? { ...updates.headers } : this.config.headers,
    };
    return this.getConfig();
  }

  public startSpan(span: OtlpSpan): void {
    this.activeSpans.set(span.spanId, span);
    this.totalSpansRecorded++;
  }

  public getActiveSpan(spanId: string): OtlpSpan | undefined {
    return this.activeSpans.get(spanId);
  }

  public listActiveSpans(): readonly OtlpSpan[] {
    return Array.from(this.activeSpans.values());
  }

  public endSpan(spanId: string, updates: Partial<OtlpSpan> = {}): OtlpSpan | undefined {
    const existing = this.activeSpans.get(spanId);
    if (!existing) return undefined;

    const endTime = updates.endTimeUnixNano || Date.now() * 1_000_000;
    const durationMs = updates.durationMs || Math.max(0, (endTime - existing.startTimeUnixNano) / 1_000_000);

    const completed: OtlpSpan = {
      ...existing,
      ...updates,
      endTimeUnixNano: endTime,
      durationMs,
      status: updates.status || { code: "OK" },
    };

    this.activeSpans.delete(spanId);

    if (this.completedSpansRing.length >= this.maxRingCapacity) {
      this.completedSpansRing.shift();
    }
    this.completedSpansRing.push(completed);

    if (!completed.parentSpanId) {
      this.totalTracesCompleted++;
    }

    return completed;
  }

  public listCompletedSpans(traceId?: string): readonly OtlpSpan[] {
    if (traceId) {
      return this.completedSpansRing.filter((s) => s.traceId === traceId);
    }
    return [...this.completedSpansRing];
  }

  public getSpan(spanId: string): OtlpSpan | undefined {
    return this.activeSpans.get(spanId) || this.completedSpansRing.find((s) => s.spanId === spanId);
  }

  public upsertActiveSpan(span: OtlpSpan): void {
    this.activeSpans.set(span.spanId, span);
  }

  public clearBuffer(): void {
    this.activeSpans.clear();
    this.completedSpansRing.length = 0;
  }

  public clearSpans(): void {
    this.clearBuffer();
  }

  public listSpans(): readonly OtlpSpan[] {
    return [...Array.from(this.activeSpans.values()), ...this.completedSpansRing];
  }

  public exportSnapshot(): OtlpSubstrateSnapshot {
    return {
      activeSpans: Array.from(this.activeSpans.values()),
      completedSpans: [...this.completedSpansRing],
      config: this.getConfig(),
      totalSpansRecorded: this.totalSpansRecorded,
      totalTracesCompleted: this.totalTracesCompleted,
    };
  }

  public importSnapshot(snapshot: OtlpSubstrateSnapshot): void {
    this.activeSpans.clear();
    for (const span of snapshot.activeSpans) {
      this.activeSpans.set(span.spanId, span);
    }
    this.completedSpansRing.length = 0;
    this.completedSpansRing.push(...snapshot.completedSpans);
    this.config = { ...snapshot.config };
    this.totalSpansRecorded = snapshot.totalSpansRecorded;
    this.totalTracesCompleted = snapshot.totalTracesCompleted;
  }
}
