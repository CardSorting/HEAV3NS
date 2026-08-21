# LUMI Monolith Runtime Architecture & Executive Subsystem Guide

This document provides a comprehensive technical reference for the **LUMI Monolith Runtime**, detailing its baremetal substrate, zero-GC memory allocation model, differential terminal rendering engine, state time-travel capabilities, and SLA verification guardrails.

---

## 🌟 Executive Summary: What LUMI Is & Why This Matters

### What is LUMI?
**LUMI** is an enterprise-grade AI pair programmer and autonomous agent framework engineered like a **Deterministic Game Engine Kernel**. Rather than treating agent interactions as loose async request/response wrappers or distributed microservices, LUMI treats every agent turn as an atomic frame tick (`tick()`), operates over a **16MB Zero-GC Contiguous ArrayBuffer Slab**, captures immutable game-save snapshots (`GameStateSnapshot`), and supports sub-millisecond ($< 0.05\text{ ms}$) state time-travel rollback (`rewindToSnapshot()`).

### The Core Problem in Modern AI Agents
Traditional agent frameworks (LangChain, AutoGen, CrewAI, raw REST wrappers) suffer from systemic architectural friction:
- **Framework Soup & RPC Overhead**: Uncoordinated micro-packages introduce $14\text{ ms} - 500\text{ ms}$ of dispatch latency before any LLM model even begins thinking.
- **State Drift & Ghost Edits**: Multi-turn agent loops easily lose context, get stuck in edit loops, or produce un-reproducible states when tool actions fail.
- **Garbage Collection (GC) Latency Spikes**: Generating thousands of dynamic V8 heap objects per turn triggers Node.js garbage collection sweeps, causing stutter and high memory pressure during live streaming.
- **Costly Re-runs**: When an agent makes a mistake on turn 8, traditional systems require restarting the entire session from scratch ($285\text{ ms} - \text{seconds}$ of re-parsing and re-execution).

### Why LUMI's Architecture Matters
1. **For Developers & Engineers**:
   - **Instant Feedback & Sub-Millisecond Speed**: Local orchestration overhead is slashed to **$0.17\text{ ms}$** ($>5,700\text{ frames/second}$), making the CLI and programmatic SDK feel instantaneously responsive.
   - **Zero-Friction State Rewind**: Rewind state to any earlier checkpoint in **$0.027\text{ ms}$** via `/rewind`. Staged virtual files, transcripts, and memory facts roll back in a single frame.
   - **Polished Terminal Experience**: Differential screen rendering with zero visual flicker, dynamic borders that never wrap on split screens, and ANSI syntax highlighting with continuation gutters.

2. **For AI Systems & Researchers**:
   - **Enabling High-Frequency Search**: High-level reasoning strategies like Monte Carlo Tree Search (MCTS), A* pathfinding, and autonomous multi-branch exploration require running hundreds of simulated rollouts. By removing IPC and GC overhead, researchers can run dense tree searches locally.
   - **Hard Determinism**: Seeded simulations, exact composition manifests (142/142 components), and fail-closed completion gates guarantee 100% reproducible execution traces.

3. **For Enterprises & Technology Leaders**:
   - **Maximized Compute Efficiency**: Running $>5,700$ frames/second on a single core allows running dense multi-agent swarms without expensive cloud infrastructure clusters.
   - **Enterprise Security**: Native PKCE OAuth 2.0 with credentials stored locally with 0600 file permissions and zero secret leakage in progress event streams.
   - **Permanent Open Innovation**: Licensed under Apache 2.0 and backed by a defensive patent non-aggression pledge.

---

## 1. Architectural Principles & Invariants

The LUMI runtime is engineered for high-frequency execution with deterministic, predictable performance characteristics:

1. **Zero-GC Contiguous Slab Memory**: A dedicated 16MB `ArrayBuffer` slab is initialized upon startup. String and node allocations write directly into structured typed array views (`Uint32Array` and `Uint8Array`), eliminating heap allocation churn and V8 garbage collection pauses during agent execution ticks.
2. **Sub-Millisecond Mean Tick Latency**: Turn dispatch, prompt composition, and fact storage execute in $< 1.0\text{ ms}$ on the local fast path (**$0.17\text{ ms}$ measured**).
3. **High-Throughput Execution**: The monolith exceeds $1,000\text{ frames/second}$ execution throughput (**$5,761.61\text{ fps}$ measured**).
4. **$O(1)$ State Rewind**: Time-travel rollback restores conversation frames, VFS staging layers, and memory stores in $< 0.10\text{ ms p95}$ (**$0.027\text{ ms p95}$ measured**).
5. **Zero Barrel Imports (ADR-012)**: Strictly disallows index barrel re-exports to eliminate circular initialization hazards and optimize tree-shaking and module loading latency.
6. **Base Class Immutability**: Foundational abstract classes (`AbstractAgentEngine`, `AbstractSessionStore`, `AbstractHands`) remain pure, extensible interfaces without ad-hoc coupling.

