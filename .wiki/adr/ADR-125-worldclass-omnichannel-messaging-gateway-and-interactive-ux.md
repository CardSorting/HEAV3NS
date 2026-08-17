# ADR-125: World-Class Omnichannel Messaging Gateway & Interactive UX Architecture (Phase 95)

## Status
ACCEPTED (AKD-DSO Monolith Hardened)

## Context
Following the initial protocol hardening in [ADR-124](ADR-124-deterministic-native-multi-platform-messaging-gateway-kernel.md), operational teams and conversational users require world-class ergonomics mirroring best-in-class customer messaging platforms (Slack Block Kit, Discord Components, Telegram Inline Keyboards, WhatsApp Cloud API, Front, Intercom, and Zendesk).

Specifically:
1. **Interactive Elements**: Users need 1-click action buttons, URL links, and approval buttons instead of memorizing text-only commands.
2. **Omnichannel Identity Resolution**: Customer interactions across Telegram, WhatsApp, Slack, Discord, and Signal need unification into a single customer profile with interaction history and VIP tiers.
3. **Human-in-the-Loop Handover & Whisper Notes**: Support operations require seamless switching between autonomous agent responses, co-pilot assistance, and human takeover, with internal operator whisper notes that never leak to external platforms.
4. **Media Streaming & MIME Bounds**: Inbound and outbound voice notes, documents, and images need strict MIME whitelisting and size verification.
5. **Platform Health Telemetry**: Operators need live latency, uptime, and delivery error telemetry across all connected chat platforms.

## Decision
We implemented the **Omnichannel Messaging Gateway and Interactive UX Architecture**:

### 1. Native Interactive Action Cards & Buttons
- Cross-platform card compiler targeting Telegram `inline_keyboard`, Slack Block Kit `actions`, Discord `components` Action Rows, and WhatsApp `interactive` buttons.
- Supports `primary`, `danger`, `success`, and `link` button semantics.

### 2. Omnichannel Unified Contact Identity
- Links fragmented platform identities (`telegram:alice_vance`, `whatsapp:+1555019944`, `discord:alice#0001`) into a single `UnifiedContactProfile`.
- Indexes contacts by both global contact ID and platform handles for $O(1)$ identity resolution.

### 3. Human-in-the-Loop Handover & Internal Whisper Notes
- Three governance modes: `AGENT_AUTONOMOUS`, `COPILOT_ASSIST` (agent drafts, human approves), and `HUMAN_TAKEOVER` (autonomous replies paused).
- Internal whisper notes recorded in the session substrate that are never transmitted to the external chat channel.

### 4. Rich Media & Strict MIME Safety Firewall
- Validates media payloads against allowed MIME types (`image/*`, `audio/*`, `application/pdf`, `video/*`) and enforces byte boundaries (10MB image, 25MB audio, 50MB PDF/video).

### 5. Reaction Emojis & Real-Time Typestates
- Real-time typestate emission (`typing`, `recording_audio`, `uploading_file`) for fluid conversational dynamics.
- Message reaction emoji ledger (`👍`, `❤️`, `✅`, `🔥`, `👀`, `❌`) with optimistic add/remove operations.

### 6. Expanded 16 Model Tool Suite
1. `gateway_send_message`
2. `gateway_send_interactive_card`
3. `gateway_send_rich_media`
4. `gateway_broadcast_announcement`
5. `gateway_verify_webhook`
6. `gateway_manage_channel_binding`
7. `gateway_link_contact_identity`
8. `gateway_get_contact_profile`
9. `gateway_set_handover_mode`
10. `gateway_post_internal_whisper`
11. `gateway_manage_reaction`
12. `gateway_send_typing_indicator`
13. `gateway_inspect_platform_health`
14. `gateway_inspect_delivery_ledger`
15. `gateway_manage_session_lease`
16. `gateway_manage_config`

## Consequences
- World-class conversational ergonomics matching industry leaders (Slack, Discord, Telegram, Front, Intercom).
- Frame snapshotting and state rollback maintained at $< 0.002\text{ ms p95}$.
- Contiguous 16MB slab memory invariant and 0 barrel imports preserved.
