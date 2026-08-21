<div align="center">

# ⚡ LUMI-JOY

### **The Lightning-Fast, Zero-Lag AI Coding Assistant**

*Blazing-fast TypeScript AI engine that never freezes, enables instant 1-click time-travel undo, and slashes API costs by up to 90%.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Speed](https://img.shields.io/badge/Speed-%3C0.15ms%20tick-brightgreen?style=for-the-badge)](#-why-its-fast--cost-efficient)
[![Undo](https://img.shields.io/badge/Undo-%3C0.03ms%20rewind-blueviolet?style=for-the-badge)](#-why-its-fast--cost-efficient)
[![Throughput](https://img.shields.io/badge/Throughput-6800%2B%20fps-orange?style=for-the-badge)](#-why-its-fast--cost-efficient)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)

<br/>

| **Quick Links** | **Guides & Manuals** | **Architecture & Deep Dives** |
|---|---|---|
| 🚀 [Quick Start](#-quick-start-in-60-seconds) | 🔮 [SOUL & Skills Guide](SOUL_AND_SKILLS_GUIDE.md) | 📐 [Architecture Diagrams](docs/ARCHITECTURE_DIAGRAMS.md) |
| 🎯 [How-To Cookbook](#-1-command-cookbook) | ❓ [FAQ & Onboarding](docs/FAQ.md) | 🏗️ [Runtime Architecture Guide](docs/RUNTIME_ARCHITECTURE_GUIDE.md) |
| 👤 [AI Roles & Blueprints](#-ai-roles) | ⌨️ [TUI Commands & Strategy](docs/TUI_COMMANDS_GUIDE.md) | 🔍 [Pattern Search & Zen I/O (ADR-136)](docs/adr/ADR-136-high-velocity-pattern-search-and-zen-io-execution-authority.md) |
| 📋 [Changelog Highlights](#-recent-changelog-highlights) | 📖 [Author's Note](PREFACE.md) | ⚡ [Prompt Caching Subsystem (ADR-135)](docs/adr/ADR-135-zenith-tier-prompt-caching-telemetry-and-auto-tuning-substrate.md) |
| 🧪 [78-Test QoL Suite](scripts/validate-qol-enhancements.ts) | 📈 [Live Baseline Evidence](docs/LIVE_BASELINE.json) | 🏛️ [Master ADR Index](docs/adr/README.md) |

---

</div>

> *Dedicated to the open-source community and the creators at **Nous Research** & **Hermes**. Made with love so anyone can build with fast, reliable AI.*
> — **William Andrew Cruz** (`bozoegg` / `CardSorting`) · [Read Author's Note](PREFACE.md)

---

## 🌟 Why It's Fast & Cost-Efficient

| Capability | What It Means to You | Performance SLA |
|---|---|:---:|
| ⚡ **Zero Turn Latency** | Direct in-memory engine runs locally without bloated RPC or subprocess lag. | **0.15 ms / tick** |
| 🔍 **Blazing Pattern Search** | In-memory code search with regex auto-escaping, typo-tolerance, and captures. | **5–10x faster than grep** |
| ⏪ **Instant Time-Travel** | Undo any mistake or bad edit instantly with `/rewind 1`. | **0.022 ms p95** |
| 💸 **90% Token Savings** | Locks immutable system prompts and tools in memory (Prompt Caching ADR-135). | **Up to 90% cheaper** |
| 🛡️ **Zero Port Blockers** | Automatically detects and terminates zombie dev servers locking ports (`:3000`). | **Instant kill_port** |
| 🚀 **High Throughput** | Built over a 16MB Zero-GC typed array slab sustaining massive turn velocity. | **6,800+ frames/sec** |

---

## 🚀 Quick Start in 60 Seconds

```bash
# 1. Download & Build
git clone https://github.com/CardSorting/LUMI-JOY.git && cd LUMI-JOY
npm install && npm run build

# 2. Configure AI Provider (Interactive OAuth / API Key Wizard)
npx tsx src/index.ts --setup

# 3. Launch with Persona
npx tsx src/index.ts --profile coder
```

```text
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║ ⚡ LUMI-JOY v1.0.0 │ 👤 [💻 Coder] │ 🧠 [gpt-5.6-luna] │ ⏱️ 0.12ms │ 💰 $0.0018 │ ⭐ Fav ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║  👤 You: Refactor auth.ts to add expiration checks                                        ║
║  ⚡ LUMI (Coder): Checked auth.ts and applied clean edits with unit tests (0.04ms)         ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║ 💡 Shortcuts: [Ctrl+M] Switch Model  [Ctrl+P] Setup  [/profile] Change Role  [Ctrl+C] Quit ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 🎯 1-Command Cookbook

| Goal | Command / Action | Result |
|---|---|---|
| **Write & refactor code** | `/profile use coder` | Activates TypeScript LSP, AST parsers, and test assertions. |
| **Inspect staged diffs** | `/diff [path]` | Previews real-time unified diffs before writing to physical disk. |
| **Commit staged changes** | `/commit [path]` | Atomically commits staged virtual file edits to disk. |
| **Revert unwanted edits** | `/discard [path]` | Discards staged edits and restores the original disk file. |
| **Undo last AI action** | `/rewind 1` | Instantly rolls back all files, memory, and conversation state. |
| **Search symbols safely** | `grep_search` | Runs in-memory pattern matching with typo tolerance & captures. |
| **Unlock blocked port** | `kill_port :3000` | Automatically terminates ghost background processes holding the port. |
| **Switch AI model live** | `Ctrl+M` *(or `/model claude-3-7`)* | Swaps model provider with 100% prefix cache retention. |
| **Drop-in customize** | Drop into `souls/` or `skills/` | Instantly creates and activates custom assistants and tools. |

---

## 👤 AI Roles

| Role | Focus | Included Toolsets |
|---|---|---|
| 💻 **`coder`** | Software engineering, refactoring, and test generation | Files, Code editing, Terminal, Git |
| 🔬 **`researcher`** | Web intelligence, documentation search, and citation analysis | Web search, File reader, Memory facts |
| 🛡️ **`sre`** | Incident triage, crash logs, and automated self-healing | Diagnostics, Health probes, Terminal |
| ✍️ **`writer`** | Architecture ADRs, changelogs, and technical guides | Markdown, File writer, Memory notes |
| 🎓 **`student`** | Socratic learning tutor with interactive walkthroughs | Step-by-step guidance, Explanations |
| ⚡ **`minimal`** | Ultra-fast, lightweight assistant with minimum token footprint | Fast file editing, Core tools |

---

## 📋 Recent Changelog Highlights

| Milestone | What's New in Plain English | Strategic Impact |
|---|---|---|
| **⚡ ADR-136: Pattern Search & Zen I/O Authority** | • **Zero-Subprocess In-Memory Search**: Scans code 5–10x faster without shell freezing.<br/>• **Typo-Forgiving Fuzzy Search**: Finds symbols even with minor spelling mistakes.<br/>• **Regex Subgroup Captures**: Directly extracts AST variables in search results.<br/>• **Port Liberation (`kill_port`)**: Terminates ghost background servers blocking dev ports.<br/>• **Token Defense**: Caps per-file matches and strips comments to protect context windows.<br/>• **VFS Staging Controls**: Added `/diff`, `/commit`, `/discard`, and `/tools`. | **Eliminates developer friction, accelerates refactoring, and shields token budgets.** |
| **🧠 ADR-135: Zenith Prompt Caching Subsystem** | • **5-Tier Prompt Hierarchy (L0–L4)**: Caches immutable system kernels and tools.<br/>• **Up to 90% Cost Reduction**: Slashes multi-turn API bills across Claude, OpenAI, and DeepSeek.<br/>• **Real-Time Dollar Forecasts**: Displays daily, monthly, and annual ROI calculations. | **Massively reduces API token costs and delivers sub-second first-word responses.** |

> 📜 *See complete release history in [CHANGELOG.md](CHANGELOG.md).*

---

## 📚 Advanced Developer Reference

| Category | Reference Links |
|---|---|
| 📐 **Architecture** | [Architecture Diagrams](docs/ARCHITECTURE_DIAGRAMS.md) · [Runtime Guide](docs/RUNTIME_ARCHITECTURE_GUIDE.md) · [Optimization Record](docs/RUNTIME_OPTIMIZATION_RECORD.md) · [Master ADR Index](docs/adr/README.md) |
| 🎓 **Research & Evidence** | [AKD-DSO Academic Paper](.wiki/whitepaper/AKD-DSO-ACADEMIC-WHITEPAPER.md) · [Live Baseline Measurements](docs/LIVE_BASELINE.json) · [Benchmark Report](docs/BENCHMARK_REPORT.md) · [Grand Audit](docs/GRAND_ARCHITECTURAL_AUDIT.md) |
| ⚡ **Source Architecture** | [Composition Root](src/index.ts) · [Engine Factory](src/factories/monolith-factory.ts) · [Tool Registry](src/tooling/extensions/registry/tool-registry.ts) · [Pattern Search Service](src/tooling/extensions/perception/ripgrep-search-service.ts) |

### Latest Verified Workspace Baseline (2026-08-21)

| Verification Metric | Measured Result | Threshold SLA | Status |
|---|---:|---:|:---:|
| Composed Components | **591 / 591** | 591 components | **PASS** |
| Runtime Capability Smoke | **9 / 9 checks (3.76 ms)** | 9 checks | **PASS** |
| Quality-of-Life (QoL) Suite | **78 / 78 checks (7.12 s)** | 78 checks | **PASS** |
| Architecture Guardrails | **6 / 6 checks** | 6 checks | **PASS** |
| Turn Tick Latency | **0.15 ms** | $< 1.0\text{ ms}$ | **PASS** |
| Execution Throughput | **6,869.90 frames/sec** | $\ge 1,000\text{ fps}$ | **PASS** |
| Snapshot State Rewind | **0.022 ms p95** | $< 0.1\text{ ms p95}$ | **PASS** |
| Zero-GC Memory Slab | **16,777,216 bytes** | 16 MB exact | **PASS** |

---

## 🏛️ Open Source & License

- **Inspiration**: Built with love and inspired by [`hermes-agent`](https://github.com/NousResearch/hermes-agent) by **Nous Research**.
- **License**: Free & Open Source under the **Apache License 2.0** ([LICENSE](LICENSE) · [NOTICE](NOTICE) · [CONTRIBUTING.md](CONTRIBUTING.md) · [PATENT-NON-AGGRESSION-PLEDGE.md](PATENT-NON-AGGRESSION-PLEDGE.md)).
