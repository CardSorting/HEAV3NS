<div align="center">

# ⚡ LUMI-JOY

### **AKD-DSO: Architectural Knowledge Distillation & Deterministic Substrate Optimization**

*An enterprise-grade TypeScript agent framework engineered like a deterministic game engine—built on frame-perfect state snapshotting, contiguous slab memory, and biological osmosis self-mutation.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.19+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Ancestral Teacher](https://img.shields.io/badge/Ancestral%20Teacher-Hermes--Agent%20(Nous%20Research)-FFD700?style=for-the-badge&logo=github)](https://github.com/NousResearch/hermes-agent)
[![Academic Paper](https://img.shields.io/badge/Academic%20Paper-AKD--DSO-9C27B0?style=for-the-badge)](.wiki/whitepaper/AKD-DSO-ACADEMIC-WHITEPAPER.md)
[![Whitepaper](https://img.shields.io/badge/Whitepaper-Osmosis%20Paradigm-00C853?style=for-the-badge)](.wiki/whitepaper/OSMOSIS-WHITEPAPER.md)
[![Auto-Rolling Roadmap](https://img.shields.io/badge/Roadmap-Auto--Rolling-E91E63?style=for-the-badge)](.wiki/roadmap/AUTOROLLING-ROADMAP.md)
[![Package Matrix](https://img.shields.io/badge/Package%20Matrix-1--to--1%20Mapping-FF9800?style=for-the-badge)](.wiki/package-mappings/PACKAGE-MAPPING-MATRIX.md)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)

<br/>

| **Core Navigation** | **Documentation & Wiki** | **Subsystem Source Code** |
|---|---|---|
| 📌 [Executive Brief](#-why-lumi-joy-the-architectural-imperative) | 📖 [Author's Preface](PREFACE.md) | ⚡ [Composition Root](src/index.ts) |
| ⚡ [Comparison Matrix](#-comparison-matrix--empirical-benchmarks) | 🎮 [Game Engine Paradigm](#-inspired-by-game-engines-deterministic-agent-architecture) | 🏭 [Engine Factory](src/factories/monolith-factory.ts) |
| 🏛️ [Ancestral Heritage](#%EF%B8%8F-architectural-heritage--ancestral-lineage-the-hermes-agent-main-osmosis) | ⚡ [Runtime Universal Pass](.wiki/agent/runtime-universal-pass.md) | ⚙️ [Core Abstracts](src/core/abstracts/) |
| 🏗️ [Architecture Tree](#%EF%B8%8F-subsystem-architecture--file-tree) | 🏗️ [Runtime Architecture](docs/RUNTIME_ARCHITECTURE_GUIDE.md) | 🧠 [Agents Tier](src/agents/) |
| 🧪 [Osmosis Methodology](#-the-osmosis-learning-methodology) | 🎓 [Academic Whitepaper](.wiki/whitepaper/AKD-DSO-ACADEMIC-WHITEPAPER.md) | 💾 [Sessions Tier](src/sessions/) |
| 🚀 [Quick Start Guide](#-quick-start--installation) | 📦 [1-to-1 Package Matrix](.wiki/package-mappings/PACKAGE-MAPPING-MATRIX.md) | 🖥️ [TUI Components](src/tui/components/) |
| 📡 [Live Activity Streaming](#-live-agent-activity-streaming) | 📋 [API Reference Guide](.wiki/agent/api-reference.md) | 📜 [Core Contracts](src/core/contracts/) |
| 🤝 [Contributing Guide](CONTRIBUTING.md) | 🛡️ [Security Guardrails](.wiki/policy/CONTRIBUTOR-SECURITY-GUARDRAILS.md) | 🔧 [Tool Registry](src/tooling/extensions/registry/tool-registry.ts) |

---

</div>

---

## 📖 Author's Preface & Dedication

> *To my family, whose quiet encouragement and unconditional warmth gave me the space to dream, tinker, and build in the silence of late nights;*
>
> *To the visionary team at **Nous Research** and the vibrant **Hermes community**—where I have had the deep honor to serve as an ambassador, community mentor, and meetup contributor. You inspired me with the pure beauty of true open science, permissionless research, and the boundless power of open collaborators building together for the future of human agency;*
>
> *To the open-source community and the legendary pioneers of computer graphics who taught us that code can be written with craftsmanship, elegance, and soul;*
>
> *And to every builder who has ever looked at a bloated, sluggish system and believed, in their heart, that we could build something far more beautiful.*
>
> *This work is dedicated to you. May it serve as a humble gift back to the open world that taught me how to create.*

### A Letter from the Author

Behind every line of code in **LUMI-JOY** lies a simple, deeply human story: the quiet joy of tinkering, the thrill of chasing elegance, and a lifelong love for software that feels truly *alive*.

Serving as a community mentor and ambassador for Hermes, organizing meetups, and collaborating with the brilliant researchers and builders at Nous Research opened my eyes to what open science can achieve when people come together with generosity and curiosity. LUMI-JOY was built directly from that inspiration—a tribute to our open community.

— **William Andrew Cruz** (`bozoegg` / `CardSorting`), *Primary Author, Inventor & Hermes Ambassador*
📖 *Read the complete [Author's Preface & Dedication](PREFACE.md).*

---

## 🌟 Executive Summary: What LUMI-JOY Is & Why This Matters

**LUMI-JOY** is an enterprise-grade TypeScript autonomous AI agent framework engineered from the ground up like a **Deterministic Game Engine Kernel**.

### The Core Problem in Modern AI Agents
Traditional AI agent frameworks (such as LangChain, AutoGen, CrewAI, and uncoordinated REST micro-packages) treat LLM interactions as loose asynchronous network wrappers. This approach incurs severe structural bottlenecks:
- **Framework Soup & Latency**: Multi-package microservices and IPC queues introduce $14\text{ ms} - 500\text{ ms}$ of serialization overhead per turn before model reasoning even begins.
- **State Drift & Tool Desynchronization**: Multi-turn agent loops lose context and produce non-deterministic file edits when intermediate tool steps fail.
- **Garbage Collection (GC) Stutter**: Generating thousands of short-lived V8 heap objects per turn triggers Node.js garbage collection sweeps, causing stutter and memory pressure during live streaming.
- **Costly Re-Execution**: When an agent makes a mistake on turn 8, traditional frameworks require restarting the entire session from scratch.

### The Architectural Breakthrough: Game Engine Architecture for AI Agents
LUMI-JOY eliminates software friction by applying proven principles from high-performance video game physics and rendering engines:

| Core Architecture Pillar | Implementation Mechanism | Concrete Impact & Measured Result |
| :--- | :--- | :--- |
| 🕹️ **Deterministic Frame Ticks (`tick()`)** | Single-threaded atomic frame lifecycle (`Input -> Context Assembly -> Provider Dispatch -> State Mutation -> Telemetry`) | **$0.13\text{ ms}$ fast-path mean latency**; eliminates microservice queues |
| ⚡ **Zero-GC Contiguous Memory Slab** | 16MB pre-allocated `ArrayBuffer` slab (`ArenaAllocator`) with static cached UTF-8 encoders | **Zero Garbage Collection pauses** during live token streaming and rapid multi-tool loops |
| 🚀 **High-Throughput Execution** | In-process monolithic dispatch bypassing network IPC | **$7960.17\text{ frames/second}$** throughput ($>7.9\times$ above the $1,000\text{ fps}$ SLA) |
| ⏪ **$O(1)$ State Time-Travel (`rewindToSnapshot()`)** | Restores conversation transcripts, staged virtual files (`SessionVfs`), and memory facts (`SessionMemoryStore`) | **$0.021\text{ ms p95}$** instant rollback; enables multi-branch search (MCTS) |
| 🖥️ **Differential Terminal User Interface** | Synchronized ANSI cell rendering (`\x1b[?2026h`), adaptive box borders, syntax highlighting, fuzzy autocomplete | **Zero visual flicker**; borders never wrap on split-screen terminals |

### 🎯 Who This Is For & Why It Matters
- **For Developers**: Instant feedback, zero UI tearing, instant state rollback (`/rewind`) during iterative debugging without restarting the agent or re-parsing transcripts, and sub-millisecond execution without garbage collection pauses.
- **For AI Systems & Researchers**: Eliminating software friction enables high-frequency agent search techniques (Monte Carlo Tree Search, branch-and-bound, self-reflection loops) to run locally at thousands of frames per second instead of paying cloud microservice latency penalties.
- **For Enterprises & Leaders**: Dramatic reduction in infrastructure compute costs, deterministic predictable behavior with 0 state drift, enterprise OAuth PKCE security, and Apache 2.0 open-source licensing backed by a defensive patent non-aggression pledge.

---

## 👔 Role-Based Stakeholder Onboarding

Select your role for tailored navigation and onboarding instructions:

| Stakeholder Role | Primary Focus | Recommended Onboarding Path & Key Resources |
|---|---|---|
| 👔 **Executive & VP of Engineering** | ROI, Infrastructure Cost, Latency SLAs & Compliance | Read [Business & Technical ROI](#-business--technical-roi-highlights), evaluate [Benchmark SLA Matrix](#-comparison-matrix--empirical-benchmarks), and review [Apache 2.0 License](LICENSE) & [Defensive Patent Pledge](PATENT-NON-AGGRESSION-PLEDGE.md). |
| 🏗️ **Enterprise Architect & Tech Lead** | Monolith Topology, State Memory Substrates & DSL Engine | Inspect [3-Tier Architecture Tree](#%EF%B8%8F-subsystem-architecture--file-tree), review [Context DSL & Template Engine](#-multi-turn-context-lifecycle), and read [ADR-083 Context Lifecycle](.wiki/adr/ADR-083-token-aware-multi-turn-context-lifecycle.md). |
| 🔒 **Security & Compliance Officer** | Authentication Security, PKCE OAuth & Permission Gates | Audit [Live Activity Streaming](#-live-agent-activity-streaming), check [OpenAI Codex PKCE Setup](#2-provider-authentication--guided-setup), and review [ADR-082 Streaming Policy](.wiki/adr/ADR-082-structured-agent-activity-streaming.md). |
| 💻 **Software Engineer & Developer** | Installation, Local Shell Execution & TypeScript SDK | Follow 3-step [Quick Start](#-quick-start--onboarding), test [Programmatic SDK Usage](#programmatic-typescript-usage), and consult the [API Reference Guide](.wiki/agent/api-reference.md). |

### 🎯 Concrete Goals by Stakeholder Role

#### 👔 Executive & Engineering VP
- **Goal 1: Predictable Infrastructure Costs & High Density**: Enforce a deterministic fast-path floor of at least $1,000$ frames/second without microservice IPC overhead; consult the live baseline for the current host measurement.
- **Goal 2: Strict Turn Latency SLAs**: Enforce a mean deterministic fast-path latency below $1.0\text{ ms}$ through automated guardrail testing.
- **Goal 3: Enterprise Compliance**: Deploy under the Apache License 2.0 backed by an explicit Defensive Patent Non-Aggression Pledge.

#### 🏗️ Enterprise Architect & Technical Lead
- **Goal 1: Monolithic Simplicity over Monorepo Bloat**: Eliminate 18+ uncoordinated micro-packages in favor of a clean 3-tier TypeScript monolith (`agents`, `sessions`, `tooling`).
- **Goal 2: Zero-GC Memory Stability**: Prevent runtime garbage collection sweeps during live streaming using a contiguous 16MB ArrayBuffer substrate.
- **Goal 3: Deterministic Context Envelopes**: Replace raw string concatenation with `ContextDslEngine` AST parsing and `PromptTemplateEngine` conditional block rendering.

#### 🔒 Security & InfoSec Officer
- **Goal 1: PKCE OAuth Security**: Secure OpenAI Codex credentials using local PKCE authentication (`localhost:1455`) with encrypted disk storage (`~/.lumi/config.json`).
- **Goal 2: Redacted Telemetry**: Stream progress events (`CodexProgressAdapter`) without leaking raw chain-of-thought, tokens, secrets, or file contents.
- **Goal 3: Command & Permission Sandboxing**: Restrict execution via `CommandPermissionController` and validate all terminal commands before invocation.

#### 💻 Software Engineer & Developer
- **Goal 1: Instant Local Setup**: Get up and running in under 60 seconds with `npm install` and `npx tsx src/index.ts --setup`.
- **Goal 2: Frame-Perfect State Rewind**: Perform $O(1)$ state restoration under the enforced $0.1\text{ ms}$ warmed-p95 guardrail during iterative agent debugging.
- **Goal 3: Type-Safe Programmatic SDK**: Embed `LumiMonolith` seamlessly into node applications with full TypeScript autocompletion and progress callbacks.

## 💡 Why LUMI-JOY? (The Architectural Imperative)

Traditional AI agent frameworks (LangChain, AutoGen, CrewAI, and raw provider wrappers) suffer from systemic architectural flaws that limit their enterprise production readiness:

| Architectural Challenge | Traditional Agent Frameworks | AKD-DSO Engine (`LUMI-JOY`) | Business & Technical Impact |
|---|---|---|---|
| **Framework Overhead** | 18+ micro-packages with RPC/IPC queues | **Single 3-tier monolith** (`agents`, `sessions`, `tooling`) | **Measured deterministic fast path with $<1.0\text{ ms}$ latency SLA** |
| **Context Safety & DSL** | Loose string joins prone to prompt injection | **Formal `ContextDslEngine` AST parsing & SHA-256 digests** | **Deterministic context bounds & injection defense** |
| **Memory & GC Latency** | Dynamic heap allocations causing V8 GC sweeps | **Contiguous 16MB ArrayBuffer zero-GC substrate** | **Zero Garbage Collection pauses during live streaming** |
| **State Rewind & Audit** | Slow transcript re-parsing | **$O(1)$ in-memory snapshot restoration** | **Warmed-p95 guardrail below $0.1\text{ ms}$ and frame-perfect state verification** |

---

## 🎮 Inspired by Game Engines: Deterministic Agent Architecture

Traditional AI agent frameworks treat LLM interactions as loose async request/response handlers or stateless REST calls, leading to state drift, non-reproducible execution paths, and V8 Garbage Collection latency spikes.

**LUMI-JOY was explicitly engineered like a Deterministic Game Engine kernel.** By adapting core principles from high-performance game engine architecture, LUMI-JOY brings frame-perfect isolation, sub-millisecond turn discipline, and zero-GC memory stability to autonomous AI agents.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DETERMINISTIC GAME ENGINE TURN LOOP                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [ User Input / CLI Trigger ]                                              │
│               │                                                             │
│               ▼                                                             │
│   ┌─────────────────────────┐                                               │
│   │ Frame Tick (tick())     │ ◄─── Input ───► DSL Context Projection        │
│   └───────────┬─────────────┘                                               │
│               │                                                             │
│               ▼                                                             │
│   ┌─────────────────────────┐                                               │
│   │ Provider Dispatch       │ ◄─── Streaming Events & Activity Timeline     │
│   └───────────┬─────────────┘                                               │
│               │                                                             │
│               ▼                                                             │
│   ┌─────────────────────────┐                                               │
│   │ Immutable State Snapshot│ ◄─── GameStateSnapshot (VFS Overlay + Memory) │
│   └───────────┬─────────────┘                                               │
│               │                                                             │
│               ▼                                                             │
│   [ O(1) Rewind / Subagent ] ◄─── rewindToSnapshot() (< 0.1ms p95)          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Game Engine Architectural Parallels

| Game Engine Concept | Traditional Agent Frameworks | LUMI-JOY Game Engine Implementation | Technical & Operational Advantage |
|---|---|---|---|
| 🕹️ **Frame Tick (`tick()`)** | Loose async handlers & event emitters | **Deterministic frame step (`AbstractAgentEngine.tick()`)** | Serializes turn processing in a strict frame cycle (`Input -> Context Assembly -> Dispatch -> Mutation -> Telemetry`). |
| 💾 **Game Save / Frame Snapshot** | Serialized text transcript re-parsing | **`GameStateSnapshot` (In-memory frame snapshotting)** | Captures complete engine state (VFS staged overlays, memory store, token budgets, turn index) at frame $t$. |
| ⏪ **Frame Rewind & Replay** | Manual context re-building or restart | **$O(1)$ State Rewind (`rewindToSnapshot()`)** | Sub-millisecond ($<0.1\text{ ms}$ warmed p95) time-travel rollback for instant turn debugging & subagent state branching. |
| ⚡ **Arena Memory Allocator** | Dynamic heap allocation per turn | **Contiguous 16MB ArrayBuffer slab (`ArenaAllocator`)** | Pre-allocated slab eliminates V8 Garbage Collection (GC) latency pauses during live streaming & tick execution. |
| 🌿 **Scene & Subagent Branching** | Shared mutable global state | **Child Session Forking (`AgentSwarmDispatcher`)** | Subagent tasks spawn isolated child engine instances pre-initialized from parent state snapshots (`createSnapshot()`). |

> 📖 For full technical details and architectural specs, read [ADR-008: Deterministic Game Engine Architecture](.wiki/adr/ADR-008-deterministic-game-engine-architecture.md) and [The Osmosis Paradigm Whitepaper](.wiki/whitepaper/OSMOSIS-WHITEPAPER.md).

---

## 🏛️ Architectural Heritage & Ancestral Lineage: The Hermes-Agent-Main Osmosis

**LUMI-JOY** stands proudly on the shoulders of open-source giants. It was forged through the **AKD-DSO (Architectural Knowledge Distillation & Deterministic Substrate Optimization)** Osmosis paradigm, taking foundational inspiration, structural domain patterns, and functional breadth directly from its ancestral teacher: [`hermes-agent`](https://github.com/NousResearch/hermes-agent) (**Nous Research**).

### 🌟 Deep Credit to Nous Research & The Hermes Agent Community

We express our deepest admiration, professional respect, and gratitude to **Nous Research** ([nousresearch.com](https://nousresearch.com)), their pioneering research scientists, engineers, and the vibrant open-source contributor community on GitHub and Discord (`#plugins-skills-and-skins`).

The open AI community owes an immense debt to Nous Research for championing unconstrained reasoning models and open agent architectures:
- **Pioneering Open Weights & Unconstrained Reasoning**: From the breakthrough Nous-Hermes, Hermes 2, and Hermes 3 model families to modern agentic tool-use, Nous Research has consistently proven that open-source intelligence can compete with and surpass closed frontier systems.
- **The Self-Improving Agent Loop**: `hermes-agent` invented the open paradigm of closed learning loops—where an agent autonomously creates skills from experiential problem solving, refines them during execution, and shares them via the open [`agentskills.io`](https://agentskills.io) standard.
- **True Multi-Platform Universality**: Proving that an agent shouldn't be confined to a browser or laptop by orchestrating unified sessions across Telegram, Discord, Slack, WhatsApp, Signal, Matrix, and 15+ other platforms.
- **Empowering User Sovereignty**: Designing agents that run anywhere—from a $5 VPS to high-performance GPU clusters—with zero telemetry lock-in and complete model neutrality.

### 💖 A Personal Reflection from the Author: The Power of Open Science & Collaboration

> *"As an ambassador and community mentor for Hermes, contributing to Nous Research through local meetups, workshops, and open collaborations has been one of the greatest honors of my engineering journey. Nous Research embodies the purest ethos of open science: breaking down artificial moats, sharing weights and knowledge freely, and welcoming anyone with curiosity to sit at the table and build.*
>
> *Every time our community gathers—engineers, students, dreamers, and researchers swapping ideas over terminal prompts—I am reminded of why open source matters. LUMI-JOY was built not in isolation, but as a direct reflection of that collaborative fire: taking the brilliant design patterns pioneered in Hermes Agent and distilling them into a lightning-fast, deterministic game-engine substrate for the entire open-source world to build upon."*
> — **William Andrew Cruz** (`bozoegg` / `CardSorting`), *Hermes Ambassador & Community Mentor*

### 🔄 The Osmotic Distillation Journey

While the ancestral teacher implemented these capabilities in a rich, multi-platform Python ecosystem, **LUMI-JOY** embarked on an intensive, highly scrutinized architectural distillation pass. We audited every major subsystem of `hermes-agent`, extracted its pure domain intent, and transmuted it into a unified, zero-GC, typed TypeScript deterministic game engine monolith operating over Broccolidb with frame-perfect $O(1)$ state snapshotting.

### 🧬 The 41 Distilled Osmotic Subsystems

| # | Ancestral Teacher Subsystem (`hermes-agent-main`) | Distilled Student Subsystem (`LUMI-JOY`) | Phase / ADR | Osmotic Transformation & Architectural Advantage |
|:---:|---|---|---|---|
| **1** | `skills/` & Skills Ingestor | **Evolutionary Skill Tree System** (`EvolutionarySkillEngine`, `DeterministicSkillCurator`, `SkillTreeToolSuite`) | Phase 61 / [ADR-013](.wiki/adr/ADR-013-deterministic-evolutionary-skill-tree-dag.md) | Transmuted into a topological DAG with prerequisite unlocks, Trojan Unicode sanitization, exponential decay, and frame-perfect $O(1)$ rollback. |
| **2** | `cron/` Scheduler & Job Loops | **Self-Healing Cron Kernel & Blueprints** (`MonolithCronScheduler`, `DeterministicBlueprintCatalog`, `CronToolSuite`) | Phase 64 / [ADR-016](.wiki/adr/ADR-016-deterministic-cron-kernel-and-job-blueprints.md) | Replaced unbounded background threads with single-threaded deterministic frame-tick synchronization, recursive trigger guards, and Broccolidb ring buffers. |
| **3** | `tools/browser_tool.py` (Playwright / CDP) | **Intelligent CDP Browser Supervisor** (`CdpBrowserSupervisorEngine`, `DomTreeSanitizer`, `CdpToolSuite`) | Phase 65 / [ADR-017](.wiki/adr/ADR-017-deterministic-cdp-browser-supervisor.md) | Eliminated massive raw DOM string bloat with structural semantic tree sanitization, CSS selector synthesis, and interactive session capture. |
| **4** | `credential_pool.py` & Key Rotation | **Deterministic Token-Bucket Credential Pool** (`ContinuousTokenBucketRateGovernor`, `DeterministicCredentialPool`, `CredentialToolSuite`) | Phase 66 / [ADR-018](.wiki/adr/ADR-018-deterministic-credential-pool-and-circuit-breaker.md) | Replaced random sleep loops with mathematical continuous token-bucket rate governance, provider-tier prioritization, and automated tri-state circuit breaking. |
| **5** | `gateway/` (20+ Messaging Platforms) | **Multi-Platform Messaging Gateway** (`GatewayDispatcherEngine`, `GatewayDeliveryLedger`, `Telegram/Discord/Slack/WebhookAdapters`) | Phase 67 / [ADR-019](.wiki/adr/ADR-019-unified-multi-platform-messaging-gateway.md) | Unified multi-platform messaging into typed streaming protocol adapters with idempotency deduplication and sub-millisecond dispatching. |
| **6** | Context Compaction & Truncation | **Semantic Context Compression & Compaction** (`TrajectoryCompactorEngine`, `HeadTailBudgetGovernor`, `DeterministicToolPruner`) | Phase 68 / [ADR-020](.wiki/adr/ADR-020-deterministic-semantic-context-compression.md) | Eliminated naive string truncation with structural tool call pair pruning, head/tail token budgeting, and zero-loss semantic trajectory summarization. |
| **7** | `hermes_state.py` (SQLite FTS5 Search) | **Deterministic Inverted-Index & Search Engine** (`DeterministicSessionSearchEngine`, `FtsQuerySanitizer`, `BroccoliSearchSubstrate`) | Phase 69 / [ADR-021](.wiki/adr/ADR-021-deterministic-session-search-engine.md) | Replaced C SQLite binary dependencies with an in-memory BM25-ranked inverted index operating in Broccolidb with instant sub-millisecond recall. |
| **8** | `tools/environments/` (Local / Docker / SSH) | **Multi-Backend Execution Environments** (`EnvironmentSupervisorEngine`, `LocalEnvironmentAdapter`, `DockerEnvironmentAdapter`, `SecretScrubber`) | Phase 70 / [ADR-022](.wiki/adr/ADR-022-deterministic-execution-environments-and-container-sandboxes.md) | Added automated entropy-based secret scrubbing, container resource limits, and frame-level state isolation across execution backends. |
| **9** | `agent/error_classifier.py` (2,000 LOC Regex) | **Intelligent Error Taxonomy & Fault Recovery** (`DeterministicErrorClassifier`, `JitteredBackoffGovernor`, `FaultRecoverySupervisor`) | Phase 71 / [ADR-023](.wiki/adr/ADR-023-deterministic-error-taxonomy-and-automated-fault-recovery.md) | Replaced raw regex substring matching and non-deterministic random jitter with typed fault taxonomy, Mulberry32 PRNG backoff, and actionable recovery directives. |
| **10** | `acp_adapter/` (2,500 LOC Server) | **Agent Client Protocol (ACP) IDE Bridge** (`AcpBridgeServer`, `AcpProtocolCodec`, `AcpPermissionGate`, `AcpToolSuite`) | Phase 72 / [ADR-024](.wiki/adr/ADR-024-deterministic-agent-client-protocol-and-ide-bridge.md) | Transmuted async Python queues into strict JSON-RPC 2.0 codecs, interactive permission gates, and real-time streaming progress multiplexers for VS Code, Zed, and JetBrains. |
| **11** | `tools/mcp_tool.py` (7,750 LOC Client) | **Model Context Protocol (MCP) Client Supervisor** (`McpSupervisorEngine`, `McpTransportCodec`, `McpSecurityScrubber`, `McpClientToolSuite`) | Phase 73 / [ADR-025](.wiki/adr/ADR-025-deterministic-mcp-client-supervisor-and-sandbox-router.md) | Transmuted async daemon loops and unscrubbed subprocesses into typed JSON-RPC 2.0 streaming codecs, automated credential scrubbing, and Broccolidb tool discovery. |
| **12** | `tools/process_registry.py` (6,875 LOC Process Engine) | **Interactive Process Registry & PTY Supervisor** (`ProcessSupervisorEngine`, `ProcessOutputRingBuffer`, `ProcessSecuritySandbox`, `ProcessToolSuite`) | Phase 74 / [ADR-026](.wiki/adr/ADR-026-deterministic-process-registry-and-pty-supervisor.md) | Transmuted zombie daemon leaks and rolling string slicing into zero-GC 256KB circular byte buffers, command safety gates, and Broccolidb process substrates. |
| **13** | `tools/approval.py` (7,100+ LOC Approval Gate) | **Human-in-the-Loop Approval & Interactive Security Arbiter** (`InteractiveSecurityArbiter`, `SecurityRiskClassifier`, `ApprovalHashLedger`, `ArbiterToolSuite`) | Phase 75 / [ADR-027](.wiki/adr/ADR-027-deterministic-human-in-the-loop-approval-and-security-arbiter.md) | Transmuted sprawling regex heuristics and thread-unsafe environment variables into typed risk taxonomies, SHA-256 allowlist ledgers, and emergency E-Stop killswitches. |
| **14** | `agent/curator.py` & `agent/memory_manager.py` (11,000+ LOC Memory Subsystem) | **Persistent Memory Substrate, Knowledge Graph & Continuous Learning Curator** (`ContinuousLearningCurator`, `SemanticKnowledgeGraph`, `BroccoliLearningSubstrate`, `LearningSnapshotManager`, `LearningCuratorToolSuite`) | Phase 76 / [ADR-028](.wiki/adr/ADR-028-deterministic-knowledge-graph-and-continuous-learning-curator.md) | Transmuted sprawling ThreadPool daemon syncs and ad-hoc Markdown files into typed entity-relation graph DAGs, in-memory Broccolidb storage, mathematical exponential decay, and prompt envelopes. |
| **15** | `tools/file_tools.py` & `tools/patch_parser.py` (9,400+ LOC File System Subsystem) | **Deterministic Unified Patch Engine, Atomic Mutation Substrate & VFS** (`DeterministicPatchEngine`, `BroccoliPatchSubstrate`, `PatchSnapshotManager`, `AtomicMutationSupervisor`, `FileMutationToolSuite`) | Phase 77 / [ADR-029](.wiki/adr/ADR-029-deterministic-unified-patch-engine-and-atomic-mutation-substrate.md) | Transmuted blocking direct filesystem calls and partial-write corruption into typed patch ASTs, in-memory Broccolidb staging substrates, pre-flight dry-runs, and frame-perfect rollback. |
| **16** | `agent/lsp/` (4,100+ LOC LSP & Code Perception Subsystem) | **Deterministic LSP, AST Code Intelligence & Semantic Diagnostic Substrate** (`DeterministicLspEngine`, `BroccoliLspSubstrate`, `LspSnapshotManager`, `SemanticCodeSupervisor`, `LspCodeIntelligenceToolSuite`) | Phase 78 / [ADR-030](.wiki/adr/ADR-030-deterministic-lsp-and-semantic-code-intelligence.md) | Transmuted background daemon event loops and external binary dependencies into in-memory zero-GC AST symbol perception, delta diagnostic baselining, and frame-perfect rollback. |
| **17** | `tools/voice_mode.py`, `tools/tts_tool.py`, `tools/transcription_tools.py` (12,000+ LOC Voice Subsystem) | **Deterministic Voice Mode, Speech Perception & Real-Time Audio Streaming Substrate** (`DeterministicAudioCodec`, `BroccoliVoiceSubstrate`, `VoiceSnapshotManager`, `VoiceSpeechSupervisor`, `VoiceSpeechToolSuite`) | Phase 79 / [ADR-031](.wiki/adr/ADR-031-deterministic-voice-mode-and-audio-streaming.md) | Transmuted unmanaged thread pools, temporary disk files, and host audio subprocesses into in-memory zero-GC RIFF WAV codecs, RMS signal energy VAD, Broccolidb audio ring buffers, and frame-perfect rollback. |
| **18** | `tools/vision_tools.py`, `tools/image_generation_tool.py`, `tools/image_source.py` (7,500+ LOC Vision Subsystem) | **Deterministic Multimodal Vision, Visual Perception & Image Codec Substrate** (`DeterministicImageCodec`, `BroccoliVisionSubstrate`, `VisionSnapshotManager`, `MultimodalVisionSupervisor`, `MultimodalVisionToolSuite`) | Phase 80 / [ADR-032](.wiki/adr/ADR-032-deterministic-multimodal-vision-and-visual-perception.md) | Transmuted raw base64 string bloat, Pillow/subprocess dependencies, and temporary disk files into in-memory zero-GC binary image header decoders, SHA-256 deduplicated media storage, aspect ratio reduction, and frame-perfect rollback. |
| **19** | `tools/kanban_tools.py`, `plugins/kanban/`, `tools/todo_tool.py` (6,300+ LOC Kanban Subsystem) | **Deterministic Kanban Board Dispatcher, Task DAG & Multi-Agent Issue Orchestrator** (`DeterministicKanbanEngine`, `BroccoliKanbanSubstrate`, `KanbanSnapshotManager`, `KanbanBoardSupervisor`, `KanbanOrchestrationToolSuite`) | Phase 81 / [ADR-033](.wiki/adr/ADR-033-deterministic-kanban-board-and-task-orchestrator.md) | Transmuted raw disk SQLite contention, untyped transitions, and unmanaged worker dispatch races into in-memory topological DAG dependency resolution, strict column state-machine validation, cycle prevention, and frame-perfect rollback. |
| **20** | `tools/web_tools.py`, `tools/url_safety.py`, `tools/read_extract.py`, `tools/website_policy.py`, `tools/x_search_tool.py`, `plugins/web/` (4,000+ LOC Web Subsystem) | **Deterministic Web Intelligence, Semantic Extraction & SSRF URL Guardrail Substrate** (`DeterministicWebEngine`, `BroccoliWebSubstrate`, `WebSnapshotManager`, `WebIntelligenceSupervisor`, `WebIntelligenceToolSuite`) | Phase 82 / [ADR-034](.wiki/adr/ADR-034-deterministic-web-intelligence-and-ssrf-guardrails.md) | Transmuted blocking DNS calls, TOCTOU DNS rebinding, cloud metadata SSRF leaks, and heavy third-party vendor dependencies into in-memory zero-GC CIDR firewalls, HTML-to-Markdown semantic extractors, and frame-perfect rollback. |
| **21** | `tools/code_execution_tool.py`, `tools/thread_context.py`, `tools/lazy_deps.py` (3,350+ LOC Code Execution Subsystem) | **Deterministic Programmatic Tool Execution & Scripting Sandbox Subsystem** (`DeterministicCodeExecutor`, `BroccoliExecutionSubstrate`, `ExecutionSnapshotManager`, `CodeExecutionSupervisor`, `CodeExecutionToolSuite`) | Phase 83 / [ADR-035](.wiki/adr/ADR-035-deterministic-programmatic-tool-execution-and-scripting-sandbox.md) | Transmuted raw Unix domain sockets, disk file polling, and child subprocess spawning into in-memory zero-GC VM sandboxes with direct in-process tool binding and frame-perfect rollback. |
| **22** | `batch_runner.py`, `mini_swe_runner.py`, `trajectory_compressor.py` (2,560+ LOC Batch & Benchmark Subsystem) | **Deterministic Batch Evaluation, SWE Benchmark Runner & Dataset Orchestration Substrate** (`DeterministicBatchEvaluator`, `BroccoliBatchSubstrate`, `BatchSnapshotManager`, `BatchEvaluationSupervisor`, `BatchEvaluationToolSuite`) | Phase 84 / [ADR-036](.wiki/adr/ADR-036-deterministic-batch-evaluation-and-benchmark-runner.md) | Transmuted heavy OS process forking, non-deterministic random sampling, and disk-locked JSONL checkpointing into in-memory zero-GC concurrent worker pools with Mulberry32 PRNG and frame-perfect rollback. |
| **23** | `tools/clarify_tool.py`, `tools/clarify_gateway.py`, `tools/terminal_hints.py`, `tools/slash_confirm.py` (1,820+ LOC Clarification Subsystem) | **Deterministic Clarification, Interactive Inquiry & Intent Disambiguation Substrate** (`DeterministicClarifyEngine`, `BroccoliClarifySubstrate`, `ClarifySnapshotManager`, `ClarifyInquirySupervisor`, `ClarifyInquiryToolSuite`) | Phase 85 / [ADR-037](.wiki/adr/ADR-037-deterministic-clarification-and-intent-disambiguation.md) | Transmuted blocking OS thread events, unbounded global dictionaries, and string coercion leaks into in-memory zero-GC inquiry state machines with automated recommendation tagging and frame-perfect rollback. |
| **24** | `tools/threat_patterns.py`, `tools/skills_guard.py`, `tools/tirith_security.py`, `tools/self_repo_guard.py` (3,060+ LOC Threat & Safety Subsystem) | **Deterministic Threat Pattern Scanner, Code Safety & Security Firewall Substrate** (`DeterministicThreatScanner`, `BroccoliThreatSubstrate`, `ThreatSnapshotManager`, `ThreatFirewallSupervisor`, `ThreatFirewallToolSuite`) | Phase 86 / [ADR-038](.wiki/adr/ADR-038-deterministic-threat-scanner-and-security-firewall.md) | Transmuted ReDoS backtracking hazards, external binary subprocess downloads, and git CLI queries into in-memory zero-GC compiled pattern regex engines with trust matrices and frame-perfect rollback. |
| **25** | `tools/checkpoint_manager.py` (1,950+ LOC Checkpoint Subsystem) | **Deterministic Content-Addressable Blob Store, Filesystem Checkpoint Kernel & State Branch Tree Substrate** (`DeterministicCasStore`, `BroccoliCheckpointSubstrate`, `CheckpointSnapshotManager`, `CheckpointKernelSupervisor`, `CheckpointKernelToolSuite`) | Phase 87 / [ADR-039](.wiki/adr/ADR-039-deterministic-cas-store-and-checkpoint-kernel.md) | Transmuted heavy Git CLI child subprocesses, synchronous disk object writes, and index lock collisions into an in-memory zero-GC Content-Addressable Storage (CAS) engine with SHA-256 Merkle tree deduplication and frame-perfect rollback. |
| **26** | `tools/computer_use/` (7,000+ LOC Computer Use Subsystem) | **Deterministic Computer Use, Virtual Display Buffer & OS Automation Substrate** (`DeterministicDisplayDriver`, `BroccoliDisplaySubstrate`, `DisplaySnapshotManager`, `ComputerUseSupervisor`, `ComputerUseToolSuite`) | Phase 88 / [ADR-040](.wiki/adr/ADR-040-deterministic-computer-use-and-display-driver.md) | Transmuted external `cua-driver` daemons, OS window focus stealing, and subprocess screenshot delays into an in-memory zero-GC virtual display driver with Set-of-Marks (SoM) element overlays and frame-perfect rollback. |
| **27** | `tools/skills_hub.py`, `tools/skills_sync_client.py` (11,000+ LOC Skills Hub Subsystem) | **Deterministic Skills Hub, Remote Registry Sync & Package Quarantine Substrate** (`DeterministicSkillsHub`, `BroccoliSkillsHubSubstrate`, `SkillsHubSnapshotManager`, `SkillsHubSupervisor`, `SkillsHubToolSuite`) | Phase 89 / [ADR-041](.wiki/adr/ADR-041-deterministic-skills-hub-and-package-quarantine.md) | Transmuted heavy network HTTP loops, Git CLI clone subprocesses, unmanaged lockfiles, and quarantine disk races into an in-memory zero-GC skills hub with SHA-256 package verification, SemVer resolution, and quarantine isolation. |
| **28** | `agent/usage_pricing.py`, `agent/credits_tracker.py` (6,000+ LOC Cost Subsystem) | **Deterministic Model Pricing, Token Accounting & Cost Governance Substrate** (`DeterministicCostGovernor`, `BroccoliCostSubstrate`, `CostSnapshotManager`, `CostGovernanceSupervisor`, `CostGovernanceToolSuite`) | Phase 90 / [ADR-042](.wiki/adr/ADR-042-deterministic-model-pricing-and-cost-governance.md) | Transmuted scattered float roundoff, sub-cent display truncations (#79220), network price lookups, and un-gated budget runs into an in-memory zero-GC governor with micro-cent integer arithmetic, pre-flight hard-cap gating, and frame-perfect rollback. |
| **29** | `tools/tool_search.py`, `tools/schema_sanitizer.py` (3,500+ LOC Disclosure Subsystem) | **Deterministic Progressive Tool Disclosure, Dynamic Schema Gateway & Deferred Tooling Substrate** (`DeterministicToolDiscloser`, `BroccoliDisclosureSubstrate`, `ToolDisclosureSnapshotManager`, `ToolDisclosureSupervisor`, `ToolDisclosureToolSuite`) | Phase 91 / [ADR-043](.wiki/adr/ADR-043-deterministic-progressive-tool-disclosure.md) | Transmuted eager tool array bloat (30k+ tokens), stateless regex string rebuilds, and un-indexed bridge searches into a 4-tier token-budgeted progressive disclosure engine with BM25 filtering, dynamic activation, and frame-perfect rollback. |
| **30** | `agent/verification_evidence.py`, `agent/verification_stop.py` (3,800+ LOC Evidence Subsystem) | **Deterministic Coding Verification Evidence Ledger, Stop-Gate Policy & Session Insights Substrate** (`DeterministicEvidenceLedger`, `BroccoliEvidenceSubstrate`, `EvidenceSnapshotManager`, `VerificationEvidenceSupervisor`, `VerificationEvidenceToolSuite`) | Phase 92 / [ADR-044](.wiki/adr/ADR-044-deterministic-verification-evidence-ledger.md) | Transmuted disk SQLite evidence databases, coarse thread locks, and ad-hoc regex stop guards into an in-memory zero-GC evidence ledger with automated code path classification, stop-gate nudges, and frame-perfect rollback. |
| **31** | `agent/prompt_builder.py`, `agent/prompt_caching.py` (6,200+ LOC Prompt Cache Subsystem) | **Deterministic Byte-Stable Prompt Cache Boundary, Progressive System Envelope & Reasoning Sanitizer Substrate** (`DeterministicPromptCacher`, `BroccoliPromptCacheSubstrate`, `PromptCacheSnapshotManager`, `PromptCacheSupervisor`, `PromptCacheToolSuite`) | Phase 93 / [ADR-045](.wiki/adr/ADR-045-deterministic-prompt-cache-boundary.md) | Transmuted mid-conversation cache invalidations, in-place dictionary mutations, and raw `<think>` token leakage into an in-memory zero-GC prompt cache boundary calculator with 4-breakpoint layout, byte-stable static prefix isolation, and frame-perfect rollback. |
| **32** | `agent/tool_executor.py`, `agent/tool_guardrails.py` (8,500+ LOC Execution Guard Subsystem) | **Deterministic Tool Execution Segmenter, Batch Parallelism Scheduler & Loop-Guardrail Substrate** (`DeterministicToolSegmenter`, `BroccoliExecutionGuardSubstrate`, `ExecutionGuardSnapshotManager`, `ToolExecutionGuardSupervisor`, `ToolExecutionGuardToolSuite`) | Phase 94 / [ADR-046](.wiki/adr/ADR-046-deterministic-tool-execution-segmenter.md) | Transmuted unbounded thread-pool races, unmanaged batch segments, and infinite loop oscillations into an in-memory zero-GC batch parallelism scheduler with mutating barrier placement, escalating anti-loop gates, and frame-perfect rollback. |
| **33** | `agent/redact.py`, `agent/file_safety.py` (2,500+ LOC Redaction Subsystem) | **Deterministic Secret Redactor, Query Masker & Sensitive Path Safety Substrate** (`DeterministicSecretRedactor`, `BroccoliRedactionSubstrate`, `RedactionSnapshotManager`, `SecretRedactionSupervisor`, `SecretRedactionToolSuite`) | Phase 95 / [ADR-047](.wiki/adr/ADR-047-deterministic-secret-redaction-and-path-safety.md) | Transmuted unbounded regex backtracking, un-tracked path blocklists, and credential leaks into an in-memory zero-GC secret redactor with query/body masking, suffix-preservation rules, path safety gating, and frame-perfect rollback. |
| **34** | `agent/background_review.py`, `agent/insights.py` (3,500+ LOC Review Subsystem) | **Deterministic Background Review, Self-Improvement Fork & Session Insights Substrate** (`DeterministicReviewEvaluator`, `BroccoliReviewSubstrate`, `ReviewSnapshotManager`, `BackgroundReviewSupervisor`, `BackgroundReviewToolSuite`) | Phase 96 / [ADR-048](.wiki/adr/ADR-048-deterministic-background-review-and-insights.md) | Transmuted unmanaged daemon threads, raw SQLite queries, and un-tracked candidate facts into an in-memory zero-GC review evaluator with token/cost insights, topic title synthesis, and frame-perfect rollback. |
| **35** | `hermes_cli/doctor.py`, `hermes_cli/session_recovery.py` (6,000+ LOC Doctor & Salvage Subsystem) | **Deterministic Diagnostic Doctor, Live Health Probing, Orphaned Session Salvage & State Integrity Substrate** (`DeterministicDiagnosticDoctor`, `BroccoliDoctorSubstrate`, `DoctorSnapshotManager`, `DiagnosticDoctorSupervisor`, `DiagnosticDoctorToolSuite`) | Phase 97 / [ADR-049](.wiki/adr/ADR-049-deterministic-diagnostic-doctor-and-session-salvage.md) | Transmuted scattered subprocess scripts, raw SQLite WAL recovery routines, and ad-hoc doctor heuristics into an in-memory zero-GC diagnostic engine with orphaned turn repair, live subsystem probing, and frame-perfect rollback. |
| **36** | `hermes_cli/auth.py`, `hermes_cli/copilot_auth.py` (14,000+ LOC Auth Subsystem) | **Deterministic OAuth2 PKCE Device Flow, Multi-Provider Identity Federation & Subscription Tier Governance Substrate** (`DeterministicAuthFederator`, `BroccoliAuthSubstrate`, `AuthSnapshotManager`, `IdentityFederationSupervisor`, `IdentityFederationToolSuite`) | Phase 98 / [ADR-052](.wiki/adr/ADR-052-deterministic-identity-federation-and-auth-governance.md) | Transmuted sprawling HTTP server callback daemons, unmanaged poll threads, and raw file locks into an in-memory zero-GC identity federator with RFC 7636 PKCE S256 verification, subscription tier matrix gating, and frame-perfect rollback. |
| **37** | `hermes_cli/backup.py`, `hermes_cli/session_export_html.py` (5,000+ LOC Export/Backup Subsystem) | **Deterministic Multi-Format Session Export, Archive Packaging & Encrypted Backup Substrate** (`DeterministicSessionArchiver`, `BroccoliArchiveSubstrate`, `ArchiveSnapshotManager`, `SessionArchiveSupervisor`, `SessionArchiveToolSuite`) | Phase 99 / [ADR-053](.wiki/adr/ADR-053-deterministic-multi-format-session-archive-and-backups.md) | Transmuted blocking zipfile compression routines, unescaped HTML concatenation hazards, and raw disk file dumps into an in-memory zero-GC multi-format session exporter with strict CSP, SHA-256 verification, and frame-perfect rollback. |
| **38** | `hermes_cli/skin_engine.py`, `hermes_cli/banner.py` (4,000+ LOC Skin/Banner Subsystem) | **Deterministic Terminal UI Skin Engine, Theme Palette & Animated Banner Substrate** (`DeterministicSkinEngine`, `BroccoliSkinSubstrate`, `SkinSnapshotManager`, `TerminalSkinSupervisor`, `TerminalSkinToolSuite`) | Phase 100 / [ADR-054](.wiki/adr/ADR-054-deterministic-terminal-skin-and-palette-engine.md) | Transmuted disk theme lookups, random spinner flicker, and ANSI regex string formatting hazards into an in-memory zero-GC terminal skin engine with TrueColor palette resolution, seedable Kawaii spinner state machines, and frame-perfect rollback. |
| **39** | `agent/auxiliary_client.py` (10,500+ LOC Auxiliary Subsystem) | **Deterministic Auxiliary Client Router, Sub-Task Fallback Chain & Dynamic User Model Selection Substrate** (`DeterministicAuxiliaryRouter`, `BroccoliAuxiliarySubstrate`, `AuxiliarySnapshotManager`, `AuxiliaryRouterSupervisor`, `AuxiliaryRouterToolSuite`) | Phase 101 / [ADR-055](.wiki/adr/ADR-055-deterministic-auxiliary-client-router-and-failover.md) | Transmuted hardcoded fallback chains, HTTP client leaks, and process monkey-patches into an in-memory zero-GC auxiliary task router with 100% dynamic user model selection, credit exhaustion failover, and frame-perfect rollback. |
| **40** | `agent/think_scrubber.py`, `agent/reasoning_timeouts.py`, `agent/reasoning_summaries.py` (15,000+ LOC Reasoning Subsystem) | **Deterministic Streaming Reasoning Scrubber, Chunk-Boundary Tag Parser, Dynamic Timeout Floor & Adaptive Thinking Budget Substrate** (`DeterministicReasoningScrubber`, `BroccoliReasoningSubstrate`, `ReasoningSnapshotManager`, `ReasoningSupervisor`, `ReasoningToolSuite`) | Phase 102 / [ADR-056](.wiki/adr/ADR-056-deterministic-streaming-reasoning-scrubber-and-budgets.md) | Transmuted regex boundary leaks and premature stale timeouts into an in-memory zero-GC streaming tag scrubber with chunk-boundary lookahead, dynamic timeout floors, adaptive effort budgets, and frame-perfect rollback. |
| **41** | `tools/fuzzy_match.py` (49,500+ LOC Fuzzy Matching Subsystem) | **Deterministic 9-Strategy Fuzzy Line Matcher, Unicode Typography Normalizer, Block-Anchor Resolver & Edit Idempotency Substrate** (`DeterministicFuzzyMatcher`, `BroccoliFuzzySubstrate`, `FuzzySnapshotManager`, `FuzzyMatcherSupervisor`, `FuzzyMatcherToolSuite`) | Phase 103 / [ADR-057](.wiki/adr/ADR-057-deterministic-fuzzy-line-matcher-and-idempotency.md) | Transmuted Python difflib loops, whitespace mismatches, and duplicate re-patch failures into an in-memory zero-GC 9-strategy fuzzy matching cascade with Unicode typography normalization, idempotency verification, and frame-perfect rollback. |

---

## 🌟 Business & Technical ROI Highlights

- **⚡ Enforced Fast-Path Latency**: Direct function dispatch eliminates micro-package IPC/RPC queues; `ArchitectureGuardrailGate` requires mean local frame latency below $1.0\text{ ms}$.
- **📈 Enforced Fast-Path Throughput**: The same guardrail requires at least $1,000$ deterministic frames/second and records the host-specific observation in the live baseline.
- **🔄 $O(1)$ State Rewind**: In-memory snapshot restoration is verified for state correctness and a warmed p95 below $0.1\text{ ms}$.
- **🔒 Enterprise Security & OAuth PKCE**: Native PKCE OAuth 2.0 integration with zero-leak credential storage in `~/.lumi/config.json` and strict permission gates (`CommandPermissionController`).
- **🧠 Formal Context Envelope DSL & Template Engine**: Structured `ContextDslEngine` AST parsing (`LUMI-CONTEXT/1`, `LUMI-THREAD/1`, `LUMI-MEMORY/1`, `LUMI-TOOL-RESULT/1`, `LUMI-GOAL/1`) and `PromptTemplateEngine` (`{{#if}}`/`{{#unless}}`) prevent prompt injection and guarantee deterministic context control.
- **🛡️ Contiguous Zero-GC Substrate**: 16MB pre-allocated ArrayBuffer memory slab eliminates runtime Garbage Collection latency spikes.

### Latest verified workspace baseline

The authoritative run was generated on **2026-08-16T07:54:59.840Z** using Node.js `v23.5.0` on macOS ARM64. It passed:

| Verification lane | Latest result |
|---|---:|
| Pass 192 composition manifest | 382/382 components |
| Runtime capability smoke | 9/9 checks |
| Heterogeneous benchmark suite | 5/5 cases |
| Complete Flappy Bird React + TypeScript + Vite case | 8/8 assertions; 12/12 files |
| Architecture and performance guardrails | 6/6 checks |

Performance timings are host-sensitive and must not be copied forward as permanent guarantees. Read the generated [machine-readable baseline](docs/LIVE_BASELINE.json), [benchmark evidence](docs/BENCHMARK_REPORT.md), and [architectural audit](docs/GRAND_ARCHITECTURAL_AUDIT.md) for the exact current measurements and regeneration timestamp.

---

## 🚀 Quick Start & Onboarding

Get up and running with **LUMI-JOY** in seconds:

### 1. Prerequisites & Installation

Ensure you have **Node.js 20.19+** (or a compatible newer release) installed:

```bash
# Clone the repository
git clone https://github.com/CardSorting/LUMI-JOY.git
cd LUMI-JOY

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Provider Authentication & Guided Setup

Configure your LLM providers (OpenAI Codex OAuth, Anthropic, or OpenAI API keys):

```bash
# Launch the interactive guided setup wizard
npx tsx src/index.ts --setup
# or run the global binary if linked:
# lumi --setup
```

> **Codex OAuth**: Select **OpenAI Codex OAuth** to initiate browser sign-in. Paste the callback authorization code if automatic redirect capture is unavailable. Credentials are stored securely in `~/.lumi/config.json`.

### 3. Launch the Interactive Shell or Programmatic SDK

```bash
# Start the interactive terminal shell
npx tsx src/index.ts

# Run a single prompt directly from the CLI
npx tsx src/index.ts "Build a HTML5 Canvas game in src/app.js"
```

#### Programmatic TypeScript Usage

```typescript
import { LumiMonolith } from "lumi-joy";

// Initialize the deterministic monolith engine
const lumi = new LumiMonolith();

// Execute a frame-perfect turn with real-time progress callbacks
const result = await lumi.tick({
  prompt: "Analyze repository topology and write unit tests",
  onProgress: (event) => {
    console.log(`[${event.phase}] ${event.message}`);
  },
});

console.log("Agent Response:", result.response);
```

### 🖥️ Interactive TUI & Slash Commands

LUMI includes a high-performance differential-rendering Terminal User Interface (`lumi` or `npx tsx src/index.ts`):

- **Shortcuts**: `?` (Help Modal), `Ctrl+S` (Settings), `Alt+M` (Model Selector), `Home`/`End` (Jump History), `PgUp`/`PgDn`/`Shift+Up/Down` (Scroll), `Ctrl+L` (Clear Screen), `Ctrl+C` (Clear/Quit), `Ctrl+D` (EOF Exit).
- **Slash Commands**:
  - `/snapshots` & `/rewind [id]`: Snapshot inspection and sub-millisecond state time-travel rollback.
  - `/memory`: Active cognitive facts and rules inspector.
  - `/model [name]`: Interactive model selector and active model switcher.
  - `/settings`: Interactive reasoning effort configuration (`low`, `medium`, `high`, `max`).
  - `/health`: Comprehensive subsystem operational diagnostics.
  - `/providers`: Provider latency and authentication connectivity tests.

📖 Read the complete [Runtime Architecture Guide](docs/RUNTIME_ARCHITECTURE_GUIDE.md) and [Runtime Universal Pass Guide](.wiki/agent/runtime-universal-pass.md).

### 🛠️ Common Operational Commands

| Command | Action |
|---|---|
| `npm test` | Run the complete validation suite, including runtime-baseline contracts, documentation freshness/link checks, and architecture guardrails |
| `npm run build` | Compile TypeScript (`tsc`) to `dist/` |
| `npm run smoke` | Verify the current Pass 192 composition and critical runtime completion, rewind, safety, and integrity behaviors |
| `npm run benchmark` | Run the hermetic latency and throughput benchmark suite |
| `npm run baseline:update` | Run smoke, benchmarks, and guardrails, then atomically regenerate the live baseline reports |
| `npx tsx src/index.ts --setup` | Run guided provider & model selection wizard |

The current measured baseline is stored in [`docs/LIVE_BASELINE.json`](docs/LIVE_BASELINE.json). [`docs/BENCHMARK_REPORT.md`](docs/BENCHMARK_REPORT.md) and [`docs/GRAND_ARCHITECTURAL_AUDIT.md`](docs/GRAND_ARCHITECTURAL_AUDIT.md) are generated views of that same run; do not hand-edit their measured values.

---

## ⚡ Comparison Matrix & Empirical Benchmarks

| Metric / Feature | Legacy Monorepo (`pi-main`) | AKD-DSO Engine (`LUMI-JOY`) | Underlying Mechanism / Speedup |
|---|---|---|---|
| **Architecture** | 18+ Micro-packages | **3-Tier Monolith** (`agents`, `sessions`, `tooling`) | **Zero Framework Bloat** |
| **Execution Loop** | Loose Async Handlers | **Deterministic Game Loop** (`tick()`) | **Frame-Perfect Isolation** |
| **Mean Turn Latency** | $14.20\text{ ms}$ | **Live guardrail: $<1\text{ ms}$** | Direct function dispatch replacing IPC/RPC queues; see the generated live baseline for the current measurement. |
| **Execution Throughput** | $70.4\text{ turns/sec}$ | **Live guardrail: $\geq1,000\text{ frames/sec}$** | Direct deterministic fast-path measurement, kept separate from heterogeneous benchmark workloads. |
| **State Rewind Latency** | $285.00\text{ ms}$ (Re-parse) | **Live guardrail: $<0.1\text{ ms}$ p95** | Real snapshot mutation/rewind measured across warmed samples rather than a fixed fallback. |
| **VFS Perception Speed** | $12.40\text{ ms}$ (Disk I/O) | **Live benchmark case** | In-memory contiguous VFS overlay inspection. |
| **Memory Allocation** | Dynamic Heap GC Sweep | **16MB Zero-GC Slab** | Pre-allocated slab eliminates Garbage Collection sweeps. |
| **Complete Game Synthesis** | Manual multi-file setup | **12-file React + TypeScript + Vite project** | Temp-isolated generation, strict compiler diagnostics, executable physics simulation, responsive Canvas UI, controls, and accessibility checks. |

---

## 🏗️ Subsystem Architecture & File Tree

```
src/
├── core/
│   ├── contracts/                         # System Interfaces & GameStateSnapshot
│   ├── abstracts/                         # Abstract Base Classes (DIP)
│   └── utilities/                         # Shared progress credential sanitizer
│
├── agents/                                # Tier 1: Agents Subsystem
│   ├── base/                              # Agent Base Config
│   └── extensions/                        # Domain Mutation Subdirectories
│       ├── compaction/                    # prompt-composer.ts
│       ├── resolution/                    # model-resolver.ts, agent-slash-router.ts, model-catalog.ts
│       ├── execution/                     # agent-engine.ts, Codex progress adapter, interactive controller
│       ├── mentions/                      # mention-resolver.ts (Pass 9)
│       ├── swarm/                         # agent-swarm-dispatcher.ts (Pass 11)
│       └── intelligence/                  # workspace-intelligence.ts (Pass 13)
│
├── sessions/                              # Tier 2: Sessions Subsystem
│   ├── base/                              # Session Context Base
│   └── extensions/                        # Domain Mutation Subdirectories
│       ├── substrate/                     # arena-allocator.ts, file-lock.ts (Pass 20)
│       ├── persistence/                   # session-store.ts
│       ├── memory/                        # session-memory-store.ts
│       ├── vfs/                           # session-vfs.ts
│       ├── compaction/                    # session-compactor.ts, snapcompact-engine.ts (Pass 15)
│       └──> 🛡️ **Non-Destructive Osmosis Extension Strategy (`ADR-012`)**:  
> Base classes in `src/*/base/` remain immutable. Evolutionary passes introduce single-responsibility extension classes in dedicated mutation subdirectories (`src/*/extensions/<mutation-domain>/`) and compose them cleanly in `MonolithFactory` and `LumiMonolith`.

---

## 📡 Live Agent Activity Streaming

Authenticated Codex turns use the official SDK event stream and render a persistent activity card instead of a single ambiguous `Thinking...` label. Stable activities update in place as they move through `started`, `in_progress`, and a terminal state.

Use `/setup` to connect and activate a provider. Codex setup attempts to open the browser, but also displays a clickable and copyable OpenAI sign-in URL; press `O` to retry or paste the authorization code/full callback URL if automatic redirect capture is unavailable. When Codex is already authenticated, submit an empty field to keep the login and activate its default model. The selection is saved in `~/.lumi/config.json`.

```text
Agent activity · Working 4s · gpt-5.6-terra
  ✓ Connected to Codex — gpt-5.6-terra
  ◐ Analyzing the request — Understanding goals and workspace context
  ◐ Running workspace command — npm test
```

The timeline can show safe reasoning summaries, plan progress, redacted commands, relative file changes, MCP/web activity, response-candidate state, elapsed time, and final token totals. A completed message item is only a candidate: LUMI reports success after the provider turn also terminates and the candidate passes final-response validation. It never displays raw chain-of-thought, aggregated tool output, MCP payloads, OAuth material, or full response text.

Press `Esc` or `Ctrl+C` to cancel an active turn. Cancellation and failure settle active child rows, discard the failed Codex thread, restore the loop phase to idle, and leave the terminal audit trail visible.

Programmatic callers can consume the same lifecycle through `EngineTickInput.onProgress`:

```typescript
const abortController = new AbortController();

const result = await lumi.tick({
  prompt: "make a racing game",
  signal: abortController.signal,
  onProgress: (event) => {
    console.log(event.activityId, event.status, event.message, event.detail);
  },
});

if (result.outcome !== "completed") {
  // `response` contains safe failure or cancellation guidance, not a successful answer.
  console.error(result.response);
}
```

See the [complete streaming strategy](.wiki/agent/streaming-activity-strategy.md), [public API reference](.wiki/agent/api-reference.md), and [ADR-082](.wiki/adr/ADR-082-structured-agent-activity-streaming.md).

---

## 🧠 Multi-Turn Context Lifecycle

LUMI separates the full conversation transcript from the bounded context projection sent to a model. The transcript remains available for persistence, snapshots, forks, rewind, and SHA-256-addressed recall; the active projection keeps pinned system policy, one structured checkpoint, and the newest complete user turns.

Context admission is model-aware and token-aware:

```text
model context window
├── reserved model output
├── safety margin
└── usable model input
    ├── pinned system + memory context
    └── active conversation projection
        ├── LUMI-CONTEXT/1 checkpoint
        └── recent complete turns
```

Compaction triggers before the hard provider limit and targets a lower utilization level, leaving space for subsequent tool rounds. A final turn-aware guard prevents provider-side blind truncation. All context envelopes (`LUMI-CONTEXT/1`, `LUMI-THREAD/1`, `LUMI-MEMORY/1`, `LUMI-TOOL-RESULT/1`, `LUMI-GOAL/1`) are parsed, validated, and serialized through `ContextDslEngine`. System prompts are compiled via `PromptTemplateEngine`, supporting handlebar variable placeholders (`{{var}}`) and conditional blocks (`{{#if}}`/`{{#unless}}`). Stateful Codex threads are automatically rehydrated from `LUMI-THREAD/1` after compaction, rewind, model changes, stateless provider turns, or local-only responses.

Run `npm test` to exercise DSL AST parsing (`scripts/validate-dsl-strategy.ts`), message pressure, token pressure, oversized DSL/code input, checkpoint recurrence, durable persistence, rewind, and multi-turn thread handoff. See [ADR-083](.wiki/adr/ADR-083-token-aware-multi-turn-context-lifecycle.md) for the policy and trade-offs.

---

## ⚡ Attempt Completion Gate Strategy & Autonomous Progression

LUMI implements an apex / sovereign-tier **Attempt Completion Gate Strategy** (`RoadmapCompletionGate` and `AttemptCompletionGateStrategy`) to enable autonomous multi-attempt turn progression without manual user prompting or feedback:

- **Phased Gating Lifecycle**: Evaluates quality bars across `admission`, `in_flight`, `completion`, and `postmortem` checkpoints.
- **Dynamic Context Evaluators**: Analyzes candidate outputs, tool execution outcomes, and runtime error diagnostics.
- **Differential Attempt Analysis (`computeAttemptDiff`)**: Tracks delta improvements and catches regressions (`newlyPassing`, `newlyFailing`, `stagnantFailing`) across attempts.
- **Deterministic State Fingerprinting & Zero-Delta Stagnation Traps**: Uses SHA-256 state hashes to detect identical failing outputs and instantly pivot strategies.
- **Forensic Flight Recording (`AttemptFlightRecorder`)**: Blackbox timeline recording exporting structured JSON logs and formatted Markdown postmortem reports.
- **Direct Quantitative Criterion Scoring (`CriterionScoreEvaluator`)**: Eliminates subjective voting and quorum locks in favor of direct mathematical criterion scoring.
- **Flattened Candidate Arbitration (`evaluateAttemptCandidates`)**: Deterministically ranks parallel candidate branches by gate pass rate, score optimization, and minimal critical violations, guaranteeing decisive candidate selection.
- **Hierarchical DAG Gate Pipelines (`GatePipelineDag`)**: Directed Acyclic Graph execution with causal dependency short-circuiting.
- **Cognitive Remediation Directives (`RemediationDirective`) & Divergence Sentinel**: Automatically synthesizes root causes, prioritized criteria, and concrete action steps, escalating strategies (`PATCH_LOCAL` $\to$ `REWRITE_MODULE` $\to$ `PIVOT_APPROACH` $\to$ `EXPAND_CONTEXT` $\to$ `RESTORE_CHECKPOINT`) with automatic regression unwinding when attempts diverge.
- **Tri-State Circuit Breaker & Phase-Aware Watchdogs**: Self-healing `CLOSED` $\to$ `OPEN` $\to$ `HALF_OPEN` canary probe state machine, paired with phase-aware stream watchdogs (180s reasoning, 300s tool execution) and anti-oscillation safeguards.

See [ADR-084](.wiki/adr/ADR-084-attempt-completion-gate-strategy.md) for architectural specifications and benchmarks.

---

## 🛡️ Non-Destructive Osmosis Extension Strategy (`ADR-012`)

To prevent code regression, file overwrites, and structural drift as new evolutionary passes are absorbed from `pi-main`, **LUMI-JOY** strictly enforces the **Non-Destructive Extension & Mutation Directory Strategy**:

### 1. Core Architectural Tenets

- **Base Class Immutability**: Base domain classes in `src/*/base/` (e.g. `Eyes`, `SessionContext`, `AgentConfig`) are foundational and immutable.
- **Single-Responsibility Mutation Subdirectories**: Every evolutionary pass or feature mutation creates a dedicated, single-responsibility file in a domain-scoped subdirectory inside `src/*/extensions/<mutation-domain>/`.
- **Zero-Barrel Import Policy**: All intermediate `index.ts` barrel re-export files are prohibited. Imports across subsystems MUST target explicit, deep relative paths.
- **Dependency Inversion Monolith Composition**: Extension classes extend base abstractions and are composed at the composition root (`MonolithFactory` & `LumiMonolith`).

### 2. Mutation Directory Responsibility Matrix

| Subsystem Tier | Mutation Directory | Pass / Feature Responsibility | Extension Class |
|---|---|---|---|
| **Agents** (`src/agents/extensions/`) | `compaction/` | System prompt compilation & context assembly | `PromptComposer` |
| | `resolution/` | Model fallback resolution, slash routing & pricing specs | `ModelResolver`, `AgentSlashRouter`, `ModelCatalog` |
| | `execution/` | Deterministic tick execution, Codex lifecycle adaptation, interactive orchestration | `AgentEngine`, `CodexProgressAdapter`, `InteractiveModeController` |
| | `mentions/` *(Pass 9)* | Prompt `@mention` context expansion | `MentionResolver` |
| | `swarm/` *(Pass 11)* | Subagent task delegation & frame snapshot sync | `AgentSwarmDispatcher` |
| | `intelligence/` *(Pass 13)* | Workspace topology & package identity indexing | `WorkspaceIntelligenceEngine` |
| **Sessions** (`src/sessions/extensions/`) | `substrate/` | Contiguous 16MB ArrayBuffer slab allocation & file locks | `ArenaAllocator`, `FileLockManager`, `LruCache` |
| | `persistence/` | File persistence & frame-perfect snapshot rewind | `PersistentSessionStore` |
| | `memory/` | Long-term fact store & KI persistence | `SessionMemoryStore` |
| | `vfs/` | In-memory Virtual File System diff overlay | `SessionVfs` |
| | `compaction/` | Sliding window compaction & dense bitmap archiving | `SessionCompactor`, `SnapcompactEngine` |
| | `integrity/` *(Pass 12)* | Environment auditing & forensic self-healing | `StabilityDoctor` |
| **Tooling** (`src/tooling/extensions/`) | `perception/` | AST structural code symbol search | `AstPerceptionEyes` |
| | `progress/` | Legacy JSON-RPC progress notification formatting; distinct from provider activity | `ProgressStreamingEars`, `TerminalProgressRenderer` |
| | `telemetry/` | Microsecond performance timers & OpenTelemetry spans | `ProtocolEars`, `TelemetryTracer` |
| | `hashline/` | Line-anchored hash edit verification | `AnchoredHands` |
| | `registry/` | Skill discovery & schema validation tool execution | `SkillsIngestor`, `ValidatingToolRegistry` |
| | `policy/` *(Pass 10)* | Zombie symbol detection & dependency analysis | `ModuleDecomposer` |
| | `permissions/` *(Pass 14)* | Command permission controller & execution guardrails | `CommandPermissionController` |
| | `gateway/` *(Pass 17)* | JSON-RPC 2.0 streaming gateway server | `MonolithGatewayServer` |
---

## ❓ Frequently Asked Questions (FAQ)

### Q: What is LUMI-JOY and what core business problem does it solve?
**LUMI-JOY** is an enterprise-grade AI pair programmer and autonomous agent engine. It addresses framework overhead and state drift through a deterministic local frame path guarded below $1.0\text{ ms}$ mean latency, explicit frame outcomes, immutable snapshots, and fail-closed completion semantics. Provider-backed model latency is external to this local-runtime guardrail.

### Q: Why is the LUMI-JOY agent runtime inspired by game engines?
Traditional AI agent frameworks suffer from state drift, non-reproducible turns, microservice overhead, and V8 Garbage Collection pauses. Modeling the agent runtime like a **Deterministic Game Engine** establishes frame ticks (`tick()`), immutable state snapshots (`GameStateSnapshot`), sub-millisecond state rewind (`rewindToSnapshot()`), and a pre-allocated 16MB contiguous slab memory substrate (`ArenaAllocator`). This guarantees frame-perfect isolation, instant time-travel debugging, and zero-GC performance stability.

### Q: How does LUMI-JOY reduce AI infrastructure and cloud operating costs?
By eliminating internal microservice RPC queues, LUMI-JOY keeps deterministic local orchestration in-process. The enforced floor is **$1,000$ local frames/second**; the latest host run observed **$7960.17$ frames/second**. These figures are local framework measurements—not provider responses, model tokens, or a universal server-capacity promise—and should be regenerated on deployment hardware.

### Q: Which LLM providers and AI models are supported?
LUMI-JOY natively supports major provider ecosystems including **OpenAI** (`gpt-4o`, `gpt-5`, `Codex`), **Anthropic** (`Claude 3.5 Sonnet`), and standard OpenAI-compatible proxy gateways. It features automatic model resolution, fallback routing, and PKCE OAuth 2.0 authentication.

### Q: How does LUMI-JOY protect enterprise data privacy and source code security?
LUMI-JOY runs locally or within your private cloud infrastructure. Credentials configured via `/setup` are stored in restricted user storage (`~/.lumi/config.json` with 0600 permissions). The engine explicitly redacts credentials, bearer tokens, and internal file contents from streaming activity logs, and enforces strict command permission policies before executing any terminal operations.

### Q: Can LUMI-JOY be customized or embedded into internal enterprise tools?
Yes. LUMI-JOY is open-source under the **Apache License 2.0** and backed by a **Defensive Patent Non-Aggression Pledge**. You can integrate the TypeScript SDK (`LumiMonolith`) directly into internal developer portals, custom CLI tools, IDE plugins, or automated CI/CD code repair pipelines.

### Q: What user experience does LUMI-JOY offer developers during long agent tasks?
Developers receive real-time, transparent feedback through a differential terminal timeline UI or progress event stream. Instead of displaying a static "Thinking..." label, LUMI-JOY shows live activity updates (file viewing, test execution, plan updates) with elapsed time timers and clear completion status.

### Q: How quickly can an engineering team get started with LUMI-JOY?
Engineering teams can install LUMI-JOY in under 60 seconds with `npm install` and complete provider authentication using the built-in guided wizard (`lumi --setup`). Programmatic integration requires only 4 lines of TypeScript code.

---

## 📚 Roadmap & Documentation Index

- 🚀 [Auto-Rolling Evolution Roadmap](.wiki/roadmap/AUTOROLLING-ROADMAP.md)
- 🏛️ [The Hermes-Agent-Main Distillation & Osmosis Matrix](#%EF%B8%8F-architectural-heritage--ancestral-lineage-the-hermes-agent-main-osmosis)
- 📋 [Workspace Changelog](CHANGELOG.md)
- 🎓 [Academic Research Paper: AKD-DSO Specification](.wiki/whitepaper/AKD-DSO-ACADEMIC-WHITEPAPER.md)
- 📦 [True 1-to-1 Package Mapping Matrix](.wiki/package-mappings/PACKAGE-MAPPING-MATRIX.md)
- 📄 [Whitepaper: The Osmosis Paradigm](.wiki/whitepaper/OSMOSIS-WHITEPAPER.md)
- 🧠 [The Osmosis Methodology & Handoff Guide](.wiki/agent/osmosis-methodology.md)
- 📖 [Wiki Landing Page](.wiki/index.md)
- 📋 [API Reference Guide](.wiki/agent/api-reference.md)
- 📡 [Agent Activity Streaming Strategy](.wiki/agent/streaming-activity-strategy.md)
- 🧭 [ADR-082: Structured Agent Activity Streaming](.wiki/adr/ADR-082-structured-agent-activity-streaming.md)
- 📈 [Current Machine-Readable Baseline](docs/LIVE_BASELINE.json)
- 🧪 [Generated Benchmark Evidence](docs/BENCHMARK_REPORT.md)
- 🏛️ [Generated Architectural Audit](docs/GRAND_ARCHITECTURAL_AUDIT.md)
- 📖 [ADR Index & Decision Records](.wiki/adr/README.md)

---

---

## 🙏 Acknowledgments & Ancestral Attribution

- ☤ **Ancestral Teacher & Inspiration**: [`hermes-agent`](https://github.com/NousResearch/hermes-agent) created and open-sourced by **Nous Research** and its incredible community of contributors (licensed under the MIT License). Special thanks to the Nous Research team for pushing the boundaries of open models, autonomous agents, and AI self-improvement.
- 🧠 **Research Foundations**: Built on the open paradigms of autonomous skill evolution, dialectic agent memory (`Honcho`), and open-weights model intelligence advanced by the open AI research community.
- 🎮 **Game Engine Pioneers**: Inspired by the deterministic architecture, memory arenas, and frame-tick discipline of classic game engines (id Software, John Carmack et al.).
- 🌐 **Open Standards**: Fully compatible with the [`agentskills.io`](https://agentskills.io) open standard and the Agent Client Protocol (ACP) for modern IDEs.

---

## 📄 License & Contributing

- 🤝 [Contributor Guidelines](CONTRIBUTING.md)
- 📄 Distributed under the Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.
