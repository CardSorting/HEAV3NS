# ADR-022: Phase 5 Environment Key & Image Model Registry (Passes 25–27)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing environment API key resolution (`packages/ai/src/env-api-keys.ts`), image model metadata capabilities (`packages/ai/src/image-models.ts`), and performing Phase 5 master subsystem synthesis (Passes 25–27) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 5 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 25 (`env-api-keys`)**: Provider API key inspection and masked status reporting (`EnvironmentKeyResolver`).
2. **Pass 26 (`image-models`)**: Image generation model specs and supported aspect ratio capability indexing (`ImageModelRegistry`).
3. **Pass 27 (Phase 5 Master Orchestrator)**: Complete 27-pass master verification suite confirming zero-barrel OOP class extension and 100% subsystem cohesion.

---

## 2. Architectural Decision (The What)

### Non-Destructive Class Extension & Mutation Directory Architecture (`ADR-012`)

Following **ADR-012**:
- `src/agents/extensions/resolution/environment-key-resolver.ts` (`EnvironmentKeyResolver`)
- `src/agents/extensions/resolution/image-model-registry.ts` (`ImageModelRegistry`)
- `src/index.ts` (`LumiMonolith` master composition root)

---

## 3. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean execution of all 27 passes in the deterministic monolith composition root.
