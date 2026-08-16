# ADR-109: Async Context Propagation, Security Callback Inheritance & Fail-Closed Approval Lifecycle Subsystem

## Status
**ACCEPTED** (Phase 133 / Target #66)

## Context
When AI agents dispatch commands to worker threads, background queues, or detached asynchronous execution loops, context variables (`ContextVars` / `AsyncLocalStorage`) and thread-local security approval/sudo callbacks are frequently lost.

Losing this context causes critical security risks:
1. Approval callbacks for dangerous commands (e.g. `rm -rf`, `chmod +s`, `curl | bash`, raw sudo) are lost, causing non-interactive background executors to either fail open or execute without authorization.
2. Sudo password prompts cannot reach the interactive user.
3. Threads in persistent worker pools hold onto stale references to disposed CLI or session instances, leaking memory.
4. Subsystems need frame-perfect snapshotting and instant state rollback ($<0.05\text{ ms SLA}$) with ultra-high-throughput context dispatching ($>1,000,000\text{ ops/sec}$).

## Decision
We implement a zero-GC, typed, deterministic Async Context Propagation Subsystem in **LUMI-JOY**:
1. **Core Contracts (`thread-context.contracts.ts`)**:
   - Defines `SecurityApprovalCallback`, `SudoPasswordCallback`, `AsyncTurnContextDescriptor`, `ContextPropagationConfig`, `ExecutionDispatchEvent`, `ContextPropagationMetrics`, and `ThreadContextWorkspaceSnapshot`.
2. **In-Memory Substrate & Snapshots (`broccoli-thread-context-substrate.ts`, `thread-context-snapshot-manager.ts`)**:
   - In-memory Broccolidb repository tracking active execution contexts, audit ledgers, fail-closed block counters, and binary snapshotting with $<0.05\text{ ms SLA}$ rollback.
3. **Deterministic Engine (`deterministic-thread-context-engine.ts`)**:
   - Uses `AsyncLocalStorage` to store active contexts, wraps async functions for child worker propagation (`propagateContext()`), and enforces fail-closed approval evaluation.
4. **Supervisor (`thread-context-supervisor.ts`)**:
   - Coordinates context lifecycle (`spawnContext()`, `runInContext()`, `wrapWorkerDispatch()`, `requestDangerousApproval()`, `requestSudo()`), guaranteeing automatic reference cleanup on exit.
5. **Model Tool Suite (`thread-context-tool-suite.ts`)**:
   - Exposes 5 model tools (`thread_context_inspect`, `thread_context_request_approval`, `thread_context_verify_propagation`, `thread_context_configure`, `thread_context_get_metrics`).
6. **Grand Monolith Expansion**:
   - Monolith expanded from **504 to 509 components** in optimal alphabetical cohesion.

## Consequences
- Guaranteed preservation of parent security approval and sudo callbacks across all asynchronous worker dispatches.
- Strict fail-closed execution if approval callbacks are missing or throw errors.
- Automatic zero-leak cleanup upon worker task completion.
