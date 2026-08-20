# ADR-066: Phase 45 Osmosis Evolution — Broccoli Execution Trace Recorder & Intent Tracer

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 45 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 45 completes the zero-dependency Osmosis distillation of execution event stream recording and sovereign intent lifecycle tracking from `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Execution Trace Recorder (`BroccoliExecutionTraceRecorder`)**: In-memory telemetry event stream recorder (`emit`, `getEvents`, `clear`), ring-buffer auto-shift (`maxEvents`), and session correlation filtering without external dependencies. Directly embedded inside `TelemetryTracer`.
2. **Broccoli Intent Tracer (`BroccoliIntentTracer`)**: Sovereign intent lifecycle tracker (`startIntent`, `endIntent`, `failIntent`), tracking latency statistics, capability counts, and active intent maps without external libraries. Directly embedded inside `WorkspaceIntelligenceEngine`.

---

## Architectural Changes

### 1. Telemetry Subsystem (`src/tooling/extensions/telemetry/broccolidb-execution-trace.ts` & `telemetry-tracer.ts`)
- **Execution Event Stream Tracing**: Emits structured trace events (`emit`) and filters logs by session identifier (`getEvents`).

### 2. Intelligence Subsystem (`src/agents/extensions/intelligence/broccolidb-intent-tracer.ts` & `workspace-intelligence.ts`)
- **Intent Lifecycle Tracking**: Tracks high-level agent capability intentions, latency metrics, and failure traces (`getHealth`).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliExecutionTraceRecorder` and `BroccoliIntentTracer` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
