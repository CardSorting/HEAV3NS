# ADR-043: Phase 26 Postmortem Diagnostics & Process Lifecycle Manager (Passes 88–90)

- **Status**: Accepted
- **Date**: 2026-08-09
- **Domain**: Phase 26 Integrity & Process Lifecycle Evolution
- **Authors**: AI Pair Programmer (Osmosis Strategy)

---

## 1. Context & Rationale

In Phase 26 (Passes 88–90), **LUMI-NEW** ingested process exception tracking and crash diagnostic concepts from `pi-main/packages/utils/src/postmortem.ts` and process tree management concepts from `pi-main/packages/utils/src/procmgr.ts`.

These capabilities are absorbed into single-responsibility monolithic extension classes (`PostmortemDiagnostic` and `ProcessLifecycleManager`), granting LUMI-NEW deterministic exception auditing and child process lifecycle control without external monorepo dependencies.

---

## 2. Decision Specifications

### Pass 88: Postmortem Diagnostic (`PostmortemDiagnostic`)
- **Location**: `src/sessions/extensions/integrity/postmortem-diagnostic.ts`
- **Responsibilities**: Captures system exception records, tracks severity levels (`warning`, `error`, `fatal`), and produces diagnostic health reports (`generateReport()`, `hasFatalCrash()`).

### Pass 89: Process Lifecycle Manager (`ProcessLifecycleManager`)
- **Location**: `src/tooling/extensions/permissions/process-lifecycle-manager.ts`
- **Responsibilities**: Tracks spawned child process PIDs (`registerProcess()`), manages graceful/forced process termination (`terminateProcess()`), and handles bulk process cleanup (`killAll()`).

### Pass 90: Phase 26 Grand Subsystem Synthesis & Verification
- **Location**: `src/factories/grand-monolith-synthesizer.ts` & `src/index.ts`
- **Responsibilities**: Verifies end-to-end integration and cohesion across all 90 evolutionary passes.

---

## 3. Verification & Compliance

- **TypeScript Type Safety**: Verified with `npm run check` (0 errors).
- **Runtime Execution**: Verified via `npx tsx src/index.ts` (90 passes verified cleanly).
