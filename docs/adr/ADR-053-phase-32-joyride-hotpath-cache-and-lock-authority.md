# ADR-053: Phase 32 Osmosis Evolution — JoyRide Hot-Path Cache & Lock Authority Governance

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 32 Osmosis Distillation (`codemarie-new/src` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 32 completes the Osmosis distillation of production performance and multi-agent resource safety systems from `/Users/bozoegg/Downloads/codemarie-new/src` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **JoyRide Hot-Path Execution Cache (`JoyRideHotPathCache`)**: Zero-GC, LRU memory-budgeted cache for read-only command executions and workspace symbol inspection with automatic regex secret redaction.
2. **Command Safety Classifier (`HotPathCommandClassifier`)**: Real-time safety classification dividing CLI invocations into `safe_readonly`, `workspace_mutating`, and `system_dangerous`.
3. **Lock Authority Engine (`LockAuthorityEngine`)**: Fine-grained workspace file locking substrate with lease epoch enforcement, fencing tokens (`BroccoliFencingSubstrate`), and stale lock recovery.

---

## Architectural Changes

### 1. Tooling Subsystem (`src/tooling/extensions/cache/joyride-cache.ts`)
- **Memory Budgeting**: Default 32MB cap with LRU eviction when bytes exceed configured budget.
- **Secret Redaction**: Automatic sanitization of tokens (`sk-ant-`, `sk-`, `AIza`, `Bearer`, private keys) prior to caching.
- **Command Safety Classification**: Filters read-only CLI calls (`git status`, `grep`, `cat`, `ls`) for sub-millisecond execution bypass.

### 2. Sessions Subsystem (`src/sessions/extensions/substrate/lock-authority.ts`)
- **Fencing Token Preservation**: Generates epoch-stamped fencing tokens to eliminate split-brain write collisions across concurrent subagent tasks.
- **Stale Lock Recovery**: Automatic eviction of expired claims (`recoverStaleLocks`) ensuring deadlock-free workspace operations.

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `JoyRideHotPathCache` and `LockAuthorityEngine` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
