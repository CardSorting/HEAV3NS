# ADR-105: Progressive Subdirectory Context Discovery, Dynamic Instruction Hints & Prefix-Cache-Safe Tool Attachment Subsystem

## Status
**Accepted** (Target #62 / Phase 129 — 2026-08-16)

## Context
In large multi-package codebases and monorepos, distinct directories often contain localized instructions and architecture guidelines (e.g. `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.windsurfrules`). Loading all such files upfront at session initialization bloats the context window and dilutes agent focus with irrelevant instructions. Conversely, mutating the global system prompt mid-session whenever the agent enters a new subdirectory invalidates LLM prompt prefix caches, multiplying API cost and response latency.

Furthermore, recursive tools navigating the filesystem risk re-injecting duplicate instructions across symlinks or repeated directory tool calls, or escaping the active workspace and contaminating the context with external system guidelines.

Hermes Agent solved this via lazy progressive discovery in `agent/subdirectory_hints.py`.

## Decision
We implement a zero-GC, typed, deterministic **Progressive Subdirectory Context Discovery, Dynamic Instruction Hints & Prefix-Cache-Safe Tool Attachment Subsystem** in LUMI-JOY:

1. **Contracts Layer (`subdirectory-hints.contracts.ts`)**:
   - Defines `DiscoveredSubdirHint`, `SubdirHintDiscoveryResult`, `SubdirectoryHintsConfig`, `SubdirectoryHintsMetrics`, `DEFAULT_SUBDIRECTORY_HINTS_CONFIG`, and `SubdirectoryHintsWorkspaceSnapshot`.

2. **Substrate & Snapshots (`broccoli-subdir-hints-substrate.ts`, `subdir-hints-snapshot-manager.ts`)**:
   - In-memory Broccolidb repository tracking discovered hints, loaded directories, SHA-256 content digests (preventing duplicate injections), virtual in-memory hint files, and telemetry metrics.
   - Binary snapshot manager for frame-perfect state rollback in $<0.05\text{ ms}$.

3. **Deterministic Engine & Supervisor (`deterministic-subdir-hint-engine.ts`, `subdir-hints-supervisor.ts`)**:
   - `DeterministicSubdirHintEngine`: Extracts path candidates from tool arguments (`path`, `file_path`, `workdir`, command string tokens), traverses parent directories bounded by `maxAncestorWalk: 5`, enforces workspace containment within `workingDir`, filters non-authoritative excluded directories (`node_modules`, `.git`, `vendor`, `site-packages`), computes SHA-256 digests, and formats markdown context attachments.
   - `SubdirHintsSupervisor`: Intercepts tool calls (`checkToolCall()`), loads filesystem and virtual hints on first directory access, and appends markdown instruction attachments to tool return messages without mutating system prompts.

4. **Model Tool Suite (`subdir-hints-tool-suite.ts`)**:
   - Exposes 5 model tools:
     - `subdir_hints_check_tool`: Evaluates tool arguments and discovers new subdirectory instruction files.
     - `subdir_hints_register_virtual`: Injects a virtual in-memory instruction hint file for a given directory.
     - `subdir_hints_list_discovered`: Lists all discovered subdirectory context hints and their digests.
     - `subdir_hints_configure`: Configures search parameters, ancestor walk limits, and excluded directories.
     - `subdir_hints_get_metrics`: Retrieves aggregate statistics on hint checks, discoveries, and injected bytes.

5. **Grand Monolith Expansion**:
   - Expands Grand Monolith from **484 to 489 components** in exact alphabetical cohesion.

## Consequences
- Enables lazy, progressive loading of localized instructions exactly when the agent begins operating in nested directories.
- Preserves LLM prompt caching by attaching guidelines to tool execution results rather than mutating the system prompt.
- Prevents redundant prompt bloating via cryptographic SHA-256 digest deduplication.
- Grand Monolith cohesion expanded to 489/489 components in OPTIMAL state.
- Zero barrel imports and base class immutability preserved.
