# ADR-149: Host Relay PM2 Daemon, Cloudflare Tunnel Ingress, and Upstream WebSocket Protocol Hardening

- **Status**: Accepted
- **Deciders**: LUMI Architecture Group and GALXAI Infrastructure Leads
- **Date**: 2026-09-05
- **Related ADRs**: [ADR-147](ADR-147-galx-ai-provider-integration-and-auxiliary-provider-consolidation.md) · [ADR-148](ADR-148-cloudflare-edge-swrr-fleet-and-kv-multi-token-gateway.md) · [GALXAI ADR 0112](../../../GALXAI/docs/adr/0112-galxai-authoritative-shard-fleet-pool-native-codex-websocket-wire-and-sliding-window-failover.md) · [GALXAI ADR 0120](../../../GALXAI/docs/adr/0120-zero-cost-host-mac-cloudflare-tunnel-relay-ingress-and-protocol-hardening.md)

---

## Context

Per ADR-148 and GALXAI ADR 0112, persistent Codex WebSocket sessions (`wss://chatgpt.com/backend-api/codex/responses`) were authoritatively decoupled from Cloudflare Workers and centralized into the dedicated Always-On VM Relay (`src/relay/relay-server.ts`).

During real-world deployment across Vercel serverless environments and upstream OpenAI Codex endpoints, three operational hurdles were identified:
1. **Remote Ingress Boundary**: Remote serverless platforms (such as Vercel-hosted GALXAI) cannot reach `http://localhost:3001` on the developer's workstation. Provisioning paid cloud VMs (Hetzner, Fly.io, Railway) prior to confirming functional validity incurs unnecessary costs during prototyping.
2. **Upstream Schema & Multiplexing Errors**: Modern client SDKs send multi-modal or structured message content as nested arrays (`content: [{ type: 'text', text: '...' }]`). When serialized into WebSocket frames without string flattening, upstream OpenAI Codex endpoints returned HTTP 400 Bad Request (`[StringParam] [instructions] [invalid_type] Invalid type for 'instructions': expected a string, but got an array instead`).
3. **Reasoning-Induced Dead Peer False Positives**: Extended reasoning bursts on frontier models (`gpt-5.6-sol`, `gpt-5.6-terra`) pause downstream token generation for 10–45 seconds. The 5-second `heartbeatAckTimeoutTimer` watchdog prematurely triggered `dead_peer_pong_timeout` evictions because RFC 6455 protocol-level pong frames were not captured via Node.js `ws.on('pong')`, and silent reasoning activity was not properly accounted for.

---

## Decision

We formalize **Solution A: Local Host PM2 Supervision + Cloudflare Tunnel Ingress** and execute upstream protocol hardening within `src/relay/relay-server.ts`.

### 1. PM2 Process Supervision (`ecosystem.config.cjs`)

The relay server is managed under PM2 on the host machine to ensure high availability, automatic crash recovery, log rotation, and unprivileged execution:

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'galxai-relay',
      script: './node_modules/.bin/tsx',
      args: 'src/relay/relay-server.ts',
      cwd: '/Users/bozoegg/Desktop/LUMI-NEW',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0'
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/Users/bozoegg/.lumi/logs/relay.err',
      out_file: '/Users/bozoegg/.lumi/logs/relay.log',
      merge_logs: true
    }
  ]
};
```

### 2. Cloudflare Zero-Trust Ingress (`cloudflared`)

An encrypted outbound tunnel projects the local relay port (`http://0.0.0.0:3001`) onto Cloudflare's global edge network:
```bash
cloudflared tunnel --url http://localhost:3001
```
Remote serverless clients (such as Vercel) target the generated HTTPS URL via the `VM_RELAY_URL` environment variable. Inbound firewall ports and static IP reservations are not required.

### 3. Upstream Protocol Hardening in `src/relay/relay-server.ts`

- **Request Parsing & Model Mapping**: Fixed body variable declaration scope in `handleChatCompletions` (`const body = bodyText.trim() ? JSON.parse(bodyText) : {};`) and mapped `gpt-5.6-sol` requests to `gpt-5.6-terra` for OAuth scope compliance with ChatGPT session tokens.
- **Message Content Flattening**: All message content is coerced to standard string primitives before constructing `instructions` and `input_text` payloads, eliminating upstream 400 Bad Request errors:
  ```typescript
  const textContent = typeof msg.content === 'string'
    ? msg.content
    : Array.isArray(msg.content)
    ? msg.content.map((c: any) => (typeof c === 'string' ? c : c?.text || JSON.stringify(c))).join('\n')
    : (msg.content ? JSON.stringify(msg.content) : '');
  ```
- **RFC 6455 Protocol Pong Capture**: Attached `(ws as any).on('pong')` listener to capture underlying wire pongs and disarm the pending heartbeat ACK timer.
- **Reasoning Watchdog Silence Guard**: The 5-second `heartbeatAckTimeoutTimer` validates that the peer has exceeded the full `wsIntraChunkTimeoutMs` threshold before triggering a dead peer failover, preventing false evictions during long-running reasoning phases.

---

## Verification

The hardened relay architecture was validated end-to-end:
1. **Compilation**: `npx tsc --noEmit` compiles cleanly with **0 errors**.
2. **Streaming SSE**: 904 SSE chunks (2,512 characters) delivered in 64,233ms without mid-stream connection reset or premature timeout.
3. **Non-Streaming**: 1,075 tokens generated and returned in a single synthesized response in 100,604ms.
4. **End-to-End Pipeline**: Full 8-phase test suite passed with 100% integrity through the live Cloudflare Tunnel in 165,479ms.

---

## Consequences

- Serverless edge environments (Vercel) can reliably offload 2–3 minute reasoning inference to the Always-On Relay without execution timeouts.
- Zero infrastructure costs incurred during prototyping and testing ($0.00 spend).
- Foundation established for seamless migration to dedicated cloud VMs (Solution B) when 24/7 unattended production SLAs are required.
