# ADR-057: Phase 36 Osmosis Evolution — Zero-Dependency BroccoliDB Monolithic Substrate

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 36 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 36 lifts operational substrate, task DAG scheduling, and runtime circuit breaking from `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src` under a **Refined Zero-Dependency Osmosis Strategy**.

This pass replaces 9 external npm dependencies (`better-sqlite3`, `kysely`, `@modelcontextprotocol/sdk`, `ts-morph`, `simple-git`, `chalk`, `chokidar`, `ignore`, `ora`) with pure native TypeScript modules:
1. **Broccoli Substrate Store (`BroccoliSubstrateStore`)**: Operational database and key-value store supporting entity query filters, JSON snapshot persistence, and atomic transaction rollback checkpoints (`createCheckpoint` / `rollbackToCheckpoint`).
2. **Broccoli Task DAG Scheduler (`BroccoliTaskDagScheduler`)**: Topological sort task execution engine (`dependsOnTaskIds`), dependency graph validation, and failure cascade handling.
3. **Broccoli Circuit Breaker & Rate Governor (`BroccoliCircuitBreaker` & `TokenBucketRateGovernor`)**: Tool execution circuit breaker auto-tripping on repeated failures, and token-bucket rate governor.

---

## Architectural Changes

### 1. Sessions Subsystem (`src/sessions/extensions/substrate/broccoli-substrate-store.ts`)
- **Zero-Dependency Persistence**: Pure TypeScript entity store managing table queries (`query`), JSON file loading/saving (`persistToDisk`), and transaction checkpoints.

### 2. Swarm Subsystem (`src/agents/extensions/swarm/broccoli-task-dag-scheduler.ts` & `agent-swarm-dispatcher.ts`)
- **DAG Execution Queue**: Evaluates upstream task statuses (`getReadyTasks`), marks completion, and cascade-skips downstream dependencies on error (`markFailed`).

### 3. Policy & Registry Subsystem (`src/tooling/extensions/policy/broccoli-circuit-breaker.ts` & `registry/tool-registry.ts`)
- **Circuit Breaker Integration**: Intercepts tool calls in `ValidatingToolRegistry.executeTool()`, tripping when consecutive failures cross the threshold to prevent subagent failure loops.

### 4. Composition Root & Monolith Integration (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated all BroccoliDB components into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
