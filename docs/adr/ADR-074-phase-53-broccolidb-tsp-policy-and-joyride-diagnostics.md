# ADR-074: Phase 53 Osmosis Evolution — Broccoli TSP Policy Plugin & JoyRide Diagnostics

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 53 Osmosis Distillation (`codemarie` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 53 completes the zero-dependency Osmosis distillation of AST-level policy enforcement themes (`strict`, `relaxed`, `safety`), exception rule registration, and JoyRide hot-path telemetry diagnostic reporting from `/Users/bozoegg/Downloads/codemarie-new/src/core/` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli TSP Policy Plugin (`BroccoliTspPolicyPlugin`)**: Configurable enforcement theme management (`strict`, `relaxed`, `safety`), exception rule registry (`addExceptionRule`), and real-time architectural policy rule evaluator without third-party dependencies. Directly embedded inside `BroccoliAxiomVerifier`.
2. **Broccoli JoyRide Diagnostics (`BroccoliJoyRideDiagnostics`)**: Hot-path telemetry diagnostic reporting (`buildDiagnosticReport`), tracking cache hit/miss ratios, degraded performance triggers, and pressure trim events without third-party libraries. Directly embedded inside `JoyRideHotPathCache`.

---

## Architectural Changes

### 1. Permissions Subsystem (`src/tooling/extensions/permissions/broccolidb-tsp-policy.ts` & `broccolidb-axiom-verifier.ts`)
- **Theme-Based Enforcement**: Manages AST-level policy strictness rules based on project safety profiles (`evaluatePolicy`).

### 2. Cache Subsystem (`src/tooling/extensions/cache/broccolidb-joyride-diagnostics.ts` & `joyride-cache.ts`)
- **Hot-Path Telemetry Audit**: Computes hit ratios, tracks memory pressure trims, and produces Maintainer diagnostic snapshots (`buildDiagnosticReport`).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliTspPolicyPlugin` and `BroccoliJoyRideDiagnostics` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
