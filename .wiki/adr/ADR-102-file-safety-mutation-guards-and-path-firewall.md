# ADR-102: File Safety Mutation Guards, Sensitive Path Firewall & Safe Root Governance Subsystem

## Status
**Accepted** (Target #59 / Phase 126 — 2026-08-16)

## Context
Autonomous agents running with tool execution privileges have access to local file mutations and execution environments. Without strict path firewalls and mutation guards, agents could inadvertently overwrite critical system configurations (`/etc/sudoers`, `/etc/passwd`, `/etc/shadow`), private SSH keys (`~/.ssh/id_*`, `authorized_keys`), cloud/tool credentials (`.aws`, `.gnupg`, `.kube`, `.docker`, `.npmrc`, `.pypirc`, `.netrc`, `.git-credentials`), and environment secrets (`.env`, `*.key`, `*.pem`, OAuth tokens). Furthermore, non-private configuration files (`~/.ssh/config`) should require explicit operator approval rather than unconditional writes or hard denials.

Hermes Agent defined a centralized path safety rule engine in `agent/file_safety.py`.

## Decision
We implement a zero-GC, typed, deterministic **File Safety Mutation Guards, Sensitive Path Firewall & Safe Root Governance Subsystem** in LUMI-JOY:

1. **Contracts Layer (`file-safety.contracts.ts`)**:
   - Defines `FileSafetyVerdict`, `FileSafetyEvaluation`, `FileSafetyPolicyConfig`, `FileSafetyMetrics`, and `FileSafetyWorkspaceSnapshot`.

2. **Substrate & Snapshots (`broccoli-file-safety-substrate.ts`, `file-safety-snapshot-manager.ts`)**:
   - In-memory Broccolidb repository storing safety policies, custom deny rules, dynamic safe roots, evaluation audit logs, and metrics.
   - Binary snapshot manager for frame-perfect state rollback in $<0.05\text{ ms}$.

3. **Deterministic Guard & Supervisor (`deterministic-file-safety-guard.ts`, `file-safety-supervisor.ts`)**:
   - `DeterministicFileSafetyGuard`: Normalizes paths, checks hard-denied file paths and directory prefixes, detects sensitive credentials, enforces approval on designated files (`~/.ssh/config`, shell rc files), and validates safe roots enclosure.
   - `FileSafetySupervisor`: Coordinates pre-flight write validation (`checkWrite()`), read inspection (`checkRead()`), and dynamic safe root registration (`addSafeRoot()`).

4. **Model Tool Suite (`file-safety-tool-suite.ts`)**:
   - Exposes 5 model tools:
     - `file_safety_check_write`: Pre-flight evaluates if a target write path is permitted, denied, or requires approval.
     - `file_safety_check_read`: Evaluates if a target read path accesses sensitive credential stores.
     - `file_safety_add_safe_root`: Dynamically registers an authorized root directory for write operations.
     - `file_safety_inspect_rules`: Lists active write-denied paths, sensitive prefixes, and safe roots.
     - `file_safety_get_metrics`: Retrieves aggregate statistics on safety evaluations and violation blocks.

5. **Grand Monolith Expansion**:
   - Expands Grand Monolith from **469 to 474 components** in exact alphabetical cohesion.

## Consequences
- Protects critical operating system and credential paths from rogue mutations.
- Enforces approval gates for sensitive non-secret configuration edits (`~/.ssh/config`).
- Grand Monolith cohesion expanded to 474/474 components in OPTIMAL state.
- Zero barrel imports and base class immutability preserved.
