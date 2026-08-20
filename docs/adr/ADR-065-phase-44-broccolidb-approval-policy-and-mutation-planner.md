# ADR-065: Phase 44 Osmosis Evolution — Broccoli Approval Policy Engine & Mutation Planner

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 44 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 44 completes the zero-dependency Osmosis distillation of mutation approval policies and plan generation engines from `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Approval Policy Engine (`BroccoliApprovalPolicyEngine`)**: Evaluates mutation plans against risk levels (`low`, `medium`, `high`) and policy modes (`readonly`, `production_locked`, `human_approval_required`, `ci_gate_only`, `autonomous_safe`) throwing `PolicyBlockedError` when violated. Directly embedded inside `LumiIgnorePolicyController`.
2. **Broccoli Mutation Planner (`BroccoliMutationPlanner`)**: Constructs mutation step sequences (`planFromAudit`), calculates aggregate plan risk (`maxRisk`), and assigns required verification commands without third-party libraries. Directly embedded inside `BroccoliRepairMutationExecutor`.

---

## Architectural Changes

### 1. Tooling Subsystem (`src/tooling/extensions/permissions/broccolidb-approval-policy.ts` & `lumi-ignore-controller.ts`)
- **Approval Policy Evaluation**: Evaluates mutation plans against policy modes (`readonly`, `production_locked`, `human_approval_required`, `ci_gate_only`, `autonomous_safe`) and risk levels.

### 2. Execution Subsystem (`src/agents/extensions/execution/broccolidb-mutation-planner.ts` & `broccolidb-repair-executor.ts`)
- **Mutation Step Planning**: Converts audit directives into mutation plans (`planFromAudit`) with risk level calculations (`maxRisk`).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliApprovalPolicyEngine` and `BroccoliMutationPlanner` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
