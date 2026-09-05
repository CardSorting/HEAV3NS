# ADR-150: Always-On Relay Live Wire Codex WebSocket Image Generation and Cloudflare R2 Pipeline

- **Status**: Accepted
- **Deciders**: LUMI Architecture Group and GALXAI Infrastructure Leads
- **Date**: 2026-09-05
- **Related ADRs**: [ADR-148](ADR-148-cloudflare-edge-swrr-fleet-and-kv-multi-token-gateway.md) · [ADR-149](ADR-149-host-relay-pm2-daemon-cloudflare-tunnel-ingress-and-protocol-hardening.md) · [GALXAI ADR 0121](../../../GALXAI/docs/adr/0121-user-and-session-r2-partitioning-manifest-lifecycle-and-relay-image-synthesis.md)

---

## Context

Frontend consumers and autonomous agents in the LUMI and GALXAI ecosystems frequently execute visual synthesis requests. While standard platform API keys can query `https://api.openai.com/v1/images/generations`, pooled ChatGPT OAuth session tokens (which power the flagship `gpt-5.6-terra` / `gpt-5.6-sol` reasoning fleets) strictly lack the Platform API scope `api.model.images.request`, resulting in HTTP 401 Unauthorized errors when called over REST.

Forensic probing of the native ChatGPT Codex WebSocket protocol (`wss://chatgpt.com/backend-api/codex/responses`) proved that the backend supports visual synthesis natively via tool `image_generation`. To unlock this capability for the entire fleet, the Always-On Relay daemon (`src/relay/relay-server.ts`) required first-class visual synthesis endpoints, connection liveness watchdogs, and base64 rendering pipelines.

---

## Decision

We expand the Always-On Relay (`src/relay/relay-server.ts`) to serve as an authoritative **Live Wire Visual Synthesis Gateway**:

1. **New Ingress Endpoints**:
   - `POST /v1/images/generations`
   - `POST /images/generations`
   - Governed by zero-trust timing-safe API key verification (`crypto.timingSafeEqual`) and continuous token-bucket rate limits.

2. **Dual-Dispatch Engine**:
   - **ChatGPT OAuth Shards**: Dispatched via native Codex WebSocket wire (`wss://chatgpt.com/backend-api/codex/responses`).
   - **OpenAI Platform API Keys (`sk-...`)**: Dispatched via standard HTTPS REST to `https://api.openai.com/v1/images/generations`.

3. **Codex WebSocket Visual Synthesis Lifecycle**:
   - On connection handshake, transmits `response.create` with `tools: [{ type: "image_generation" }]`.
   - Sends periodic 15-second protocol ping frames to defeat edge idle timeouts.
   - Monitors neural diffusion state progression (`response.image_generation_call.generating`).
   - Captures `response.output_item.done` containing:
     - `item.result`: Lossless master PNG base64 string.
     - `item.revised_prompt`: Model-generated revised visual prompt.
   - Returns standard OpenAI response schema:
     ```json
     {
       "created": 1788620312,
       "data": [
         {
           "b64_json": "...",
           "revised_prompt": "..."
         }
       ],
       "model": "gpt-5.6-terra"
     }
     ```

4. **Integration with Cloudflare R2 Partitioning**:
   - Downstream consumers (`GALXAI`) ingest the base64 output directly into Cloudflare R2 partitioned under `users/{userId}/sessions/{sessionId}/images/{imageId}.png`, returning permanent CDN URLs (`https://assets.galx.ai/...`) to eliminate bandwidth bloat.

---

## Verification & Metrics

- **Live Wire Test**: Successfully synthesized `gpt_image_neon_cube.png` (881 KB) and `gpt_image_cyberpunk_city.png` (2.64 MB) with 200 OK.
- **Telemetry Counters Added**:
  - `totalImageJobsSubmitted`
  - `totalImageJobsCompleted`
  - `totalImageJobsFailed`
- **Clean Compilation**: Verified via `npx tsc --noEmit` in both `LUMI-NEW` and `GALXAI`.
