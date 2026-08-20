# ADR-068: Phase 47 Osmosis Evolution — Broccoli Retention Cleanup Service & Task Coordinator

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 47 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 47 completes the zero-dependency Osmosis distillation of workspace memory retention garbage collection and multi-worker task orchestration from `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Retention Cleanup Service (`BroccoliRetentionCleanupService`)**: Automatic workspace garbage collection (`runBackgroundCleanup`, `purgeStaleLocks`, `cleanupTempFiles`), pruning stale locks, orphan scratchpad files, and expired cache buffers without external libraries. Directly embedded inside `StabilityDoctor`.
2. **Broccoli Task Coordinator (`BroccoliTaskCoordinator`)**: Task orchestration across subagents (`dispatchTask`, `monitorHeartbeats`, `reconcileTasks`), worker heartbeat monitoring, and subagent state reconciliation without third-party libraries. Directly embedded inside `AgentSwarmDispatcher`.

---

## Architectural Changes

### 1. Integrity Subsystem (`src/sessions/extensions/integrity/broccolidb-retention-cleanup.ts` & `stability-doctor.ts`)
- **Retention Memory & Lock Cleanup**: Prunes stale lock files and temporary sidechain files on unref'd interval timers (`runBackgroundCleanup`).

### 2. Swarm Subsystem (`src/agents/extensions/swarm/broccolidb-task-coordinator.ts` & `agent-swarm-dispatcher.ts`)
- **Subagent Task Orchestration**: Tracks subagent worker dispatching, heartbeat pings (`recordHeartbeat`), and stale worker eviction (`monitorHeartbeats`).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliRetentionCleanupService` and `BroccoliTaskCoordinator` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
