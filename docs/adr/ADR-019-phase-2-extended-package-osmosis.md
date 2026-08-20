# ADR-019: Phase 2 Extended Package Osmosis (Passes 15–18)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing additional foundational packages from `pi-main` (`packages/snapcompact`, `packages/catalog`, `packages/server`, `packages/evals`) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy** (Passes 15–18).

---

## 1. Context & Motivation (The Why)

To complete Phase 2 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 15 (`snapcompact`)**: Dense text bitmap frame compaction of long turn history without extra LLM cost.
2. **Pass 16 (`catalog`)**: Model capability specs, max token limits, and pricing per 1M tokens.
3. **Pass 17 (`server`)**: JSON-RPC 2.0 streaming gateway for web applications and webviews.
4. **Pass 18 (`evals`)**: Automated benchmark suite evaluation and turn latency assertions.

---

## 2. Architectural Decision (The What)

### Non-Destructive Class Extension & Mutation Directory Architecture (`ADR-012`)

Following **ADR-012**:
- `src/sessions/extensions/compaction/snapcompact-engine.ts` (`SnapcompactEngine`)
- `src/agents/extensions/resolution/model-catalog.ts` (`ModelCatalog`)
- `src/tooling/extensions/gateway/monolith-gateway-server.ts` (`MonolithGatewayServer`)
- `src/tooling/extensions/evals/benchmark-evaluator.ts` (`MonolithBenchmarkEvaluator`)

---

## 3. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean execution of all 18 passes in the deterministic monolith composition root.
