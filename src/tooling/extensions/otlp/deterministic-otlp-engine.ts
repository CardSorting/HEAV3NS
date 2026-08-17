/**
 * deterministic-otlp-engine.ts
 *
 * Deterministic calculation engine for OpenTelemetry (OTLP) Distributed Tracing (Phase 98 / ADR-128).
 * Handles W3C traceparent formatting/parsing, visual ASCII trace waterfalls, proportional flame graphs,
 * automated bottleneck diagnostics, and standardized OTLP JSON payload serialization.
 */

import { randomBytes } from "node:crypto";
import type {
  OtlpBottleneckReport,
  OtlpFlameGraphSegment,
  OtlpSpan,
  OtlpTracePayload,
  W3CTraceContext,
} from "../../../core/contracts/otlp.contracts.js";

export class DeterministicOtlpEngine {
  /**
   * Generates a valid W3C TraceContext traceparent string and structured object.
   * Format: version-traceId-parentSpanId-traceFlags (e.g. 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01)
   */
  public generateW3CTraceContext(parentContext?: W3CTraceContext): W3CTraceContext {
    const version = "00";
    const traceId = parentContext ? parentContext.traceId : randomBytes(16).toString("hex");
    const parentSpanId = randomBytes(8).toString("hex");
    const traceFlags = parentContext ? parentContext.traceFlags : "01"; // Sampled
    const rawTraceparent = `${version}-${traceId}-${parentSpanId}-${traceFlags}`;

    return {
      version,
      traceId,
      parentSpanId,
      traceFlags,
      traceState: parentContext?.traceState,
      rawTraceparent,
    };
  }

  /**
   * Parses standard W3C traceparent header.
   */
  public parseW3CTraceparent(header: string): W3CTraceContext | undefined {
    if (!header || typeof header !== "string") return undefined;
    const parts = header.trim().split("-");
    if (parts.length < 4) return undefined;

    const [version, traceId, parentSpanId, traceFlags] = parts;
    if (version.length !== 2 || traceId.length !== 32 || parentSpanId.length !== 16 || traceFlags.length !== 2) {
      return undefined;
    }

    return {
      version,
      traceId,
      parentSpanId,
      traceFlags,
      rawTraceparent: header.trim(),
    };
  }

  /**
   * Compiles an intuitive ASCII waterfall timeline diagram mirroring Datadog APM / Honeycomb.
   */
  public renderWaterfallTimeline(spans: readonly OtlpSpan[]): string {
    if (!spans || spans.length === 0) {
      return "*(No spans recorded in trace)*";
    }

    const minStartTime = Math.min(...spans.map((s) => s.startTimeUnixNano));
    const maxEndTime = Math.max(...spans.map((s) => s.endTimeUnixNano || s.startTimeUnixNano));
    const totalDurationMs = Math.max(0.1, (maxEndTime - minStartTime) / 1_000_000);
    const traceId = spans[0]?.traceId || "unknown";

    let output = `📊 *Trace Waterfall: \`${traceId.slice(0, 16)}...\`*\n` +
      `Total Duration: *${totalDurationMs.toFixed(2)} ms* • Spans: *${spans.length}*\n\n` +
      "```text\n";

    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      const startOffsetMs = Math.max(0, (span.startTimeUnixNano - minStartTime) / 1_000_000);
      const spanDurationMs = span.durationMs || Math.max(0.1, ((span.endTimeUnixNano || span.startTimeUnixNano) - span.startTimeUnixNano) / 1_000_000);

      const barWidth = 20;
      const startPos = Math.min(barWidth - 1, Math.floor((startOffsetMs / totalDurationMs) * barWidth));
      const spanWidth = Math.max(1, Math.min(barWidth - startPos, Math.round((spanDurationMs / totalDurationMs) * barWidth)));
      const endPos = barWidth - startPos - spanWidth;

      const bar = "░".repeat(Math.max(0, startPos)) + "█".repeat(spanWidth) + "░".repeat(Math.max(0, endPos));
      const prefix = span.parentSpanId ? "  ├── " : "└── ";
      const statusIcon = span.status.code === "ERROR" ? "🚨" : "✅";
      const name = span.name.padEnd(24, " ");

      output += `${prefix}${statusIcon} ${name} [${bar}] ${spanDurationMs.toFixed(1)}ms\n`;
    }

