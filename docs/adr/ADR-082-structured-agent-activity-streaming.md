# ADR-082: Structured Agent Activity Streaming and Persistent Terminal Timeline

- **Status**: Accepted and implemented
- **Date**: 2026-08-12
- **Domain**: Agent execution, provider streaming, terminal UX, and observability security
- **Supersedes**: The generic single-label `Thinking...` presentation; does not supersede protocol telemetry (`ADR-023`) or tool-executor lifecycle management (`ADR-060`)

## Context

LUMI previously flattened rich provider events into one transient footer sentence. A user could submit a prompt and see only a generic working label, even while the provider was connecting, planning, running commands, changing files, composing a response, failing, or waiting for cancellation.

This created four problems:

1. Started, updated, and completed notifications appeared as unrelated text rather than one activity lifecycle.
2. The transient footer disappeared when the turn ended, leaving no audit trail beside the response.
3. Cancellation and provider errors could leave the visible state ambiguous or retain an active child row.
4. Showing arbitrary tool details without a dedicated security boundary risked credential or output leakage.

The official Codex event model distinguishes thread, turn, and item lifecycles. LUMI needed to preserve those semantics while remaining provider-independent and avoiding raw reasoning disclosure. In particular, the official App Server contract makes `item/completed` authoritative for one item and publishes the final turn status through `turn/completed`; those scopes cannot be collapsed into one generic “frame complete” signal.

## Decision

### 1. Typed provider-independent progress events

`EngineTickInput` accepts a local `AbortSignal` and `onProgress` callback. The callback receives a public `EngineProgressEvent` with a stable `activityId`, phase, lifecycle status, safe message/detail fields, timestamp, elapsed time, sequence, and optional metadata.

Phases describe what the user sees; statuses describe the activity lifecycle. These are intentionally separate. A command can remain in the `tool` phase while progressing from `started` to `completed`.

### 2. Codex SDK lifecycle adapter

`CodexProgressAdapter` maps `thread.started`, `turn.started`, `item.started`, `item.updated`, `item.completed`, `turn.completed`, `turn.failed`, and stream errors from the exactly pinned `@openai/codex-sdk` `0.147.0` event union into the public contract. The SDK item ID becomes a retry-attempt-scoped stable activity identity. Duplicate payloads are dropped, and `item.completed` is authoritative only for that item.

The official App Server documentation uses slash-form JSON-RPC methods (`item/completed`, `turn/completed`) and currently reports successful, interrupted, or failed final status on `turn/completed`. The pinned SDK uses dot-form TypeScript discriminants and separate `turn.completed` and `turn.failed` events. Runtime code follows the installed SDK contract; documentation keeps the two notations explicit.

Readable SDK reasoning summaries may be shown after sanitization and truncation. Raw chain-of-thought is not a supported UI payload.

### 3. Persistent activity timeline

`AgentActivityTimeline` upserts events by identity, ignores stale sequence numbers, animates active rows, limits visible history, pins the overall-turn summary, and remains in history beside the final response. Failure or cancellation settles all active child rows.

The footer remains a compact current-state control surface, not the sole progress record.

### 4. Explicit terminal behavior

- Completion is scoped: item completion finalizes one item, attempt completion finalizes one dispatch, turn completion finalizes provider work, and frame completion commits the public application result.
- Completion is a two-gate commit: the provider must emit `turn.completed` and the stream must contain a non-empty completed `agent_message`. The adapter publishes completion only after both gates pass.
- Retry-attempt failures are activity-scoped and nonterminal while the single fallback remains. The initial attempt and fallback share one progress sequence and one logical turn identity.
- The first turn-scoped terminal is immutable; late events cannot rewrite it.
- `EngineTickResult.outcome` carries the authoritative `completed`, `failed`, or `cancelled` result independently from promise resolution and display text.
- Caller cancellation and provider timeout are combined with `AbortSignal.any()`.
- Codex uses a ten-minute turn limit; API-key requests use endpoint timeouts.
- Failed/cancelled Codex threads are discarded.
- Duplicate submissions are blocked during an active turn.
- Loop phase resets in a `finally` block.
- Missing credentials emit an explicit failed activity rather than silently appearing idle.
- Premature stream EOF, empty HTTP success content, and a provider completion without a final message are explicit failures.

### 5. Observability security boundary

`sanitizeProgressText()` is shared by the adapter and UI. It removes control characters, bounds rendered text, and redacts authorization headers, common provider keys, GitHub tokens, JWTs, URL credentials, secret query parameters, environment assignments, and CLI secret flags.

Command output, MCP arguments/results, raw reasoning, OAuth material, and full response text are prohibited from progress details.

### 6. Transport boundary

`AbortSignal` and callbacks are process-local controls. `RemoteSessionHandle` serializes only the prompt until the remote protocol defines dedicated progress and cancellation messages.

## Alternatives considered

### One spinner and mutable footer

Rejected because it does not preserve item identity, hides completed work, and provides weak failure diagnostics.

### Append every provider event as a new log line

Rejected because SDK updates would create duplicate noise and unbounded terminal history.

### Stream raw reasoning or command output

Rejected for privacy, security, readability, and payload-size reasons.

### Treat every provider as full item-level streaming

Rejected because provider routes expose different event fidelity. Coarse request lifecycle events must remain honest about their source.

## Consequences

### Positive

- Users can distinguish connection, analysis, planning, tool execution, file changes, response generation, and terminal state.
- Programmatic clients receive a stable public contract.
- Cancellation and failures leave a consistent persistent record.
- Progress details have a dedicated defense-in-depth redaction boundary.
- SDK lifecycle semantics are preserved without coupling the TUI to provider types.

### Tradeoffs

- Renderers must implement identity-based upsert and sequence ordering.
- The adapter retains bounded per-turn maps and sets until the turn terminates.
- API-key routes expose coarser progress than Codex OAuth until their transport supports richer streaming events.
- Progress text is intentionally less detailed than raw provider payloads.

## Verification evidence

- TypeScript strict check and production build passed.
- Deterministic lifecycle, deduplication, safe-path, and redaction assertions passed.
- Authenticated fullscreen Codex completion displayed a persistent terminal timeline and returned the expected response.
- A live long-running command was cancelled through `Esc`; the turn and active child activity settled and no child process remained.
- All repository architecture and performance guardrails passed.

## References

- [Agent Activity Streaming Strategy](../agent/streaming-activity-strategy.md)
- [Official Codex SDK documentation](https://learn.chatgpt.com/docs/codex-sdk)
- [Official Codex App Server event contract](https://learn.chatgpt.com/docs/app-server)
- [ADR-023: LLM Proxy Gateway and Stream Event Formatter](ADR-023-phase-6-llm-proxy-gateway-and-stream-event-formatter.md)
- [ADR-060: Streaming Tool Executor](ADR-060-phase-39-broccolidb-streaming-tool-executor-and-task-state.md)
