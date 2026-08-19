# ❓ Frequently Asked Questions (FAQ)

Comprehensive answers to common architectural, data layer, performance, security, and developer experience questions for **LUMI-JOY**.

---

## 🏗️ Architecture & Determinism

### Q: What is LUMI-JOY and what core problem does it solve?
**LUMI-JOY** is an enterprise-grade TypeScript autonomous AI pair programmer and multi-agent framework engineered from first principles like a **Deterministic Game Engine**. Traditional agent frameworks wrap LLMs in loose asynchronous microservices, causing $14\text{ ms} - 500\text{ ms}$ serialization latency per turn, non-deterministic state drift, V8 garbage collection stutter, and costly restart-from-scratch failures. LUMI-JOY solves this by executing agent turns as deterministic frame ticks (`tick()`), maintaining state in an in-memory zero-GC contiguous memory slab (`ArenaAllocator`), and enabling instant $O(1)$ state time-travel (`rewindToSnapshot()`, $<0.05\text{ ms}$ SLA).

### Q: Why is the LUMI-JOY agent runtime modeled after video game engines?
High-performance video game engines (physics, rendering, ECS architectures) guarantee predictable frame rates, zero memory leaks, and deterministic state playback. Modeling the AI agent lifecycle as a game engine establishes:
1. **Deterministic Frame Ticks (`tick()`)**: Atomic 5-stage lifecycle (`Input -> Context Assembly -> Provider Dispatch -> State Mutation -> Telemetry`).
2. **Zero-GC Contiguous Slab Memory**: 16MB pre-allocated `ArrayBuffer` slab eliminating V8 garbage collection sweeps during high-throughput token streaming.
3. **$O(1)$ Binary Snapshot Rewind**: Frame-perfect rollback of virtual files (`SessionVfs`), conversation transcripts, and memory facts (`SessionMemoryStore`) in $<0.05\text{ ms}$.
4. **In-Process Monolithic Dispatch**: Direct function dispatch delivering $>8,500\text{ frames/second}$ local orchestration throughput.

### Q: How does the Tool Execution Segmenter & Loop Guardrail prevent infinite loops and race conditions?
The **Deterministic Tool Execution Segmenter** ([ADR-046](../.wiki/adr/ADR-046-deterministic-tool-execution-segmenter.md)) operates as a dual-action safety engine:
- **Batch Parallelism Scheduler**: Analyzes incoming tool batches and groups read-only idempotent tools (`read_file`, `search_files`, `tool_search`) into concurrent execution segments while strictly isolating mutating tools (`write_file`, `patch`, `terminal`) with sequential barrier boundaries.
- **Escalating Anti-Loop Firewall**: Computes deterministic canonical SHA-256 parameter hashes and escalates policies through 4 distinct stages: $\mathbf{allow} \to \mathbf{warn} \to \mathbf{block\_synthetic} \to \mathbf{abort\_turn}$. Repetitive identical calls are immediately halted and recorded in Broccolidb for instant $O(1)$ rollback.

---

## 💾 Data Layer & BroccoliDB Hybrid Kernel

### Q: What is BroccoliDB and why doesn't LUMI-JOY use SQLite or external database binaries?
**BroccoliDB** is LUMI-JOY's built-in, zero-dependency in-memory + hybrid persistence database kernel ([ADR-120](../.wiki/adr/ADR-120-deterministic-hybrid-inmemory-broccolidb-kernel.md)):
- **Zero External Dependencies**: Eliminates C/C++ native addons, Python SQLite locks, and cross-platform compilation failures.
- **Sub-Microsecond Latency**: Pure TypeScript in-memory reactive tables (`BroccoliDbTable<T>`) deliver $<0.5\ \mu\text{s}$ primary/secondary index lookups.
- **256-Way Sharded CAS**: Content-addressable storage with adaptive Brotli compression, cryptographic SHA-256 verification, and bit-rot quarantine.
- **Append-Only WAL Journal**: Micro-batched write-ahead logging with cryptographic hash chaining and cold-start crash replay.
- **Git-for-Data Branching & Aggregations**: Supports Copy-on-Write table branching (`forkBranch`), 3-way merge conflict resolution, and statistical aggregation pipelines (`groupBy`, `HAVING`, `SUM`, `AVG`, `STDDEV`).

### Q: How does LUMI-JOY achieve 100% prefix prompt cache retention across multi-turn sessions?
LUMI-JOY uses a **Deterministic Byte-Stable Prompt Cache Boundary Calculator** ([ADR-045](../.wiki/adr/ADR-045-deterministic-prompt-cache-boundary.md)) implementing a strict 4-breakpoint layout:
1. **Breakpoint 1 (Static System Axioms & Core Tool Definitions)**: Byte-frozen prefix that never changes across turns.
2. **Breakpoint 2 (Persona Ethos & SOUL.md Manifest)**: Stable identity context.
3. **Breakpoint 3 (Progressive Tool Disclosure Registry)**: Tier-1 active tool schemas.
4. **Breakpoint 4 (Conversation History & Compaction Checkpoints)**: Normalized messages with `<think>` tag reasoning token sanitization.
By enforcing byte-stable ordering, LLM providers (Anthropic, OpenAI, DeepSeek) retain 100% prompt cache hits, reducing token input costs by up to **90%**.

---

## ⚡ Performance, Cost & Memory

### Q: How does LUMI-JOY achieve >8,500 frames/sec local orchestration throughput?
LUMI-JOY bypasses inter-process network communication (HTTP/gRPC microservice hops) by executing orchestration entirely in-process within a unified monolithic container (`MonolithFactory` & `LumiMonolith`). Memory allocations are backed by a static 16MB `ArenaAllocator` slab with pre-compiled UTF-8 encoders and memory reuse pools, preventing V8 heap fragmentation and GC pauses.

