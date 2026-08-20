# ADR-077: Phase 56 Osmosis Evolution — Broccoli Integrity Protocol & Automated Mode Controller

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 56 Osmosis Distillation (`codemarie` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 56 completes the zero-dependency Osmosis distillation of Triad Audit template generation, semantic compliance validation, and automated state-machine Plan/Act mode switching from `/Users/bozoegg/Downloads/codemarie-new/src/core/` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Integrity Protocol (`BroccoliIntegrityProtocol`)**: Triad Audit template generator (`generateAuditTemplate`), semantic review section headers (`ARCHITECT`, `CRITIC`, `SRE`), and fuzzy section compliance validation without third-party dependencies. Directly embedded inside `BroccoliPlanModeEnforcer`.
2. **Broccoli Automated Mode Controller (`BroccoliAutomatedModeController`)**: Automated Plan/Act state-machine controller (`transitionMode`, `canExecuteToolInMode`, `getModeAdvisory`), enforcing read-only research during Plan Mode and active mutation tracking during Act Mode without third-party libraries. Directly embedded inside `BroccoliUniversalGuard`.

---

## Architectural Changes

### 1. Permissions Subsystem (`src/tooling/extensions/permissions/broccolidb-integrity-protocol.ts` & `broccolidb-universal-guard.ts`)
- **Triad Audit Protocol**: Generates structured audit markdown templates and evaluates section compliance.

### 2. Execution Subsystem (`src/agents/extensions/execution/broccolidb-mode-controller.ts` & `broccolidb-plan-enforcer.ts`)
- **Automated State Machine**: Gated tool execution based on active `plan` vs `act` mode states.

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliIntegrityProtocol` and `BroccoliAutomatedModeController` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
