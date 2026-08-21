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

## 🎯 What You Can Do (Real-World Developer Superpowers)

| Your Everyday Challenge | How LUMI Solves It | The Real-World Benefit |
|---|---|---|
| **Accidental bad edits or AI hallucinations** | Safe 1-Click Time-Travel Undo (`/rewind`) | Roll back files, memory, and chat history in **0.02ms** with zero lost work. |
| **Fear of AI overwriting production files** | Non-Destructive Staging & Live Diffs | Review every code change visually in a safe sandbox before saving to disk. |
| **Searches freezing on huge repositories** | Zero-Subprocess In-Memory Code Search | Scans codebases **5–10x faster** than terminal grep with zero UI lag. |
| **Typo in function or variable name** | Subsequence Fuzzy Symbol Matching | Finds what you're looking for even if you or the AI misspell the query. |
| **Ghost dev servers locking `:3000`** | Automatic Port & Process Liberation | Detects and frees blocked ports instantly—no manual `kill -9` required. |
| **Expensive AI token bills on long chats** | Zenith-Tier Smart Prompt Caching | Caches heavy rules and schemas so you pay up to **90% less per turn**. |
| **Need frontier reasoning for hard bugs** | Instant Live Model Hot-Swapping | Switch between OpenAI, Claude, and local models with zero context loss. |
| **Want a customized assistant** | Drag & Drop Customization (`souls/`, `skills/`) | Drop in any prompt or script file to instantly create a personalized AI. |

---

## 👤 Pick Your AI Specialist

| Specialist Persona | Best For | Everyday Superpowers |
|---|---|---|
| 💻 **`coder` (Lead Engineer)** | Full-Stack Software Engineering | Writes strict TypeScript, refactors legacy code, and writes passing tests. |
| 🔬 **`researcher` (Deep Researcher)** | Literature & Web Intelligence | Searches documentation, synthesizes web research, and verifies citations. |
| 🛡️ **`sre` (Reliability Engineer)** | System Forensics & Triage | Diagnoses crashes, inspects system logs, and applies automated fixes. |
| ✍️ **`writer` (Technical Author)** | Architecture Docs & Guides | Drafts Keep-a-Changelog releases, Architecture ADRs, and Mermaid diagrams. |
| 🎓 **`student` (Socratic Mentor)** | Codebase Onboarding & Learning | Explains tricky concepts and logic flows with interactive step-by-step hints. |
| ⚡ **`minimal` (Speed Script)** | Quick Headless Automation | High-velocity edits with the smallest possible token footprint. |

---

## 📋 What's New: Key Benefits at a Glance

| Major Upgrade | Plain-English Human Benefits | Why You'll Love It |
|---|---|---|
| **⚡ High-Velocity Pattern Search & Direct I/O (ADR-136)** | • **Instant Code Search**: Search millions of lines of code with zero terminal freezes.<br/>• **Typo Forgiveness**: Finds the right symbols even with misspelled queries.<br/>• **Smart Variable Extraction**: Pulls API keys and regex variables automatically.<br/>• **Automatic Port Unlock**: Never get stuck on `EADDRINUSE: port already in use`.<br/>• **Safe Sandbox Review**: Inspect diffs before committing changes to your disk. | **Faster coding flow, zero terminal lockups, and complete peace of mind when refactoring.** |
| **🧠 Zenith Smart Prompt Caching (ADR-135)** | • **90% Cheaper Turns**: Never pay to re-send instructions the AI already read.<br/>• **Sub-Second First Words**: Starts responding immediately without re-reading from scratch.<br/>• **Live Dollar Savings**: Shows your exact daily, monthly, and annual dollar savings in plain English. | **Massively cuts your monthly AI subscription and API bills.** |

> 📜 *See the technical changelog in [CHANGELOG.md](CHANGELOG.md) or architectural records in [ADR-136](docs/adr/ADR-136-high-velocity-pattern-search-and-zen-io-execution-authority.md).*

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
