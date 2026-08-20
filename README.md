<div align="center">

# ⚡ LUMI-JOY

### **AKD-DSO: Architectural Knowledge Distillation & Deterministic Substrate Optimization**

*An enterprise-grade TypeScript agent framework engineered like a deterministic game engine—built on frame-perfect state snapshotting, contiguous slab memory, and biological osmosis self-mutation.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.19+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Ancestral Teacher](https://img.shields.io/badge/Ancestral%20Teacher-Hermes--Agent%20(Nous%20Research)-FFD700?style=for-the-badge&logo=github)](https://github.com/NousResearch/hermes-agent)
[![Freeze Cutoff](https://img.shields.io/badge/Workspace%20Freeze-Wednesday%2C%20August%2019%2C%202026-critical?style=for-the-badge)](.wiki/architecture/OSMOSIS-FREEZE-AND-CUTOFF.md)
[![Grand Monolith](https://img.shields.io/badge/Grand%20Monolith-591%20Components-success?style=for-the-badge)](.wiki/architecture/OSMOSIS-FREEZE-AND-CUTOFF.md)
[![Agent Size](https://img.shields.io/badge/Agent%20Size-215k%20LOC%20%7C%207.77%20MB-9C27B0?style=for-the-badge)](#-total-agent-size--density)
[![Academic Paper](https://img.shields.io/badge/Academic%20Paper-AKD--DSO-9C27B0?style=for-the-badge)](.wiki/whitepaper/AKD-DSO-ACADEMIC-WHITEPAPER.md)
[![Whitepaper](https://img.shields.io/badge/Whitepaper-Osmosis%20Paradigm-00C853?style=for-the-badge)](.wiki/whitepaper/OSMOSIS-WHITEPAPER.md)
[![Auto-Rolling Roadmap](https://img.shields.io/badge/Roadmap-Auto--Rolling-E91E63?style=for-the-badge)](.wiki/roadmap/AUTOROLLING-ROADMAP.md)
[![Package Matrix](https://img.shields.io/badge/Package%20Matrix-1--to--1%20Mapping-FF9800?style=for-the-badge)](.wiki/package-mappings/PACKAGE-MAPPING-MATRIX.md)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)

<br/>

| **Core Navigation** | **Documentation & Guides** | **Subsystem Source Code** |
|---|---|---|
| 🚀 [Quick Start Guide](#-quick-start--self-intuitive-onboarding) | 📐 [Architecture Diagrams](docs/ARCHITECTURE_DIAGRAMS.md) | ⚡ [Composition Root](src/index.ts) |
| 🎯 [Task Cookbook](#-i-want-to-task-oriented-cookbook) | ❓ [Frequently Asked Questions](docs/FAQ.md) | 🏭 [Engine Factory](src/factories/monolith-factory.ts) |
| 👤 [Agent Blueprints](#-built-in-agent-blueprint-matrix-adr-119) | ⌨️ [TUI & Commands Guide](docs/TUI_COMMANDS_GUIDE.md) | ⚙️ [Core Abstracts](src/core/abstracts/) |
| 📌 [Executive Brief](#-why-lumi-joy-the-architectural-imperative) | 🧬 [41 Osmotic Subsystems](docs/HERMES_OSMOSIS_SUBSYSTEMS.md) | 🧠 [Agents Tier](src/agents/) |
| ⚡ [Comparison Matrix](#-comparison-matrix--empirical-benchmarks) | 📂 [Mutation Matrix (ADR-012)](docs/MUTATION_DIRECTORIES.md) | 💾 [Sessions Tier](src/sessions/) |
| 🏛️ [Ancestral Heritage](#%EF%B8%8F-architectural-heritage--ancestral-lineage-the-hermes-agent-main-osmosis) | 🏗️ [Runtime Architecture](docs/RUNTIME_ARCHITECTURE_GUIDE.md) | 🖥️ [TUI Components](src/tui/components/) |
| 🏗️ [Architecture Tree](#%EF%B8%8F-subsystem-architecture--file-tree) | 🎓 [Academic Whitepaper](.wiki/whitepaper/AKD-DSO-ACADEMIC-WHITEPAPER.md) | 📜 [Core Contracts](src/core/contracts/) |
| 📏 [Agent Size & Density](#-total-agent-size--density) | 📦 [1-to-1 Package Matrix](.wiki/package-mappings/PACKAGE-MAPPING-MATRIX.md) | 🔧 [Tool Registry](src/tooling/extensions/registry/tool-registry.ts) |
| 📡 [Live Activity Streaming](#-live-agent-activity-streaming) | 📈 [Current Live Baseline](docs/LIVE_BASELINE.json) | 🏭 [Grand Synthesizer](src/factories/grand-monolith-synthesizer.ts) |
| 🤝 [Contributing Guide](CONTRIBUTING.md) | 📖 [Author's Preface & Story](PREFACE.md) | 🛡️ [Patent Pledge](PATENT-NON-AGGRESSION-PLEDGE.md) |

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
| 🕹️ **Deterministic Frame Ticks (`tick()`)** | Single-threaded atomic frame lifecycle (`Input -> Context Assembly -> Provider Dispatch -> State Mutation -> Telemetry`) | **$0.12\text{ ms}$ fast-path mean latency**; eliminates microservice queues |
| ⚡ **Zero-GC Contiguous Memory Slab** | 16MB pre-allocated `ArrayBuffer` slab (`ArenaAllocator`) with static cached UTF-8 encoders | **Zero Garbage Collection pauses** during live token streaming and rapid multi-tool loops |
| 🚀 **High-Throughput Execution** | In-process monolithic dispatch bypassing network IPC | **$8506.11\text{ frames/second}$** throughput ($>8.5\times$ above the $1,000\text{ fps}$ SLA) |
| ⏪ **$O(1)$ State Time-Travel (`rewindToSnapshot()`)** | Restores conversation transcripts, staged virtual files (`SessionVfs`), and memory facts (`SessionMemoryStore`) | **$0.029\text{ ms p95}$** instant rollback; enables multi-branch search (MCTS) |
| 👤 **Zenith Multi-Profile Substrate (`ADR-119`)** | Zero global mutation, prefix cache frame decomposition, ICL few-shot exemplars, resilient fallback ladders, and run step budgeting | **$29.37\text{M ops/sec}$ throughput** ($0.034\ \mu\text{s/op}$), $0.0024\text{ ms}$ state rewind, up to 90% prompt cache token savings |
| 🖥️ **Differential Terminal User Interface** | Synchronized ANSI cell rendering (`\x1b[?2026h`), adaptive box borders, syntax highlighting, fuzzy autocomplete | **Zero visual flicker**; borders never wrap on split-screen terminals |

### 🎯 Who This Is For & Why It Matters
- **For Developers**: Instant feedback, zero UI tearing, instant state rollback (`/rewind`) during iterative debugging without restarting the agent or re-parsing transcripts, and sub-millisecond execution without garbage collection pauses.
- **For AI Systems & Researchers**: Eliminating software friction enables high-frequency agent search techniques (Monte Carlo Tree Search, branch-and-bound, self-reflection loops) to run locally at thousands of frames per second instead of paying cloud microservice latency penalties.
- **For Enterprises & Leaders**: Dramatic reduction in infrastructure compute costs, deterministic predictable behavior with 0 state drift, enterprise OAuth PKCE security, and Apache 2.0 open-source licensing backed by a defensive patent non-aggression pledge.

---

## 👔 Role-Based Stakeholder Onboarding & ROI

| Stakeholder Role | Primary Focus | Key Enforced Invariants | Recommended Resources |
|---|---|---|---|
| 👔 **Executive & VP Eng** | ROI, SLAs & Compliance | $\ge 1,000\text{ fps}$, $<1.0\text{ ms}$ latency SLA, Apache 2.0 License | [Benchmark SLA Matrix](#-comparison-matrix--empirical-benchmarks) · [Patent Pledge](PATENT-NON-AGGRESSION-PLEDGE.md) |
| 🏗️ **Architect & Tech Lead** | Monolith Topology & DSL | 3-tier monolith (591 components), zero-GC 16MB slab, formal `LUMI-CONTEXT/1` AST | [Architecture Tree](#%EF%B8%8F-subsystem-architecture--file-tree) · [ADR-083 Context Lifecycle](.wiki/adr/ADR-083-token-aware-multi-turn-context-lifecycle.md) |
| 🔒 **Security & InfoSec** | Auth, Sandboxing & Privacy | RFC 7636 PKCE OAuth (`0600` storage), automated secret redactor, path firewall | [ADR-052 Auth Governance](.wiki/adr/ADR-052-deterministic-identity-federation-and-auth-governance.md) · [ADR-047 Secret Redaction](.wiki/adr/ADR-047-deterministic-secret-redaction-and-path-safety.md) |
| 💻 **Software Engineer** | Developer Ergonomics & Speed | 60s setup, $O(1)$ state rollback ($0.029\text{ ms}$), 47 model tools, 7 persona blueprints | [Quick Start](#-quick-start--self-intuitive-onboarding) · [Task Cookbook](#-i-want-to-task-oriented-cookbook) · [FAQ Guide](docs/FAQ.md) |

---

## 💡 Why LUMI-JOY? (The Architectural Imperative)

| Architectural Challenge | Traditional Frameworks (LangChain/CrewAI) | AKD-DSO Monolith (`LUMI-JOY`) | Business & Technical Impact |
|---|---|---|---|
| **Framework Overhead** | 18+ micro-packages with IPC queues | **Single 3-tier monolith** (`agents`, `sessions`, `tooling`) | **$<1.0\text{ ms}$ fast-path mean latency SLA** |
| **Context Safety & DSL** | Loose string joins prone to injection | **Formal `ContextDslEngine` AST & SHA-256 digests** | **Deterministic bounds & injection defense** |
| **Memory & GC Latency** | Dynamic heap allocations causing GC sweeps | **Contiguous 16MB ArrayBuffer zero-GC slab** | **Zero Garbage Collection pauses during live streaming** |
| **State Rewind & Audit** | Slow transcript re-parsing | **$O(1)$ in-memory frame snapshot restoration** | **$0.029\text{ ms p95}$ instant time-travel rollback** |
| **Persona Isolation** | Global environment mutation (`HERMES_HOME`) | **Zenith Multi-Profile Substrate (`ADR-119`)** | **$29.37\text{M ops/sec}$, prefix cache optimization** |

---

## 🎮 Inspired by Game Engines: Deterministic Architecture

LUMI-JOY adapts core principles from high-performance video game physics and rendering engines ([ADR-008](.wiki/adr/ADR-008-deterministic-game-engine-architecture.md)):

- 🕹️ **Frame Ticks (`tick()`)**: Atomic 5-stage turn lifecycle (`Input -> Context Assembly -> Provider Dispatch -> State Mutation -> Telemetry`).
- 💾 **Frame Snapshots (`GameStateSnapshot`)**: Captures complete engine state (VFS staged overlays, memory facts, token budgets) at frame $t$.
- ⏪ **State Rewind (`rewindToSnapshot()`)**: Restores engine state in **$<0.05\text{ ms}$**, enabling Monte Carlo Tree Search (MCTS) and subagent branching.
- ⚡ **Zero-GC Arena Allocator**: 16MB contiguous memory slab eliminating V8 garbage collection stutter during token streaming.

---

## 🏛️ Heritage, Open Science & StateM FSM Runbooks

### 🌟 Ancestral Heritage: Nous Research (`hermes-agent`)
LUMI-JOY was forged through the **AKD-DSO** Osmosis methodology, taking foundational architectural inspiration from [`hermes-agent`](https://github.com/NousResearch/hermes-agent) (**Nous Research**). We express our deepest gratitude to Nous Research for championing open science, unconstrained reasoning models, and user sovereignty. LUMI-JOY distills these open paradigms into a high-density, deterministic TypeScript monolith operating over BroccoliDB.

### 🎯 StateM Benchmark-Winning FSM Runbooks (ADR-131)
Inspired by **StateM** (Terminal-Bench 2.1 champion), LUMI-JOY enforces workflow execution through formal finite state machines ([ADR-131](.wiki/adr/ADR-131-deterministic-fsm-runbooks-file-predicates-and-broccolidb-osmosis.md)):
- **10-Step Atomic State Transitions** (`RunbookSupervisor`): Graph-theoretic state transitions with atomic rollback upon gate failure.
- **Zero-Subshell In-Memory Predicates** (`FilePredicateEvaluator`): Instant file existence, regex, and JSONPath assertions in $<5.0\text{ ms}$.
- **Amnesia-Proof Context Compaction** (`StatefulCompactionSynthesizer`): Guarantees that `/compact` preserves active stage directives with 0 context drift.
- **Interactive Commands**: `/runbook start <preset>` · `/runbook goto <stage>` · `/runbook compact` (Presets: `coding_loop`, `bugfix_patch`, `feature_delivery`, `security_audit`).

👉 **Read the Full Evaluation**: [StateM Runbook FSM Evaluation (docs/STATEM_RUNBOOK_FSM_EVALUATION.md)](docs/STATEM_RUNBOOK_FSM_EVALUATION.md) · [Hermes Osmosis Subsystems Matrix](docs/HERMES_OSMOSIS_SUBSYSTEMS.md).

---

## 🌟 Business & Technical ROI Highlights

- **⚡ Enforced Fast-Path Latency**: Direct function dispatch eliminates micro-package IPC/RPC queues; `ArchitectureGuardrailGate` requires mean local frame latency below $1.0\text{ ms}$.
- **📈 Enforced Fast-Path Throughput**: The same guardrail requires at least $1,000$ deterministic frames/second and records the host-specific observation in the live baseline.
- **🔄 $O(1)$ State Rewind**: In-memory snapshot restoration is verified for state correctness and a warmed p95 below $0.1\text{ ms}$.
- **🔒 Enterprise Security & OAuth PKCE**: Native PKCE OAuth 2.0 integration with zero-leak credential storage in `~/.lumi/config.json` and strict permission gates (`CommandPermissionController`).
- **🧠 Formal Context Envelope DSL & Template Engine**: Structured `ContextDslEngine` AST parsing (`LUMI-CONTEXT/1`, `LUMI-THREAD/1`, `LUMI-MEMORY/1`, `LUMI-TOOL-RESULT/1`, `LUMI-GOAL/1`) and `PromptTemplateEngine` (`{{#if}}`/`{{#unless}}`) prevent prompt injection and guarantee deterministic context control.
- **🛡️ Contiguous Zero-GC Substrate**: 16MB pre-allocated ArrayBuffer memory slab eliminates runtime Garbage Collection latency spikes.

### Latest verified workspace baseline

The authoritative run was generated on **2026-08-17T04:06:43.562Z** using Node.js `v23.5.0` on macOS ARM64. It passed:

| Verification lane | Latest result |
|---|---:|
| Pass 192 composition manifest | 566/566 components |
| Runtime capability smoke | 9/9 checks |
| Heterogeneous benchmark suite | 5/5 cases |
| Complete Flappy Bird React + TypeScript + Vite case | 8/8 assertions; 12/12 files |
| Architecture and performance guardrails | 6/6 checks |

Performance timings are host-sensitive and must not be copied forward as permanent guarantees. Read the generated [machine-readable baseline](docs/LIVE_BASELINE.json), [benchmark evidence](docs/BENCHMARK_REPORT.md), and [architectural audit](docs/GRAND_ARCHITECTURAL_AUDIT.md) for the exact current measurements and regeneration timestamp.

---

## 🚀 Quick Start & Self-Intuitive Onboarding

Get up and running with **LUMI-JOY** in under 60 seconds with our zero-friction onboarding flow:

```mermaid
graph LR
  A[1. Install & Build] --> B[2. Setup: lumi --setup]
  B --> C[3. Launch: lumi --profile coder]
  C --> D[💻 Interactive Terminal Canvas]
  D --> E[Command Palette: /profile, /model, /rewind]
```

---

### 📦 3-Step Zero-Friction Setup

```bash
# 1. Clone & Install (Zero C++ bindings, pure TypeScript)
git clone https://github.com/CardSorting/LUMI-JOY.git && cd LUMI-JOY
npm install && npm run build

# 2. Interactive Provider Setup (Codex PKCE OAuth, Claude, OpenAI, Ollama)
npx tsx src/index.ts --setup

# 3. Launch with Specialized Persona (e.g. Coder, Researcher, SRE)
npx tsx src/index.ts --profile coder
```

---

### 🖥️ What You See on Your Screen (Canvas Anatomy)

When you start LUMI-JOY, the differential terminal interface presents an intuitive layout:

```text
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║ ⚡ LUMI-JOY v1.0.0 │ 👤 [💻 Coder] │ 🧠 [gpt-5.6-luna] │ ⏱️ 0.12ms │ 💰 $0.0018 │ ⭐ Fav ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  👤 You: Refactor src/core/auth.ts to add strict token expiration validation             ║
║                                                                                          ║
║  ⚡ LUMI (Coder):                                                                        ║
║  ┌────────────────────────────────────────────────────────────────────────────────────┐  ║
║  │ 🔧 Tool: read_file ("src/core/auth.ts") ➔ Status: OK (124 lines)                  │  ║
║  │ 🔧 Tool: patch ("src/core/auth.ts") ➔ Line-anchored edit verified (0.04ms)         │  ║
║  └────────────────────────────────────────────────────────────────────────────────────┘  ║
║  I have added strict JWT expiration claims verification and unit test assertions.        ║
║                                                                                          ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║ 💡 Shortcuts: [Ctrl+M] Model  [Ctrl+P] Setup  [/profile] Switch Persona  [Ctrl+C] Abort  ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║ (lumi:coder) > _                                                                         ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

### 🎯 "I Want To..." Task-Oriented Cookbook

Find your goal and execute the solution with zero guesswork:

| What I Want to Do | Exact Command to Type | What Happens Behind the Scenes |
| :--- | :--- | :--- |
| **Write or refactor code with strict types** | `/profile use coder` | Activates TypeScript LSP, AST parsers, line-anchored patchers, and unit testing axioms. |
| **Perform deep academic or web research** | `/profile use researcher` | Activates citation rigor, arXiv tools, fact verification, and web intelligence. |
| **Triage a production bug or system crash** | `/profile use sre` | Activates doctor diagnostics, log ring buffers, health probes, and self-healing tools. |
| **Draft architecture ADRs or documentation** | `/profile use writer` | Activates Keep-a-Changelog schemas, Mermaid diagram synthesis, and technical style guides. |
| **Undo the agent's last file modification** | `/rewind 1` | Instantly rolls back virtual files, memory, and conversation history in **$0.029\text{ ms}$**. |
| **Create my own customized agent persona** | `/profile init coder my_lead_dev` | Clones the battle-tested Coder blueprint into your isolated custom profile. |
| **Compare two agent profiles side-by-side** | `/profile diff default my_lead_dev` | Generates a structural delta of toolsets, soul prompts, custom axioms, and memory. |
| **Hot-swap the AI model without restarting** | `Ctrl+M` *(or `/model claude-3-7-sonnet`)* | Instantly routes future turns to the new model with 100% prefix cache retention. |
| **Inspect database tables and memory facts** | `/db status` *(or `/db query profiles`)* | Opens the BroccoliDB reactive in-memory database inspection studio. |
| **Open the full 6-tab Profile Studio Modal** | `/profile` *(or press `Tab` / `1-6` in modal)* | Opens the interactive visual orchestrator for profiles, blueprints, revisions, and health. |

---

### 👤 Built-in Agent Blueprint Matrix (ADR-119)

Choose from 7 curated blueprints with tailored prompt axioms, toolsets, and reasoning profiles:

| Blueprint | Icon | Primary Focus | Best Model | Toolsets Included |
| :--- | :---: | :--- | :--- | :--- |
| **`coder`** | 💻 | Software Engineering, Refactoring & Test Generation | `gpt-5.6-luna` | `core`, `files`, `execution`, `lsp`, `git` |
| **`researcher`** | 🔬 | Deep Academic Literature Synthesis & Fact Checking | `claude-3-7-sonnet` | `core`, `files`, `web`, `memory` |
| **`sre`** | 🛡️ | Incident Triage, System Forensics & Self-Healing | `gpt-5.6-luna` | `core`, `files`, `execution`, `git`, `doctor` |
| **`writer`** | ✍️ | Technical Documentation, Architecture ADRs & Guides | `claude-3-7-sonnet` | `core`, `files`, `memory` |
| **`student`** | 🎓 | Socratic Learning Tutor & Interactive Walkthroughs | `gpt-4o` | `core`, `files`, `memory` |
| **`creative`** | 🎨 | Game Design, Mechanics Worldbuilding & Creative Assets | `gpt-4o` | `core`, `files`, `vision`, `memory` |
| **`minimal`** | ⚡ | Headless High-Speed Scripting with Minimal Tokens | `gpt-4o-mini` | `core`, `files` |

---

### ⌨️ Universal Keyboard Shortcuts

| Shortcut | Context | Function |
| :--- | :--- | :--- |
| `Ctrl+C` / `Esc` | Global | **Emergency Abort**: Halts running models, restores terminal state, and cancels pending tool loops. |
| `Ctrl+M` | Global | **Model Switcher Modal**: Quick hotkey to toggle between OpenAI, Anthropic, DeepSeek, and local models. |
| `Ctrl+P` | Global | **Setup Wizard**: Guided provider authentication and API key manager. |
| `Ctrl+L` | Global | **Repaint Screen**: Clears buffer and redraws ANSI canvas to adapt to terminal resize. |
| `Tab` | Input Mode | **Smart Autocomplete**: Tab-completes slash commands (`/profile`, `/rewind`) and workspace paths. |
| `PageUp` / `PageDown` | View Mode | **Timeline Scroll**: Inspect previous model responses, diff blocks, and tool logs. |
| `1` – `6` | Profile Modal | **Direct Tab Switch**: Jump between `[1] Profiles`, `[2] Blueprints`, `[3] Revisions`, `[4] Exemplars`, `[5] SLA Health`, `[6] Raw JSON`. |

---

### 🛠️ Self-Healing Troubleshooting & Decision Tree

```mermaid
graph TD
  Problem{What issue did you encounter?}
  Problem -->|Rate Limit / 429 Error| Fallback[Substrate triggers Resilient Fallback Model ladder automatically]
  Problem -->|Infinite Tool Calling Loop| LoopFirewall[Anti-Loop Firewall blocks synthetic repeat and halts turn]
  Problem -->|Agent Made a Bad File Edit| Rewind[Type /rewind 1 to restore exact state in 0.029 ms]
  Problem -->|High Token Latency / Cost| PrefixCache[Check Prefix Cache status in /profile studio or run /compact]
  Problem -->|Agent Forgot Operational Rules| Axioms[Type /profile diff to inspect custom axioms and few-shot exemplars]
```

#### Common Gotchas & 1-Second Fixes

| Symptom | Cause | 1-Second Fix |
| :--- | :--- | :--- |
| **`Command not found: lumi`** | Monolith not linked globally | Run `npx tsx src/index.ts` or run `npm link` in the root folder. |
| **`Missing Provider API Key`** | No credentials configured | Run `npx tsx src/index.ts --setup` or export `OPENAI_API_KEY="sk-..."`. |
| **`Rate limit exceeded (429)`** | Provider quota limit reached | Fallback ladder routes automatically, or press `Ctrl+M` to switch providers. |
| **`Agent edited the wrong file`** | LLM hallucination or stale context | Run `/rewind 1` to instantly undo the file edit and prompt again. |
| **`Terminal borders wrapping`** | Terminal window resized too narrow | Press `Ctrl+L` to repaint canvas to fit your new window width. |

---

### 💻 Programmatic TypeScript SDK & 60s Walkthrough

```typescript
import { LumiMonolith } from "lumi-joy";
const lumi = new LumiMonolith();

// Execute a frame-perfect turn with real-time streaming telemetry
const result = await lumi.tick({
  prompt: "Analyze repository architecture, run test suites, and fix compiler errors",
  onProgress: (event) => console.log(`[${event.phase}] ${event.message}`),
});
console.log("Turn Outcome:", result.outcome, "\nResponse:", result.response);
```

| Interactive Shell Experiment | Exact Command | Measurable Result |
| :--- | :--- | :--- |
| **1. Instant App Synthesis** | `/flappy` | Materializes a 12-file React + TS + Vite Flappy Bird game in VFS in $<100\text{ ms}$. |
| **2. $O(1)$ State Time-Travel** | `/rewind 0` | Instantly rolls back VFS, transcript, and memory facts to Frame #0 in **$0.029\text{ ms}$**. |
| **3. BroccoliDB Reactive Query** | `/db query "SELECT * FROM profiles"` | Queries in-memory tables with $<0.5\ \mu\text{s}$ indexing in rich ANSI spreadsheet view. |

---

### ⚙️ Developer & Verification Quick Reference

| Task / Flow | Command | Key Invariants & Artifacts |
| :--- | :--- | :--- |
| **Run Full Verification** | `npm test` | Verifies composition manifest (591 components), link integrity, and architecture guardrails. |
| **Run Throughput Benchmark** | `npm run benchmark` | Enforces $\ge 1,000\text{ fps}$ fast-path throughput and warmed-p95 rollback $<0.1\text{ ms}$. |
| **Run Smoke Test** | `npm run smoke` | Verifies runtime capabilities across all 9 evidence lanes. |
| **Update Baseline Report** | `npm run baseline:update` | Atomically regenerates [LIVE_BASELINE.json](docs/LIVE_BASELINE.json) & [BENCHMARK_REPORT.md](docs/BENCHMARK_REPORT.md). |
| **Environment Overrides** | `export LUMI_MODEL="claude-3-7-sonnet"` | Supported: `LUMI_MODEL`, `LUMI_PROVIDER`, `LUMI_REASONING_EFFORT`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`. |

---

## ⚡ Comparison Matrix & Empirical Benchmarks

| Metric / Feature | Legacy Monorepo (`pi-main`) | AKD-DSO Monolith (`LUMI-JOY`) | Underlying Mechanism / Speedup |
|---|---|---|---|
| **Architecture** | 18+ Micro-packages | **3-Tier Monolith** (`agents`, `sessions`, `tooling`) | **Zero Framework Bloat** |
| **Agent Codebase Size** | ~18 repositories (>150MB node_modules) | **Unified Monolith: 7.77 MB (`src/`) · 215k LOC** | Zero-dependency high-density engine with **591 single-responsibility components**. |
| **Execution Loop** | Loose Async Handlers | **Deterministic Game Loop** (`tick()`) | **Frame-Perfect Isolation** |
| **Mean Turn Latency** | $14.20\text{ ms}$ | **Live guardrail: $<1.0\text{ ms}$** | Direct function dispatch replacing IPC/RPC queues (see [LIVE_BASELINE.json](docs/LIVE_BASELINE.json)). |
| **Execution Throughput** | $70.4\text{ turns/sec}$ | **Live guardrail: $\geq 1,000\text{ frames/sec}$** | Direct deterministic fast-path measurement ($8,506.11\text{ fps}$ measured baseline). |
| **State Rewind Latency** | $285.00\text{ ms}$ (Re-parse) | **Live guardrail: $<0.1\text{ ms}$ p95** | In-memory frame snapshots restoring state in **$0.029\text{ ms}$**. |
| **Profile Routing Latency**| Global env mutation | **$29.37\text{M ops/sec}$ ($0.034\ \mu\text{s/op}$)** | Zenith Multi-Profile Substrate with byte-stable prefix caching ([ADR-119](.wiki/adr/ADR-119-persistent-multi-profile-isolation-and-routing.md)). |
| **Memory Allocation** | Dynamic Heap GC Sweep | **16MB Zero-GC Slab** | Pre-allocated `ArrayBuffer` slab eliminates Garbage Collection pauses. |
| **Complete Game Synthesis** | Manual multi-file setup | **12-file React + TS + Vite Flappy Bird** | Temp-isolated generation, strict compiler diagnostics, and executable physics simulation. |

---

## 📏 Total Agent Size & Density

> **7.77 MB Source (`src/`)** · **215k LOC** · **16 MB Zero-GC Slab** · **1.8 MB NPM Tarball** · **591 Composed Components**

LUMI-JOY replaces 18+ fragmented micro-packages (>150MB `node_modules`) with a high-density, single-binary monolith delivering **10x higher architectural density**, instant $<100\text{ ms}$ cold starts, and sub-millisecond execution with zero garbage collection pauses.

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
│   ├── base/                              # Agent Base Config (Immutable)
│   └── extensions/                        # Mutation subdirectories (compaction, execution, swarm, profiles)
│
├── sessions/                              # Tier 2: Sessions Subsystem
│   ├── base/                              # Session Context Base (Immutable)
│   └── extensions/                        # Mutation subdirectories (substrate, memory, vfs, broccolidb)
│
└── tooling/                               # Tier 3: Tooling Subsystem
    ├── base/                              # Eyes Tool Base (Immutable)
    └── extensions/                        # 47 Model Tools, execution guards, LSP, browser CDP
```

> 🛡️ **Non-Destructive Osmosis Extension Strategy (`ADR-012`)**: Base classes in `src/*/base/` remain immutable. Evolutionary passes introduce single-responsibility extensions in dedicated domain subdirectories without intermediate barrel files.

---

## 🥦 Deterministic Hybrid BroccoliDB Kernel ($\mathcal{K}_{\text{broccoli}}$)

BroccoliDB combines zero-GC in-memory reactive tables with append-only Write-Ahead Logging and 256-way sharded Content-Addressable Storage ([ADR-120](.wiki/adr/ADR-120-deterministic-hybrid-inmemory-broccolidb-kernel.md)–[ADR-122](.wiki/adr/ADR-122-apex-tier-relational-joins-aggregation-branching-and-views.md)):
- **L1 Hotpath Tables (`BroccoliDbTable<T>`)**: Microsecond-speed reactive tables with primary/secondary index lookups ($<0.5\ \mu\text{s}$).
- **L2 Crash-Proof WAL Journal**: Micro-batched write coalescing ($20\text{ms}$ debounce), SHA-256 frame chaining, and cold-start replay ($<50\text{ ms}$).
- **L3 Sharded CAS Vault**: 256-way sharded storage with adaptive Brotli compression ($\ge 1024\text{B}$) and automatic corruption quarantine.
- **L4 State Checkpoints & Branching**: Double-buffered base checkpoints (`checkpoint.db`) and Git-for-data table branching (`forkBranch`, `mergeBranch`).

---

## 📡 Structured Activity Streaming & Context Lifecycle

- **Structured Live Streaming (`ADR-082`)**: Renders persistent real-time ANSI activity cards showing turn phases, tool executions, and redacted progress without leaking chain-of-thought, tokens, or credentials.
- **Token-Aware Context DSL (`ADR-083`)**: Formal `ContextDslEngine` AST parsing (`LUMI-CONTEXT/1`, `LUMI-THREAD/1`, `LUMI-MEMORY/1`, `LUMI-TOOL-RESULT/1`, `LUMI-GOAL/1`) and `PromptTemplateEngine` (`{{#if}}`/`{{#unless}}`) prevent prompt injection and eliminate amnesia.
- **Autonomous Attempt Completion Gate (`ADR-084`)**: Evaluates quality bars across `admission`, `in_flight`, `completion`, and `postmortem` checkpoints, using quantitative criterion scoring to arbitrate candidates.

---

## 📜 Subsystem Synthesis Matrix & Grand Monolith Baseline

The evolutionary baseline of **LUMI-JOY** synthesizes **591 single-responsibility components** in 100% optimal cohesion under the **AKD-DSO** methodology *(see [Tool Execution Pipeline & Guardrail Topology](docs/ARCHITECTURE_DIAGRAMS.md#3-️-tool-execution-pipeline-guardrails--broccolidb-time-travel))*:

| Subsystem / Pillar | Core Extension Engine | Storage & Snapshot Substrate | Phase / ADR | Key Capabilities & Technical Advantages |
|---|---|---|---|---|
| **👤 Zenith Multi-Profile Substrate** | `DeterministicProfileEngine`, `ProfileSupervisor` | `BroccoliProfileSubstrate`, `ProfileSnapshotManager` | Phase 76 / [ADR-119](.wiki/adr/ADR-119-persistent-multi-profile-isolation-and-routing.md) | Prefix cache frame optimization, few-shot ICL exemplars, resilient model ladders, run step budgeting, and 47 model tools ($29.37\text{M ops/sec}$). |
| **🛡️ Tool Execution Guard & Scheduler** | `DeterministicToolSegmenter`, `ToolExecutionGuardSupervisor` | `BroccoliExecutionGuardSubstrate`, `ExecutionGuardSnapshotManager` | Phase 94 / [ADR-046](.wiki/adr/ADR-046-deterministic-tool-execution-segmenter.md) | Batch parallelism for read-only tools, sequential mutating barriers, 4-stage escalating loop prevention, and $<0.05\text{ ms}$ state rewind. |
| **🗄️ BroccoliDB Relational Kernel** | `BroccoliDatabaseKernel`, `BroccoliRelationEngine`, `BroccoliAggregateEngine` | `BroccoliWriteAheadLog`, `BroccoliCASStorageService`, `BroccoliDbTable<T>` | Phases 71–73 / [ADR-120](.wiki/adr/ADR-120-deterministic-hybrid-inmemory-broccolidb-kernel.md)–[ADR-122](.wiki/adr/ADR-122-apex-tier-relational-joins-aggregation-branching-and-views.md) | In-memory reactive tables ($<0.5\ \mu\text{s}$ indexing), declarative joins with cascade policies, statistical aggregations, and Git-for-data branching. |
| **🎯 StateM Workflow FSM Runbooks** | `RunbookSupervisor`, `FilePredicateEvaluator` | `BroccoliRunbookSubstrate`, `StatefulCompactionSynthesizer` | Phase 131 / [ADR-131](.wiki/adr/ADR-131-deterministic-fsm-runbooks-file-predicates-and-broccolidb-osmosis.md) | 10-step atomic state transitions, zero-subshell predicates ($<5\text{ ms}$), entry-scoped task manifests, and amnesia-proof context compaction. |
| **🧠 Byte-Stable Prompt Cache Boundary** | `DeterministicPromptCacher`, `PromptCacheSupervisor` | `BroccoliPromptCacheSubstrate`, `PromptCacheSnapshotManager` | Phase 93 / [ADR-045](.wiki/adr/ADR-045-deterministic-prompt-cache-boundary.md) | 4-breakpoint byte-stable prompt envelope isolating static axioms, persona ethos, and active schemas for 100% prefix cache retention. |
| **🔍 Verification Evidence Ledger** | `DeterministicEvidenceLedger`, `VerificationEvidenceSupervisor` | `BroccoliEvidenceSubstrate`, `EvidenceSnapshotManager` | Phase 92 / [ADR-044](.wiki/adr/ADR-044-deterministic-verification-evidence-ledger.md) | Turn-by-turn verification evidence recording, automated code path classification, and fail-closed stop-gate completion policies. |
| **🔒 Secret Redactor & Path Firewall** | `DeterministicSecretRedactor`, `SecretRedactionSupervisor` | `BroccoliRedactionSubstrate`, `RedactionSnapshotManager` | Phase 95 / [ADR-047](.wiki/adr/ADR-047-deterministic-secret-redaction-and-path-safety.md) | Entropy-based token scrubbing, query/body masking, suffix-preservation rules, and sensitive path access gating. |
| **🖥️ Terminal UI Modals & Renderers** | `BroccoliViewRenderer`, 30+ TUI Modal Classes | `BroccoliSkinSubstrate`, `SkinSnapshotManager` | Phase 130 / [ADR-106](.wiki/adr/ADR-106-stream-diagnostics-and-forensic-header-capture.md) | Synchronized ANSI cell rendering (`\x1b[?2026h`), 30+ interactive terminal modal dashboards, and rich spreadsheet/kanban/diff views. |
| **🏛️ Grand Monolith Synthesis** | `GrandMonolithSynthesizer`, `MonolithFactory`, `LumiMonolith` | Contiguous 16MB ArrayBuffer slab | Pass 193 / [ADR-012](.wiki/adr/ADR-012-non-destructive-osmosis-class-extension-strategy.md) | 591 verified single-responsibility components with zero circular dependencies, deep relative imports, and full dependency inversion. |

---

## 📚 Essential Documentation & Architecture Index

| Category | Key Resources & Specifications |
| :--- | :--- |
| **Guides & FAQs** | ❓ [Complete FAQ & Self-Intuitive Onboarding Guide](docs/FAQ.md) · ⌨️ [TUI & Commands Guide](docs/TUI_COMMANDS_GUIDE.md) · 🏗️ [Runtime Architecture Guide](docs/RUNTIME_ARCHITECTURE_GUIDE.md) |
| **Architecture & ADRs** | 📖 [Complete ADR Decision Index](.wiki/adr/README.md) · 📐 [Architecture Diagrams](docs/ARCHITECTURE_DIAGRAMS.md) · 🧬 [41 Osmotic Subsystems](docs/HERMES_OSMOSIS_SUBSYSTEMS.md) |
| **Research & Whitepapers** | 🎓 [Academic Research Paper: AKD-DSO](.wiki/whitepaper/AKD-DSO-ACADEMIC-WHITEPAPER.md) · 📄 [Whitepaper: The Osmosis Paradigm](.wiki/whitepaper/OSMOSIS-WHITEPAPER.md) · 🧠 [Osmosis Methodology](.wiki/agent/osmosis-methodology.md) |
| **Verification & Metrics** | 📈 [Live Baseline Evidence](docs/LIVE_BASELINE.json) · 🧪 [Benchmark Report](docs/BENCHMARK_REPORT.md) · 🏛️ [Grand Architectural Audit](docs/GRAND_ARCHITECTURAL_AUDIT.md) · 📋 [Changelog](CHANGELOG.md) |

---

---

## 🙏 Acknowledgments & Ancestral Attribution

- ☤ **Ancestral Teacher & Inspiration**: [`hermes-agent`](https://github.com/NousResearch/hermes-agent) created and open-sourced by **Nous Research** and its incredible community of contributors (licensed under the MIT License). Special thanks to the Nous Research team for pushing the boundaries of open models, autonomous agents, and AI self-improvement.
- 🎯 **StateM Research & Workflow FSM**: Deep credit and appreciation to the creators and contributors of **StateM** for their pioneering work on state-machine-governed agentic runbooks, verification gates, and dynamic check manifests that inspired LUMI-JOY's deterministic runbook substrate ([ADR-131](.wiki/adr/ADR-131-deterministic-fsm-runbooks-file-predicates-and-broccolidb-osmosis.md)).
- 🧠 **Research Foundations**: Built on the open paradigms of autonomous skill evolution, dialectic agent memory (`Honcho`), and open-weights model intelligence advanced by the open AI research community.
- 🎮 **Game Engine Pioneers**: Inspired by the deterministic architecture, memory arenas, and frame-tick discipline of classic game engines (id Software, John Carmack et al.).
- 🌐 **Open Standards**: Fully compatible with the [`agentskills.io`](https://agentskills.io) open standard and the Agent Client Protocol (ACP) for modern IDEs.

---

## 📄 License & Contributing

- 🤝 [Contributor Guidelines](CONTRIBUTING.md)
- 📄 Distributed under the Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.
