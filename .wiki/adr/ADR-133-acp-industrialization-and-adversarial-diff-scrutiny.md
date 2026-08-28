# ADR-133: Agent Client Protocol (ACP) Industrialization, Pre-Commit Adversarial Diff Scrutiny & Interactive TUI Bridge

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-28

## Status
**ACCEPTED** (Pass 195 Baseline Integration)

## Context
As LUMI evolves into an enterprise-grade autonomous engineering substrate, bi-directional integration with external developer environments (VS Code, JetBrains, Zed, Cursor, Windsurf) requires strict adherence to industry standards while enforcing fail-closed safety invariants.

In previous phases (ADR-129 / Phase 99), the basic JSON-RPC 2.0 ACP editor bridge was introduced. In Pass 194 (ADR-132), LUMI assimilated senior adversarial red-teaming, factual provenance proofs, and cognitive fluff decomposition from the BroccoliDB compaction lineage.

However, a critical gap remained: edit approvals in ACP were evaluated purely on static path regexes without deep pre-commit red-teaming, and terminal operators lacked an interactive TUI modal to inspect live changesets, colorized diffs, and adversarial risk shields in real time.

## Decision
1. **Pre-Commit Adversarial Diff Scrutiny**:
   - Upgraded `AcpPermissionGate` to deeply scrutinize proposed file mutations (`scrutinizeEdit`, `scrutinizeChangeset`) before generating approval requests.
   - Computes multi-dimensional risk scores (0–100), risk levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), detecting hardcoded credentials, missing rollback/error boundaries, ungrounded symbol references, and cognitive fluff.
   - Automatically renders and attaches high-contrast ASCII diagnostic shields to queued approval requests.

2. **LSP-Compatible Diagnostic Streaming (`diagnostics/publish`)**:
   - Enabled real-time push notifications of structured adversarial findings and syntax/type errors directly to connected IDE clients.

3. **Interactive ACP TUI Dashboard Modal (`AcpDashboardModal`)**:
   - Built a 5-tab ANSI terminal modal (`sessions`, `approvals`, `changesets`, `diagnostics`, `audit-ledger`) accessible via the `/acp` slash command.
   - Allows terminal operators to review diffs side-by-side and execute instantaneous keyboard approvals (`[A] Approve`, `[D] Deny`, `[M] Mode Switch`).

4. **Typed BroccoliDB Substrate & WAL Journaling**:
   - Backed ACP sessions, changesets, approvals, and risk audits with typed BroccoliDB tables (`acp_sessions`, `acp_changesets`, `acp_approvals`, `acp_risk_audits`, `acp_wal`) delivering sub-millisecond snapshotting and O(1) state rewind.

5. **Evolution Baseline Advancement**:
   - Advanced repository evolution baseline to **Pass 195 / 598 components**.

## Consequences
- **Positive**: IDE clients receive real-time adversarial security feedback; operators can review and approve code mutations with full provenance guarantees; zero subshell execution preserves extreme performance.
- **Verification**: All 8 suites in `scripts/validate-acp-industrialization.ts` pass cleanly alongside repository forensic audits.
