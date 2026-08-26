# Key Architectural Findings & Osmosis Audit

This document records the foundational research findings and lessons learned during the migration from early multi-agent experiments to the 3-tier monolithic Deterministic Game Engine architecture in `/Users/bozoegg/Desktop/LUMI-NEW`.

---

## 1. Why Multi-Agent Framework Experiments Failed

In earlier iterations, attempting to partition simple coding tasks across 6+ specialized agent micro-services resulted in severe structural failures:

1. **Context Fragmentation**: Agents lost track of system prompt rules and conversation turns across inter-agent RPC calls.
2. **Framework Bloat & Latency**: Serializing turns over multiple async event buses added 100ms+ latency overhead per turn.
3. **Uncoordinated State Mutations**: Multiple agents modified files simultaneously, leading to race conditions and file content corruption.

### The Monolithic Solution
Consolidating into a 3-tier monolithic framework (`agents`, `sessions`, `tooling`) with a **strict cap of $\le 5$ orchestrating classes per tier directory** eliminated multi-service overhead while retaining full modularity.

---

## 2. Key Insights Absorbed from `pi-main` (Teacher Model)

By running 5 passes of the **Osmosis Learning Methodology** against `/Users/bozoegg/Downloads/pi-main`, we isolated key production capabilities and discarded framework complexity:

- **Pass 1 (Context Compaction)**: Compacts turn history dynamically when turn threshold is exceeded ([SessionCompactor](../../src/sessions/extensions/compaction/session-compactor.ts)).
- **Pass 2 (Model Resolution & Branching)**: Fallback model resolution chain (`gemini-3.6-flash` $\rightarrow$ `gemini-1.5-pro`) and isolated session branching (`fork()`) ([ModelResolver](../../src/agents/extensions/resolution/model-resolver.ts)).
- **Pass 3 (VFS & Slash Router)**: In-memory Virtual File System staging overlays (`SessionVfs`) and sub-millisecond slash command routing (`AgentSlashRouter`).
- **Pass 4 (Long-Term Memory & KIs)**: Persistent memory fact storage and Knowledge Item indexing (`SessionMemoryStore`).
- **Pass 5 (Monorepo Package Absorption)**: Line-anchored hash verification (`hashline`), type-safe schema validation (`omptype`), file storage (`session-backends`), and JSON-RPC telemetry (`protocol`).

---

## 3. The Deterministic Game Engine Paradigm

Capturing agent turns as frame steps (`tick()`), state transitions as immutable snapshots (`GameStateSnapshot`), and memory as pre-allocated contiguous slabs (`ArenaAllocator`) proved to be the ultimate architecture for AI agent performance and stability.

- **Predictable Frame Cycle**: Every tick follows the invariant lifecycle: `preTick() -> executeTick() -> postTick()`, serializing turn execution without race conditions or state drift.
- **Zero-GC Arena Memory Substrate**: Pre-allocates a contiguous 16MB ArrayBuffer memory slab (`ArenaAllocator`), eliminating V8 Garbage Collection pauses during live activity streaming and frame ticks.
- **Zero-Drift Rewind**: `rewindToSnapshot()` allows instantaneous $O(1)$ time-travel state restoration ($<0.1\text{ ms}$ warmed p95) to any previous frame without side-effect leakage or transcript re-parsing.
- **Subagent Session Forking**: Spawns isolated child engine instances (`forkSession()`) pre-initialized from parent frame snapshots, allowing multi-agent swarms (`AgentSwarmDispatcher`) to explore complex solution spaces safely.
- **Guarded Performance SLAs**: Enforces local fast-path mean latency below $1.0\text{ ms}$ and execution throughput of at least $1,000\text{ frames/second}$ on every build.

---

## 4. Why a Single “Thinking” Spinner Failed

A transient spinner label hid the difference between authentication, connection, planning, tool execution, file mutation, response generation, timeout, and cancellation. When a provider paused between events, the interface looked frozen even though the turn was still live. When dispatch failed before response generation, the same generic label concealed the actual failure boundary.

The durable solution is an identity-based activity lifecycle:

- Provider item IDs become attempt-scoped stable `activityId` values, while the logical turn keeps one ID across fallback.
- `started`, `in_progress`, and terminal events update one persistent row.
- A per-turn `sequence` continues across attempts and prevents late updates from rolling the UI backward.
- `item.completed` finalizes one item, not the turn. A completed assistant message remains a candidate until the provider turn terminates and LUMI validates non-empty final text.
- Retriable attempt failures remain child activity failures; the first turn-scoped terminal is the immutable frame outcome.
- The final response remains separate from the progress channel.

The public success boundary is `EngineTickResult.outcome === "completed"`. Promise resolution and non-empty display guidance are deliberately not success signals.

This provides useful visibility without exposing raw command output, tool data, credentials, or hidden reasoning. It also keeps provider fidelity honest: Codex SDK dispatch can show item-level work, while basic HTTP dispatch reports only request-level status.

See [Agent Activity Streaming Strategy](streaming-activity-strategy.md) and [ADR-082](../adr/ADR-082-structured-agent-activity-streaming.md).

---

## 5. GALX AI Wholesale Compute & Provider Consolidation (ADR-147)

Consolidating legacy direct vendor drivers into three core backends (**OpenRouter**, **Codex (OpenAI)**, and **GALX AI**) achieved major structural improvements:

1. **Wholesale Clearinghouse Precision**: GALX AI provides sub-cent token execution (`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`) paired with cryptographic delivery receipts (`BroccoliDeliveryReceipt`) and Write-Ahead Ledger state tracking (`BroccoliTransportSubstrate`).
2. **Hardened Transport Layer**: Implements dual Content-Digests (RFC 9530 / RFC 3230), HTTP message signatures (RFC 9421), DPoP proofs (RFC 9449), 3-state circuit breaking, and AIMD concurrency throttling.
3. **Drastic Codebase De-duplication**: Eliminated 4,000+ lines of fragile auxiliary vendor adapters without loss of model capability (external frontier models route via OpenRouter with full prompt caching and unified billing).