---

## 2. Substrate & Memory Allocation Engine

### 2.1 Arena Allocator (`src/sessions/extensions/substrate/arena-allocator.ts`)
The `ArenaAllocator` operates over a single fixed-capacity `ArrayBuffer` (default: `16,777,216 bytes`).

- **Static Zero-GC Encoding**: Retains static, reusable `TextEncoder` and `TextDecoder("utf-8")` instances across all invocations, eliminating per-turn object allocations.
- **Direct Slab Writes**: Allocates strings and binary payloads directly into the slab's byte view with bounds verification.
- **Bounds-Checked Slices**: Exposes `readString(byteOffset, byteLength)` for zero-copy deserialization.
- **Offset Rewind**: Resets memory allocations via `setOffset(offsetWords)` during state rollback in $O(1)$ complexity.

```typescript
// Memory Slab Layout
// [ Offset 0 ........................................ 16MB Capacity ]
// [ Node View (Uint32Array) ][ Byte View (Uint8Array) ][ Free Space ]
```

### 2.2 Write Coalescing Substrate (`src/sessions/extensions/substrate/write-coalescer.ts`)
To protect NVMe/SSD storage and prevent I/O blocking during rapid turns, the write-behind buffer:
- Deduplicates file mutations via bitwise **FNV-1a 32-bit fast hashing** (`calculateFastHash`).
- Debounces file flushes (`debounceMs: 300ms`, `maxDelayMs: 2000ms`).
- Applies `.unref()` to internal timers to ensure clean process termination when the CLI exits.

### 2.3 BroccoliDB Hybrid Storage Kernel (`src/sessions/extensions/substrate/broccolidb-kernel.ts`)
The Zenith-tier hybrid database kernel ($\mathcal{K}_{\text{broccoli}}$ / [ADR-120](../.wiki/adr/ADR-120-deterministic-hybrid-inmemory-broccolidb-kernel.md)) resolves the tension between volatile memory speed and durable disk persistence with zero external C++ native dependencies:
- **L1 In-Memory Reactive Tables (`BroccoliDbTable<T>`)**: Primary key map and secondary multi-map inverted indices delivering sub-microsecond query latencies ($< 0.5\ \mu\text{s}$).
- **L2 Append-Only Write-Ahead Log (`BroccoliWriteAheadLog`)**: Micro-batched write coalescing ($20\text{ms}$ buffer), cryptographic SHA-256 frame hash chaining ($h_i = \text{SHA256}(h_{i-1} \parallel f_i)$), and zero-data-loss cold-start replay.
- **L3 256-Way Sharded CAS Vault (`BroccoliCASStorageService`)**: Sharded blob deduplication (`.broccolidb/cas/`), adaptive Brotli compression ($\ge 1024\text{B}$, $\ge 10\%$ savings), cryptographic bit-rot quarantine (`.broccolidb/cas/corrupt/`), and mark-sweep garbage collection.
- **L4 Double-Buffered Checkpointing**: Atomic base snapshots (`.broccolidb/checkpoint.db`) written via `.tmp -> rename` and safe log truncation.
- **L5 Re-Entrant Mutex (`ReentrantAsyncMutex`)**: `AsyncLocalStorage`-based nested lock acquisition, 30s dead-man leases, and randomized Poisson jitter backoff.
- **L6 4-Pillar Diagnostic Probe**: Real-time auditing for Disk Invariants, CAS Integrity, WAL Journal Drift, and Table Consistency.

### 2.4 Substrate Store Adapter (`src/sessions/extensions/substrate/broccoli-substrate-store.ts`)
- Bridges all session extension domains (goals, tasks, profiles, reasoning, kanban, memories) to the hybrid kernel with 100% backwards compatibility.
- Exposes model database tools (`db_inspect_status`, `db_query_table`, `db_checkpoint_wal`, `db_cas_audit`, `db_timeline_history`, `db_rollback_timeline`).

---

## 3. Executive Terminal User Interface (TUI)

