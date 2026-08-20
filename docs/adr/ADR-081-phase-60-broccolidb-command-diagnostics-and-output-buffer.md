# ADR-081: Phase 60 Osmosis Evolution — Broccoli Command Diagnostics & Output Buffer

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 60 Osmosis Distillation (`codemarie` → `LUMI-NEW`)

---

## Executive Summary

Phase 60 completes the second wave of zero-dependency terminal handling distillation from `/Users/bozoegg/Downloads/codemarie-new/src/integrations/terminal/commandDiagnostics.ts` and `CommandOrchestrator.ts` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:

1. **Broccoli Command Diagnostics (`BroccoliCommandDiagnostics`)**: Non-destructive command failure recovery advisor (`analyzeCommandFailure`) detecting port collisions (`EADDRINUSE`), Git lock contention (`.git/index.lock`), missing commands (exit 127/9009), permission errors (`EACCES`), and missing modules without third-party dependencies. Directly embedded inside `TerminalTextSanitizer`.

2. **Broccoli Command Output Buffer (`BroccoliCommandOutputBuffer`)**: Bounded terminal stream output chunking (`appendChunk`), head/tail summary line retention, byte/line threshold enforcement, and formatted truncation. Provides `getFormattedSummary()` for safe oversized output presentation. Directly embedded inside `TerminalTextSanitizer` via `sanitizeAndBuffer()` pipeline method.

---

## Architectural Changes

### 1. Telemetry Subsystem (`src/tooling/extensions/telemetry/`)

- **`broccolidb-output-buffer.ts`**: New `BroccoliCommandOutputBuffer` class with `appendChunk`, `getRawOutput`, `getFormattedSummary`, and `clear`. Head/tail truncation with configurable `summaryLinesToKeep`, `maxLines`, `maxBytes`.
- **`text-sanitizer.ts`**: `TerminalTextSanitizer` now embeds both `BroccoliCommandOutputBuffer` and `BroccoliCommandDiagnostics` as internal instances. New `sanitizeAndBuffer()`, `getFormattedSummary()`, `clearBuffer()` pipeline methods unify ANSI stripping and bounded stream buffering in a single call.

### 2. Permissions Subsystem (`src/tooling/extensions/permissions/`)

- **`broccolidb-command-diagnostics.ts`**: New `BroccoliCommandDiagnostics` class with `analyzeCommandFailure(command, exitCode, output)` returning `CommandDiagnosticResult { suggestion? }`. Detects port collision, git lock, command-not-found, and permission denied without external libraries.

### 3. Composition Root & Factory (`src/factories/monolith-factory.ts` & `src/index.ts`)

- Integrated both into `MonolithFactory.createEngine()` and exported `BroccoliCommandDiagnostics`, `CommandDiagnosticResult`, `BroccoliCommandOutputBuffer`, `BufferSummaryOptions` from `src/index.ts`.

---

## Conformance & Verification

- TypeScript strict verification passed via `npm run check` with **0 errors** after fixing `erasableSyntaxOnly` violation (replaced constructor parameter property shorthand with explicit field declarations).
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).

---

## Relationship to Agent Activity

Bounded command output and diagnostics remain terminal/debugging facilities. Their raw or aggregated output is not copied into `EngineProgressEvent`. The activity surface may report a sanitized command label, status, elapsed time, and exit code; complete output remains in its dedicated result/diagnostic channel. See [ADR-082](ADR-082-structured-agent-activity-streaming.md).
