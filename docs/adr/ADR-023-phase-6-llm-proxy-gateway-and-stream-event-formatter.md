# ADR-023: Phase 6 LLM Proxy Gateway & Stream Event Formatter (Passes 28–30)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing LLM proxy middleware (`packages/agent/src/proxy.ts`), response text stream chunking (`packages/agent/src/stream-fn.ts`), and performing Phase 6 master subsystem synthesis (Passes 28–30) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 6 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 28 (`proxy.ts`)**: Custom proxy endpoint base URL configuration, header injection, and timeout guardrails (`LlmProxyGateway`).
2. **Pass 29 (`stream-fn.ts`)**: Streaming text chunk event formatting and SSE/JSON-RPC frame serialization (`StreamEventFormatter`).
3. **Pass 30 (Phase 6 Master Orchestrator)**: Complete 30-pass master verification suite confirming zero-barrel OOP class extension and 100% subsystem cohesion.

---

## 2. Architectural Decision (The What)

### Non-Destructive Class Extension & Mutation Directory Architecture (`ADR-012`)

Following **ADR-012**:
- `src/agents/extensions/resolution/llm-proxy-gateway.ts` (`LlmProxyGateway`)
- `src/tooling/extensions/telemetry/stream-event-formatter.ts` (`StreamEventFormatter`)
- `src/index.ts` (`LumiMonolith` master composition root)

---

## 3. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean execution of all 30 passes in the deterministic monolith composition root.

---

## Current Refinement: Stream Boundaries

`StreamEventFormatter` continues to own transport/SSE/JSON-RPC framing. It does not define user-facing agent activity. Provider lifecycle events are normalized through `EngineProgressEvent` and ADR-082; callers must read `EngineTickResult.outcome` before treating `EngineTickResult.response` as a successful final answer. See [ADR-082](ADR-082-structured-agent-activity-streaming.md).
