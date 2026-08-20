# ADR-020: Phase 3 Master Subsystem Orchestration (Passes 19–21)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing telemetry tracing (`packages/telemetry`), concurrent file locks and snapshot LRU caching (`packages/utils`), and performing Phase 3 master subsystem orchestration (Passes 19–21) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 3 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 19 (`telemetry`)**: OpenTelemetry-compatible microsecond span tracing (`TelemetryTracer`) wrapped around frame ticks.
2. **Pass 20 (`utils`)**: Atomic file lock lease acquisition (`FileLockManager`) and frame snapshot LRU caching (`LruCache`).
3. **Pass 21 (Monolith Orchestrator)**: Complete 21-pass master verification suite confirming zero-barrel OOP inheritance and 100% subsystem cohesion.

---

## 2. Architectural Decision (The What)

### Non-Destructive Class Extension & Mutation Directory Architecture (`ADR-012`)

Following **ADR-012**:
- `src/tooling/extensions/telemetry/telemetry-tracer.ts` (`TelemetryTracer`)
- `src/sessions/extensions/substrate/file-lock.ts` (`FileLockManager`, `LruCache`)
- `src/index.ts` (`LumiMonolith` master composition root)

---

## 3. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean execution of all 21 passes in the deterministic monolith composition root.
