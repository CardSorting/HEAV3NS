# ADR-095: V4A Multi-File Patch Parser, Atomic Multi-Hunk Applicator & Working Tree Diff Synthesizer Subsystem ($\mathcal{K}_{\text{v4a-patch}}$ / Phase 119 / Target #52)

## Status
Accepted / Implemented / Deeply Hardened (Phase 119 / Target #52)

## Context
In automated coding agents (e.g. Codex, Claude, Cline, Aider, and `tools/patch_parser.py` / `tools/working_diff.py` in Hermes Agent):
1. **Multi-File V4A Patch Format**: Standard single-file diff tools fail when an LLM outputs compound multi-file edits in a single turn. The standard V4A patch grammar includes:
   - `*** Begin Patch` / `*** End Patch` block envelope.
   - `*** Update File: <path>` with context hints (`@@ context @@`), context lines (` `), deletions (`-`), and additions (`+`).
   - `*** Add File: <path>` with content additions (`+`).
   - `*** Delete File: <path>` for file removals.
   - `*** Move File: <old> -> <new>` for atomic file renames.
2. **Multi-Hunk Fuzzy Matching & Resilience**:
   - CRLF line endings in model outputs must be normalized to prevent corrupted carriage returns.
   - Column 0 marker validation ensures that code snippets containing `+*** End Patch` inside docs or comments do not truncate the patch.
   - Fuzzy whitespace matching allows hunks to apply smoothly despite minor indentation or trailing space drifts.
   - All-or-nothing atomic application across all files in a single turn ensures zero partial corruption if any hunk fails.
3. **Working Tree Diff Synthesizer**:
   - Surface-agnostic diff collection supporting `working` (unstaged + untracked), `staged` (cached commits), and `all` (HEAD $\rightarrow$ worktree) modes.
   - Untracked files are synthesized into diff additions (`diff --no-index /dev/null <file>`) with `--stat` summaries and bounded caps on file explosions.
4. **In-Memory Substrate & Snapshots**:
   - Tracks applied V4A patch transactions, diff inspection caches, and patch metrics with sub-millisecond $O(1)$ state rollback ($<0.05\text{ ms SLA}$).

## Decision
We implemented a zero-GC, typed, frame-perfect V4A Multi-File Patch Parser and Working Diff Synthesizer Subsystem for **LUMI-JOY**:

1. **`DeterministicV4aPatch` ([deterministic-v4a-patch.ts](../../src/agents/extensions/v4a_patch/deterministic-v4a-patch.ts))**:
   - **V4A Grammar Parser**: Extracts multi-file operations and hunks.
   - **Multi-Hunk Applicator**: Exact and fuzzy whitespace line matching.
   - **Atomic Multi-File Engine**: Stages all operations in memory before committing to VFS.
   - **Working Tree Diff Engine**: Synthesizes git diffs across `working`, `staged`, and `all` modes.

2. **`V4aPatchSupervisor` ([v4a-patch-supervisor.ts](../../src/agents/extensions/v4a_patch/v4a-patch-supervisor.ts))**:
   - Master supervisor coordinating V4A patch parsing, atomic execution, working diff collection, and in-memory substrate tracking.

3. **`BroccoliV4aPatchSubstrate` ([broccoli-v4a-patch-substrate.ts](../../src/sessions/extensions/v4a_patch/broccoli-v4a-patch-substrate.ts))**:
   - In-memory Broccolidb repository storing applied patch transactions, file mutation records, and patch metrics.

4. **`V4aPatchSnapshotManager` ([v4a-patch-snapshot-manager.ts](../../src/sessions/extensions/v4a_patch/v4a-patch-snapshot-manager.ts))**:
   - Frame-perfect binary snapshots and sub-millisecond $O(1)$ state rollback in $<0.05\text{ ms}$.

5. **`V4aPatchToolSuite` ([v4a-patch-tool-suite.ts](../../src/tooling/extensions/v4a_patch/v4a-patch-tool-suite.ts))**:
   - Exposes 5 model tools:
     - `v4a_apply_patch`: Parses and atomically applies a multi-file V4A patch block.
     - `v4a_parse_patch_manifest`: Validates and inspects the operations in a V4A patch without applying them.
     - `v4a_collect_working_diff`: Collects git working tree diffs (`working`, `staged`, `all`) with synthesized untracked file additions.
     - `v4a_inspect_patch_history`: Lists applied patch transactions in the active session.
     - `v4a_get_engine_metrics`: Retrieves aggregate V4A patch parser and applicator metrics.

## Invariants & Guardrails
1. **All-or-Nothing Atomicity**: If any hunk in an update fails, or if a move target is invalid, no files are modified in VFS.
2. **Zero Barrel Imports (`ADR-012`)**: Direct file imports only.
3. **Base Class Immutability (`ADR-012`)**: Base classes remain unmodified.
4. **Sub-Microsecond Latency SLA**: State rollback in $<0.05\text{ ms}$; V4A parsing $>50,000\text{ hunks/sec}$.
5. **Exact Cohesion Verification**: Monolith component count expands from 434 to 439 components in OPTIMAL cohesion.
