# ADR-106: LLM Stream Diagnostics, Upstream Edge Forensic Header Capture & Exception Chain Breadcrumb Subsystem

## Status
**ACCEPTED** (Phase 130 / Target #63)

## Context
When an LLM stream drops unexpectedly mid-response or mid-tool-call during high-concurrency multi-agent turns or subagent delegations, debugging the root cause requires granular forensic signals:
1. Identifying the specific upstream edge proxy, Cloudflare ray (`cf-ray`), OpenRouter upstream provider (`x-openrouter-provider`), or internal trace identifier (`x-request-id`, `x-vercel-id`).
2. Measuring precise latency metrics, including Time to First Byte (TTFB), streamed byte volume, and chunk counts before the connection dropped.
3. Unwrapping deeply nested SDK exception chains (e.g. `APIConnectionError` hiding `RemoteProtocolError` or `ConnectError`) into an actionable single-line forensic breadcrumb.
4. Preserving subagent attribution (`subagent_id`, `delegate_depth`) without polluting the primary user output.
5. Providing instantaneous $O(1)$ state rollback ($<0.05\text{ ms SLA}$) and high-frequency recording ($>500,000\text{ ops/sec}$).

## Decision
We implement a zero-GC, deterministic Stream Diagnostics & Upstream Edge Header Forensic Subsystem in **LUMI-JOY**:
1. **Core Contracts (`stream-diag.contracts.ts`)**:
   - Defines `StreamDiagnosticAttempt`, `StreamDropEvent`, `StreamDiagConfig`, `StreamDiagMetrics`, and `StreamDiagWorkspaceSnapshot`.
2. **In-Memory Substrate & Snapshots (`broccoli-stream-diag-substrate.ts`, `stream-diag-snapshot-manager.ts`)**:
   - In-memory Broccolidb repository tracking per-attempt stream telemetry, drop event ring buffers, and binary snapshots with $<0.05\text{ ms SLA}$ rollback.
3. **Deterministic Engine (`deterministic-stream-diag-engine.ts`)**:
   - Exception cause chain flattener (`Outer(msg) <- Inner(msg) <- ...` up to 4 levels), upstream diagnostic header extractor with bounded length caps, and user-facing status formatter.
4. **Supervisor (`stream-diag-supervisor.ts`)**:
   - Coordinates stream lifecycle (`startAttempt()`, `captureResponse()`, `recordChunk()`, `recordDropAndRetry()`, `completeAttempt()`).
5. **Model Tool Suite (`stream-diag-tool-suite.ts`)**:
   - Exposes 5 model tools (`stream_diag_inspect_attempts`, `stream_diag_record_event`, `stream_diag_format_chain`, `stream_diag_configure`, `stream_diag_get_metrics`).
6. **Grand Monolith Expansion**:
   - Monolith expanded from **489 to 494 components** in optimal alphabetical cohesion.

## Consequences
- Full visibility into upstream CDN and provider health on streaming disconnects.
- Clear attribution of subagent retries and failures.
- Zero impact on message prompt caching and zero GC memory overhead.