    output += "```";
    return output;
  }

  /**
   * Compiles an intuitive proportional ASCII Flame Graph showing percentage time distribution.
   */
  public renderFlameGraph(spans: readonly OtlpSpan[]): { asciiFlameGraph: string; segments: readonly OtlpFlameGraphSegment[] } {
    if (!spans || spans.length === 0) {
      return { asciiFlameGraph: "*(No spans recorded)*", segments: [] };
    }

    const totalDurationMs = spans.reduce((sum, s) => sum + (s.durationMs || 0), 0) || 1;
    const segments: OtlpFlameGraphSegment[] = [];

    for (const span of spans) {
      const durationMs = span.durationMs || 0.1;
      const pct = Math.min(100, Math.max(0, Math.round((durationMs / totalDurationMs) * 100)));

      let category: OtlpFlameGraphSegment["category"] = "INTERNAL";
      let emoji = "⚡";

      if (span.name.includes("model") || span.name.includes("inference") || span.name.includes("llm")) {
        category = "MODEL";
        emoji = "🧠";
      } else if (span.name.includes("tool") || span.name.includes("exec")) {
        category = "TOOL";
        emoji = "🛠️";
      } else if (span.name.includes("db") || span.name.includes("query") || span.name.includes("storage")) {
        category = "DATABASE";
        emoji = "🗄️";
      } else if (span.name.includes("gateway") || span.name.includes("dispatch")) {
        category = "GATEWAY";
        emoji = "📤";
      } else if (span.name.includes("swarm") || span.name.includes("subagent")) {
        category = "SWARM";
        emoji = "🐝";
      }

      segments.push({
        spanId: span.spanId,
        name: span.name,
        durationMs,
        percentageOfTotal: pct,
        category,
        emoji,
      });
    }

    let ascii = `🔥 *Trace Proportional Flame Graph* (Total Work: ${totalDurationMs.toFixed(1)} ms)\n\n` +
      "```text\n" +
      "┌" + "─".repeat(70) + "┐\n";

    for (const seg of segments) {
      const barLen = Math.max(1, Math.min(30, Math.round((seg.percentageOfTotal / 100) * 30)));
      const bar = "█".repeat(barLen) + "░".repeat(Math.max(0, 30 - barLen));
      const line = `│ ${seg.emoji} ${seg.name.padEnd(20, " ")} [${bar}] ${seg.percentageOfTotal}% (${seg.durationMs.toFixed(1)}ms)`.padEnd(71, " ") + "│\n";
      ascii += line;
    }

    ascii += "└" + "─".repeat(70) + "┘\n```";

    return { asciiFlameGraph: ascii, segments };
  }

  /**
   * Automatically diagnoses the slowest span and produces remediation recommendations.
   */
  public diagnoseBottlenecks(spans: readonly OtlpSpan[]): OtlpBottleneckReport {
    if (!spans || spans.length === 0) {
      const fallback: OtlpSpan = {
        traceId: "none",
        spanId: "none",
        name: "none",
        kind: "INTERNAL",
        startTimeUnixNano: 0,
        status: { code: "UNSET" },
        attributes: {},
        events: [],
        links: [],
      };
      return {
        traceId: "none",
        totalDurationMs: 0,
        slowestSpan: fallback,
        slowestSpanPercent: 0,
        recommendations: ["No spans recorded to analyze."],
        detectedAt: Date.now(),
      };
    }

    const totalDurationMs = spans.reduce((sum, s) => sum + (s.durationMs || 0), 0) || 1;
    let slowest = spans[0];

    for (const s of spans) {
      if ((s.durationMs || 0) > (slowest.durationMs || 0)) {
        slowest = s;
      }
    }

    const slowestDuration = slowest.durationMs || 0;
    const slowestSpanPercent = Math.round((slowestDuration / totalDurationMs) * 100);
    const recommendations: string[] = [];

    if (slowestSpanPercent > 50) {
      recommendations.push(`⚠️ Single span '${slowest.name}' consumed ${slowestSpanPercent}% of execution time.`);
    }

    if (slowest.name.includes("model") && slowestDuration > 2000) {
      recommendations.push("💡 Model inference exceeded 2000ms. Consider prompt token pruning or parallel subagent delegation.");
    } else if (slowest.name.includes("tool") && slowestDuration > 1000) {
      recommendations.push("💡 Tool execution took >1000ms. Check external network dependencies or enable tool caching.");
    } else if (slowest.name.includes("db") && slowestDuration > 50) {
      recommendations.push("💡 In-memory table scan took >50ms. Add composite index on filtered keys.");
    } else {
      recommendations.push("✓ Execution distribution is balanced within optimal sub-millisecond SLAs.");
    }

    return {
      traceId: slowest.traceId,
      totalDurationMs,
      slowestSpan: slowest,
      slowestSpanPercent,
      recommendations,
      detectedAt: Date.now(),
    };
  }

  /**
   * Serializes spans into standard OpenTelemetry (OTLP) JSON format.
   */
  public serializeOtlpJson(spans: readonly OtlpSpan[], serviceName = "lumi-engine"): string {
    const payload: OtlpTracePayload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: "service.name", value: { stringValue: serviceName } },
              { key: "telemetry.sdk.language", value: { stringValue: "typescript" } },
              { key: "telemetry.sdk.name", value: { stringValue: "lumi-otlp-engine" } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: "lumi.tracer", version: "0.1.0" },
              spans: spans.map((s) => ({ ...s })),
            },
          ],
        },
      ],
    };

    return JSON.stringify(payload, null, 2);
  }
}
