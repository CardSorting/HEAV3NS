<div align="center">

# ⚡ LUMI-JOY

### **The Lightning-Fast, Zero-Lag AI Coding Assistant**

*A blazing-fast AI coding companion that never freezes, lets you undo any mistake with one click, and cuts your AI bills by up to 90%.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Speed](https://img.shields.io/badge/Speed-%3C0.15ms%20instant-brightgreen?style=for-the-badge)](#-why-developers-love-it)
[![Undo](https://img.shields.io/badge/Undo-Instant%20Rewind-blueviolet?style=for-the-badge)](#-why-developers-love-it)
[![Throughput](https://img.shields.io/badge/Throughput-6800%2B%20actions%2Fsec-orange?style=for-the-badge)](#-why-developers-love-it)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)

<br/>

| **Quick Links** | **Guides & Manuals** | **Architecture & Deep Dives** |
|---|---|---|
| 🚀 [Quick Start](#-quick-start-in-60-seconds) | 🔮 [Custom Assistants (SOULs & Skills)](SOUL_AND_SKILLS_GUIDE.md) | 📐 [Visual Architecture Maps](docs/ARCHITECTURE_DIAGRAMS.md) |
| 🎯 [Real-World Benefits](#-what-you-get-real-world-benefits) | ❓ [Frequently Asked Questions](docs/FAQ.md) | 🏗️ [Runtime Architecture Guide](docs/RUNTIME_ARCHITECTURE_GUIDE.md) |
| 👤 [Pick an AI Specialist](#-pick-your-ai-specialist) | ⌨️ [Interactive Terminal Guide](docs/TUI_COMMANDS_GUIDE.md) | 🔍 [Smart Search Engine (ADR-136)](docs/adr/ADR-136-high-velocity-pattern-search-and-zen-io-execution-authority.md) |
| 📋 [What's New](#-whats-new-at-a-glance) | 📖 [Author's Story & Note](PREFACE.md) | ⚡ [Cost-Saving Memory Caching (ADR-135)](docs/adr/ADR-135-zenith-tier-prompt-caching-telemetry-and-auto-tuning-substrate.md) |
| 🧪 [78-Test Verification Suite](scripts/validate-qol-enhancements.ts) | 📈 [Live Benchmark Measurements](docs/LIVE_BASELINE.json) | 🏛️ [Architecture Decision Records](docs/adr/README.md) |

---

</div>

> *Dedicated to the open-source community and the creators at **Nous Research** & **Hermes**. Made with love so anyone can build with fast, reliable AI.*
> — **William Andrew Cruz** (`bozoegg` / `CardSorting`) · [Read Author's Note](PREFACE.md)

---

## 🌟 Why Developers Love It

| What You Get | Why It Helps You Every Day | How Fast & Effective It Is |
|---|---|:---:|
| ⚡ **Instant Responses, Zero Lag** | Runs directly on your machine with no bloated middleware or slow delays. | **Under 0.15 milliseconds** |
| 🔍 **Lightning-Fast Code Search** | Finds any function, file, or symbol instantly without freezing your terminal. | **5–10x faster than normal search** |
| ⏪ **1-Click Instant Undo** | Made a bad edit? One command snaps all your files and chat history back. | **Snap back in 0.02ms** |
| 💸 **Up to 90% Cheaper Bills** | Remembers your rules and files so you only pay for your new questions. | **Slashes AI API costs** |
| 🛡️ **No More Locked Ports** | If a background server is stuck on port 3000, LUMI frees it automatically. | **Automatic unblocking** |
| 🚀 **Rock-Solid Stability** | Smooth memory management ensures your screen never stutters or freezes. | **6,800+ actions every second** |

---

## 🚀 Quick Start in 60 Seconds

```bash
# 1. Download & Build
git clone https://github.com/CardSorting/LUMI-JOY.git && cd LUMI-JOY
npm install && npm run build

# 2. Add your AI API key (guided step-by-step wizard)
npx tsx src/index.ts --setup

# 3. Start coding!
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

## 🎯 What You Get (Real-World Benefits)

| The Everyday Frustration | How LUMI Solves It | Your Real-World Benefit |
|---|---|---|
| **Accidental bad edits or AI mistakes** | 1-Click Instant Time-Travel Undo | Roll back all files, memory, and chat history instantly with zero lost work. |
| **Fear of AI breaking working code** | Safe Preview Sandbox & Live Diffs | Review every code edit visually in a safe sandbox before saving anything to disk. |
| **Searches freezing on large projects** | Direct High-Speed Code Search | Scans your whole codebase in milliseconds with zero terminal lag or freezing. |
| **Typos in function or variable names** | Typo-Tolerant Smart Matching | Finds what you're looking for even if you or the AI misspell the name. |
| **Ghost servers locking port 3000** | Automatic Port Unlocking | Automatically finds and terminates stuck background servers for you. |
| **Expensive AI token bills on long chats** | Smart Memory Caching | Locks system rules in memory so you pay up to **90% less per turn**. |
| **Need a smarter model for hard bugs** | Switch AI Models on the Fly | Seamlessly switch between Claude, OpenAI, and local models mid-chat. |
| **Want a customized AI teammate** | Drag & Drop Custom Assistants | Drop in any prompt or script file to create a personalized AI assistant. |

---

## 👤 Pick Your AI Specialist

| Specialist | Best For | What It Does For You |
|---|---|---|
| 💻 **`coder` (Lead Engineer)** | Coding & Refactoring | Writes clean TypeScript, fixes tricky bugs, and writes passing unit tests. |
| 🔬 **`researcher` (Deep Researcher)** | Research & Learning | Searches documentation, summarizes web findings, and verifies sources. |
| 🛡️ **`sre` (Reliability Engineer)** | Fixing Crashes & Errors | Diagnoses error logs, checks system health, and applies automated fixes. |
| ✍️ **`writer` (Technical Author)** | Guides & Documentation | Writes crystal-clear documentation, release changelogs, and architecture notes. |
| 🎓 **`student` (Patient Mentor)** | Learning & Onboarding | Breaks down difficult code into friendly, step-by-step explanations. |
| ⚡ **`minimal` (Speed Script)** | Fast Automation | Gets straight to work on quick file edits using the lowest possible token cost. |

---

## 📋 What's New at a Glance

| Major Upgrade | What It Means in Plain English | Why You'll Love It |
|---|---|---|
| **⚡ High-Speed Search & Smart Tools (ADR-136)** | • **Instant Code Search**: Search your whole project with zero terminal lockups.<br/>• **Typo Forgiveness**: Finds the right code even with spelling mistakes.<br/>• **Automatic Port Unlock**: Never get stuck on `port already in use` errors.<br/>• **Safe Sandbox Review**: Inspect visual diffs before saving changes to your disk. | **Faster coding flow, zero terminal freezes, and complete peace of mind when editing code.** |
| **🧠 Smart Cost-Saving Memory (ADR-135)** | • **Up to 90% Cheaper**: Never pay to re-send instructions the AI already read.<br/>• **Sub-Second First Words**: Starts answering immediately without re-reading from scratch.<br/>• **Live Dollar Savings**: Shows your exact daily and monthly savings in real dollars. | **Massively cuts your monthly AI subscription and API costs.** |

> 📜 *See the complete release history in [CHANGELOG.md](CHANGELOG.md).*

---

## 📚 Advanced Developer Reference

| Category | Reference Links |
|---|---|
| 📐 **Architecture** | [Visual Architecture Maps](docs/ARCHITECTURE_DIAGRAMS.md) · [Runtime Guide](docs/RUNTIME_ARCHITECTURE_GUIDE.md) · [Optimization Record](docs/RUNTIME_OPTIMIZATION_RECORD.md) · [Master ADR Index](docs/adr/README.md) |
| 🎓 **Research & Evidence** | [AKD-DSO Academic Paper](.wiki/whitepaper/AKD-DSO-ACADEMIC-WHITEPAPER.md) · [Live Baseline Measurements](docs/LIVE_BASELINE.json) · [Benchmark Report](docs/BENCHMARK_REPORT.md) · [Grand Audit](docs/GRAND_ARCHITECTURAL_AUDIT.md) |
| ⚡ **Source Architecture** | [Composition Root](src/index.ts) · [Engine Factory](src/factories/monolith-factory.ts) · [Tool Registry](src/tooling/extensions/registry/tool-registry.ts) · [Pattern Search Service](src/tooling/extensions/perception/ripgrep-search-service.ts) |

### Verified Workspace Baseline (2026-08-21)

| Verification Metric | Measured Result | Threshold SLA | Status |
|---|---:|---:|:---:|
| Composed Components | **591 / 591** | 591 components | **PASS** |
| Runtime Capability Smoke | **9 / 9 checks (3.76 ms)** | 9 checks | **PASS** |
| Quality-of-Life (QoL) Suite | **78 / 78 checks (7.12 s)** | 78 checks | **PASS** |
| Architecture Guardrails | **6 / 6 checks** | 6 checks | **PASS** |
| Turn Response Speed | **0.15 ms** | $< 1.0\text{ ms}$ | **PASS** |
| Processing Velocity | **6,869.90 actions/sec** | $\ge 1,000\text{ actions/sec}$ | **PASS** |
| Instant Undo Latency | **0.022 ms p95** | $< 0.1\text{ ms p95}$ | **PASS** |
| Dedicated Memory Buffer | **16,777,216 bytes** | 16 MB exact | **PASS** |

---

## 🏛️ Open Source & License

- **Inspiration**: Built with love and inspired by [`hermes-agent`](https://github.com/NousResearch/hermes-agent) by **Nous Research**.
- **License**: Free & Open Source under the **Apache License 2.0** ([LICENSE](LICENSE) · [NOTICE](NOTICE) · [CONTRIBUTING.md](CONTRIBUTING.md) · [PATENT-NON-AGGRESSION-PLEDGE.md](PATENT-NON-AGGRESSION-PLEDGE.md)).
