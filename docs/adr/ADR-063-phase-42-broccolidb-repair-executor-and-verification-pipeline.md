# ADR-063: Phase 42 Osmosis Evolution — Broccoli Repair Executor & Verification Pipeline

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 42 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 42 completes the zero-dependency Osmosis distillation of repair mutation execution and post-edit verification pipelines from `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Repair Mutation Executor (`BroccoliRepairMutationExecutor`)**: Sole authorized repair directive mutation path (`applyDirective`, `execute`), executing multi-step repair plans transactionally with trace tracking (`appliedSteps`, `skippedSteps`). Directly embedded inside `AgentLoopHarness`.
2. **Broccoli Verification Pipeline (`BroccoliVerificationPipeline`)**: 2-phase post-mutation code verification comparing baseline findings vs post-mutation findings (`introducedFindings`, `resolvedFindings`), invariant compliance checks, and gate status evaluation. Directly embedded inside `PostmortemDiagnostic`.

---

## Architectural Changes

### 1. Execution Subsystem (`src/agents/extensions/execution/broccolidb-repair-executor.ts` & `agent-loop-harness.ts`)
- **Transactional Repair Mutation**: Executes multi-step repair plans on disk transactionally and tracks execution step statuses (`execute`).

### 2. Intelligence Subsystem (`src/agents/extensions/intelligence/broccolidb-verification-pipeline.ts` & `postmortem-diagnostic.ts`)
- **Post-Mutation Verification**: Evaluates introduced vs resolved findings between pre-mutation baseline and post-mutation code audits (`verify`).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliRepairMutationExecutor` and `BroccoliVerificationPipeline` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
