# HEAV3NS CLI: Interactive TUI Guide

This guide describes the interactive CLI in `src/agents/extensions/execution/interactive-mode-controller.ts` and its keyboard-first task and skill views.

## Everyday controls

| Key | Action |
|---|---|
| `Enter` | Submit a prompt or run a slash command |
| `Shift+Enter` / `Alt+Enter` | Insert a new line |
| `↑` / `↓` | Browse prompt history or autocomplete options |
| `Tab` | Complete a slash command or workspace path |
| `?` or `/help` | Open the shortcut and command guide |
| `Ctrl+S` or `/settings` | Open settings |
| `Alt+M` or `/model` | Open the model picker |
| `PageUp` / `PageDown` | Scroll conversation history |
| `Home` / `End` | Jump to the start or end of history |
| `Ctrl+L` or `/clear` | Clear displayed history |
| `Esc` | Close the open view or cancel the active turn |
| `Ctrl+C` | Clear a non-empty input, or quit when input is empty |
| `Ctrl+D` | Exit the interactive session |

Type `/` to see command completions. Press `Esc` to dismiss the completion menu.

## Agent tasks

Use `/agents` to open the task dashboard. `/subagents` and `/swarm` are aliases. In the non-TTY fallback, the same commands print task status and any recorded blocker.

| Key | Action |
|---|---|
| `1`–`6` | Switch between Tasks, DAG, Results, Worktrees, Health, and Metrics; navigation groups them as Tasks, Flow, Results, and Insights |
| `/` | Search task IDs, goals, context, status, parent IDs, tags, results, and blockers; press `Enter` to apply or `Esc` to cancel |
| `f` | Cycle the status filter |
| `0` | Clear both search and the status filter |
| `j` / `k` or arrows | Move through tasks; scroll the other views |
| `PageUp` / `PageDown` | Scroll a page in DAG, Results, Worktrees, Health, or Metrics |
| `Enter` | Inspect the selected task and result |
| `a` | Mark a running task aborted; confirm with `y` or cancel with `n` / `Esc` |
| `?` | Show dashboard key help |
| `q` / `Esc` | Close the dashboard |

The CLI runs delegated work in isolated provider, session, and file-overlay contexts with a four-child concurrency limit. Children can inspect files and stage requested edits; successful changes become an uncommitted parent diff for review with `/diff [file]` and application with `/commit [file]`. Paths can be relative to the workspace; omit the path to review or apply all staged files. Child edits retain a disk baseline, so `/commit` blocks and preserves a stale edit if another process changed that file during review. Cancelling the parent turn also cancels its active child and discards that child’s branch. Children cannot run shell commands or delegate more work. Parallel edits to a file changed by another lane are rejected as conflicts. `/agents` shows status, results, modified files, and blockers. Git-worktree delegation is rejected clearly because this runtime does not provision worktrees.

## Skills

Use `/skills` to browse skill names, descriptions, and sources. Run `/skills <term>` to search names and descriptions, or `/skills refresh [term]` to rescan and optionally search in one step. Discovery checks project folders `.dietcoderules/skills`, `.dietcode/skills`, `.claude/skills`, and `.agents/skills`, plus `skills/` under the configured DietCode home (default `~/.dietcode`) and `~/.agents/skills`.

The model receives a compact metadata catalog and loads a matching skill's instructions on demand through `use_skill`. You can describe the task normally or name a skill explicitly; unrelated skills are not loaded. Skill instructions guide the task while system and user instructions retain priority.

## Common commands

| Command | Action |
|---|---|
| `/agents` | Inspect delegated task status, results, and blockers |
| `/skills` | Browse skills currently available to the agent |
| `/skills refresh` | Refresh skill discovery |
| `/login` / `/logout` / `/whoami` | Manage and inspect authentication |
| `/model [name]` / `/models` | View or switch the active model |
| `/providers` / `/setup` | Configure or diagnose providers |
| `/local` | Open local model controls |
| `/doctor` / `/health` / `/status` | Inspect subsystem diagnostics |
| `/snapshot` / `/snapshots` / `/rewind [id]` | Manage session snapshots |
| `/memory` | View active session memory |
| `/help` | Open the in-app help guide |
| `/exit` / `/quit` | Exit the REPL |

## Parallel tool execution

Independent tool calls may run concurrently, with a per-turn limit of eight. Calls that mutate the same resource are serialized, and unscoped shell commands run alone. A failed call is reported alongside the results of its siblings so one failure does not hide completed work or leave the parent turn waiting on abandoned I/O.
