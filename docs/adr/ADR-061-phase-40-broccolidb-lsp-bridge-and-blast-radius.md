# ADR-061: Phase 40 Osmosis Evolution — Broccoli LSP Protocol Bridge & Blast Radius Calculator

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 40 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 40 completes the zero-dependency Osmosis distillation of Language Server Protocol bridges and structural blast radius calculation engines from `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli LSP Protocol Bridge (`BroccoliLspProtocolBridge`)**: Stdio JSON-RPC LSP request formatting (`initialize`, `textDocument/definition`, `textDocument/hover`), language server executable maps (`typescript-language-server`, `pyright-langserver`, `gopls`), and diagnostic map indexing without third-party npm libraries. Directly embedded inside `AstPerceptionEyes`.
2. **Broccoli Blast Radius Calculator (`BroccoliBlastRadiusCalculator`)**: Structural blast radius calculation, inverse graph dependency traversal, centrality scoring, and critical dependent list extraction before file mutation events. Directly embedded inside `WorkspaceIntelligenceEngine`.

---

## Architectural Changes

### 1. Tooling Subsystem (`src/tooling/extensions/perception/broccolidb-lsp-bridge.ts` & `ast-eyes.ts`)
- **LSP Stdio JSON-RPC**: Formats JSON-RPC method payloads (`formatJsonRpc`) and registers diagnostic collections (`recordDiagnostic`).

### 2. Agents Subsystem (`src/agents/extensions/intelligence/broccolidb-blast-radius.ts` & `workspace-intelligence.ts`)
- **Inverse Graph Blast Radius**: Traverses inverse dependency edges to compute affected node sets, centrality scores, and critical dependent bottlenecks (`calculateBlastRadius`).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliLspProtocolBridge` and `BroccoliBlastRadiusCalculator` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
