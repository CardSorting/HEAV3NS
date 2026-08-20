# ADR-055: Phase 34 Osmosis Evolution — Lumi Ignore Policy & Native Mutation Substrate

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 34 Osmosis Distillation (`codemarie-new/src` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 34 completes the Osmosis distillation of workspace ignore policy control and safe native file mutation transactions from `/Users/bozoegg/Downloads/codemarie-new/src` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Lumi Ignore Policy Controller (`LumiIgnorePolicyController`)**: Standard `.lumiignore` / `.gitignore` pattern matcher, inclusion overrides, policy generation counters, and LRU access decision caching (4096 entry limit).
2. **Workspace Symlink Boundary Checker (`isPathInWorkspace`)**: Real-time path traversal & symlink escape detection resolving real paths against workspace roots.
3. **Normalized Content Hashing (`getNormalizedHash`)**: Cross-platform SHA-256 line-ending invariant file hashing.
4. **Native Mutation Substrate (`NativeMutationTransactionSubstrate`)**: Atomic staging file mutations and transaction rollback buffers.

---

## Architectural Changes

### 1. Tooling Subsystem (`src/tooling/extensions/permissions/lumi-ignore-controller.ts`)
- **Ignore Pattern Rules**: Evaluates `.lumiignore`, `.dietcodeignore`, and `.gitignore` file rules with negation (`!`) support.
- **Access Cache**: Fast path decision caching up to 4096 relative file paths to eliminate redundant regex evaluation overhead.

### 2. Sessions Subsystem (`src/sessions/extensions/substrate/native-mutation-substrate.ts`)
- **Symlink Escape Guard**: Recursively resolves target ancestor directories via `fs.realpath` to prevent path traversal attacks outside workspace boundaries.
- **Rollback Buffers**: Stores preceding file states (`MutationTransaction`) to enable immediate atomic undo/rollback actions.

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `LumiIgnorePolicyController` and `NativeMutationTransactionSubstrate` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
