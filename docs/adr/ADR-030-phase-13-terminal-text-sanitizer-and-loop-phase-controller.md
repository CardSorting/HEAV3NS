# ADR-030: Phase 13 Terminal Text Sanitizer & Loop Phase Controller (Passes 49–51)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing terminal control code sanitization (`packages/utils/src/sanitize-text.ts`), agent loop execution phase state machine (`packages/utils/src/loop-phase.ts`), and performing Phase 13 master subsystem synthesis (Passes 49–51) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 13 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 49 (`sanitize-text.ts`)**: Terminal control code and ANSI escape sequence sanitizer preventing prompt injection and formatting corruption (`TerminalTextSanitizer`).
2. **Pass 50 (`loop-phase.ts`)**: Fine-grained execution phase state machine tracking agent loop state transitions (`LoopPhaseController`).
3. **Pass 51 (Phase 13 Master Orchestrator)**: Complete 51-pass master verification suite confirming zero-barrel OOP class extension and 100% subsystem cohesion.

---

## 2. Architectural Decision (The What)

### Non-Destructive Class Extension & Mutation Directory Architecture (`ADR-012`)

Following **ADR-012**:
- `src/tooling/extensions/telemetry/text-sanitizer.ts` (`TerminalTextSanitizer`)
- `src/agents/extensions/execution/loop-phase-controller.ts` (`LoopPhaseController`)
- `src/index.ts` (`LumiMonolith` master composition root)

---

## 3. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean execution of all 51 passes in the deterministic monolith composition root.

---

## Current Refinement: Progress Sanitization and Settlement

Terminal escape sanitization remains responsible for arbitrary terminal text. Agent activity adds a narrower boundary in `src/core/utilities/progress-sanitizer.ts`: every progress message/detail is control-character-safe and bounded before presentation. Turn timers and active controller references are released in `finally`, and terminal lifecycle events settle visible activities. See [ADR-082](ADR-082-structured-agent-activity-streaming.md).
