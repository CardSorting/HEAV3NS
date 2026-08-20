# ADR-021: Phase 4 Agentic Commit & Interactive CLI Controller (Passes 22–24)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing automated conventional commit message analysis (`packages/coding-agent/src/commit`), interactive CLI turn execution controllers (`packages/coding-agent/src/modes`), and performing Phase 4 master subsystem orchestration (Passes 22–24) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 4 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 22 (`commit`)**: Automated conventional commit message generation (`AgenticCommitGenerator`) following project standards (no emojis, direct technical prose).
2. **Pass 23 (`modes`)**: Interactive CLI turn execution controller (`InteractiveModeController`) managing interactive turn loops and progress stream updates.
3. **Pass 24 (Phase 4 Master Orchestrator)**: Complete 24-pass master verification suite confirming zero-barrel OOP class extension and 100% subsystem cohesion.

---

## 2. Architectural Decision (The What)

### Non-Destructive Class Extension & Mutation Directory Architecture (`ADR-012`)

Following **ADR-012**:
- `src/tooling/extensions/policy/agentic-commit-generator.ts` (`AgenticCommitGenerator`)
- `src/agents/extensions/execution/interactive-mode-controller.ts` (`InteractiveModeController`)
- `src/index.ts` (`LumiMonolith` master composition root)

---

## 3. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean execution of all 24 passes in the deterministic monolith composition root.

---

## Current Refinement: Structured Activity Rendering

ADR-082 supersedes the original generic “progress stream updates” presentation. `InteractiveModeController` now creates one `AbortController` and one persistent `AgentActivityTimeline` per turn, passes `signal` and `onProgress` into the engine, and clears timers/controller references in `finally`. `Esc` or `Ctrl+C` cancels active work before exiting the shell. See [ADR-082](ADR-082-structured-agent-activity-streaming.md).
