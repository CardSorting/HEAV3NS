# ADR-134: Two-Phase Commit (2PC) Speculative Changeset Staging, Streaming Token Protocol & Industrialized Transport

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-28

## Status
**ACCEPTED** (Pass 196 Baseline Integration)

## Context
Bi-directional AI coding agents operating across modern development environments (Zed, VS Code, Cursor, JetBrains) require transaction isolation, optimistic concurrency control, and low-latency token streaming to match world-class developer UX:
1. **Speculative Changeset Staging**: Multi-file modifications must never be written blindly to disk. If a file is altered externally while the agent is planning, applying partial writes leads to corrupted repository states.
2. **Streaming Tokens & Collapsible Reasoning**: Modern IDEs require real-time delta chunks (`session/chunk`), thinking traces (`session/thought`), and live tool call widgets (`session/toolCall`, `session/toolResult`).
3. **Cooperative In-Flight Cancellation**: Agents executing long-running turns must gracefully abort (`session/cancel`, `$/cancelRequest`) without leaking uncommitted file changes or hanging background workers.
4. **Industrialized Transport Framing**: High-velocity IDE communication requires support for standard Language Server Protocol (LSP) header-framed streams (`Content-Length: ...\r\n\r\n`) and newline-delimited JSON (`NDJSON`).

## Decision
1. **Two-Phase Commit (2PC) Speculative Stager (`AcpSpeculativeChangesetStager`)**:
   - Implemented an in-memory speculative buffer that captures file pre-images and computes SHA-256 pre/post integrity hashes before any filesystem write.
   - Enforces Optimistic Concurrency Control (OCC) during `commitTransaction(transactionId)` to detect file drift and abort safely with clean error diagnostics.
   - Generates structured rollback tokens (`AcpRollbackToken`) enabling atomic, 1-click reversal of all touched files.

2. **Bidirectional Streaming Protocol**:
   - Added real-time token streaming (`session/chunk`), cognitive thought traces (`session/thought`), and execution completion reports (`AcpTurnCompletionReport`).

3. **Cooperative Cancellation & Workspace Synchronization**:
   - Implemented `session/cancel` and `$/cancelRequest` handling with cooperative interrupt tokens.
   - Added `workspace/roots` and `workspace/didChangeWorkspaceFolders` synchronization for dynamic multi-root scoping.

4. **Industrialized Protocol Codec & Transport Framing**:
   - Upgraded `AcpProtocolCodec` with `encodeLspMessage` and `parseStreamBuffer` to handle continuous chunked streams and LSP Content-Length framing.

5. **Evolution Baseline Advancement**:
   - Advanced repository evolution baseline to **Pass 196 / 599 components**.

## Consequences
- **Positive**: Eliminates partial or corrupted file writes via 2PC transactions; enables real-time streaming tokens and collapsible thought traces; provides 1-click rollback guarantees; adheres strictly to zero-subshell invariants.
- **Verification**: Verified via `scripts/validate-acp-2pc-streaming.ts`, `scripts/validate-acp-industrialization.ts`, `scripts/validate-forensic-integrity.ts`, and full 141-suite regression runs.
