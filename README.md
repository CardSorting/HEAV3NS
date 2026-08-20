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

### 📦 Step 1: Prerequisites & Installation

LUMI-JOY is built as a zero-dependency, pure TypeScript monolith without native C++ compilation bindings. Ensure you have **Node.js 20.19+** and **Git** installed:

```bash
# 1. Clone the repository
git clone https://github.com/CardSorting/LUMI-JOY.git
cd LUMI-JOY

# 2. Install dependencies (pure TypeScript toolchain)
npm install

# 3. Compile the monolith into dist/
npm run build
```

---

### 🔑 Step 2: Provider Authentication & Guided Setup

LUMI-JOY features a guided onboarding wizard to configure your preferred LLM providers and reasoning models:

```bash
# Launch the interactive provider configuration wizard
npx tsx src/index.ts --setup
# or if linked globally:
# lumi --setup
```

#### Supported Provider Authentication Options:
1. **OpenAI Codex OAuth (Recommended)**: Initiates an official RFC 7636 PKCE browser sign-in (`http://localhost:1455/auth/callback`).
2. **Anthropic Claude**: Configure `ANTHROPIC_API_KEY` for Claude 3.7 Sonnet, Claude 3.5 Sonnet, and Claude 3 Opus.
3. **OpenAI API Key**: Configure direct API keys for `gpt-4o`, `gpt-5`, `o1`, `o3-mini`.
4. **OpenAI-Compatible Custom Proxy**: Connect private corporate endpoints, Ollama, vLLM, DeepSeek, or OpenRouter gateways.

---

### 💻 Step 3: Launch with a Specialized Agent Persona

```bash
# Launch directly with the specialized Coder persona
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

### 💻 Programmatic TypeScript / Node.js SDK

Embed the deterministic engine directly into your enterprise developer tools, CI bots, or IDE extensions:

```typescript
import { LumiMonolith } from "lumi-joy";

// 1. Initialize the monolithic game engine agent container
const lumi = new LumiMonolith();

// 2. Execute a frame-perfect turn with real-time streaming telemetry
const result = await lumi.tick({
  prompt: "Analyze repository architecture, run test suites, and fix compiler errors",
  onProgress: (event) => {
    console.log(`[${event.phase}] (${event.status}) ${event.message}`);
  },
});

console.log("Turn Outcome:", result.outcome);
console.log("Agent Response:\n", result.response);
```

---

### ⏱️ 60-Second Hands-On Walkthrough

Try these 3 quick commands in the interactive shell to experience LUMI-JOY's unique deterministic powers:

#### 1. Instant Application Synthesis & VFS Overlay
```text
> /flappy
```
*Result*: Materializes a complete 12-file temp-isolated React + TypeScript + Vite Flappy Bird application in the in-memory VFS with executable physics simulation.

#### 2. Sub-Millisecond $O(1)$ State Time-Travel
```text
> /snapshots
> /rewind 0
```
*Result*: Instantly rolls back the virtual file system, conversation transcript, and memory facts to Frame #0 in under $0.05\text{ ms}$ with zero state drift.

#### 3. In-Memory BroccoliDB Relational Query
```text
> /db query "SELECT * FROM tool_execution_plans WHERE status = 'COMPLETED'"
```
*Result*: Queries in-memory reactive tables with $<0.5\ \mu\text{s}$ latency and displays a rich ANSI spreadsheet grid.

---

### 🌐 Step 6: Enterprise Environment Variables Reference

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
│       └── substrate/                     # broccolidb-kernel.ts, broccolidb-cas.ts, broccolidb-wal.ts, broccolidb-table.ts (Phase 71 / ADR-120)
│
│       └──> 🛡️ **Non-Destructive Osmosis Extension Strategy (`ADR-012`)**:  
> Base classes in `src/*/base/` remain immutable. Evolutionary passes introduce single-responsibility extension classes in dedicated mutation subdirectories (`src/*/extensions/<mutation-domain>/`) and compose them cleanly in `MonolithFactory` and `LumiMonolith`.

---

## 🥦 Deterministic Hybrid BroccoliDB Kernel ($\mathcal{K}_{\text{broccoli}}$)

LUMI-JOY features a Zenith-Tier hybrid database kernel combining zero-GC in-memory reactive tables with append-only Write-Ahead Logging (WAL) and 256-way sharded Content-Addressable Storage (CAS):

- **L1 In-Memory Hotpath**: Microsecond-speed reactive tables (`BroccoliDbTable<T>`) with primary key and secondary index multi-map lookups ($<0.5\ \mu\text{s}$).
- **L2 Crash-Proof WAL Journal**: Micro-batched write coalescing ($20\text{ms}$ debounce), cryptographic SHA-256 frame chaining, and automatic cold-start replay ($<50\text{ ms}$ for 10k frames).
- **L3 Sharded CAS Vault**: 256-way sharded blob storage (`.broccolidb/cas/`) with adaptive Brotli compression ($\ge 1024\text{B}$, $\ge 10\%$ savings), cryptographic read verification, and automatic corruption quarantine (`.broccolidb/cas/corrupt/`).
- **L4 Double-Buffered Base State Checkpoints**: Atomic `.tmp -> rename` snapshot compaction (`.broccolidb/checkpoint.db`) with safe WAL log rotation.
- **L5 Re-Entrant Async Mutex**: `AsyncLocalStorage`-based nested locking, 30s dead-man leases, and randomized Poisson jitter backoff.
- **🕒 Time Machine & Model Tools**: Exposes `db_inspect_status`, `db_query_table`, `db_checkpoint_wal`, `db_cas_audit`, `db_timeline_history`, and `db_rollback_timeline`.

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

Context admission is model-aware and token-aware *(see the [Context Envelope Projection Diagram](docs/ARCHITECTURE_DIAGRAMS.md#5--token-aware-multi-turn-context-lifecycle))*:

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

Each feature pass creates a dedicated, single-responsibility module across the `agents/`, `sessions/`, `tooling/`, and `tui/` tiers, maintaining absolute immutability of the foundational domain base classes.

👉 **View the complete table**: [Full Mutation Directory Responsibility Matrix (ADR-012)](docs/MUTATION_DIRECTORIES.md).

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
