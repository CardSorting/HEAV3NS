# ADR-135: Fine-Grained Hunk-Level Patching, Dynamic Client Tool Negotiation & Interactive Hunk Review

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-28

## Status
**ACCEPTED** (Pass 197 Baseline Integration)

## Context
In modern agentic editor extensions (Cursor Composer, Windsurf Cascade, GitKraken, VS Code Language Model Tools), full-file accept/reject binaries introduce friction and operator cognitive overload:
1. **Granular Hunk Review**: Developers require the ability to review discrete, line-anchored hunks (`AcpDiffHunk`), cherry-picking individual edits while discarding others without invalidating entire multi-file changesets.
2. **Dynamic Client Tool Registration**: Connected IDE clients need to expose editor-native actions (e.g. `editor/getSelection`, `editor/openFiles`, `editor/showNotification`) dynamically across JSON-RPC 2.0 without static coupling.
3. **Interactive TUI Hunk Selector**: Terminal operators require visual hunk-level review with checkbox selection (`[x]` / `[ ]`), line-offset shifting calculations, and instant keyboard approval actions.

## Decision
1. **Fine-Grained Hunk-Level Patcher (`AcpFineGrainedHunkPatcher`)**:
   - Deconstructs unified diffs into line-anchored hunks with start/count coordinates and addition/deletion classifications.
   - Slices original file buffers and dynamically recalculates line offsets during selective patch application (`applySelectedHunks`).
   - Supports individual hunk discard (`discardHunk`) leaving the remainder of the changeset intact.

2. **Dynamic Client Tool Negotiation (`tools/list`, `tools/call`, `client/registerTools`)**:
   - Upgraded `AcpBridgeServer` to accept client tool declarations, storing them in-memory and dispatching tool executions transparently.

3. **Interactive Hunk Review in `AcpDashboardModal`**:
   - Added `hunks` view mode with checkbox toggles (`[Space]`), colorized additions/deletions, and keyboard approval shortcuts.

4. **Evolution Baseline Advancement**:
   - Advanced repository evolution baseline to **Pass 197 / 600 components**.

## Consequences
- **Positive**: Enables granular cherry-picking of AI modifications; supports arbitrary client-side tool execution; provides terminal operators with high-fidelity hunk inspection.
- **Verification**: Verified via `scripts/validate-acp-hunk-patching.ts`, `scripts/validate-acp-2pc-streaming.ts`, `scripts/validate-forensic-integrity.ts`, and full 142-suite regression runs.
