# ADR-027: Deterministic Human-in-the-Loop Approval & Interactive Security Arbiter

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team & Autonomous Evolution Core
- **Date**: 2026-08-15
- **Technical Story**: Transmuting Hermes Agent's sprawling Dangerous Command Approval, E-Stop & Write Gate subsystems (`tools/approval.py` [5,010 LOC] + `tools/write_approval.py` [494 LOC] + `tools/tirith_security.py` [800 LOC] + `agent/file_safety.py` [600 LOC] + `agent/estop.py` [200 LOC] — totaling **7,100+ LOC, 320 KB**) into a typed, deterministic, zero-GC **Human-in-the-Loop Approval & Interactive Security Arbiter ($\mathcal{K}_{\text{arbiter}}$ / Phase 75)** for LUMI-JOY via the AKD-DSO Osmosis Paradigm. Replaces 7,100+ lines of untyped regex heuristics, thread-unsafe process environment mutations, loose disk file staging, and unmanaged approval caches with typed risk tiers, SHA-256 canonical command hashing, in-memory Broccolidb approval substrates, frame-perfect $O(1)$ state rollback, and emergency E-Stop killswitches.

---

## 1. Context & Motivation (The Why)

### Auditing the Teacher (`hermes-agent-main`)
The Teacher agent implemented dangerous command approvals across `tools/approval.py` (224 KB), `tools/write_approval.py` (19 KB), and `tools/tirith_security.py` (34 KB).
Forensic inspection revealed critical security and architectural flaws:
1. **7,100+ Lines of Monolithic God-Files**: Over 5,000 lines in `approval.py` alone, mixing regex heuristics, thread-unsafe environment variables (`HERMES_INTERACTIVE`, `HERMES_YOLO_MODE`), and loose disk file staging.
2. **Thread-Race and Environment Mutation Leaks**: Concurrency vulnerabilities (e.g. `GHSA-96vc-wcxf-jjff`) caused by concurrent ACP or gateway sessions clobbering process-global environment variables.
3. **No Frame-Level Snapshotting or Rollback**: Pending approvals, session grants, and write-staged artifacts live in untracked Python dictionaries or loose disk files (`~/.hermes/pending/`). If an agent rewinds a turn, approval state desynchronizes.
4. **Unbounded Disk File Staging**: File write approval stages JSON files in disk paths (`~/.hermes/pending/{memory,skills}/<id>.json`), risking disk leaks and orphaned staging files if the agent or user terminates early.
5. **No Structured Decision Ledger with Cryptographic Hash Anchors**: Approval responses pass loose strings without SHA-256 command hashing, expiration TTLs, or tamper-evident audit ledgers.

---

## 2. Architectural Decision (The What)

### 1. Deterministic Multi-Tier Threat Classifier (`SecurityRiskClassifier`)
- Categorizes commands and mutations into `critical`, `high`, `medium`, `low`, `safe`.
- Critical: Destructive OS commands (`rm -rf /`, disk wipes, SQL drops, fork bombs, bootloader modifications).
- High: Root privilege escalation (`sudo`, `chmod 777`, `chown root`), credential reading (`.ssh`, `.env`), service stopping.
- Medium: Mass directory writes, package installations (`npm i -g`, `pip install`), git force-pushes.
- Low / Safe: Read-only perception, localized test executions, status queries.
- Micro-benchmark performance: $<0.0005\text{ ms/op}$ evaluation latency.

### 2. SHA-256 Cryptographic Command Canonicalizer (`ApprovalHashLedger`)
- Hashes normalized command strings with argument tokenization.
- Manages session-scoped and persistent allowlists with $O(1)$ lookup performance.

### 3. Zero-GC In-Memory Arbiter Substrate (`BroccoliArbiterSubstrate`)
- In-memory Broccolidb substrate for pending approval queues, approved command ledger, session grants, write-staging buckets (memory & skills), and security metrics.

### 4. Frame-Perfect Binary Snapshotting & $O(1)$ State Rollback (`ArbiterSnapshotManager`)
- Captures atomic snapshots of pending requests, grants, and staging buckets at frame $t$, restoring arbiter state in $<0.05\text{ ms}$ on turn rewind.

### 5. Master Interactive Security Arbiter (`InteractiveSecurityArbiter`)
- Coordinates multi-tier risk evaluation, SHA-256 allowlist ledgers, interactive prompting callbacks, write-staging reviews, and emergency E-Stop killswitch.

### 6. Model & Governance Tool Suite (`ArbiterToolSuite`)
- `arbiter_request_approval`: Explicitly evaluates and requests human-in-the-loop authorization.
- `arbiter_resolve_approval`: Resolves a pending authorization request.
- `arbiter_list_pending`: Lists all pending approvals and write-staged artifacts.
- `arbiter_estop`: Emergency stop killswitch halting all active execution.

---

## 3. Subsystem Organization (ADR-012 Alignment)

```
src/
├── core/contracts/
│   └── arbiter.contracts.ts               # ApprovalRiskLevel, ApprovalActionType, PendingApprovalRequest, ArbiterSessionSnapshot
├── tooling/extensions/arbiter/
│   ├── security-risk-classifier.ts        # Zero-allocation multi-tier risk taxonomy (critical/high/medium/low/safe)
│   ├── approval-hash-ledger.ts            # SHA-256 normalized command hashing, allowlist grants, and TTL management
│   └── arbiter-tool-suite.ts              # Model & control tools (arbiter_request_approval, arbiter_resolve_approval, arbiter_list_pending, arbiter_estop)
├── sessions/extensions/arbiter/
│   ├── broccoli-arbiter-substrate.ts      # In-memory Broccolidb substrate for pending queues, staging buckets, and audit metrics
│   └── arbiter-snapshot-manager.ts        # Frame-perfect binary snapshots and O(1) state rollback (<0.05 ms)
└── agents/extensions/arbiter/
    └── interactive-security-arbiter.ts    # Master security arbiter with E-Stop killswitch, auto-approval thresholds, and write gates
```

---

## 4. Empirical Validation & Benchmarks

Validated via `scripts/validate-security-arbiter.ts`:
- **10,000 Risk Evaluations**: $<5\text{ ms}$ ($<0.0005\text{ ms/op}$).
- **State Rewind Latency**: $<0.05\text{ ms}$.
- **Component Graduation**: Monolith successfully expanded from 236 to **242 required components** in exact alphabetical order.
