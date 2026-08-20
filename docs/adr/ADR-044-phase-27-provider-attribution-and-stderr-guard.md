# ADR-044: Phase 27 Provider Attribution & Stderr Guard (Passes 91–93)

- **Status**: Accepted
- **Date**: 2026-08-09
- **Domain**: Phase 27 Provider Attribution & Telemetry Filtering
- **Authors**: AI Pair Programmer (Osmosis Strategy)

---

## 1. Context & Rationale

In Phase 27 (Passes 91–93), **LUMI-NEW** ingested model provider token attribution & cost estimation concepts from `pi-main/packages/coding-agent/src/core/provider-attribution.ts` and stderr stream noise suppression concepts from `pi-main/packages/utils/src/stderr-guard.ts`.

These capabilities are absorbed into single-responsibility monolithic extension classes (`ProviderAttributionComposer` and `StderrGuardFilter`), enabling LUMI-NEW to perform real-time token pricing telemetry and terminal warning noise suppression without external monorepo dependencies.

---

## 2. Decision Specifications

### Pass 91: Provider Attribution Composer (`ProviderAttributionComposer`)
- **Location**: `src/agents/extensions/resolution/provider-attribution.ts`
- **Responsibilities**: Calculates estimated USD model execution costs (`calculateCost()`), logs usage telemetry (`recordUsage()`), and aggregates session pricing summaries (`getAttributionSummary()`).

### Pass 92: Stderr Guard Filter (`StderrGuardFilter`)
- **Location**: `src/tooling/extensions/telemetry/stderr-guard.ts`
- **Responsibilities**: Detects and suppresses harmless CLI warning patterns (`isSuppressedLine()`), cleans terminal stderr streams (`filterNoise()`), and tracks suppression metrics (`getSuppressionStats()`).

### Pass 93: Phase 27 Grand Subsystem Synthesis & Verification
- **Location**: `src/factories/grand-monolith-synthesizer.ts` & `src/index.ts`
- **Responsibilities**: Verifies end-to-end integration and cohesion across all 93 evolutionary passes.

---

## 3. Verification & Compliance

- **TypeScript Type Safety**: Verified with `npm run check` (0 errors).
- **Runtime Execution**: Verified via `npx tsx src/index.ts` (93 passes verified cleanly).
