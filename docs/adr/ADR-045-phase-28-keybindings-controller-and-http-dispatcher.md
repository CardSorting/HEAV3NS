# ADR-045: Phase 28 Keybindings Controller & HTTP Dispatcher Overlay (Passes 94–96)

- **Status**: Accepted
- **Date**: 2026-08-09
- **Domain**: Phase 28 Keybindings & Transport Dispatch Evolution
- **Authors**: AI Pair Programmer (Osmosis Strategy)

---

## 1. Context & Rationale

In Phase 28 (Passes 94–96), **LUMI-NEW** ingested configurable keyboard shortcut registry concepts from `pi-main/packages/coding-agent/src/core/keybindings.ts` and custom HTTP dispatcher/proxy header configuration concepts from `pi-main/packages/coding-agent/src/core/http-dispatcher.ts`.

These capabilities are absorbed into single-responsibility monolithic extension classes (`KeybindingsController` and `HttpDispatcherOverlay`), granting LUMI-NEW CLI keyboard mapping flexibility and proxy/header transport configuration without external monorepo dependencies.

---

## 2. Decision Specifications

### Pass 94: Keybindings Controller (`KeybindingsController`)
- **Location**: `src/tooling/extensions/permissions/keybindings-controller.ts`
- **Responsibilities**: Registers custom shortcut actions (`registerKeybinding()`), matches input keystrokes (`matchesKey()`), and maps actions for user keyboard input.

### Pass 95: HTTP Dispatcher Overlay (`HttpDispatcherOverlay`)
- **Location**: `src/agents/extensions/resolution/http-dispatcher.ts`
- **Responsibilities**: Configures network proxy endpoints (`configureDispatcher()`), injects custom HTTP headers (`applyHeaders()`), and manages transport options for outbound model requests.

### Pass 96: Phase 28 Grand Subsystem Synthesis & Verification
- **Location**: `src/factories/grand-monolith-synthesizer.ts` & `src/index.ts`
- **Responsibilities**: Verifies end-to-end integration and cohesion across all 96 evolutionary passes.

---

## 3. Verification & Compliance

- **TypeScript Type Safety**: Verified with `npm run check` (0 errors).
- **Runtime Execution**: Verified via `npx tsx src/index.ts` (96 passes verified cleanly).
