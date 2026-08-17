/**
 * otlp-tool-suite.ts
 *
 * Model tool surface for the OpenTelemetry (OTLP) Distributed Tracing Subsystem (Phase 98 / ADR-128).
 * Exposes 9 specialized model tools covering span lifecycles, visual ASCII trace waterfalls,
 * proportional flame graphs, bottleneck diagnostics, tag filtering, and OTLP JSON serialization.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { SpanKind, SpanStatusCode } from "../../../core/contracts/otlp.contracts.js";
import { OtlpSupervisor } from "../../../agents/extensions/otlp/otlp-supervisor.js";

export class OtlpToolSuite {
  private readonly supervisor: OtlpSupervisor;

  constructor(supervisor: OtlpSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): readonly ToolDefinition[] {
    return [
      // 1. otlp_start_trace_span
      {
        name: "otlp_start_trace_span",
        description: "Initiates a new root or child span with W3C TraceContext traceparent for distributed tracing.",
        parameters: {
          name: { type: "string", required: true, description: "Name of the operation / span (e.g. model_inference, tool_exec)" },
          kind: { type: "string", description: "Span kind: INTERNAL, SERVER, CLIENT, PRODUCER, CONSUMER. Default: INTERNAL" },
          parentTraceparent: { type: "string", description: "Optional incoming W3C traceparent header to attach child span" },
          attributesJson: { type: "string", description: "Optional JSON key-value attributes to attach to span" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const name = String(args.name || "operation");
          const kind = (String(args.kind || "INTERNAL").toUpperCase()) as SpanKind;
          const parentTraceparent = args.parentTraceparent ? String(args.parentTraceparent) : undefined;
          let attributes: Record<string, string | number | boolean> = {};

          try {
            if (args.attributesJson) attributes = JSON.parse(String(args.attributesJson));
          } catch {
            attributes = {};
          }

          const { span, traceContext } = this.supervisor.startSpan(name, kind, parentTraceparent, attributes);

          return {
            success: true,
            spanId: span.spanId,
            traceId: span.traceId,
            traceparent: traceContext.rawTraceparent,
            name: span.name,
            startTimeUnixNano: span.startTimeUnixNano,
          };
        },
      },

      // 2. otlp_end_trace_span
      {
        name: "otlp_end_trace_span",
        description: "Ends an active span, calculating duration and recording completion status.",
        parameters: {
          spanId: { type: "string", required: true, description: "Span ID to close" },
          statusCode: { type: "string", description: "Status code: OK, ERROR, UNSET. Default: OK" },
          statusDescription: { type: "string", description: "Optional description or error message" },
          attributesJson: { type: "string", description: "Optional additional attributes to merge on completion" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const spanId = String(args.spanId || "");
          const statusCode = (String(args.statusCode || "OK").toUpperCase()) as SpanStatusCode;
          const statusDescription = args.statusDescription ? String(args.statusDescription) : undefined;
          let attributes: Record<string, string | number | boolean> = {};

          try {
            if (args.attributesJson) attributes = JSON.parse(String(args.attributesJson));
          } catch {
            attributes = {};
          }

          const completed = this.supervisor.endSpan(spanId, statusCode, statusDescription, attributes);
          if (!completed) {
            return {
              success: false,
              error: `Span '${spanId}' not found or OTLP skill is disabled.`,
            };
          }

          return {
            success: true,
            spanId: completed.spanId,
            traceId: completed.traceId,
            durationMs: completed.durationMs,
            status: completed.status,
          };
        },
      },

      // 3. otlp_render_waterfall_timeline
      {
        name: "otlp_render_waterfall_timeline",
        description: "Renders an approachable visual ASCII trace waterfall timeline diagram mirroring Datadog APM / Honeycomb.",
        parameters: {
          traceId: { type: "string", description: "Optional traceId to render specific trace. If omitted, renders all recent spans" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const traceId = args.traceId ? String(args.traceId) : undefined;
          const waterfall = this.supervisor.renderWaterfallTimeline(traceId);
          return {
            success: true,
            traceId: traceId || "recent",
            waterfallMarkdown: waterfall,
          };
        },
      },

      // 4. otlp_render_flame_graph
      {
        name: "otlp_render_flame_graph",
        description: "Renders a proportional ASCII Flame Graph showing percentage time distribution across models, tools, and DB operations.",
        parameters: {
          traceId: { type: "string", description: "Optional traceId to inspect" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const traceId = args.traceId ? String(args.traceId) : undefined;
          const { asciiFlameGraph, segments } = this.supervisor.renderFlameGraph(traceId);
          return {
            success: true,
            flameGraphMarkdown: asciiFlameGraph,
            totalSegments: segments.length,
            segments,
          };
        },
      },

      // 5. otlp_diagnose_bottlenecks
      {
        name: "otlp_diagnose_bottlenecks",
        description: "Runs the automated Bottleneck Hunter to identify the slowest spans in execution and produce optimization recommendations.",
        parameters: {
          traceId: { type: "string", description: "Optional traceId to diagnose" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const traceId = args.traceId ? String(args.traceId) : undefined;
          const report = this.supervisor.diagnoseBottlenecks(traceId);
          return {
            success: true,
            report,
          };
        },
      },

      // 6. otlp_filter_spans
      {
        name: "otlp_filter_spans",
        description: "Filters completed trace spans by tag, category, error state, or minimum latency threshold.",
        parameters: {
          onlyErrors: { type: "boolean", description: "Filter only spans with status ERROR" },
          minDurationMs: { type: "number", description: "Filter spans with duration >= minDurationMs" },
          tagKey: { type: "string", description: "Attribute key to filter by" },
          tagValue: { type: "string", description: "Attribute value to filter by" },
          traceId: { type: "string", description: "Specific trace ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const spans = this.supervisor.filterSpans({
            onlyErrors: typeof args.onlyErrors === "boolean" ? args.onlyErrors : undefined,
            minDurationMs: typeof args.minDurationMs === "number" ? args.minDurationMs : undefined,
            tagKey: args.tagKey ? String(args.tagKey) : undefined,
            tagValue: args.tagValue !== undefined ? String(args.tagValue) : undefined,
            traceId: args.traceId ? String(args.traceId) : undefined,
          });

          return {
            success: true,
            totalMatches: spans.length,
            spans,
          };
        },
      },

      // 7. otlp_inspect_active_traces
      {
        name: "otlp_inspect_active_traces",
        description: "Lists all currently in-flight spans and active W3C trace contexts.",
        parameters: {},
        execute: async (_args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const active = this.supervisor.listActiveSpans();
          const health = this.supervisor.inspectHealth();

          return {
            success: true,
            activeSpansCount: active.length,
            activeSpans: active,
            health,
          };
        },
      },

      // 8. otlp_export_trace_payload
      {
        name: "otlp_export_trace_payload",
        description: "Serializes completed spans into standard OpenTelemetry (OTLP) JSON format for external collectors (Datadog/Langfuse/Jaeger).",
        parameters: {
          serviceName: { type: "string", description: "Service name identifier. Default: lumi-agent" },
          traceId: { type: "string", description: "Optional traceId to export" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const serviceName = String(args.serviceName || "lumi-agent");
          const traceId = args.traceId ? String(args.traceId) : undefined;
          const jsonPayload = this.supervisor.exportTracePayload(serviceName, traceId);

          return {
            success: true,
            serviceName,
            otlpJsonPayload: jsonPayload,
          };
        },
      },

      // 9. otlp_manage_config
      {
        name: "otlp_manage_config",
        description: "Enables, disables, or configures the OpenTelemetry (OTLP) Tracing & Observability Subsystem.",
        parameters: {
          enabled: { type: "boolean", description: "Enable or disable OTLP span collection" },
          endpointUrl: { type: "string", description: "OTLP collector endpoint URL" },
          samplingRate: { type: "number", description: "Sampling rate from 0.0 to 1.0" },
          batchSize: { type: "number", description: "Export batch size" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const updates: Record<string, unknown> = {};
          if (typeof args.enabled === "boolean") updates.enabled = args.enabled;
          if (typeof args.endpointUrl === "string") updates.endpointUrl = args.endpointUrl;
          if (typeof args.samplingRate === "number") updates.samplingRate = args.samplingRate;
          if (typeof args.batchSize === "number") updates.batchSize = args.batchSize;

          const updated = this.supervisor.updateConfig(updates);

          return {
            success: true,
            config: updated,
            status: updated.enabled ? "ACTIVE (ENABLED)" : "DISABLED (FAIL-CLOSED)",
            message: updated.enabled
              ? `✓ OTLP Tracing is now ENABLED (Collector: ${updated.endpointUrl}, Sampling: ${updated.samplingRate * 100}%).`
              : "✓ OTLP Tracing is now DISABLED. All operations will fail closed.",
          };
        },
      },
    ];
  }
}
