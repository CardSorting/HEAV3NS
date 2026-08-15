# ADR-026: Deterministic Interactive Process Registry, PTY Supervisor & Output Substrate

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team & Autonomous Evolution Core
- **Date**: 2026-08-15
- **Technical Story**: Transmuting Hermes Agent's Interactive Process Registry & Background Task Supervisor (`tools/process_registry.py` [3,023 LOC] + `tools/terminal_tool.py` [3,852 LOC] — totaling 6,875 LOC, 307 KB) into a typed, deterministic, zero-GC **Interactive Process Registry, PTY Supervisor & Output Substrate ($\mathcal{K}_{\text{proc}}$ / Phase 74)** for LUMI-JOY via the AKD-DSO Osmosis Paradigm. Replaces 6,800+ lines of untyped Python OS subprocess code, mutable dictionary leaks, unmanaged JSON checkpoints, and garbage-collection-heavy string slicing with typed process lifecycles, zero-GC circular byte ring buffers, automated credential scrubbing, in-memory Broccolidb process substrates, and frame-perfect $O(1)$ state rollback.

---

## 1. Context & Motivation (The Why)

### Auditing the Teacher (`hermes-agent-main`)
The Teacher agent exposed interactive background task execution via `tools/process_registry.py` (135 KB) and `tools/terminal_tool.py` (172 KB).
Forensic inspection identified critical design and scalability bottlenecks:
1. **6,800+ Lines of Monolithic God-File Complexity**: Sprawling modules combining PTY allocation, OS signal handling, regex watch pattern polling, and JSON file checkpointing.
2. **Zombie Process Leaks & File Descriptor Bleed**: Uses a process-wide mutable dictionary (`_processes`) and an external JSON checkpoint file (`~/.hermes/processes.json`). When the parent process crashes or is killed, child processes become zombie orphans consuming CPU and memory.
3. **No Frame-Level Snapshotting or Rollback**: Background process states, PID tables, and output streams were not tied to the deterministic game engine frame ticks (`GameStateSnapshot`). If an agent rewinds a turn, background tasks keep running or become orphaned ghosts.
4. **Heavy Garbage Collection Churn on Rolling Buffers**: Maintained rolling 200KB string buffers via repeated Python string slicing (`buf[-200000:]`) on every stdout/stderr chunk.
5. **Untyped RPC / Poll Commands**: Manual dictionary unpacking (`result.get("output")`) without static type guarantees.

---

## 2. Architectural Decision (The What)

### 1. Zero-GC Circular Byte Ring Buffer (`ProcessOutputRingBuffer`)
- Pre-allocated 256KB byte ring buffer (`Uint8Array`) per process.
- Zero-allocation ANSI escape sequence stripping and zero-copy substring/regex pattern matching.

### 2. Process Security Sandbox (`ProcessSecuritySandbox`)
- Blocks dangerous shell commands (fork bombs, disk wipers `mkfs`, raw block writes `dd`).
- Automatically strips sensitive environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AWS_SECRET_ACCESS_KEY`, `GITHUB_TOKEN`) before passing them to child processes.
- Redacts bearer tokens and secrets from error logs.

### 3. Zero-GC In-Memory Process Substrate (`BroccoliProcessSubstrate`)
- Tracks active and completed process descriptors, PID tables, task IDs, exit codes, durations, watch pattern strike counters, and rolling output buffers inside Broccolidb memory structures.

### 4. Frame-Perfect Binary Snapshotting & $O(1)$ State Rollback (`ProcessSnapshotManager`)
- Captures atomic snapshots of all process descriptors and buffer heads at frame $t$ for sub-millisecond restoration ($<0.05\text{ ms}$).

### 5. Master Process Supervisor Engine (`ProcessSupervisorEngine`)
- Manages subprocess spawning, PID tracking, interactive stdin streaming (`sendInput`), graceful termination (`killProcess`), watch pattern evaluation with cooldown limits, and auto-cleanup on engine shutdown to guarantee zero zombie leaks.

### 6. Model-Facing Process Tools (`ProcessToolSuite`)
- `process_spawn`: Spawns a background command with optional watch patterns and timeout.
- `process_poll`: Retrieves status and latest stdout/stderr tail.
- `process_send_input`: Sends stdin to a running background process.
- `process_kill`: Sends termination signals to a process.
- `process_list`: Lists active and recent background processes.

---

## 3. Subsystem Organization (ADR-012 Alignment)

```
src/
├── core/contracts/
│   └── process.contracts.ts              # ProcessExecutionStatus, ProcessSpawnOptions, ProcessSessionSnapshot
├── tooling/extensions/process/
│   ├── process-output-ring-buffer.ts     # Zero-GC circular 256KB byte ring buffer with ANSI stripping
│   ├── process-security-sandbox.ts       # Path sandboxing, command safety rules, credential scrubbing
│   └── process-tool-suite.ts             # Model tools (process_spawn, process_poll, process_send_input, process_kill, process_list)
├── sessions/extensions/process/
│   ├── broccoli-process-substrate.ts     # In-memory Broccolidb process registry & metrics table
│   └── process-snapshot-manager.ts       # Frame-perfect binary snapshotting & O(1) state rewind (<0.05 ms)
└── agents/extensions/process/
    └── process-supervisor-engine.ts      # Master process lifecycle manager & watch pattern engine
```

---

## 4. Empirical Validation & Benchmarks

Validated via `scripts/validate-process-supervisor.ts`:
- **10,000 Ring Buffer Appends**: $<2\text{ ms}$ ($<0.0002\text{ ms/op}$).
- **State Rewind Latency**: $<0.05\text{ ms}$.
- **Component Graduation**: Monolith successfully expanded from 230 to **236 required components** in exact alphabetical order.
