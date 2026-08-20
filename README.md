<div align="center">

# ⚡ LUMI-JOY

### **The Lightning-Fast, Zero-Lag AI Coding Assistant**

*An ultra-fast AI assistant for TypeScript that never freezes, lets you instantly undo any mistake in 1 second, and is dead simple to customize with drag-and-drop.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.19+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Ancestral Teacher](https://img.shields.io/badge/Ancestral%20Teacher-Hermes--Agent%20(Nous%20Research)-FFD700?style=for-the-badge&logo=github)](https://github.com/NousResearch/hermes-agent)
[![Grand Monolith](https://img.shields.io/badge/Grand%20Monolith-586%20Components-success?style=for-the-badge)](.wiki/architecture/OSMOSIS-FREEZE-AND-CUTOFF.md)
[![Agent Size](https://img.shields.io/badge/Agent%20Size-215k%20LOC%20%7C%207.77%20MB-9C27B0?style=for-the-badge)](#-empirical-benchmarks--density)
[![Academic Paper](https://img.shields.io/badge/Academic%20Paper-AKD--DSO-9C27B0?style=for-the-badge)](.wiki/whitepaper/AKD-DSO-ACADEMIC-WHITEPAPER.md)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)

<br/>

| **Core Navigation** | **Documentation & Guides** | **Subsystem Source Code** |
|---|---|---|
| 🚀 [Quick Start](#-quick-start-in-60-seconds) | 🔮 [SOUL & Skills Guide](SOUL_AND_SKILLS_GUIDE.md) | ⚡ [Composition Root](src/index.ts) |
| 🎯 [Task Cookbook](#-i-want-to-task-cookbook) | 📐 [Architecture Diagrams](docs/ARCHITECTURE_DIAGRAMS.md) | 🏭 [Engine Factory](src/factories/monolith-factory.ts) |
| 🔮 [SOUL & Skills Vaults](#-zero-command-customization-souls--skills) | ❓ [Frequently Asked Questions](docs/FAQ.md) | ⚙️ [Core Contracts](src/core/contracts/) |
| 👤 [Agent Blueprints](#-agent-blueprints-matrix) | ⌨️ [TUI & Commands Guide](docs/TUI_COMMANDS_GUIDE.md) | 🧠 [Agents Tier](src/agents/) |
| ⚡ [Empirical Benchmarks](#-empirical-benchmarks--density) | 🧬 [41 Osmotic Subsystems](docs/HERMES_OSMOSIS_SUBSYSTEMS.md) | 💾 [Sessions Tier](src/sessions/) |
| 🏛️ [Ancestral Heritage](#-heritage--open-science) | 📈 [Live Baseline Evidence](docs/LIVE_BASELINE.json) | 🔧 [Tool Registry](src/tooling/extensions/registry/tool-registry.ts) |

---

</div>

> *Dedicated to the open-source community and the visionary researchers at **Nous Research** & the **Hermes community**. Built with the belief that agent software can be fast, deterministic, and crafted with soul.*
> — **William Andrew Cruz** (`bozoegg` / `CardSorting`), *Author & Hermes Ambassador* · [Read Preface](PREFACE.md)

---

## 🌟 Core Engine Pillars

| Pillar | Architectural Mechanism | Measured SLA / Result |
|---|---|---|
| 🕹️ **Deterministic Frame Ticks** | Single-threaded atomic frame loop (`Input ➔ Dispatch ➔ Mutation ➔ Telemetry`) | **$0.12\text{ ms}$ latency**; eliminates microservice queues |
| ⚡ **Zero-GC Contiguous Slab** | 16 MB pre-allocated `ArrayBuffer` arena with static cached UTF-8 encoders | **Zero GC pauses** during live token streaming |
| 🚀 **High-Throughput Execution** | In-process monolithic dispatch bypassing network IPC overhead | **$8,500+\text{ frames/sec}$** ($>8.5\times$ above the $1,000\text{ fps}$ SLA) |
| ⏪ **$O(1)$ State Time-Travel** | Instant rollback of virtual files (`SessionVfs`), memory, and transcripts | **$0.01\text{ ms p95}$** instant rollback for MCTS branch search |

---

## 🔮 Zero-Command Customization: `souls/` & `skills/`

Customize your agent simply by dropping files into your workspace folders:

- 🎭 **`souls/`** — Drop persona files (`.soul.md`, `.card.json`, `.gpt.json`, `.claude.xml`, or `.txt`) to instantly update identity, voice & ethos.
- ⚡ **`skills/`** — Drop capability files (`SKILL.md`, `*.tool.json`, `*.claude.xml`, `*.py`, or `.txt`) to instantly add tools & workflows.

> **💡 Effortless Setup**: Describe what you want in plain text (*One-Shot Forge*), answer the *5-Step Wizard*, apply *Power-Up Packs* (`zero_gc_buffer`, `retry_resilience`), or 1-click auto-heal with the *Doctor Linter*. See 📖 [SOUL_AND_SKILLS_GUIDE.md](SOUL_AND_SKILLS_GUIDE.md).

---

## 🚀 Quick Start in 60 Seconds

```bash
# 1. Clone & Install (Pure TypeScript, zero C++ bindings)
git clone https://github.com/CardSorting/LUMI-JOY.git && cd LUMI-JOY
npm install && npm run build

# 2. Interactive Provider Setup (Codex PKCE OAuth, Claude, OpenAI, Ollama)
npx tsx src/index.ts --setup

# 3. Launch with Specialized Persona (e.g. Coder, Researcher, SRE)
npx tsx src/index.ts --profile coder
```

### 🖥️ Differential Terminal Canvas

```text
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║ ⚡ LUMI-JOY v1.0.0 │ 👤 [💻 Coder] │ 🧠 [gpt-5.6-luna] │ ⏱️ 0.12ms │ 💰 $0.0018 │ ⭐ Fav ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║  👤 You: Refactor src/core/auth.ts to add strict token expiration validation             ║
║  ⚡ LUMI (Coder):                                                                        ║
║  ┌────────────────────────────────────────────────────────────────────────────────────┐  ║
║  │ 🔧 Tool: patch ("src/core/auth.ts") ➔ Line-anchored edit verified (0.04ms)         │  ║
║  └────────────────────────────────────────────────────────────────────────────────────┘  ║
║  I have added strict JWT expiration claims verification and unit test assertions.        ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║ 💡 Shortcuts: [Ctrl+M] Model  [Ctrl+P] Setup  [/profile] Switch Persona  [Ctrl+C] Abort  ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 🎯 "I Want To..." Task Cookbook

| Goal | Command / Action | Mechanism |
|---|---|---|
| **Write or refactor code** | `/profile use coder` | TypeScript LSP, AST parsers, line-anchored atomic mutators. |
| **Academic & web research** | `/profile use researcher` | Citation rigor, arXiv tools, web intelligence synthesis. |
| **Triage production crashes** | `/profile use sre` | Diagnostic ring buffers, health probes, self-healing tools. |
| **Undo last file modification** | `/rewind 1` | Instantly rolls back VFS, memory, and transcript in **$0.01\text{ ms}$**. |
| **Create custom persona** | Drop in `souls/` or `/soul forge` | Auto-senses format and verifies SHA-256 integrity. |
| **Create custom skill** | Drop in `skills/` or `/skill forge` | Ingests tool schemas and builds procedural execution DAG. |
| **Hot-swap AI model** | `Ctrl+M` *(or `/model claude-3-7`)* | Switches provider with 100% prefix cache retention. |
| **Run StateM FSM runbook** | `/runbook start coding_loop` | 10-step atomic workflow state machine with zero-subshell predicates. |

---

## 👤 Agent Blueprints Matrix

| Blueprint | Focus | Key Toolsets | Best Model |
|:---|---|---|---|
| 💻 **`coder`** | Software Engineering, Refactoring & Test Suites | `files`, `execution`, `lsp`, `git` | `gpt-5.6-luna` |
| 🔬 **`researcher`** | Literature Synthesis, Fact Checking & Intelligence | `files`, `web`, `memory` | `claude-3-7-sonnet` |
| 🛡️ **`sre`** | Incident Triage, System Forensics & Diagnostics | `execution`, `git`, `doctor` | `gpt-5.6-luna` |
| ✍️ **`writer`** | Architecture ADRs, Technical Guides & Specs | `files`, `memory` | `claude-3-7-sonnet` |
| 🎓 **`student`** | Socratic Learning Tutor & Walkthroughs | `files`, `memory` | `gpt-4o` |
| 🎨 **`creative`** | Game Mechanics, Assets & Worldbuilding | `vision`, `memory` | `gpt-4o` |
| ⚡ **`minimal`** | Headless High-Speed Scripting | `core`, `files` | `gpt-4o-mini` |

---

## ⚡ Empirical Benchmarks & Density

> **7.77 MB Source (`src/`)** · **215k LOC** · **16 MB Zero-GC Slab** · **586 Composed Components** · **0 Compilation Errors**

| Metric | Legacy Monorepos | LUMI-JOY Monolith | Verified Mechanism |
|---|---|---|---|
| **Architecture** | 18+ Loose Packages | **3-Tier Monolith** (`agents`, `sessions`, `tooling`) | In-process zero-overhead dispatch |
| **Turn Latency** | $14.2\text{ ms}$ | **$<0.15\text{ ms}$** | Atomic frame tick lifecycle ([LIVE_BASELINE.json](docs/LIVE_BASELINE.json)) |
| **Throughput** | $70.4\text{ fps}$ | **$8,500+\text{ frames/sec}$** | In-process monolithic kernel ($>8.5\times$ SLA) |
| **State Rewind** | $285.0\text{ ms}$ | **$0.01\text{ ms p95}$** | Frame snapshots restoring VFS and memory state |
| **Memory Invariant**| Heap GC Sweeps | **16 MB Zero-GC Slab** | Pre-allocated `ArrayBuffer` eliminating GC pauses |

---

## 🏛️ Heritage & Open Science

- **☤ Ancestral Teacher**: Forged via **AKD-DSO** distillation from [`hermes-agent`](https://github.com/NousResearch/hermes-agent) (**Nous Research** / MIT License). Special thanks to Nous Research for championing open weights, agent self-improvement, and user sovereignty.
- **🎯 StateM FSM Runbooks (`ADR-131`)**: State-machine-governed workflow execution with atomic verification gates.
- **📄 License**: Distributed under the **Apache License 2.0** ([LICENSE](LICENSE) · [NOTICE](NOTICE) · [CONTRIBUTING.md](CONTRIBUTING.md) · [PATENT-NON-AGGRESSION-PLEDGE.md](PATENT-NON-AGGRESSION-PLEDGE.md)).

