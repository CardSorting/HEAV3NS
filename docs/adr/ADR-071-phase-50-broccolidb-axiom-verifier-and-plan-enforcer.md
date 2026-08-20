# ADR-071: Phase 50 Osmosis Evolution — Broccoli Axiom Verifier & Plan Mode Enforcer

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 50 Osmosis Distillation (`codemarie` / `broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 50 completes the zero-dependency Osmosis distillation of architectural layer header verification and strategic plan mode drafting enforcement from `/Users/bozoegg/Downloads/codemarie-new/src/core/policy/` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Axiom Verifier (`BroccoliAxiomVerifier`)**: Architectural layer header validation (`getFileLayerContext`, `getCorrectionHint`), layer tagging discipline (`[LAYER: DOMAIN/CORE/INFRASTRUCTURE]`), and boundary leak hints without external dependencies. Directly embedded inside `BroccoliApprovalPolicyEngine`.
2. **Broccoli Plan Mode Enforcer (`BroccoliPlanModeEnforcer`)**: Integrity drafting workflow enforcement (`enforceStrategicReview`, Triad Audit validation), scratchpad advisory checks, and sovereign bypass verification without third-party libraries. Directly embedded inside `BroccoliMutationPlanner`.

---

## Architectural Changes

### 1. Permissions Subsystem (`src/tooling/extensions/permissions/broccolidb-axiom-verifier.ts` & `broccolidb-approval-policy.ts`)
- **Axiomatic Layer Tag Audit**: Validates layer header compliance (`verifyLayerTag`) and generates hints for architectural boundary violations.

### 2. Execution Subsystem (`src/agents/extensions/execution/broccolidb-plan-enforcer.ts` & `broccolidb-mutation-planner.ts`)
- **Strategic Plan Drafting Enforcement**: Checks `scratchpad.md` for Architect, Critic, and SRE Triad Audits (`enforceStrategicReview`).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliAxiomVerifier` and `BroccoliPlanModeEnforcer` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
