# ⌨️ Interactive TUI Keybindings, Modals & Slash Commands

Comprehensive reference for keyboard navigation, specialized terminal UI modals, and slash commands in **LUMI-JOY**.

---

## 1. 🎮 Universal Keyboard Shortcuts

The fullscreen differential terminal interface maintains synchronized `\x1b[?2026h` flicker-free updates and responsive navigation shortcuts:

| Keybinding | Action & Context | Operational Behavior |
|---|---|---|
| `Ctrl+C` / `Esc` | **Abort Current Turn** | Immediately cancels in-flight LLM requests, rolls back uncommitted VFS diffs, and restores loop phase to `idle`. |
| `Ctrl+L` | **Repaint Canvas** | Flushes terminal buffer, queries terminal size via ANSI sequence, and redraws differential frame. |
| `Ctrl+M` | **Model Selector Modal** | Opens the interactive model switcher modal to select and hot-swap between supported LLM providers and models. |
| `Ctrl+P` | **Provider Setup Wizard** | Launches the guided provider credential setup walkthrough. |
| `Ctrl+D` / `Tab` | **Toggle View / Autocomplete** | In input mode: auto-completes slash commands and file paths. In view mode: cycles between metrics and timeline. |
| `PageUp` / `PageDown` | **Scroll Conversation Timeline** | Scrolls through the active conversation projection and tool execution activity history. |
| `Up` / `Down` | **Input History Navigation** | Cycles through previous prompt history entries stored in the session ring buffer. |
| `Home` / `End` | **Timeline Boundary Jumps** | Jumps directly to the start (top) or newest turn (bottom) of the conversation timeline. |
| `?` | **Help & Shortcut Palette** | Displays the interactive help overlay modal with keybindings and command reference. |

---

## 2. 🧭 Essential Slash Commands Reference

LUMI-JOY features a built-in slash router (`AgentSlashRouter`) with auto-completion and instant sub-millisecond command execution:

| Slash Command | Parameters | Description |
|---|---|---|
| `/setup` | `[provider]` | Launches the interactive setup wizard to configure Codex OAuth, GALX Wholesale Compute, or OpenRouter. |
| `/providers` | — | Tests latency, authentication headers, and connectivity across all 3 active providers (Codex, GALX, OpenRouter). |
| `/model` | `[model_id]` | Displays active model specs or switches model dynamically without restarting the session. |
| `/rewind` | `[frames]` | Performs an instant $O(1)$ state rollback to frame $N-k$, restoring conversation, memory, and VFS state. |
| `/diff` | `[path]` | Synthesizes real-time unified diffs comparing disk files against staged VFS overlays without committing. |
| `/commit` | `[path]` | Atomically commits staged VFS file mutations directly to physical disk storage. |
| `/discard` | `[path]` | Discards staged VFS file modifications and restores working disk state. |
| `/tools` | `[query]` | Lists all registered native developer tools, parameter schemas, and normalized aliases. |
| `/compact` | `[--force]` | Manually triggers semantic trajectory compaction and AST `LUMI-CONTEXT/1` envelope serialization. |
| `/db` | `[status\|query\|wal\|rollback]` | Opens BroccoliDB inspection dashboard, executes SQL-like AST queries, or rolls back table branches. |
| `/profile` | `[list\|use\|init\|fav\|diff\|starters\|revisions\|rollback]` | Manages isolated multi-agent personas, blueprints, few-shot exemplars, resilient fallback ladders, and revision time-travel. |
| `/swarm` | `[status\|tasks\|consensus]` | Inspects multi-agent swarm status, active DAG task dependencies, and Byzantine consensus voting logs. |
| `/doctor` | `[--full]` | Runs the environment stability doctor, checks network, disk permissions, and audits orphaned turn state. |
| `/benchmark` | `[--live]` | Runs the real-time deterministic benchmark harness and measures local frame latency and throughput. |
| `/help` | `[topic]` | Displays comprehensive usage instructions, documentation links, and active configuration parameters. |
| `/exit` | — | Gracefully persists session snapshot to disk and terminates the agent process. |

