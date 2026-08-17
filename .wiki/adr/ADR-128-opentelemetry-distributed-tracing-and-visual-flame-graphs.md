# ADR-128: OpenTelemetry (OTLP) Distributed Tracing, Visual Flame Graphs & Bottlenecks

## Status
Accepted (Phase 98)

## Context
As multi-agent workflows, subagent spawning, distributed microservices, and external LLM/tool interactions scale in enterprise environments, forensic observability requires end-to-end distributed tracing. Without deterministic W3C trace context propagation and visual bottleneck detection, operators cannot diagnose cross-boundary latency spikes or locate sub-optimal tool calls.

## Decision
Implement native OpenTelemetry (OTLP) distributed tracing within the LUMI AKD-DSO Monolith architecture:
1. **W3C TraceContext Protocol**: Deterministic formatting and parsing of `00-${traceId}-${spanId}-${traceFlags}` headers with 32-character trace IDs and 16-character span IDs.
2. **Deterministic Span Substrate**: Fixed-capacity ring buffer (1,000 spans) with Zero-GC contiguous slab invariants and microsecond-precision timing.
3. **Visual Flame Graph & Waterfall Visualizers**: Non-technical ASCII waterfall timelines with relative millisecond offsets and proportional percentage bar charts.
4. **Bottleneck Hunter**: Automated latency analyzer identifying slow spans, critical bottlenecks (e.g. >50% trace latency), and contextual optimization recommendations.
5. **Model Tool Suite**: 9 deterministic tools (`otlp_start_span`, `otlp_end_span`, `otlp_add_event`, `otlp_get_waterfall`, `otlp_get_flamegraph`, `otlp_find_bottlenecks`, `otlp_export_trace`, `otlp_configure`, `otlp_get_health`).

## Consequences
- Full W3C-compliant distributed tracing across all agent frames and tools.
- Immediate visual discovery of execution bottlenecks without external APM tooling.
- Zero allocation footprint during hot-path trace propagation.