### Q: How does LUMI-JOY reduce enterprise LLM infrastructure and token costs?
1. **Micro-Cent Pricing Governance (`DeterministicCostGovernor`)**: Tracks exact token usage against per-model pricing catalogs with integer micro-cent arithmetic and pre-flight budget hard caps ([ADR-042](../.wiki/adr/ADR-042-deterministic-model-pricing-and-cost-governance.md)).
2. **Progressive Tool Disclosure (`DeterministicToolDiscloser`)**: Replaces bloated 30,000+ token tool arrays with a 4-tier progressive disclosure engine that dynamically activates tools on-demand ([ADR-043](../.wiki/adr/ADR-043-deterministic-progressive-tool-disclosure.md)).
3. **Semantic Trajectory Compaction (`TrajectoryCompactorEngine`)**: Automatically prunes redundant tool call/output pairs and compacts middle conversation turns into structured `LUMI-CONTEXT/1` envelopes ([ADR-020](../.wiki/adr/ADR-020-deterministic-semantic-context-compression.md), [ADR-083](../.wiki/adr/ADR-083-token-aware-multi-turn-context-lifecycle.md)).

---

## 🔒 Security, Privacy & Compliance

### Q: How does LUMI-JOY protect credentials and sensitive source code?
- **RFC 7636 PKCE OAuth 2.0 Flow**: Native browser-based OAuth authentication with zero-secret PKCE device flows ([ADR-052](../.wiki/adr/ADR-052-deterministic-identity-federation-and-auth-governance.md)).
- **Secure File Storage**: User credentials and tokens are stored exclusively in `~/.lumi/config.json` with strict POSIX `0600` user-only permissions.
- **Automated Secret Redaction (`DeterministicSecretRedactor`)**: Scans all streaming outputs, activity telemetry, and log events with entropy-based scanners to redact API keys, GitHub PATs, JWTs, and private URLs before display ([ADR-047](../.wiki/adr/ADR-047-deterministic-secret-redaction-and-path-safety.md)).
- **Sensitive Path & Command Firewalls**: Blocks access to `.env`, private SSH keys, cloud metadata endpoints (`169.254.169.254`), and destructive terminal commands via `CommandPermissionController`.

### Q: Are code mutations safe and reversible?
Yes. Every file modification is performed via **Line-Anchored Hash Editing (`AnchoredHands`)** ([ADR-029](../.wiki/adr/ADR-029-deterministic-unified-patch-engine-and-atomic-mutation-substrate.md)):
- Verifies line-by-line SHA-256 hashes to guarantee the target file has not drifted since read.
- Staged first in the in-memory Virtual File System (`SessionVfs`) with pre-flight dry runs.
- Instant $O(1)$ rollback unwinds mutations if downstream typechecks, linter passes, or verification gates fail.

---

## 🤝 Multi-Agent Swarm, IDEs & Developer Experience

### Q: How does LUMI-JOY support multi-agent collaboration and subagent swarms?
LUMI-JOY features a built-in **Decentralized Swarm Dispatcher (`AgentSwarmDispatcher`)** ([ADR-015](../.wiki/adr/ADR-015-deterministic-swarm-delegation-and-worktree-isolation.md)):
- Coordinates parallel subagents with topological task DAG scheduling (`dependsOnTaskIds`).
- Reaches deterministic consensus across diverse model outputs using a Byzantine Fault Tolerant (BFT) Priority Lattice (`PRIORITY_LATTICE`).
- Maintains inter-agent communication via in-memory mailboxes and heartbeat monitoring with automatic stale worker eviction.

### Q: How does LUMI-JOY integrate with modern IDEs and external tools?
- **Agent Client Protocol (ACP) Bridge (`AcpBridgeServer`)**: Full JSON-RPC 2.0 streaming bridge for VS Code, Zed, and JetBrains IDEs ([ADR-024](../.wiki/adr/ADR-024-deterministic-agent-client-protocol-and-ide-bridge.md)).
- **Model Context Protocol (MCP) Supervisor (`McpSupervisorEngine`)**: Connects to standard MCP tool servers with automated credential scrubbing and schema discovery ([ADR-025](../.wiki/adr/ADR-025-deterministic-mcp-client-supervisor-and-sandbox-router.md)).
- **Interactive ANSI TUI**: Differential terminal timeline UI (`\x1b[?2026h` synchronized update mode) with 30+ interactive dashboard modals for live metrics, execution guard inspection, and session diagnostics.

### Q: What is the licensing model and IP protection?
LUMI-JOY is 100% open source under the **Apache License 2.0** and backed by a **Defensive Patent Non-Aggression Pledge** ([PATENT-NON-AGGRESSION-PLEDGE.md](../PATENT-NON-AGGRESSION-PLEDGE.md)). You are completely free to use, modify, embed, and deploy LUMI-JOY in proprietary commercial software, internal developer platforms, or cloud infrastructure.

### Q: How quickly can an engineering team get started?
In under 60 seconds:
```bash
git clone https://github.com/CardSorting/LUMI-JOY.git
cd LUMI-JOY
npm install && npm run build
lumi --setup
```

---

## Related Documentation

- [Runtime Architecture Guide](RUNTIME_ARCHITECTURE_GUIDE.md)
- [Architecture & Subsystem Diagrams](ARCHITECTURE_DIAGRAMS.md)
- [Live Baseline Evidence](LIVE_BASELINE.json)
