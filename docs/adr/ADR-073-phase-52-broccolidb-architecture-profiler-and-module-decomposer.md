# ADR-073: Phase 52 Osmosis Evolution — Broccoli Workspace Architecture Profiler & Joy-Zoning Module Decomposer

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 52 Osmosis Distillation (`codemarie` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 52 completes the zero-dependency Osmosis distillation of workspace architectural mode resolution, Joy-Zoning header compliance scoring, steering threshold checks, and module decomposition refactoring planning from `/Users/bozoegg/Downloads/codemarie-new/src/core/policy/` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Workspace Architecture Profiler (`BroccoliWorkspaceArchitectureProfiler`)**: Workspace architectural mode detection (`detectProfile`), canonical layer compliance scoring, and Joy-Zoning steering threshold checks (`maxFunctionLines`, `maxClassMethods`) without third-party dependencies. Directly embedded inside `BroccoliAxiomVerifier`.
2. **Broccoli Joy-Zoning Module Decomposer (`BroccoliJoyZoningModuleDecomposer`)**: Joy-Zoning refactoring & decomposition analyzer (`analyzeDecomposition`), structural integrity scoring ($0-100$), logic island extraction, and step-by-step refactoring plan generation (`EXTRACT`, `MOVE`, `DECOUPLE`, `HARDEN`) without third-party libraries. Directly embedded inside `BroccoliMutationPlanner`.

---

## Architectural Changes

### 1. Permissions Subsystem (`src/tooling/extensions/permissions/broccolidb-architecture-profiler.ts`, `broccolidb-module-decomposer.ts`, & `broccolidb-axiom-verifier.ts`)
- **Workspace Architectural Mode Resolution**: Categorizes codebase state into `greenfield`, `joy-zoning`, or `workspace-native`.
- **Joy-Zoning Module Decomposition**: Generates actionable, risk-quantified refactoring plans for monolithic modules.

### 2. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliWorkspaceArchitectureProfiler` and `BroccoliJoyZoningModuleDecomposer` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
