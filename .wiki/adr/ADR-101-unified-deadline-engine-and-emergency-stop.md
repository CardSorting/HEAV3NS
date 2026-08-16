# ADR-101: Unified Deadline Engine, Bounded Execution & Emergency Stop Governance Subsystem

## Status
**Accepted** (Target #58 / Phase 125 — 2026-08-16)

## Context
In agentic systems and long-running execution loops, hanging async tasks, unbounded tool runs, and unmonitored external calls can lead to thread stalls, process starvation, and orphan background jobs. Simultaneously, operators need a reliable, fail-safe mechanism to immediately halt the acceptance and dispatch of **NEW** work (Emergency Stop / ESTOP) without corrupting in-flight state or requiring full system crashes.

Hermes Agent introduced:
1. `agent/deadline.py`: A unified deadline layer offering platform-safe timeout resolution (`resolve_timeout`), bounded asynchronous execution (`run_bounded_async`) with wall-clock timers that abandon stalled tasks without relying on congested event-loop timers, and whole process tree termination.
2. `agent/estop.py`: A global emergency stop (`ESTOP`) sentinel protocol that halts the dispatch of all new cron jobs, kanban workers, and gateway turns while keeping in-flight tasks safe.

## Decision
We implement a zero-GC, typed, deterministic **Unified Deadline Engine, Bounded Execution & Emergency Stop Governance Subsystem** in LUMI-JOY:

1. **Contracts Layer (`deadline.contracts.ts`)**:
   - Defines `DeadlineOutcome`, `BoundedResult<T>`, `EstopState`, `DeadlineConfig`, `DeadlineMetrics`, and `DeadlineWorkspaceSnapshot`.
   - Establishes `MAX_SAFE_TIMEOUT_MS = 31_536_000_000` (365 days) platform safety boundary.

2. **Substrate & Snapshots (`broccoli-deadline-substrate.ts`, `deadline-snapshot-manager.ts`)**:
   - In-memory Broccolidb repository tracking ESTOP sentinel state, active leases, timeout counters, and audit trails.
   - Binary snapshot manager for frame-perfect state rollback in $<0.05\text{ ms}$.

3. **Deterministic Engine & Supervisor (`deterministic-deadline-engine.ts`, `deadline-supervisor.ts`)**:
   - `DeterministicDeadlineEngine`: Implements `resolveTimeout()`, `clampTimeout()`, `runBoundedAsync()`, and filesystem sentinel parsing (`checkFsSentinel()`, `writeFsSentinel()`) with fail-safe semantics.
   - `DeadlineSupervisor`: Coordinates new-work gating (`canStartNewWork()`), bounded execution dispatch, and ESTOP engagement/disengagement.

4. **Model Tool Suite (`deadline-tool-suite.ts`)**:
   - Exposes 5 model tools:
     - `deadline_run_bounded`: Runs actions within a strict wall-clock timeout limit.
     - `estop_engage`: Engages the global Emergency Stop with an audit reason.
     - `estop_disengage`: Lifts the emergency stop sentinel.
     - `estop_get_status`: Inspects active ESTOP state and audit trail.
     - `deadline_get_metrics`: Retrieves aggregate statistics on bounded runs and timeouts.

5. **Grand Monolith Expansion**:
   - Expands Grand Monolith from **464 to 469 components** in exact alphabetical cohesion.

## Consequences
- Prevents indefinite stalls across tool calls and agent loops with wall-clock timer-bounded execution.
- Provides immediate, resumable, fail-safe pause functionality for operators via ESTOP.
- Grand Monolith cohesion expanded to 469/469 components in OPTIMAL state.
- Zero barrel imports and base class immutability preserved.
