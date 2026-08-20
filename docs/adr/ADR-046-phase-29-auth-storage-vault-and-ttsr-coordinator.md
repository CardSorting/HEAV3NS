# ADR-046: Phase 29 Auth Storage Vault & TTSR Coordinator (Passes 97–99)

- **Status**: Accepted
- **Date**: 2026-08-09
- **Domain**: Phase 29 Authentication & Response Telemetry Evolution
- **Authors**: AI Pair Programmer (Osmosis Strategy)

---

## 1. Context & Rationale

In Phase 29 (Passes 97–99), **LUMI-NEW** ingested runtime authentication credential storage & token vault concepts from `pi-main/packages/coding-agent/src/core/auth-storage.ts` and Time-To-Second-Response (TTSR) latency tracking concepts from `pi-main/packages/coding-agent/src/core/ttsr-coordinator.ts`.

These capabilities are absorbed into single-responsibility monolithic extension classes (`AuthStorageVault` and `TTSRCoordinator`), providing LUMI-NEW credential management and response milestone latency tracking without external monorepo dependencies.

---

## 2. Decision Specifications

### Pass 97: Auth Storage Vault (`AuthStorageVault`)
- **Location**: `src/agents/extensions/resolution/auth-storage-vault.ts`
- **Responsibilities**: Safely stores API keys and OAuth tokens (`setToken()`), retrieves active credentials (`getToken()`), verifies provider authorization (`hasToken()`), and clears expired credentials (`clearToken()`).

### Pass 98: TTSR Coordinator (`TTSRCoordinator`)
- **Location**: `src/tooling/extensions/telemetry/ttsr-coordinator.ts`
- **Responsibilities**: Tracks execution turn start (`markStart()`), logs Time-To-First-Byte (`markFirstByte()`), records Time-To-Second-Response (`markSecondResponse()`), and computes stream latency stats (`getLatencyStats()`).

### Pass 99: Phase 29 Grand Subsystem Synthesis & Verification
- **Location**: `src/factories/grand-monolith-synthesizer.ts` & `src/index.ts`
- **Responsibilities**: Verifies end-to-end integration and cohesion across all 99 evolutionary passes.

---

## 3. Verification & Compliance

- **TypeScript Type Safety**: Verified with `npm run check` (0 errors).
- **Runtime Execution**: Verified via `npx tsx src/index.ts` (99 passes verified cleanly).
