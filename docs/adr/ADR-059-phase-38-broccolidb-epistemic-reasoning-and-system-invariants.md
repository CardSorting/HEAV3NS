# ADR-059: Phase 38 Osmosis Evolution — Broccoli Epistemic Reasoner & System Invariant Engine

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 38 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 38 completes the zero-dependency distillation of `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Epistemic Reasoning Engine (`BroccoliEpistemicReasoningEngine`)**: Epistemic PageRank (EP-Rank) calculation over knowledge graph nodes with damping factor score propagation, hub score calculation, and contradiction decay without third-party libraries. Directly embedded inside `KnowledgeGraphSubstrate.computeEpistemicPageRank()`.
2. **Broccoli System Invariant Engine (`BroccoliSystemInvariantEngine`)**: Disk surface audits and source code text scanning for banned telemetry database artifacts, dynamic `eval()` usage, and security boundary breaches. Directly embedded inside `StabilityDoctor`.

---

## Architectural Changes

### 1. Intelligence Subsystem (`src/agents/extensions/intelligence/broccolidb-epistemic-reasoning.ts` & `knowledge-graph-substrate.ts`)
- **Epistemic PageRank**: Calculates confidence scores across node relationships (`calculateEpistemicPageRank`), applying multiplier boosts for `supports` edges and decays for `contradicts` edges.

### 2. Integrity Subsystem (`src/sessions/extensions/integrity/broccolidb-system-invariant.ts` & `stability-doctor.ts`)
- **System Invariant Audits**: Scans workspace disk surfaces (`auditDiskInvariants`) and code text (`auditCodeContent`) for banned SQLite queue files and security violations.

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliEpistemicReasoningEngine` and `BroccoliSystemInvariantEngine` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
