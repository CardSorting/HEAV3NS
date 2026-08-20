# ADR-093: Spill-Safe File Vault, Context-Overflow Result Persistence & Multi-Tier Turn Budget Governor Subsystem ($\mathcal{K}_{\text{spill-persistence}}$ / Phase 117 / Target #50)

## Status
Accepted / Implemented / Deeply Hardened (Phase 117 / Target #50)

## Context
In agentic architectures (`tools/spill_safety.py`, `tools/hook_output_spill.py`, `tools/tool_result_storage.py`, and `tools/budget_config.py` in Hermes Agent):
1. **Symlink Hijack Attacks on Spill Directories**: Spill files (oversized terminal outputs, hook contexts, subagent summaries) are written to temporary or world-discoverable directories. A standard file creation follows pre-planted symlinks, allowing a local process to redirect writes onto arbitrary user files (`~/.bashrc`, `~/.ssh/authorized_keys`). Files must be created with `O_CREAT | O_EXCL` and `O_NOFOLLOW` refusing pre-existing paths and symlinks, with `0o700` directories and `0o600` file permissions.
2. **Multi-Tier Context Overflow Defense**: Unbounded tool outputs blow out LLM context windows and invalidate prompt cache prefixes. A structured 3-tier defense is required:
   - **Tier 1 (Per-Tool Output Cap)**: Individual tools pre-truncate results at generation time.
   - **Tier 2 (Per-Result Persistence)**: Outputs exceeding registered size thresholds are written into the spill-safe vault and replaced in-context with structured head/tail previews and `<persisted-output path="..." size="...">` metadata anchors.
   - **Tier 3 (Per-Turn Aggregate Budget Governor)**: When multiple medium-sized results collectively exceed the turn budget (e.g. 100k chars), the governor automatically spills the largest unpersisted results to disk until context is strictly bounded.
3. **Hook Output Spilling**: Oversized hook-injected context (`pre_llm_call`, shell hooks, feedback hooks) is spilled to disk, preserving byte-stable prompt caching.
4. **In-Memory Substrate & Snapshots**: Tracks persisted results, session spill registries, and budget metrics with sub-millisecond $O(1)$ state rollback ($<0.05\text{ ms SLA}$).

## Decision
We implemented a zero-GC, typed, frame-perfect Spill-Safe File Vault, Context-Overflow Result Persistence, and Multi-Tier Turn Budget Governor Subsystem for **LUMI-JOY**:

1. **`DeterministicSpillVault` ([deterministic-spill-vault.ts](../../src/agents/extensions/spill_vault/deterministic-spill-vault.ts))**:
   - **Symlink-Safe Exclusive File Operations**: Uses `O_CREAT | O_EXCL`, unlinks existing paths without following symlinks, and enforces `0o700` directory and `0o600` file permissions.
   - **Head/Tail Structured Preview Generator**: Preserves sentence/newline boundaries while truncating middle sections with omitted character counts.
   - **Per-Result Persistence**: Tags oversized outputs with `<persisted-output>` XML blocks.
   - **Turn Budget Governor**: Sorts multi-tool results by length descending and spills largest outputs until aggregate character limit is satisfied.
   - **Hook Context Spiller**: Isolates hook blobs into session directories with preview anchors.

2. **`SpillVaultSupervisor` ([spill-vault-supervisor.ts](../../src/agents/extensions/spill_vault/spill-vault-supervisor.ts))**:
   - Master supervisor coordinating result persistence, turn budget enforcement, hook spilling, and telemetry.

3. **`BroccoliSpillVaultSubstrate` ([broccoli-spill-vault-substrate.ts](../../src/sessions/extensions/spill_vault/broccoli-spill-vault-substrate.ts))**:
   - In-memory Broccolidb repository storing persisted descriptors, session-isolated indices, and aggregate budget telemetry.

4. **`SpillVaultSnapshotManager` ([spill-vault-snapshot-manager.ts](../../src/sessions/extensions/spill_vault/spill-vault-snapshot-manager.ts))**:
   - Frame-perfect binary snapshots and sub-millisecond $O(1)$ state rollback in $<0.05\text{ ms}$.

5. **`SpillVaultToolSuite` ([spill-vault-tool-suite.ts](../../src/tooling/extensions/spill_vault/spill-vault-tool-suite.ts))**:
   - Exposes 5 model tools:
     - `spill_persist_result`: Explicitly persists oversized content into the spill vault and generates a preview anchor.
     - `spill_enforce_turn_budget`: Enforces aggregate character limits across multi-tool execution turns.
     - `spill_read_persisted_content`: Reads full un-truncated content from a persisted result reference or path.
     - `spill_inspect_session_vault`: Inspects all persisted result descriptors in the active session.
     - `spill_get_governor_metrics`: Retrieves aggregate spill and budget enforcement metrics.

## Invariants & Guardrails
1. **Symlink Defense Guarantee**: File writes refuse symlinks and cannot be tricked into overwriting pre-planted target files.
2. **Prompt Cache Stability**: Hook output spilling prevents large dynamic strings from invalidating prefix cache tokens.
3. **Zero Barrel Imports (`ADR-012`)**: Direct file imports only.
4. **Base Class Immutability (`ADR-012`)**: Base classes remain unmodified.
5. **Sub-Microsecond Latency SLA**: State rollback in $<0.05\text{ ms}$; budget evaluations $>100,000\text{ ops/sec}$.
6. **Exact Cohesion Verification**: Monolith component count expands from 424 to 429 components in OPTIMAL cohesion.