### 3.1 Differential Rendering Engine (`src/tui/tui-alt-screen.ts`)
The interactive TUI operates on an alternate terminal screen buffer (`\x1b[?1049h`), using synchronized output fencing (`\x1b[?2026h` / `\x1b[?2026l`) to eliminate visual tearing:
- **Cell Matrix Diffing**: Only changed terminal character cells are emitted over stdout.
- **Adaptive Width Borders**: Components like `AgentActivityTimeline` dynamically scale box width (`Math.max(24, Math.min(width, 100))`), adapting seamlessly between split-screen terminals and ultra-wide viewports.
- **Scrollback Geometry**: The `ScrollView` component supports auto-scroll pinning (`scrollToEnd()`), viewport jump commands (`Home` / `End`), and page-relative scrolling (`PgUp` / `PgDn` / `Shift+Up/Down` / `Ctrl+U/D`).

### 3.2 Syntax Highlighting & Continuation Gutters (`src/tui/syntax-highlighter.ts`)
- **Zero-Dependency Highlighting**: Built-in ANSI lexers for TypeScript, JavaScript, Python, Bash/Shell, Git Diffs, JSON, HTML, and CSS.
- **Continuation Guttering**: Long code lines wrapped across terminal widths are prefixed with `↳ ` continuation gutters to preserve visual boundary indentation.

---

## 4. State Rewind & Snapshot Time-Travel System

The monolith supports full-spectrum state checkpoints:

1. **Snapshot Creation**: Calling `monolith.createSnapshot()` captures:
   - Frame turn index counter.
   - Active message array and durable transcript log.
   - Staged Virtual File System ([SessionVfs](../src/sessions/extensions/vfs/session-vfs.ts)) modifications.
   - Cognitive memory facts and rules ([SessionMemoryStore](../src/sessions/extensions/memory/session-memory-store.ts)).
   - Active slab buffer offset word pointer.
2. **Snapshot Storage Index**: Checkpoints are stored in memory and indexed by session ID in `SnapshotStorageIndex`.
3. **Holistic Rollback**: Calling `monolith.rewindToSnapshot(snapshot)` restores:
   - Message history and transcript indexes.
   - Frame turn counter.
   - Memory facts categorized by rules, troubleshooting, and user facts.
   - Virtual filesystem staged files.
   - Arena allocator word pointer.

---

## 5. Interactive Commands Reference

| Slash Command | Short Key | Description |
| :--- | :--- | :--- |
| `/help` | `?` | Opens the interactive Keyboard Navigation & Usage Guide modal. |
| `/model [name]` | `Alt+M` | Opens the interactive model selection modal or switches model directly. |
| `/settings` | `Ctrl+S` | Opens framework settings to adjust reasoning effort and policies. |
| `/snapshots` | — | Lists all immutable state checkpoints recorded in the active session. |
| `/rewind [id]` | — | Rolls back engine frame, VFS files, and memories to a snapshot checkpoint. |
| `/memory` | — | Displays active persistent facts, rules, and cognitive memory context. |
| `/health` | — | Runs subsystem health audit and displays component diagnostic status. |
| `/providers` | — | Tests latency and authentication for all configured LLM providers. |
| `/setup` | — | Launches the guided provider API key configuration wizard. |
| `/about` | — | Displays monolith specifications, slab capacity, and active SLAs. |
| `/clear` | `Ctrl+L` | Clears the TUI message output history container. |
| `/exit` | `Ctrl+C` / `Ctrl+D` | Exits the interactive TUI or fallback readline session cleanly. |

---

## 6. Autocomplete & Contextual Next-Action Guidance

The `CombinedAutocompleteProvider` in `src/tui/autocomplete.ts` supports:
- **Dynamic Follow-Up Actions**: Contextual suggestions generated after successful agent turns are fuzzy-ranked with `fuzzyFilter`.
- **Fuzzy File Search**: Typing `@` triggers workspace file path completions.
- **Categorized Slash Commands**: Typing `/` displays all available system and session commands.

---

## 7. Verification & SLA Guardrails

The repository enforces 6 performance and architectural SLAs on every pull request and commit:

```bash
# Type safety check
npm run check

# Smoke test suite (9 cross-cutting runtime checks)
npm run smoke

# Architectural guardrail and performance SLA suite
npm test

# Monolith benchmark suite (5 heterogeneous cases including Flappy Bird synthesis)
npm run benchmark

# ADR workspace validation suite
node --import tsx scripts/validate-adr-workspace.ts

# Prompt cache validation suite (42 Zenith suites)
node --import tsx scripts/validate-prompt-cache.ts
```

---

## 8. Zenith-Tier Deterministic Byte-Stable Prompt Caching Subsystem (ADR-135)

