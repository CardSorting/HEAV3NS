# ADR-064: Phase 43 Osmosis Evolution — Broccoli Rollback Coordinator & Inter-Agent Mailbox

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 43 Osmosis Distillation (`broccolidb` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 43 completes the zero-dependency Osmosis distillation of multi-file rollback snapshot recovery and inter-subagent mailbox message queues from `/Users/bozoegg/Downloads/codemarie-new/broccolidb` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Rollback Coordinator (`BroccoliRollbackCoordinator`)**: Pre-mutation snapshot capture (`snapshotBefore`) and atomic multi-file transaction restoration (`restore`) restoring exact text state upon repair failures or abort signals without third-party libraries. Directly embedded inside `NativeMutationTransactionSubstrate`.
2. **Broccoli Inter-Agent Mailbox (`BroccoliInterAgentMailbox`)**: Decentralized inter-subagent mailbox message queue (`postMessage`, `pollInbox`, `postStatus`), FIFO ring buffer bounds, and read state tracking. Directly embedded inside `AgentSwarmDispatcher`.

---

## Architectural Changes

### 1. Substrate Subsystem (`src/sessions/extensions/substrate/broccolidb-rollback-coordinator.ts` & `native-mutation-substrate.ts`)
- **Rollback Snapshots**: Captures file content snapshots prior to file write directives (`snapshotBefore`) and executes multi-file restorations (`restore`).

### 2. Swarm Subsystem (`src/agents/extensions/swarm/broccolidb-inter-agent-mailbox.ts` & `agent-swarm-dispatcher.ts`)
- **Inter-Agent Mailbox Queue**: Manages subagent message posting, status broadcasts, and unread message polling (`pollInbox`).

### 3. Factory & Monolith Composition (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliRollbackCoordinator` and `BroccoliInterAgentMailbox` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