---

## 3. 🛡️ Interactive Operational Strategies & Flow Topology

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                    INTERACTIVE TUI STRATEGY & MUTATION WORKFLOW                   │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  [ Developer Prompt ] ──► [ Model Generates Edits ] ──► [ Staged in SessionVFS ]  │
│                                                                  │                │
│                                      ┌───────────────────────────┴─────────────┐  │
│                                      ▼                                         ▼  │
│                           [ /diff Inspect Changes ]               [ /discard Revert ]
│                                      │                                            │
│                                      ▼                                            │
│                           [ /commit Apply to Disk ]                               │
│                                      │                                            │
│                                      ▼                                            │
│                           [ /rewind 1 Emergency Rollback (<0.05ms) ]               │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Non-Destructive VFS Staging Strategy
1. **Zero Unintended Disk Mutations**: When an agent edits files, mutations are held in `SessionVFS` memory buffers rather than immediately touching physical disk storage.
2. **Instant Unified Diffs (`/diff [path]`)**: Developers can inspect changes line-by-line using git-compatible unified diff syntax directly in the TUI terminal.
3. **Selective Commit Authority (`/commit [path]`)**: Commit all files (`/commit`) or selectively commit individual files (`/commit src/auth.ts`).
4. **Instant Reversion (`/discard [path]`)**: Discard unwanted mutations instantly without dirtying git working trees.

### 3.2 Time-Travel Rewind & State Rollback Strategy (`/rewind`)
1. **Full-Envelope Restoration**: Rewinds transcript messages, frame counters, virtual file overlays, and in-memory BroccoliDB tables in **$0.022\text{ ms p95}$**.
2. **Zero Context Pollution**: When a model enters a hallucination loop or flawed refactor, `/rewind 1` rolls back the turn completely, allowing clean prompt re-anchoring.

### 3.3 Dynamic Multi-Model Hot-Swapping Strategy (`Ctrl+M` / `/model`)
1. **4 Focused Provider Tabs**: Press `Ctrl+M` to open the modal and navigate between `[1] ALL`, `[2] CODEX OAUTH`, `[3] GALX WHOLESALE`, and `[4] OPENROUTER` using keys `1-4` or `Tab`.
2. **Wholesale Sub-Cent Switching**: Quickly switch to `galx/gpt-5.6-sol` or `gpt-5.6-luna` for ultra-cost-effective reasoning turns.
3. **Prefix Cache Preservation**: LUMI's 5-tier prompt structure (ADR-135) preserves L0–L2 system prompts across model switches.

---

## 4. 🖥️ 30+ Interactive Dashboard Modals

LUMI-JOY includes 30+ specialized terminal modal dashboards (`src/tui/components/`), accessible via slash commands or direct hotkeys:
- **`ProfileDashboardModal`**: 6-view orchestrator studio for browsing active agent personas, built-in blueprints, immutable revisions, few-shot exemplars, SLA health metrics, and raw JSON snapshots.
- **`ToolExecutionGuardDashboardModal`**: Real-time batch parallelism timelines and anti-loop firewall violations.
- **`PromptCacheDashboardModal`**: Prefix prompt cache byte layout inspection and hit rate analytics.
- **`VerificationEvidenceDashboardModal`**: Turn-by-turn verification evidence ledgers and stop-gate evaluation.
- **`DiagnosticDoctorDashboardModal`**: Subsystem health diagnostics and self-healing telemetry.
- **`SessionArchiveDashboardModal`**: Multi-format session export, HTML archiving, and encrypted backups.
- **`SwarmDashboardModal`**: Multi-agent task DAG scheduling and priority lattice consensus.

---

## 5. Related Documentation

- [Runtime Architecture Guide](RUNTIME_ARCHITECTURE_GUIDE.md)
- [Architecture Decision Records: ADR-136](adr/ADR-136-high-velocity-pattern-search-and-zen-io-execution-authority.md)
- [Architecture Diagrams](ARCHITECTURE_DIAGRAMS.md)
- [FAQ Guide](FAQ.md)
