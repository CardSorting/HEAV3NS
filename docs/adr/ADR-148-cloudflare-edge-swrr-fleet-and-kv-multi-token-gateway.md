# ADR-148: Cloudflare Edge SWRR Fleet and KV Credential Gateway

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team and GALXAI Infrastructure Leads
- **Date**: 2026-09-03
- **Updated**: 2026-09-04

## Context

LUMI needs an edge ingress that can project OpenAI-compatible HTTP/SSE traffic and Codex WebSocket traffic across a registered credential fleet. A single credential can be throttled or revoked, while naive rotation discards useful session affinity.

This gateway is infrastructure beneath the uncertain-execution runtime. It does not decide that an execution is complete, cancelled, or failed. WebSocket projects execution, queues deliver authorized intents, the journal records observations, and the control plane governs authoritative state.

## Decision

`src/worker.ts` runs as a Cloudflare Worker with four explicit responsibilities:

1. Load the durable credential registry from the `TOKEN_POOL_KV` binding once per isolate.
2. Select an eligible credential through the isolate-local `SmoothWeightedPool` projection.
3. Proxy bounded, authenticated inference requests over HTTP/SSE or WebSocket.
4. Expose authenticated administration for credential ingestion, removal, status, cooldown reset, and a fixed-target WebSocket probe.

The routing pool maintains smooth weighted round-robin state, a sliding request window, token buckets, circuit state, and bounded session affinity. These values are advisory and isolate-local. KV durably stores credential records, but it is not a strongly consistent quota or lease authority. A future globally authoritative governor must use an appropriate coordination primitive and fencing protocol.

## Security boundaries

- Every `/v1/tokens/*`, `/v1/debug/*`, and `/v1/chat/completions` request requires `X-Lumi-Admin-Secret`.
- Missing server-side `LUMI_ADMIN_SECRET` configuration fails closed with HTTP 503.
- Secret comparison uses a timing-safe digest comparison.
- Chat requests never persist an incoming bearer credential. Durable enrollment occurs only through `/v1/tokens/ingest`.
- The WebSocket probe has a fixed upstream target and returns no upstream headers, body, credential metadata, or stack traces.
- Request bodies and upstream error bodies are bounded before they are accumulated.
- Browser access is disabled by default. `CORS_ALLOWED_ORIGIN` must explicitly name an allowed origin.
- Local credential files use atomic writes and mode `0600`. Remote synchronization requires an explicit HTTPS Worker URL and admin secret.

Set production secrets outside source control:

```bash
npx wrangler secret put LUMI_ADMIN_SECRET
npx wrangler secret put OPENAI_API_KEY
```

## Configuration and verification

`wrangler.jsonc` is the versioned source of truth. `src/worker-configuration.d.ts` is generated from it and checked for drift.

```bash
npm run worker:types:check
npm run worker:build
npm run check
npm test
```

`worker:build` is a dry run; it does not deploy.

## Consequences

- A slow or unavailable KV registry prevents the isolate from serving protected traffic instead of silently routing with an incomplete fleet.
- OAuth refresh is single-flight per credential within one isolate and always releases its lock on success or failure.
- Session affinity is bounded and may be lost when an isolate is recycled, which can reduce upstream cache reuse without affecting authoritative execution state.
- SWRR counters can diverge across isolates. They reduce local burst concentration but do not guarantee fleet-wide rate-limit avoidance.
- KV is eventually consistent, so token ingestion and removal may take time to appear in other isolates.
- No prompt-cache hit rate, zero-drop rate, or global fairness guarantee is asserted without production telemetry that measures it.
