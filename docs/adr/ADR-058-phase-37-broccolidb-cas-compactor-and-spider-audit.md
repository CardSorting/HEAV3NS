# ADR-058: Phase 37 Osmosis Evolution — Broccoli CAS Compactor & Spider Audit Engine

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 37 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 37 continues the zero-dependency Osmosis distillation of `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli CAS & Brotli Compacting Substrate (`BroccoliCasCompactor`)**: Content-addressable SHA-256 blob storage, Brotli compression/decompression via native `node:zlib`, immutable context projection DAGs, and blob hash verification. Directly embedded inside `SessionCompactor`.
2. **Broccoli Spider Forensic Audit Engine (`BroccoliSpiderAuditEngine`)**: 2-phase structural audits, ghost symbol detection, file reality verification (VFS vs physical disk stat), and topology link graph verification without external AST parsers. Directly embedded inside `WorkspaceIntelligenceEngine`.

---

## Architectural Changes

### 1. Sessions Subsystem (`src/sessions/extensions/compaction/broccolidb-cas-compactor.ts` & `session-compactor.ts`)
- **CAS Blob Repository**: Deduplicates identical code payloads using SHA-256 hashes (`sha256`) and compresses payloads larger than 2KB using Brotli.
- **Projection DAGs**: Tracks parent/child lineage graphs (`parentProjectionId`) for context compression windows.

### 2. Intelligence Subsystem (`src/agents/extensions/intelligence/broccolidb-spider-audit.ts` & `workspace-intelligence.ts`)
- **Spider Forensic Audits**: Scans JS/TS code for unresolved import references, ghost symbol placeholders, and physical file disk absence (Two-Lock Check).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliCasCompactor` and `BroccoliSpiderAuditEngine` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
