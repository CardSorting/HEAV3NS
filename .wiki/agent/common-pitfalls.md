# Common Pitfalls for AI Agents

This document highlights common pitfalls and non-negotiable rules for AI agents operating in `repository root`.

---

## 🛑 Critical Restrictions & Strategy Directives

1. **Preserve the Deterministic Game Engine Strategy**:
   - Every user turn MUST be modeled as a frame tick (`tick()`).
   - State updates MUST remain snapshot-compatible (`GameStateSnapshot` and `rewindToSnapshot()`).
   - Tiers (`src/agents/`, `src/sessions/`, `src/tooling/`) can expand beyond initial class counts as needed, provided all new classes strictly model the Game Engine strategy.

2. **No Non-Erasable TypeScript Syntax**:
   - Node strip-only mode (`--experimental-strip-types`) strictly forbids:
     - `enum` (Use union string types: `"fact" | "rule" | "troubleshooting" | "ki"`)
     - `namespace` / `module`
     - Parameter properties in constructors (`constructor(public name: string)`)
     - `import =` / `export =`

3. **No Dynamic Inline Imports**:
   - Do NOT use `await import("...")` or `import("pkg").Type`. All imports must be top-level static imports.

4. **No Whole File Overwrites Without Staging**:
   - For targeted line modifications, use `AnchoredHands.applyAnchoredEdit()` (line-anchored hash verification) to prevent line drift errors.
   - For virtual file edits, stage changes via `SessionVfs` before committing.

5. **Always Preserve Single Composition Root**:
   - [`src/index.ts`](../../src/index.ts) (`LumiMonolith`) backed by [`MonolithFactory`](../../src/factories/monolith-factory.ts) MUST remain the single parent composition root.

6. **Do Not Flatten Agent Work into One Spinner String**:
   - Emit `EngineProgressEvent` values with a stable `activityId`, explicit `phase` and `status`, a timestamp, and a monotonically increasing per-turn `sequence`.
   - Update the existing activity when the same ID is received. Appending every SDK update creates duplicate and misleading rows.
   - Never infer a terminal outcome from silence. Every turn must end as `completed`, `failed`, or `cancelled`.
   - Never treat `item.completed`, partial response text, stream EOF, or HTTP 200 as turn completion. Require the provider turn terminal and validate the final response before publishing success.
   - Retry attempts are child activities. They must not fail the overall turn while a fallback is still running.

7. **Do Not Leak Provider Payloads Through Progress**:
   - Progress is a safe status surface, not a debug dump or response transport.
   - Never emit credentials, authorization headers, environment values, raw command output, tool arguments/results, full assistant output, or hidden chain-of-thought.
   - Route all user-visible status text through `sanitizeProgressText()` and keep it bounded.

8. **Keep the Three Streaming Layers Separate**:
   - `EngineProgressEvent` represents provider/turn activity for users.
   - `ToolExecutionProgress` represents one local tool execution lifecycle.
   - `ProtocolEars` and `StreamEventFormatter` represent telemetry/transport envelopes.
   - Bridge between these layers deliberately; do not make their event shapes interchangeable.

9. **Do Not Serialize Local Turn Controls**:
   - `AbortSignal` and `onProgress` are process-local controls on `EngineTickInput`.
   - Remote session transports must serialize the prompt and supported data fields only, then establish cancellation and event subscriptions through their transport protocol.

10. **Do Not Claim More Provider Fidelity Than Exists**:
    - Codex OAuth uses the Codex SDK and exposes thread, turn, and item events.
    - API-key HTTP dispatch currently exposes coarse request lifecycle states.
    - Render honest provider-specific detail and supply a local terminal event when the route has no native item lifecycle.

11. **Do Not Bypass Completion Quality Gates**:
    - Never treat unverified model output or un-evaluated tool execution as a completed turn.
    - Always evaluate `RoadmapCompletionGate` to enforce non-empty responses, error containment, mutation staging, and invariant satisfaction.

12. **Do Not Prompt the User for Recoverable Failures**:
    - Utilize `deriveAutonomousFeedback` and `deriveRemediationDirective` in `executeAutonomousAttemptLoop` to drive multi-attempt self-correction automatically without manual user intervention.

For the normative rules, see [Agent Activity Streaming Strategy](streaming-activity-strategy.md), [ADR-082](../adr/ADR-082-structured-agent-activity-streaming.md), and [ADR-084](../adr/ADR-084-attempt-completion-gate-strategy.md).
