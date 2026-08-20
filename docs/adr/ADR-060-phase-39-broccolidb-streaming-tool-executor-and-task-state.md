# ADR-060: Phase 39 Osmosis Evolution — Broccoli Streaming Tool Executor & Task State Engine

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 39 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 39 completes the zero-dependency Osmosis distillation of streaming tool execution and task sidechain state engines from `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Streaming Tool Executor (`BroccoliStreamingToolExecutor`)**: Multi-phase tool execution lifecycle management (`queued` $\rightarrow$ `validating` $\rightarrow$ `running` $\rightarrow$ `completed`/`failed`/`timeout`), native timeout cancellation via `AbortController`, and progress callbacks (`onProgress`). Directly embedded inside `ValidatingToolRegistry`.
2. **Broccoli Task State Engine (`BroccoliTaskStateEngine`)**: Sovereign Scratchpad persistence (`SOFT_STATE.md`), task sidechain outputs (`tasks/${taskId}.output`), and atomic disk writes using native Node standard library. Directly embedded inside `PersistentSessionStore`.

---

## Architectural Changes

### 1. Tooling Subsystem (`src/tooling/extensions/registry/broccolidb-streaming-tool-executor.ts` & `tool-registry.ts`)
- **Streaming Tool Lifecycle**: Evaluates phase states and races execution promises against `AbortController` timeout timers (`executeWithLifecycle`).

### 2. Sessions Subsystem (`src/sessions/extensions/persistence/broccolidb-task-state.ts` & `session-store.ts`)
- **Task Sidechain State**: Manages `.broccolidb/SOFT_STATE.md` and `.broccolidb/tasks/${taskId}.output` task state persistence.

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliStreamingToolExecutor` and `BroccoliTaskStateEngine` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).

---

## Relationship to Provider Activity Streaming

`ToolExecutionProgress` describes one local registered tool's queued/validating/running/terminal lifecycle. `EngineProgressEvent` describes the user-facing provider turn and may summarize a provider-reported command or tool item. These contracts are deliberately separate; adapters may bridge a safe subset without forwarding raw tool input or output. See [ADR-082](ADR-082-structured-agent-activity-streaming.md).
