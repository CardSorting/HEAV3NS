# ADR-025: Phase 8 Transport Connection & Remote Session Handle (Passes 34–36)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing RPC transport connection controllers (`packages/client/src/connection.ts`), remote session handles (`packages/client/src/session-handle.ts`), and performing Phase 8 master subsystem synthesis (Passes 34–36) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 8 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 34 (`connection.ts`)**: Client-server transport connection lifecycle state machine and heartbeat ping monitoring (`TransportConnectionController`).
2. **Pass 35 (`session-handle.ts`)**: Client handle proxying turn execution requests over JSON-RPC to a remote `LumiMonolith` gateway server (`RemoteSessionHandle`).
3. **Pass 36 (Phase 8 Master Orchestrator)**: Complete 36-pass master verification suite confirming zero-barrel OOP class extension and 100% subsystem cohesion.

---

## 2. Architectural Decision (The What)

### Non-Destructive Class Extension & Mutation Directory Architecture (`ADR-012`)

Following **ADR-012**:
- `src/tooling/extensions/gateway/transport-connection-controller.ts` (`TransportConnectionController`)
- `src/sessions/extensions/persistence/remote-session-handle.ts` (`RemoteSessionHandle`)
- `src/index.ts` (`LumiMonolith` master composition root)

---

## 3. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean execution of all 36 passes in the deterministic monolith composition root.

---

## Current Refinement: Remote Progress Boundary

`AbortSignal` and `onProgress` are local process controls and must not be serialized in a remote turn request. A remote transport that exposes activity must define explicit subscription/event and cancellation protocol messages, validate the same `EngineProgressEvent` schema, and preserve per-turn ordering. See [ADR-082](ADR-082-structured-agent-activity-streaming.md).
