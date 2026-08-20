<div align="center">

# ⚡ LUMI-JOY

### **The Lightning-Fast, Zero-Lag AI Coding Assistant**

*A blazing-fast AI helper for TypeScript that never freezes, lets you instantly undo any mistake, and is dead simple to customize with drag-and-drop.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Speed](https://img.shields.io/badge/Speed-%3C0.15ms%20per%20action-brightgreen?style=for-the-badge)](#-why-its-so-fast)
[![Undo](https://img.shields.io/badge/Undo-Instant%20Rewind-blueviolet?style=for-the-badge)](#-why-its-so-fast)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)

<br/>

| 🚀 [Quick Start](#-quick-start-in-60-seconds) | 🎯 [How-To Cookbook](#-how-to-do-anything-in-1-command) | 🔮 [Drag & Drop Setup](#-drag--drop-customization-souls--skills) | 👤 [AI Roles](#-pick-an-ai-role) | 📖 [Full Guide](SOUL_AND_SKILLS_GUIDE.md) |
|---|---|---|---|---|

---

</div>

> *Dedicated to the open-source community and the creators at **Nous Research** & **Hermes**. Made with love so anyone can build with fast, reliable AI.*
> — **William Andrew Cruz** (`bozoegg` / `CardSorting`) · [Read Author's Note](PREFACE.md)

---

## 🌟 Why It's So Fast & Easy

| What You Get | Why It Matters to You | How Fast It Is |
|---|---|---|
| ⚡ **Zero Lag & No Waiting** | Runs directly on your machine with no bloated middleware or slow background delays. | **Instant (< 0.15 ms)** |
| ⏪ **1-Click Instant Undo** | Made a bad edit? Type `/rewind 1` and all your files and conversation snap back instantly. | **Under 1 millisecond** |
| 🛡️ **Never Freezes or Stutters** | Built with smooth, dedicated memory so your terminal never lags or locks up. | **Rock solid** |
| 🚀 **Supercharged Speed** | Can run over **8,500 actions every second** without breaking a sweat. | **8,500+ actions/sec** |

---

## 🔮 Drag & Drop Customization (`souls/` & `skills/`)

Customize your AI without touching complicated config files:

- 🎭 **`souls/` folder** — Drop in who the AI is (personality, tone, style rules, or custom prompts).
- ⚡ **`skills/` folder** — Drop in what the AI can do (new tools, scripts, or automated workflows).

> **💡 4 Easy Ways to Build**:
> 1. **Drag & Drop**: Drop any `.md`, `.json`, `.py`, or `.txt` file into `souls/` or `skills/`.
> 2. **Plain English**: Describe what you want in simple words (`/soul forge` or `/skill forge`).
> 3. **5-Step Wizard**: Answer 5 quick multiple-choice questions to build a custom assistant.
> 4. **1-Click Doctor**: Type `/soul doctor` or `/skill doctor` to automatically find and fix any errors.
>
> 📖 *Want all the details? See the [Easy SOUL & Skills Guide](SOUL_AND_SKILLS_GUIDE.md).*

---

## 🚀 Quick Start in 60 Seconds

```bash
# 1. Download & Install
git clone https://github.com/CardSorting/LUMI-JOY.git && cd LUMI-JOY
npm install && npm run build

# 2. Add your AI API key (guided step-by-step setup)
npx tsx src/index.ts --setup

# 3. Start coding!
npx tsx src/index.ts --profile coder
```

### 🖥️ Simple, Clean Terminal Screen

```text
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║ ⚡ LUMI-JOY v1.0.0 │ 👤 [💻 Coder] │ 🧠 [gpt-5.6-luna] │ ⏱️ 0.12ms │ 💰 $0.0018 │ ⭐ Fav ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║  👤 You: Refactor auth.ts to add expiration checks                                        ║
║  ⚡ LUMI (Coder):                                                                        ║
║  ┌────────────────────────────────────────────────────────────────────────────────────┐  ║
║  │ 🔧 Checked auth.ts and applied clean edits with unit tests (0.04ms)                │  ║
║  └────────────────────────────────────────────────────────────────────────────────────┘  ║
║  I have updated auth.ts with clean expiration validation and verified the tests pass!    ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║ 💡 Shortcuts: [Ctrl+M] Switch Model  [Ctrl+P] Setup  [/profile] Change Role  [Ctrl+C] Quit ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 🎯 How-To Do Anything in 1 Command

| What I Want to Do | Exact Command to Type | What Happens |
|---|---|---|
| **Write or fix code** | `/profile use coder` | Gives the AI coding tools, test checkers, and refactoring helpers. |
| **Search the web & read papers** | `/profile use researcher` | Lets the AI search the web, read articles, and summarize findings. |
| **Fix a broken app or bug** | `/profile use sre` | Turns on diagnostic tools to find crashes and suggest fixes. |
| **Undo the AI's last action** | `/rewind 1` | Instantly rolls back all edited files to how they were before. |
| **Create a custom AI persona** | Drop in `souls/` or `/soul forge` | Instantly creates and activates your custom assistant. |
| **Add a new tool or skill** | Drop in `skills/` or `/skill forge` | Gives your AI new capabilities and scripts. |
| **Switch AI model on the fly** | `Ctrl+M` *(or `/model claude-3-7`)* | Instantly swaps between OpenAI, Claude, or local models. |

---

## 👤 Pick an AI Role

| Role | What It Does Best | Included Tools |
|:---|---|---|
| 💻 **`coder`** | Writes code, fixes bugs, refactors, and generates unit tests | Files, Code editing, Terminal, Git |
| 🔬 **`researcher`** | Searches the web, reads documentation, and summarizes research | Web search, File reader, Memory notes |
| 🛡️ **`sre`** | Diagnoses errors, reads logs, and fixes system crashes | Diagnostics, Health checks, Terminal |
| ✍️ **`writer`** | Writes documentation, user guides, and technical explanations | Files, Markdown, Memory notes |
| 🎓 **`student`** | Friendly tutor that explains concepts step-by-step | Step-by-step hints, Explanations |
| 🎨 **`creative`** | Brainstorms game designs, mechanics, stories, and ideas | Brainstorming, Vision, Memory notes |
| ⚡ **`minimal`** | Super-fast, lightweight assistant with no extra fluff | Fast file editing, Minimal tokens |

---

## 🏛️ Open Source & Credits

- **❤️ Built with Inspiration from**: [`hermes-agent`](https://github.com/NousResearch/hermes-agent) by **Nous Research**. Thank you to the open-source community for making AI open and accessible to everyone.
- **📄 License**: Free & Open Source under the **Apache License 2.0** ([LICENSE](LICENSE)).

