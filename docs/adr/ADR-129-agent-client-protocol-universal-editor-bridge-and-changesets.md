# ADR-129: Agent Client Protocol (ACP) Universal Editor Bridge & Multi-File Changesets

## Status
Accepted (Phase 99)

## Context
Non-technical users and professional software engineers operating modern AI-first IDEs (VSCode, Cursor, JetBrains, Zed, Windsurf) require bi-directional synchronization, multi-file staged changeset reviews, and visual diff cards directly within their editors.

## Decision
Elevate the Agent Client Protocol (ACP) Universal Editor Bridge within the LUMI AKD-DSO Monolith architecture:
1. **JSON-RPC 2.0 Bi-Directional Bridge**: Standardized communication over stdio/IPC supporting editor connection handshakes (`vscode`, `cursor`, `jetbrains`, `zed`, `windsurf`).
2. **Multi-File Staged Changesets**: Atomic staging of multi-file diffs with addition/deletion metrics and lifecycle states (`PENDING`, `ACCEPTED`, `REJECTED`, `MODIFIED`).
3. **Cursor Composer-Style Diff Cards**: Human-readable ASCII diff cards with colorized chunk indicators, line counts, and actionable review buttons.
4. **Interactive Permission Gates**: Sensitive path protection (e.g. `.env`, `.ssh`, `.npmrc`) and structured approval queues.
5. **Model Tool Suite**: 9 deterministic tools (`acp_initialize_session`, `acp_stage_changeset`, `acp_get_diff_card`, `acp_resolve_changeset`, `acp_send_client_command`, `acp_stream_notification`, `acp_list_sessions`, `acp_configure`, `acp_get_health`).

## Consequences
- Seamless pairing experience with major editor clients.
- Clear multi-file change reviews mirroring industry best practices.
- Zero-GC state snapshots enabling instant rollback of unaccepted edits.
