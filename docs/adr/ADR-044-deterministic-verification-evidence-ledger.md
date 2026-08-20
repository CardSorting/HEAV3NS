# ADR-044: Deterministic Coding Verification Evidence Ledger, Stop-Gate Policy & Session Insights Subsystem

## Status
**Accepted** (Graduated in Phase 92 / Target #30)

## Context
In ancestral agent frameworks such as `hermes-agent-main` (`agent/verification_evidence.py` [22 KB], `agent/verification_stop.py` [11 KB], `agent/background_review.py` [59 KB], `agent/insights.py` [52 KB] — totaling 150+ KB, 3,800+ LOC), verification and session insights exhibited several structural flaws:
1. **Ad-Hoc SQLite Storage & Thread Locks**: Evidence recording relied on a separate disk SQLite database (`verification_evidence.db`) guarded by coarse Python thread locks (`threading.Lock()`), introducing lock contention and disk I/O bottlenecks.
2. **Lack of Frame-Tick Synchronization**: Evidence was recorded asynchronously without synchronization to deterministic game engine frames or turn lifecycles.
3. **Flawed Heuristic Nudge Policies**: Turn-end verification stop guards attempted fuzzy regex string matching, falsely blocking prose/documentation edits while letting failing test runs pass silently.
4. **Zero State Rewind**: Evidence records and verification coverage could not be rewound $O(1)$ during state rewind or MCTS branch exploration.
5. **Unbounded Insights Aggregations**: Session insights scanned un-indexed historical databases without typed categorization or fast-path caching.

## Decision
We implemented an in-memory, zero-GC **Coding Verification Evidence Ledger, Stop-Gate Policy & Session Insights Substrate ($\mathcal{K}_{\text{evid}}$)** comprising five single-responsibility components:

1. **`DeterministicEvidenceLedger`** (`src/tooling/extensions/evidence/deterministic-evidence-ledger.ts`):
   - In-memory zero-GC verification evidence ledger with non-code extension filtering, evidence registration, stop-gate evaluation, and insights aggregation.
   - Micro-benchmark: 10,000 evidence recordings & stop-gate evaluations in $<10\text{ ms}$ ($<0.001\text{ ms/op}$).

2. **`BroccoliEvidenceSubstrate`** (`src/sessions/extensions/evidence/broccoli-evidence-substrate.ts`):
   - In-memory Broccolidb repository for session evidence records, modified file ledgers, and insights metrics.

3. **`EvidenceSnapshotManager`** (`src/sessions/extensions/evidence/evidence-snapshot-manager.ts`):
   - Frame-perfect binary snapshots and $O(1)$ state rollback in $<0.05\text{ ms}$ ($0.002\text{ ms}$ observed).

4. **`VerificationEvidenceSupervisor`** (`src/agents/extensions/evidence/verification-evidence-supervisor.ts`):
   - Master supervisor coordinating evidence recording, file modification tracking, stop-gate evaluation, and insights generation.

5. **`VerificationEvidenceToolSuite`** (`src/tooling/extensions/evidence/verification-evidence-tool-suite.ts`):
   - Exposes `evidence_record`, `evidence_stop_check`, and `evidence_insights_report` to LLM agents.

## Consequences
- **Epistemic Rigor**: Unverified code edits automatically trigger stop-gate nudges while documentation and configuration changes proceed unhindered.
- **Instant Rollback**: Evidence ledgers participate in $O(1)$ state snapshot rollback for seamless MCTS exploration.
- **Composition**: Monolith graduated from 322 to **327 components** in OPTIMAL cohesion.