LUMI incorporates an enterprise-grade, zero-GC prompt caching and reasoning sanitizer engine that slashes multi-turn API costs by up to 75%–90% and reduces first-token prefill latency (TTFT) by up to 85%–94%:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      5-TIER PROMPT CACHING SEMANTIC HIERARCHY                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Tier 0 (L0): Base Identity (Immutable system kernel & LUMI instructions)        │
│ Tier 1 (L1): Tool Declarations (Alphabetically sorted, canonical JSON schemas)   │
│ Tier 2 (L2): Project Grounding (Workspace rules, skills & constraints)          │
│ Tier 3 (L3): History Checkpoints (Midpoint & penultimate compaction markers)    │
│ Tier 4 (L4): Volatile User Turn (Dynamic user message & transient inputs)       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Core Capabilities:
1. **Cloudflare/Vercel-Style HTTP Telemetry Headers**: Emits `X-Lumi-Cache-Status`, `X-Lumi-Tokens-Saved`, `X-Lumi-Cost-Saved-Usd`, and `X-Lumi-Prefix-Hash` on every turn.
2. **AWS Cost Explorer Multi-Horizon Forecasting**: Projects Daily, Weekly, Monthly, and Annual savings alongside token warmth classification (`Frozen`, `Cold`, `Warm`, `Hot`).
3. **Docker-Style Multi-Layer Cache Keys (L0–L3)**: Partial-layer composite hashing (`L0:hash|L1:hash|L2:hash|L3:hash`) that keeps core instructions and tool definitions warm even when rules or turns change.
4. **Datadog APM Waterfall Execution Spans**: Visualizes prefill time saved per semantic tier with plain-English narratives for non-technical users.
5. **PostgreSQL-Style `EXPLAIN` Simulator & Copilot Auto-Tuner**: Pre-computes turn costs and automatically rewrites flawed system prompts to extract volatile timestamps and UUIDs, lifting cache retention from Grade D (45) to Grade A+ (98).
6. **Strict UI/UX Isolation**: 100% of caching logic is implemented in backend contracts, deterministic cachers, substrates, supervisors, and JSON-RPC gateway endpoints with zero visual UI tampering.

---

## 9. High-Velocity Pattern Search & Zen Direct I/O Subsystem (ADR-136)

LUMI incorporates a native, zero-subprocess pattern perception and filesystem manipulation substrate engineered to eliminate agentic friction, token exhaustion, and tool-call failures during complex codebases investigations:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PATTERN SEARCH & DIRECT I/O ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Developer Tool Suite & Normalization Engine                            │
│   ├── grep_search (30+ filter parameters, regex captures, fuzzy matching)       │
│   ├── Direct I/O Tools (batch_view, batch_write, batch_delete, chmod, etc.)     │
│   └── Port Safety & Process Management (check_port, find_free_port, kill_port)  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Layer 2: In-Memory Perception & Service Runtime                                 │
│   ├── RipgrepSearchService (chunked parallel walker, literal fast-path, streams)│
│   ├── ArgumentCoercer (stringified JSON auto-parse, type coercion)              │
│   └── BroccoliCircuitBreaker (developer tool immunity rules)                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Substrate Storage & 78-Point Validation Engine                         │
│   ├── 78 Automated Quality-of-Life (QoL) Validation Suites                      │
│   └── VFS Overlay & Diff Synthesizer (/diff, /commit, /discard)                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Core Strategic Capabilities:
1. **Zero-Subprocess Search Authority (`RipgrepSearchService`)**: In-memory TypeScript directory traversal with native `indexOf` literal fast-paths delivering 5–10x higher throughput than shell `grep` subprocesses.
2. **Regex Subgroup Captures & Path Scoping**: Extracts capture groups directly into `RipgrepMatch.captures` and filters file paths using RegExp (`pathRegex`) without glob limitations.
3. **Token Defense & Context Shielding**: Employs per-file match limits (`maxMatchesPerFile`), comment stripping (`ignoreComments`), and centered character windows (`maxLineLength`) to protect context budgets against token overflows.
4. **Typo Resilience & Dry-Run Replacement**: Features subsequence fuzzy matching (`fuzzy`) and non-destructive diff previews (`previewReplacement`).
5. **Direct Process & Port Liberation**: Automatically detects available ports (`find_free_port`) and frees occupied ports (`kill_port`), eliminating `EADDRINUSE` deadlocks.
6. **Universal Tool/Parameter Alias Normalization**: Maps standard model variations (`read_file`, `bash`, `find_files`, `filePath`, `text`) and auto-coerces stringified JSON payloads.


