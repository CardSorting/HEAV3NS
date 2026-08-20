# ADR-067: Phase 46 Osmosis Evolution — Broccoli CAS Scratchpad & Context Diagnosis Service

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 46 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 46 completes the zero-dependency Osmosis distillation of CAS-deduplicated scratchpad stores and epistemic context health diagnostic services from `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli CAS Scratchpad Service (`BroccoliCASScratchpadService`)**: Provides CAS-deduplicated persistent scratchpad storage (`.broccolidb/scratchpad`), atomic lock acquisition (`acquireLock`), and section updating without third-party libraries. Directly embedded inside `BroccoliTaskStateEngine`.
2. **Broccoli Context Diagnosis Service (`BroccoliContextDiagnosisService`)**: Performs epistemic context health audits (`diagnoseContext`), scoring graph health ($0-100$), and tracking stale/unverified/contradictory node counts without third-party libraries. Directly embedded inside `PostmortemDiagnostic`.

---

## Architectural Changes

### 1. Persistence Subsystem (`src/sessions/extensions/persistence/broccolidb-cas-scratchpad.ts` & `broccolidb-task-state.ts`)
- **CAS Scratchpad Storage**: Manages task scratchpads using SHA-256 CAS content hashes (`writeScratchpad`, `readScratchpad`) and file locks (`acquireLock`).

### 2. Integrity Subsystem (`src/sessions/extensions/integrity/broccolidb-context-diagnosis.ts` & `postmortem-diagnostic.ts`)
- **Context Diagnosis Audit**: Evaluates context graph health scores ($0-100$) and flags staleness, unverified nodes, and contradiction conflicts.

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliCASScratchpadService` and `BroccoliContextDiagnosisService` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
