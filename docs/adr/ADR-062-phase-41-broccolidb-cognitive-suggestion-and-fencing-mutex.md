# ADR-062: Phase 41 Osmosis Evolution — Broccoli Cognitive Suggestion & Fencing Mutex Engine

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 41 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 41 completes the zero-dependency Osmosis distillation of cognitive prompt suggestions and fencing token distributed lock engines from `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Cognitive Suggestion Engine (`BroccoliCognitiveSuggestionEngine`)**: Context-aware prompt suggestion generation based on active file paths, workspace diagnostics, git status, and MD5 content hashes (`calculateContentHash`). Directly embedded inside `PromptComposer`.
2. **Broccoli Fencing Mutex Engine (`BroccoliFencingMutexEngine`)**: Fault-tolerant distributed resource locking using Sovereign Fencing Tokens, automatic lock annexation for stale processes, and heartbeat timers without external npm libraries. Directly embedded inside `LockAuthorityEngine`.

---

## Architectural Changes

### 1. Intelligence Subsystem (`src/agents/extensions/intelligence/broccolidb-cognitive-suggestion.ts` & `prompt-composer.ts`)
- **Cognitive Edit Suggestions**: Evaluates active file path context and workspace diagnostics to generate prompt suggestions (`generateSuggestions`).

### 2. Substrate Subsystem (`src/sessions/extensions/substrate/broccolidb-fencing-mutex.ts` & `lock-authority.ts`)
- **Sovereign Fencing Mutex**: Manages fencing token lock claims (`acquireLock`), lock release (`releaseLock`), and heartbeat maintenance (`heartbeats`).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliCognitiveSuggestionEngine` and `BroccoliFencingMutexEngine` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
