# ⌨️ Interactive TUI Keybindings, Modals & Slash Commands

Comprehensive reference for keyboard navigation, specialized terminal UI modals, and slash commands in **LUMI-JOY**.

---

## 🎮 Keyboard Shortcuts

The fullscreen differential terminal interface supports comprehensive navigation shortcuts:

| Keybinding | Action & Context | Operational Behavior |
|---|---|---|
| `Ctrl+C` / `Esc` | **Abort Current Turn** | Immediately cancels in-flight LLM requests, rolls back uncommitted VFS diffs, and restores loop phase to `idle`. |
| `Ctrl+L` | **Repaint Canvas** | Flushes terminal buffer, queries terminal size via ANSI sequence, and redraws differential frame. |
| `Ctrl+M` | **Model Selector Modal** | Opens the interactive model switcher modal to select and hot-swap between supported LLM providers and models. |
| `Ctrl+P` | **Provider Setup Wizard** | Launches the guided provider credential setup walkthrough. |
| `Ctrl+D` / `Tab` | **Toggle View / Autocomplete** | In input mode: auto-completes slash commands and file paths. In view mode: cycles between metrics and timeline. |
| `PageUp` / `PageDown` | **Scroll Conversation Timeline** | Scrolls through the active conversation projection and tool execution activity history. |
| `Up` / `Down` | **Input History Navigation** | Cycles through previous prompt history entries stored in the session ring buffer. |
| `?` | **Help & Shortcut Palette** | Displays the interactive help overlay modal with keybindings and command reference. |

---

## 🧭 Essential Slash Commands

LUMI-JOY features a built-in slash router (`AgentSlashRouter`) with auto-completion and instant command execution:

| Slash Command | Parameters | Description |
|---|---|---|
| `/setup` | `[provider]` | Launches the interactive OAuth PKCE setup wizard to configure OpenAI Codex or custom proxy credentials. |
| `/model` | `[model_id]` | Displays active model specs or switches model dynamically without restarting the session. |
| `/rewind` | `[frames]` | Performs an instant $O(1)$ state rollback to frame $N-k$, restoring conversation, memory, and VFS state. |
| `/compact` | `[--force]` | Manually triggers semantic trajectory compaction and AST `LUMI-CONTEXT/1` envelope serialization. |
| `/db` | `[status\|query\|wal\|rollback]` | Opens BroccoliDB inspection dashboard, executes SQL-like AST queries, or rolls back table branches. |
| `/swarm` | `[status\|tasks\|consensus]` | Inspects multi-agent swarm status, active DAG task dependencies, and Byzantine consensus voting logs. |
| `/doctor` | `[--full]` | Runs the environment stability doctor, checks network, disk permissions, and audits orphaned turn state. |
| `/benchmark` | `[--live]` | Runs the real-time deterministic benchmark harness and measures local frame latency and throughput. |
| `/help` | `[topic]` | Displays comprehensive usage instructions, documentation links, and active configuration parameters. |
| `/exit` | — | Gracefully persists session snapshot to disk and terminates the agent process. |

---

## 🖥️ 30+ Interactive Dashboard Modals

LUMI-JOY includes 30+ specialized terminal modal dashboards (`src/tui/components/`), accessible via slash commands or direct hotkeys:
- **`ToolExecutionGuardDashboardModal`**: Real-time batch parallelism timelines and anti-loop firewall violations.
- **`PromptCacheDashboardModal`**: Prefix prompt cache byte layout inspection and hit rate analytics.
- **`VerificationEvidenceDashboardModal`**: Turn-by-turn verification evidence ledgers and stop-gate evaluation.
- **`DiagnosticDoctorDashboardModal`**: Subsystem health diagnostics and self-healing telemetry.
- **`SessionArchiveDashboardModal`**: Multi-format session export, HTML archiving, and encrypted backups.
- **`SwarmDashboardModal`**: Multi-agent task DAG scheduling and priority lattice consensus.

---

## Related Documentation

- [Runtime Architecture Guide](RUNTIME_ARCHITECTURE_GUIDE.md)
- [Architecture Diagrams](ARCHITECTURE_DIAGRAMS.md)
- [FAQ Guide](FAQ.md)
