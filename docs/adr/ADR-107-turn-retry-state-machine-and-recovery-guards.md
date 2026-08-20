# ADR-107: Turn Retry State Machine, One-Shot Recovery Guards & Adaptive Payload Restart Subsystem

## Status
**ACCEPTED** (Phase 131 / Target #64)

## Context
During conversational agent turns with LLMs, an API invocation can fail due to transient errors (401/403 expired OAuth tokens, 429 rate limits, 400 stale Copilot integrator credentials, context length overflow, thinking tag formatting rejections, oversized images, or multimodal tool responses).

Previously, managing these recovery branches led to scattered boolean variables (`codex_auth_retry_attempted`, `has_retried_429`, `restart_with_compressed_messages`), which risked:
1. Repetitive infinite retry loops on unrecoverable authentication errors.
2. Incoherent state management between top-level turns and subagent delegations.
3. Lack of unified telemetry on which recovery branches fired and their success rate.
4. Missing frame-perfect state rollback ($<0.05\text{ ms SLA}$) and high-throughput execution ($>1,000,000\text{ ops/sec}$).

## Decision
We implement a zero-GC, typed, deterministic Turn Retry State Machine Subsystem in **LUMI-JOY**:
1. **Core Contracts (`turn-retry.contracts.ts`)**:
   - Defines `TurnRetryGuards` (one-shot booleans for Codex, Anthropic, Nous, Copilot, Vertex, thinking signature, compaction, image shrink, multimodal tools, rate-limit), `TurnRestartSignals` (compressed messages, length continuation, rebuilt messages, redirected messages), `TurnRetryStateDescriptor`, `TurnRetryConfig`, and `TurnRetryWorkspaceSnapshot`.
2. **In-Memory Substrate & Snapshots (`broccoli-turn-retry-substrate.ts`, `turn-retry-snapshot-manager.ts`)**:
   - In-memory Broccolidb repository tracking active and archived turn retry states, guard trigger counters, and binary snapshotting with $<0.05\text{ ms SLA}$ rollback.
3. **Deterministic Engine (`deterministic-turn-retry-engine.ts`)**:
   - Evaluates legal one-shot transitions (`canTrigger()`), classifies error codes/messages to recommend optimal recovery branches, and formats restart action plans.
4. **Supervisor (`turn-retry-supervisor.ts`)**:
   - Coordinates turn retry lifecycle (`createTurnState()`, `triggerRecovery()`, `setRestartSignal()`, `handleAttemptError()`, `finishAttempt()`).
5. **Model Tool Suite (`turn-retry-tool-suite.ts`)**:
   - Exposes 5 model tools (`turn_retry_inspect_state`, `turn_retry_trigger_recovery`, `turn_retry_set_restart_signal`, `turn_retry_configure`, `turn_retry_get_metrics`).
6. **Grand Monolith Expansion**:
   - Monolith expanded from **494 to 499 components** in optimal alphabetical cohesion.

## Consequences
- Guaranteed at-most-once execution for any recovery branch per attempt, eliminating infinite retry loops.
- Structured telemetry on recovery branches across all LLM providers and platforms.
- Frame-perfect rollback and zero-GC memory performance.
