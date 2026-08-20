# ADR-054: Phase 33 Osmosis Evolution — Context Staleness Tracking & Cognitive Knowledge Graph Substrate

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 33 Osmosis Distillation (`codemarie-new/src` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 33 completes the Osmosis distillation of cognitive freshness tracking and knowledge graph synthesis systems from `/Users/bozoegg/Downloads/codemarie-new/src` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Context Staleness Tracker (`ContextStalenessTracker`)**: In-memory signature calculator and filesystem modification tracker detecting stale context entries.
2. **Cognitive Freshness Guard (`CognitiveFreshnessGuard`)**: Dynamic safety guard preventing prompt composition with outdated workspace content.
3. **Cognitive Knowledge Graph Substrate (`KnowledgeGraphSubstrate`)**: Structured graph representation for workspace entities (`KnowledgeNode`), weighted relationships (`KnowledgeEdge`), BFS graph traversal, tag filtering, and hub-score centrality ranking.

---

## Architectural Changes

### 1. Sessions Subsystem (`src/sessions/extensions/memory/context-staleness-tracker.ts`)
- **Signature Calculation**: Computes bitwise content hash signatures (`calculateSignature`) on file read.
- **Mtime Audit**: Compares file modification timestamps against disk stat to flag stale context entries prior to prompt assembly.

### 2. Agents Subsystem (`src/agents/extensions/intelligence/knowledge-graph-substrate.ts`)
- **Weighted Graph Storage**: Directional adjacency list for graph relationships with `recalculateHubScores` degree centrality.
- **BFS Traversal Engine**: Configurable depth-bounded graph traversal supporting directional filtering (`outbound`, `inbound`, `both`).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `ContextStalenessTracker` and `KnowledgeGraphSubstrate` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
