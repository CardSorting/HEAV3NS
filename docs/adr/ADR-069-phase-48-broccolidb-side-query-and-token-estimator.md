# ADR-069: Phase 48 Osmosis Evolution — Broccoli Side Query Service & Token Estimator

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 48 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 48 completes the zero-dependency Osmosis distillation of isolated side query evaluations and adaptive character-ratio token estimation heuristics from `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Side Query Service (`BroccoliSideQueryService`)**: Isolated out-of-band reasoning query evaluations (`executeIsolatedReasoning`), intent classification (`classifyIntent`), and policy pre-audits without mutating turn state. Directly embedded inside `BroccoliMutationPlanner`.
2. **Broccoli Token Estimator (`BroccoliTokenEstimator`)**: Adaptive character-ratio token estimation heuristics (`estimateTokens`, `roughTokenCountEstimation`), token budget overflow checking, and message token calculations without third-party libraries. Directly embedded inside `TokenBucketRateGovernor`.

---

## Architectural Changes

### 1. Execution Subsystem (`src/agents/extensions/execution/broccolidb-side-query.ts` & `broccolidb-mutation-planner.ts`)
- **Side Query & Intent Classification**: Out-of-band query evaluation and fast heuristic intent tagging (`classifyIntent`).

### 2. Policy Subsystem (`src/tooling/extensions/policy/broccolidb-token-estimator.ts` & `broccoli-circuit-breaker.ts`)
- **Token Estimation & Budget Guard**: Fast character-ratio token counting and budget bounds evaluation (`evaluateBudget`).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliSideQueryService` and `BroccoliTokenEstimator` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
