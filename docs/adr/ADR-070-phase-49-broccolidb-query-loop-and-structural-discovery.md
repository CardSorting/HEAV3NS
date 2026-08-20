# ADR-070: Phase 49 Osmosis Evolution — Broccoli Query Loop Orchestrator & Structural Discovery Service

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 49 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 49 completes the zero-dependency Osmosis distillation of autonomous query loop state management and workspace dependency graph structural discovery from `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Query Loop Orchestrator (`BroccoliQueryLoopOrchestrator`)**: Autonomous agent query loop state machine tracking turn count, tool rounds, token usage, and automatic compaction barrier checks at 80% context window limits without external libraries. Directly embedded inside `LoopPhaseController`.
2. **Broccoli Structural Discovery Service (`BroccoliStructuralDiscoveryService`)**: Structural graph dependency analysis (`getBlastRadius`, incremental inverse graph mapping, centrality score calculation) without third-party libraries. Directly embedded inside `BroccoliBlastRadiusCalculator`.

---

## Architectural Changes

### 1. Execution Subsystem (`src/agents/extensions/execution/broccolidb-query-loop.ts` & `loop-phase-controller.ts`)
- **Query Loop State Machine**: Manages turn iterations, tool execution rounds, token accumulators, and compaction barrier states (`advanceTurn`).

### 2. Perception Subsystem (`src/tooling/extensions/perception/broccolidb-structural-discovery.ts` & `broccolidb-blast-radius.ts`)
- **Structural Dependency Indexing**: Computes inverse import dependency trees, node centrality scores, and blast radius affected lists (`getBlastRadius`).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliQueryLoopOrchestrator` and `BroccoliStructuralDiscoveryService` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
