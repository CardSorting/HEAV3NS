# ADR-110: Toolchain Environment Diagnostic Prober, Prompt Hint Generator & Non-Blocking Substrate Subsystem

## Status
**ACCEPTED** (Phase 134 / Target #67)

## Context
When AI coding agents run terminal commands on local machines, subtle environment anomalies frequently cause early execution failures:
1. Python vs `pip` path mismatches (e.g. system Python resolving to a different directory than `pip`).
2. PEP-668 `externally-managed-environment` protections preventing global `pip install` commands.
3. Missing package managers (`uv`, `npm`, `pnpm`, `bun`, `cargo`) or deactivated virtual environments (`VIRTUAL_ENV`).
4. Probing the environment must be completely non-blocking, cached in the substrate, and impose strictly **zero token overhead** when the environment is clean (`""`).
5. Subsystems need frame-perfect snapshotting and instant state rollback ($<0.05\text{ ms SLA}$) with ultra-high-throughput diagnostic generation ($>1,000,000\text{ ops/sec}$).

## Decision
We implement a zero-GC, typed, deterministic Toolchain Environment Diagnostic Probing Subsystem in **LUMI-JOY**:
1. **Core Contracts (`env-probe.contracts.ts`)**:
   - Defines `ToolchainRuntimeKind`, `ToolchainAnomalyCategory`, `ToolchainProbeDescriptor`, `EnvProbeConfig`, `EnvProbeMetrics`, and `EnvProbeWorkspaceSnapshot`.
2. **In-Memory Substrate & Snapshots (`broccoli-env-probe-substrate.ts`, `env-probe-snapshot-manager.ts`)**:
   - In-memory Broccolidb repository storing cached toolchain probe descriptors, configuration, metrics, and binary snapshotting with $<0.05\text{ ms SLA}$ rollback.
3. **Deterministic Engine (`deterministic-env-probe-engine.ts`)**:
   - Classifies toolchain anomalies (PEP 668, path mismatches, missing pip/package managers) and formats at most **one single-line actionable hint** for the system prompt (0 tokens when clean).
4. **Supervisor (`env-probe-supervisor.ts`)**:
   - Coordinates toolchain probing (`executeProbe()`), cached prompt hint retrieval (`getSystemPromptHint()`), and remote sandbox bypasses (Docker, Modal, SSH, Daytona).
5. **Model Tool Suite (`env-probe-tool-suite.ts`)**:
   - Exposes 5 model tools (`env_probe_inspect`, `env_probe_refresh`, `env_probe_generate_prompt_hint`, `env_probe_configure`, `env_probe_get_metrics`).
6. **Grand Monolith Expansion**:
   - Monolith expanded from **509 to 514 components** in optimal alphabetical cohesion.

## Consequences
- Preemptive detection of toolchain friction points before the agent attempts destructive or invalid installation commands.
- Guaranteed zero token overhead on clean system environments.
- Non-blocking execution ensuring fast agent startup and turn ticks.
