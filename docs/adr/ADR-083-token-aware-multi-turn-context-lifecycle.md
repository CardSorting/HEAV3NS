# ADR-083: Token-Aware Multi-Turn Context Lifecycle

- **Status**: Accepted
- **Date**: 2026-08-12
- **Scope**: multi-turn provider continuity, context-window admission control, and non-destructive compaction

## Context

The original runtime had several context helpers, but the live provider paths did not form one coherent policy:

- compaction triggered on message count rather than model input tokens;
- discarded turns were replaced with a count-only marker;
- `AgentConfig.systemPrompt`, model-catalog window sizes, and token truncation were not used by live requests;
- the local session could compact, rewind, or use a stateless provider while an existing Codex SDK thread continued with different hidden history;
- JSONL persistence serialized only the lossy active window after compaction.

These failure modes become correctness issues in long-running coding sessions. They can erase constraints, separate tool results from their initiating turn, overflow a smaller fallback model, or make a resumed provider thread disagree with local state.

## Decision

LUMI now treats conversation storage and provider context as separate layers:

1. **Durable transcript** — append-only, full-fidelity messages used for persistence, snapshots, forks, rebuilds, and addressable recall.
2. **Active projection** — the bounded messages sent to a provider. It may contain one rolling checkpoint plus recent complete turns.
3. **Pinned context** — the configured system prompt is composed outside lossy conversation compaction. User-derived long-term memory is separately encoded at assistant scope so it remains available without being promoted to policy.

Before each live request, `AgentEngine` reads the active model's catalog specification and reserves:

- the requested output capacity;
- a safety margin (2% by default, at least 512 tokens);
- proactive compaction headroom (trigger at 85% of usable input, target 65%).

`SessionCompactor` uses a hybrid policy:

- preserve all system messages exactly;
- group history at user-turn boundaries and retain the newest complete turns;
- replace evicted turns with one deterministic `LUMI-CONTEXT/1` checkpoint;
- keep the checkpoint at assistant scope, so quoted user text is not promoted into system policy;
- attach stable SHA-256 references that resolve against the durable transcript;
- always rebuild later checkpoints from the durable transcript, never from an earlier lossy checkpoint.

`TokenTruncator` is the final provider-boundary guard. It selects complete recent turns and only middle-truncates an individual newest request when that request cannot fit by itself. Head and tail retention preserves task orientation and expected output details better than blind prefix or suffix deletion.

## Context envelope DSL

Structured, versioned envelopes manage context handoffs and are formally parsed, validated, and serialized through `ContextDslEngine`:

- `LUMI-CONTEXT/1` is a rolling checkpoint with key/value metadata and JSONL records. Each record retains its original role, timestamp, content excerpt, and transcript reference.
- `LUMI-THREAD/1` rehydrates a fresh stateful provider thread. Prior messages live in a JSON array and the current request is separately JSON encoded, so delimiter-shaped DSL/code content cannot escape its field.
- `LUMI-MEMORY/1` carries JSON-encoded, user-derived memory at assistant scope rather than interpolating it into the system message.
- `LUMI-TOOL-RESULT/1` packages high-volume tool execution outcomes with execution metadata, tool call IDs, and status codes.
- `LUMI-GOAL/1` packages dynamic task directives, priorities, and constraint parameters.

All envelopes represent strongly-typed AST nodes processed through `ContextDslEngine`. Their versions allow parsers and migrations to evolve cleanly without prose guessing.

## Provider synchronization

`PersistentSessionStore.contextGeneration` changes after compaction, import, clear, or rewind. A Codex SDK thread is reused only while model, working directory, context generation, pinned-context fingerprint, and expected transcript progression all match. A new thread receives a `LUMI-THREAD/1` bootstrap. Stateless API-key turns, local demo turns, failed turns, direct transcript mutations, and memory changes invalidate or rebuild the SDK thread because those outcomes are not present in its remote history.

This preserves the low-overhead normal path—subsequent uninterrupted SDK turns send only the new request—while making discontinuities explicit and recoverable.

Each `AgentEngine` also owns a FIFO turn gate. Concurrent programmatic or gateway submissions wait for their predecessor, preventing session mutations and stateful provider calls from interleaving.

## Operational behavior

- `/compact` forces a projection rebuild and reports message/token deltas while retaining the transcript.
- `/stats` distinguishes active messages from durable transcript messages.
- API-key chat requests include the configured system prompt, memory context, tool identifiers, a model-derived input budget, and a matching output reserve.
- JSONL export persists the durable transcript. Import validates each record before replacing session state.
- Snapshots include both active messages and the optional transcript; older snapshots remain compatible.

## Verification

`scripts/validate-context-management.ts` covers:

- explicit per-model budgets and headroom;
- message- and token-triggered compaction;
- system-policy pinning and complete recent turns;
- checkpoint non-recursion and reference resolution;
- oversized current requests and tool-turn selection;
- durable export, import, snapshot, fork, and rewind semantics;
- JSON-safe thread envelopes;
- stateful SDK thread reuse and forced rehydration after compaction;
- concurrent submission serialization;
- bounded-cutoff scalability over a synthetic 2,000-message history;
- deterministic randomized invariant coverage across varied histories and budgets.

## Trade-offs and follow-up

The built-in estimator is conservative and dependency-free, not an exact provider tokenizer. The deterministic checkpoint avoids an extra LLM call and summary hallucination, but its excerpts are less semantically dense than a provider-native generated compaction item. The active interface leaves room for provider-native compaction in a future adapter while retaining the durable transcript and the same policy/observability invariants.

## Industry alignment

This design follows the common pattern of compacting before overflow, retaining recent turns, preserving durable session checkpoints, and separating stable instructions from variable history. It also avoids relying on provider-side automatic front truncation, which can silently discard the oldest items.

- [OpenAI Responses API reference](https://platform.openai.com/docs/api-reference/responses-streaming/response/refusal/delta) documents compaction items and distinguishes automatic oldest-item truncation from explicit context management.
- [Anthropic compaction documentation](https://platform.claude.com/docs/en/build-with-claude/compaction) describes server-side summarization for long-running conversations near their window limit.
- [Amazon Bedrock session management](https://docs.aws.amazon.com/bedrock/latest/userguide/sessions.html) uses durable invocation checkpoints for resume and audit workflows.
