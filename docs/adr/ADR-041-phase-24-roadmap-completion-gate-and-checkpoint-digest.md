# ADR-041: Phase 24 Roadmap Completion Gate & Checkpoint Digest (Passes 82–84)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing roadmap quality gate evaluation (`RoadmapCompletionGate` from `packages/codemarie/src/services/roadmap`), milestone checksum digest calculation (`RoadmapCheckpointDigest` from `packages/codemarie/src/services/roadmap`), and performing Phase 24 master subsystem synthesis (Passes 82–84) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 24 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 82**: Roadmap quality gate evaluation engine (`RoadmapCompletionGate`).
2. **Pass 83**: Milestone cryptographic checksum digest calculator (`RoadmapCheckpointDigest`).
3. **Pass 84**: Phase 24 master subsystem synthesis verification.

---

## 2. Architectural Decision (The What)

Following **ADR-012**:
- `src/tooling/extensions/policy/roadmap-completion-gate.ts` (`RoadmapCompletionGate`)
- `src/tooling/extensions/policy/roadmap-checkpoint-digest.ts` (`RoadmapCheckpointDigest`)
- `src/index.ts` (`LumiMonolith` master composition root)

## Current Completion Semantics

`RoadmapCompletionGate` is fail-closed. A gate is allowed to proceed only when it is registered, contains at least one criterion and at least one required criterion, and every required criterion has been explicitly evaluated and passed. Unregistered, empty, optional-only, unevaluated, or failed-required gates are incomplete. Criterion input and evaluation output are copied so later caller mutation cannot silently rewrite recorded gate evidence; duplicate or empty criterion identifiers are rejected at registration.
