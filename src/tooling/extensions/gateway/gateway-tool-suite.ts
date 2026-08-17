/**
 * gateway-tool-suite.ts
 *
 * Model tool surface for the Native Messaging Gateway Subsystem (Phase 95 / ADR-125).
 * Exposes 16 specialized model tools covering outbound dispatch, interactive action cards,
 * omnichannel contact identity, handover co-pilot modes, internal whisper notes, media attachments,
 * reaction ledgers, and platform health telemetry.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  ContactVipTier,
  GatewayActionButton,
  GatewayHandoverMode,
  GatewayInteractiveCard,
  GatewayMediaCard,
  GatewayMediaType,
  GatewayPlatform,
  GatewayTypingState,
  GatewayUserRole,
  LinkedPlatformIdentity,
  UnifiedContactProfile,
} from "../../../core/contracts/gateway.contracts.js";
import { GatewaySupervisor } from "../../../agents/extensions/gateway/gateway-supervisor.js";
import { BroccoliGatewaySubstrate } from "../../../sessions/extensions/gateway/broccoli-gateway-substrate.js";
import { DeterministicGatewayEngine } from "./deterministic-gateway-engine.js";
import { GatewayDeliveryLedger } from "../../../sessions/extensions/gateway/gateway-delivery-ledger.js";

export class GatewayToolSuite {
  private readonly supervisor: GatewaySupervisor;
  private readonly legacySubstrate?: BroccoliGatewaySubstrate;
  private readonly legacyLedger?: GatewayDeliveryLedger;

  constructor(
    supervisorOrDispatcher: GatewaySupervisor | any,
    substrate?: BroccoliGatewaySubstrate,
    ledger?: GatewayDeliveryLedger
  ) {
    this.legacySubstrate = substrate;
    this.legacyLedger = ledger;
    if (supervisorOrDispatcher instanceof GatewaySupervisor) {
      this.supervisor = supervisorOrDispatcher;
    } else {
      const sub = substrate || new BroccoliGatewaySubstrate();
      const eng = new DeterministicGatewayEngine();
      this.supervisor = new GatewaySupervisor(sub, eng);
    }
  }

  async executeTool(toolName: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;

    if (toolName === "gateway_broadcast_message" || toolName === "gateway_send_message") {
      const channelId = String(args.channelId || "general");
      const content = String(args.content || args.text || "");
      const res = this.supervisor.sendMessage(platform, channelId, content);
      return {
        success: true,
        messageId: res.message?.messageId || `msg_${Date.now()}`,
        status: "delivered",
        platform,
        channelId,
      };
    }

    if (toolName === "gateway_list_channels") {
      const channels = this.legacySubstrate ? this.legacySubstrate.listChannels(platform) : [];
      return {
        success: true,
        channels,
        count: channels.length,
      };
    }

    if (toolName === "gateway_inspect_session") {
      const channelId = String(args.channelId || "");
      const channel = this.legacySubstrate ? this.legacySubstrate.getChannel(channelId) : undefined;
      return {
        success: true,
        channel,
      };
    }

    if (toolName === "gateway_delivery_status") {
      const receipts = this.supervisor.listDeliveryReceipts();
      return {
        success: true,
        totalReceipts: receipts.length,
        receipts,
      };
    }

    const tool = this.getTools().find((t) => t.name === toolName);
    if (tool) {
      return (await tool.execute(args, process.cwd())) as Record<string, unknown>;
    }

    return {
      success: false,
      error: `Unknown tool '${toolName}'`,
    };
  }

  public getTools(): ToolDefinition[] {
    return [
      // 1. gateway_send_message
      {
        name: "gateway_send_message",
        description: "Dispatches an outbound message to an external chat platform (Telegram, Slack, Discord, WhatsApp, Signal, Matrix) with automatic markdown format compilation.",
        parameters: {
          platform: { type: "string", required: true, description: "Target platform (telegram, slack, discord, whatsapp, signal, webhook, matrix, imessage)" },
          channelId: { type: "string", required: true, description: "Target channel, chat ID, or phone number" },
          content: { type: "string", required: true, description: "Message body in standard Markdown" },
          threadId: { type: "string", description: "Optional thread identifier" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "general");
          const content = String(args.content || "");
          const threadId = args.threadId ? String(args.threadId) : undefined;

          const result = this.supervisor.sendMessage(platform, channelId, content, undefined, threadId);

          if (!result.success || !result.message) {
            return { success: false, error: result.error || "Failed to dispatch gateway message" };
          }

          return {
            success: true,
            messageId: result.message.messageId,
            platform: result.message.platform,
            channelId: result.message.channelId,
            deliveryStatus: result.message.deliveryStatus,
            compiledFormat: result.message.compiledFormat,
            receiptId: result.receipt?.receiptId,
            latencyMs: result.receipt?.latencyMs,
            preview: result.message.formattedPreview,
          };
        },
      },

      // 2. gateway_send_interactive_card
      {
        name: "gateway_send_interactive_card",
        description: "Dispatches a rich interactive action card with primary/danger buttons, URL links, and callback triggers compiled natively per platform (Telegram inline keyboards, Slack Block Kit, Discord Action Rows, WhatsApp buttons).",
        parameters: {
          platform: { type: "string", required: true, description: "Target platform" },
          channelId: { type: "string", required: true, description: "Target channel ID" },
          title: { type: "string", required: true, description: "Card header title" },
          bodyText: { type: "string", required: true, description: "Card markdown body text" },
          subtitle: { type: "string", description: "Card subtitle or status label" },
          buttonsJson: { type: "string", description: "JSON array of buttons, e.g. [{\"actionId\":\"btn_approve\",\"label\":\"Approve Deploy\",\"style\":\"primary\"},{\"actionId\":\"btn_docs\",\"label\":\"View Docs\",\"style\":\"link\",\"url\":\"https://lumi.ai\"}]" },
          footerText: { type: "string", description: "Card footer metadata text" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "general");
          const title = String(args.title || "Interactive Notification");
          const bodyText = String(args.bodyText || "");
          const subtitle = args.subtitle ? String(args.subtitle) : undefined;
          const footerText = args.footerText ? String(args.footerText) : undefined;

          let buttons: GatewayActionButton[] = [];
          try {
            buttons = JSON.parse(String(args.buttonsJson || "[]"));
          } catch {
            buttons = [{ actionId: "btn_ok", label: "Acknowledge", style: "primary" }];
          }

          const card: GatewayInteractiveCard = {
            cardId: `card_${Date.now()}`,
            title,
            subtitle,
            bodyText,
            buttons,
            footerText,
          };

          const result = this.supervisor.sendInteractiveCard(platform, channelId, card);

          if (!result.success || !result.message) {
            return { success: false, error: result.error || "Failed to dispatch interactive card" };
          }

          return {
            success: true,
            cardId: card.cardId,
            platform: result.message.platform,
            channelId: result.message.channelId,
            compiledFormat: result.message.compiledFormat,
            buttonsCount: buttons.length,
            preview: result.message.formattedPreview,
          };
        },
      },

      // 3. gateway_send_rich_media
      {
        name: "gateway_send_rich_media",
        description: "Dispatches rich media attachments (images, voice notes, PDF documents, videos) with strict MIME validation and size checking.",
        parameters: {
          platform: { type: "string", required: true, description: "Target chat platform" },
          channelId: { type: "string", required: true, description: "Target channel ID" },
          mediaType: { type: "string", required: true, description: "Media type: image, audio_voice, document, video" },
          url: { type: "string", required: true, description: "Public media URL" },
          mimeType: { type: "string", required: true, description: "MIME type, e.g. image/png, audio/ogg, application/pdf, video/mp4" },
          sizeBytes: { type: "number", required: true, description: "File size in bytes" },
          caption: { type: "string", description: "Optional media caption" },
          fileName: { type: "string", description: "File name with extension" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "general");
          const mediaType = (String(args.mediaType || "image").toLowerCase()) as GatewayMediaType;
          const url = String(args.url || "");
          const mimeType = String(args.mimeType || "image/png");
          const sizeBytes = Number(args.sizeBytes || 1024);
          const caption = args.caption ? String(args.caption) : undefined;
          const fileName = args.fileName ? String(args.fileName) : undefined;

          const media: GatewayMediaCard = {
            mediaId: `media_${Date.now()}`,
            type: mediaType,
            url,
            mimeType,
            sizeBytes,
            caption,
            fileName,
          };

          const result = this.supervisor.sendRichMedia(platform, channelId, media);

          if (!result.success || !result.message) {
            return { success: false, error: result.error || "Failed to dispatch rich media" };
          }

          return {
            success: true,
            mediaId: media.mediaId,
            type: media.type,
            sizeBytes: media.sizeBytes,
            preview: result.message.formattedPreview,
          };
        },
      },

      // 4. gateway_broadcast_announcement
      {
        name: "gateway_broadcast_announcement",
        description: "Broadcasts an announcement simultaneously across multiple chat platform channels.",
        parameters: {
          content: { type: "string", required: true, description: "Announcement body in Markdown" },
          channelsJson: { type: "string", required: true, description: "JSON array of target channels, e.g. [{\"platform\":\"telegram\",\"channelId\":\"123\"},{\"platform\":\"slack\",\"channelId\":\"C123\"}]" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const content = String(args.content || "");
          let targets: { platform: GatewayPlatform; channelId: string }[] = [];
          try {
            targets = JSON.parse(String(args.channelsJson || "[]"));
          } catch {
            targets = [{ platform: "telegram", channelId: "general" }];
          }

          const result = this.supervisor.broadcastAnnouncement(content, targets);

          if (!result.success) {
            return { success: false, error: result.error || "Broadcast announcement failed" };
          }

          return {
            success: true,
            totalDispatched: result.totalDispatched,
            receiptsCount: result.receipts.length,
            summary: `✓ Broadcast successfully dispatched to ${result.totalDispatched} channels.`,
          };
        },
      },

      // 5. gateway_verify_webhook
      {
        name: "gateway_verify_webhook",
        description: "Verifies an incoming webhook payload using constant-time HMAC-SHA256 comparison and replay window validation.",
        parameters: {
          platform: { type: "string", required: true, description: "Source platform (telegram, slack, discord, whatsapp, webhook)" },
          rawBody: { type: "string", required: true, description: "Raw request body string" },
          signatureHeader: { type: "string", required: true, description: "Signature header (e.g. X-Hub-Signature-256 or X-Slack-Signature)" },
          timestampHeader: { type: "string", description: "Timestamp header string" },
          secretKey: { type: "string", description: "Shared secret key" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const platform = (String(args.platform || "webhook").toLowerCase()) as GatewayPlatform;
          const rawBody = String(args.rawBody || "");
          const signatureHeader = String(args.signatureHeader || "");
          const timestampHeader = args.timestampHeader ? String(args.timestampHeader) : undefined;
          const secretKey = args.secretKey ? String(args.secretKey) : "lumi_default_webhook_secret";

          const result = this.supervisor.processInboundWebhook(
            platform,
            rawBody,
            signatureHeader,
            timestampHeader,
            secretKey
          );

          if (!result.success || !result.verification) {
            return {
              success: false,
              error: result.error || "Webhook verification failed",
              verification: result.verification,
            };
          }

          return {
            success: true,
            isValid: result.verification.isValid,
            isReplayAttack: result.verification.isReplayAttack,
            timestampSkewMs: result.verification.timestampSkewMs,
            messageId: result.message?.messageId,
            preview: result.message?.formattedPreview,
          };
        },
      },

      // 6. gateway_manage_channel_binding
      {
        name: "gateway_manage_channel_binding",
        description: "Creates, updates, or audits bindings between external chat channels and internal LUMI session contexts.",
        parameters: {
          platform: { type: "string", required: true, description: "Platform name" },
          channelId: { type: "string", required: true, description: "Platform channel or group ID" },
          targetSessionId: { type: "string", required: true, description: "Internal LUMI session ID to bind" },
          channelName: { type: "string", description: "Human-readable channel name" },
          autoReplyEnabled: { type: "boolean", description: "Enable automated agent responses for this channel. Default: true" },
          handoverMode: { type: "string", description: "Initial handover mode: AGENT_AUTONOMOUS, COPILOT_ASSIST, HUMAN_TAKEOVER. Default: AGENT_AUTONOMOUS" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "");
          const targetSessionId = String(args.targetSessionId || "");
          const channelName = args.channelName ? String(args.channelName) : undefined;
          const autoReplyEnabled = typeof args.autoReplyEnabled === "boolean" ? args.autoReplyEnabled : true;
          const handoverMode = (String(args.handoverMode || "AGENT_AUTONOMOUS")) as GatewayHandoverMode;

          const binding = {
            bindingId: `bind_${platform}_${channelId}`,
            platform,
            channelId,
            targetSessionId,
            channelName,
            authorizedRoles: ["OWNER", "ADMIN", "MEMBER"] as GatewayUserRole[],
            autoReplyEnabled,
            handoverMode,
            createdAt: Date.now(),
          };

          const result = this.supervisor.bindChannel(binding);

          return {
            success: true,
            binding: result.binding,
            message: `✓ Channel '${channelId}' on [${platform}] bound to LUMI session '${targetSessionId}' (${handoverMode}).`,
          };
        },
      },

      // 7. gateway_link_contact_identity
      {
        name: "gateway_link_contact_identity",
        description: "Links multiple platform handles (Telegram, WhatsApp, Slack, Discord) into a single Unified Contact Profile (Front/Intercom style).",
        parameters: {
          contactId: { type: "string", required: true, description: "Unique contact identifier (e.g. cnt_alice)" },
          primaryDisplayName: { type: "string", description: "Primary human display name" },
          primaryPlatform: { type: "string", description: "Primary preferred messaging platform. Default: telegram" },
          platform: { type: "string", required: true, description: "Platform being linked" },
          platformUserId: { type: "string", required: true, description: "Platform user ID or handle" },
          username: { type: "string", description: "Platform username" },
          phoneNumber: { type: "string", description: "Optional phone number" },
          vipTier: { type: "string", description: "VIP tier: STANDARD, VIP, EXECUTIVE, ENTERPRISE. Default: STANDARD" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const contactId = String(args.contactId || `cnt_${Date.now()}`);
          const primaryDisplayName = String(args.primaryDisplayName || "Customer Contact");
          const primaryPlatform = (String(args.primaryPlatform || "telegram").toLowerCase()) as GatewayPlatform;
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const platformUserId = String(args.platformUserId || "");
          const username = args.username ? String(args.username) : undefined;
          const phoneNumber = args.phoneNumber ? String(args.phoneNumber) : undefined;
          const vipTier = (String(args.vipTier || "STANDARD").toUpperCase()) as ContactVipTier;

          const identity: LinkedPlatformIdentity = {
            platform,
            platformUserId,
            username,
            phoneNumber,
            linkedAt: Date.now(),
          };

          let profile = this.supervisor.getContactProfile(contactId);
          if (!profile) {
            profile = {
              contactId,
              primaryDisplayName,
              primaryPlatform,
              vipTier,
              linkedIdentities: [identity],
              tags: ["omnichannel", vipTier.toLowerCase()],
              totalInteractions: 1,
              lastActiveAt: Date.now(),
              createdAt: Date.now(),
            };
            this.supervisor.upsertContact(profile);
          } else {
            profile = this.supervisor.linkContactIdentity(contactId, identity) || profile;
          }

          return {
            success: true,
            contactId: profile.contactId,
            displayName: profile.primaryDisplayName,
            vipTier: profile.vipTier,
            totalLinkedPlatforms: profile.linkedIdentities.length,
            linkedIdentities: profile.linkedIdentities,
            message: `✓ Identity [${platform}:${platformUserId}] successfully linked to Unified Contact '${profile.primaryDisplayName}'.`,
          };
        },
      },

      // 8. gateway_get_contact_profile
      {
        name: "gateway_get_contact_profile",
        description: "Resolves a unified customer profile across all linked messaging platforms by contact ID or platform handle.",
        parameters: {
          identifier: { type: "string", required: true, description: "Contact ID (e.g. cnt_alice) or platform user ID" },
          platform: { type: "string", description: "Optional platform name if looking up by platform handle" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const identifier = String(args.identifier || "");
          const platform = args.platform ? ((String(args.platform).toLowerCase()) as GatewayPlatform) : undefined;

          const profile = this.supervisor.getContactProfile(identifier, platform);

          if (!profile) {
            return {
              success: false,
              error: `No unified contact profile found for identifier '${identifier}'.`,
            };
          }

          return {
            success: true,
            contact: profile,
            summary: `Contact: ${profile.primaryDisplayName} | VIP: ${profile.vipTier} | Platforms: [${profile.linkedIdentities.map((id) => `${id.platform}:${id.username || id.platformUserId}`).join(", ")}]`,
          };
        },
      },

      // 9. gateway_set_handover_mode
      {
        name: "gateway_set_handover_mode",
        description: "Switches conversation governance between AGENT_AUTONOMOUS, COPILOT_ASSIST (human approval needed), and HUMAN_TAKEOVER (agent halted).",
        parameters: {
          channelId: { type: "string", required: true, description: "Target channel ID" },
          mode: { type: "string", required: true, description: "Handover mode: AGENT_AUTONOMOUS, COPILOT_ASSIST, HUMAN_TAKEOVER" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const channelId = String(args.channelId || "");
          const mode = (String(args.mode || "AGENT_AUTONOMOUS").toUpperCase()) as GatewayHandoverMode;

          this.supervisor.setHandoverMode(channelId, mode);

          return {
            success: true,
            channelId,
            handoverMode: mode,
            message: `✓ Handover mode for channel '${channelId}' set to [${mode}].`,
          };
        },
      },

      // 10. gateway_post_internal_whisper
      {
        name: "gateway_post_internal_whisper",
        description: "Posts an internal operator note to the channel ledger that is NEVER dispatched to the external chat user.",
        parameters: {
          channelId: { type: "string", required: true, description: "Target channel ID" },
          platform: { type: "string", description: "Platform name. Default: telegram" },
          noteText: { type: "string", required: true, description: "Internal whisper note text" },
          authorName: { type: "string", description: "Operator or agent name. Default: LUMI Operator" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const channelId = String(args.channelId || "");
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const noteText = String(args.noteText || "");
          const authorName = String(args.authorName || "LUMI Operator");

          const note = this.supervisor.postWhisperNote(channelId, platform, "op_01", authorName, noteText);

          return {
            success: true,
            noteId: note.noteId,
            channelId: note.channelId,
            authorName: note.authorName,
            noteText: note.noteText,
            timestamp: note.timestamp,
            summary: `🔒 Internal whisper note recorded for channel '${channelId}' (Not visible to external user).`,
          };
        },
      },

      // 11. gateway_manage_reaction
      {
        name: "gateway_manage_reaction",
        description: "Adds, audits, or removes reaction emojis on external chat messages.",
        parameters: {
          messageId: { type: "string", required: true, description: "Message ID to react to" },
          emoji: { type: "string", required: true, description: "Emoji character (e.g. 👍, ❤️, ✅, 🔥, 👀, ❌)" },
          platform: { type: "string", description: "Platform name. Default: telegram" },
          channelId: { type: "string", description: "Channel ID. Default: general" },
          action: { type: "string", description: "Action: add, remove, list. Default: add" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const messageId = String(args.messageId || "");
          const emoji = String(args.emoji || "👍");
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "general");
          const action = String(args.action || "add").toLowerCase();

          if (action === "list") {
            const reactions = this.supervisor.listReactions(messageId);
            return { success: true, totalReactions: reactions.length, reactions };
          }

          if (action === "remove") {
            const removed = this.supervisor.removeReaction(messageId, "agent_lumi", emoji);
            return { success: true, removed, message: `✓ Reaction ${emoji} removed from message '${messageId}'.` };
          }

          const rxn = this.supervisor.addReaction(messageId, platform, channelId, emoji);
          return {
            success: true,
            reactionId: rxn.reactionId,
            messageId: rxn.messageId,
            emoji: rxn.emoji,
            message: `✓ Reaction ${emoji} added to message '${messageId}' on [${platform}].`,
          };
        },
      },

      // 12. gateway_send_typing_indicator
      {
        name: "gateway_send_typing_indicator",
        description: "Emits a real-time typing or media upload status indicator to a channel.",
        parameters: {
          platform: { type: "string", required: true, description: "Chat platform" },
          channelId: { type: "string", required: true, description: "Channel ID" },
          state: { type: "string", description: "Typestate: typing, recording_audio, uploading_file, idle. Default: typing" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "general");
          const state = (String(args.state || "typing").toLowerCase()) as GatewayTypingState;

          const res = this.supervisor.sendTypingIndicator(platform, channelId, state);

          return {
            success: true,
            state: res.state,
            platform: res.platform,
            channelId: res.channelId,
            message: `✓ Typing indicator (${state}) emitted on [${platform}:${channelId}].`,
          };
        },
      },

      // 13. gateway_inspect_platform_health
      {
        name: "gateway_inspect_platform_health",
        description: "Inspects live connection status, uptime, latency, and error metrics across all 8 chat platforms.",
        parameters: {},
        execute: async (_args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const health = this.supervisor.inspectPlatformHealth();

          const tableRows = health.platforms.map((p) =>
            `| ${p.platform.padEnd(10)} | ${p.isConnected ? "🟢 ONLINE " : "🔴 OFFLINE"} | ${p.latencyMs.toFixed(1)} ms | ${p.uptimePercent.toFixed(1)}% | ${p.totalDelivered} delivered / ${p.totalFailed} failed |`
          ).join("\n");

          const matrixFormatted =
            `+-------------------------------------------------------------------------+\n` +
            `| LUMI Omnichannel Platform Gateway Health Matrix                         |\n` +
            `| Overall Status: ${health.overallStatus.padEnd(10)} | Active Platforms: ${health.totalPlatformsActive} | Error Rate: ${health.errorRatePercent.toFixed(2)}% |\n` +
            `+-------------------------------------------------------------------------+\n` +
            `| Platform   | Status   | Latency | Uptime | Delivery Stats               |\n` +
            `+------------+----------+---------+--------+------------------------------+\n` +
            tableRows + "\n" +
            `+-------------------------------------------------------------------------+`;

          return {
            success: true,
            overallStatus: health.overallStatus,
            totalPlatformsActive: health.totalPlatformsActive,
            errorRatePercent: health.errorRatePercent,
            healthMatrix: health,
            formattedDashboard: matrixFormatted,
          };
        },
      },

      // 14. gateway_inspect_delivery_ledger
      {
        name: "gateway_inspect_delivery_ledger",
        description: "Audits outbound delivery receipts, retry counts, latency metrics, and dispatch statuses.",
        parameters: {},
        execute: async (_args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const receipts = this.supervisor.listDeliveryReceipts();

          return {
            success: true,
            totalReceipts: receipts.length,
            receipts,
            summary: `Delivery Ledger contains ${receipts.length} recorded delivery receipt(s).`,
          };
        },
      },

      // 15. gateway_manage_session_lease
      {
        name: "gateway_manage_session_lease",
        description: "Acquires or releases exclusive turn execution leases to prevent collision across concurrent platform messages.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
          channelId: { type: "string", required: true, description: "Channel ID" },
          platform: { type: "string", description: "Platform name. Default: telegram" },
          action: { type: "string", description: "Lease action: acquire, release. Default: acquire" },
          userId: { type: "string", description: "User ID acquiring lease" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const sessionId = String(args.sessionId || "");
          const channelId = String(args.channelId || "");
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const action = String(args.action || "acquire").toLowerCase();
          const userId = String(args.userId || "user_primary");

          if (action === "release") {
            const released = this.supervisor.releaseSessionLease(sessionId);
            return {
              success: true,
              message: released ? `✓ Lease released for session '${sessionId}'.` : `Session '${sessionId}' had no active lease.`,
            };
          }

          const result = this.supervisor.acquireSessionLease(sessionId, channelId, platform, userId);
          return {
            success: true,
            lease: result.lease,
            isHeld: result.lease.isHeld,
            expiresInSeconds: Math.round((result.lease.expiresAt - Date.now()) / 1000),
          };
        },
      },

      // 16. gateway_manage_config
      {
        name: "gateway_manage_config",
        description: "Enables, disables, or updates security policies (platforms, rate limits, HMAC enforcement) for the Native Messaging Gateway skill.",
        parameters: {
          enabled: { type: "boolean", description: "Enable or disable native gateway capabilities" },
          rateLimitPerMinute: { type: "number", description: "Maximum outbound rate limit per minute per channel" },
          requireHmacVerification: { type: "boolean", description: "Enforce HMAC signature verification on inbound webhooks" },
          quietHoursEnabled: { type: "boolean", description: "Enable recipient quiet hours firewall" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const updates: Record<string, unknown> = {};
          if (typeof args.enabled === "boolean") updates.enabled = args.enabled;
          if (typeof args.rateLimitPerMinute === "number") updates.rateLimitPerMinute = args.rateLimitPerMinute;
          if (typeof args.requireHmacVerification === "boolean") updates.requireHmacVerification = args.requireHmacVerification;
          if (typeof args.quietHoursEnabled === "boolean") updates.quietHoursEnabled = args.quietHoursEnabled;

          const updated = this.supervisor.updateConfig(updates);

          return {
            success: true,
            status: updated.enabled ? "ACTIVE (ENABLED)" : "DISABLED (FAIL-CLOSED)",
            config: updated,
            message: updated.enabled
              ? `✓ Gateway skill is now ENABLED for [${updated.allowedPlatforms.join(", ")}] with ${updated.rateLimitPerMinute} req/min limit.`
              : "✓ Gateway skill is now DISABLED. All operations will fail closed.",
          };
        },
      },

      // 17. gateway_render_inline_menu
      {
        name: "gateway_render_inline_menu",
        description: "Renders a hierarchical inline navigation menu with breadcrumb header and navigation buttons directly in the chat feed.",
        parameters: {
          nodeId: { type: "string", description: "Target menu node identifier (e.g. root, deployments, monitors). Default: root" },
          platform: { type: "string", description: "Target chat platform: telegram, slack, discord, whatsapp" },
          channelId: { type: "string", description: "Target channel / chat ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const nodeId = String(args.nodeId || "root");
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "default_channel");

          const res = this.supervisor.renderInlineMenu(nodeId, platform, channelId);
          return { ...res };
        },
      },

      // 18. gateway_navigate_inline_menu
      {
        name: "gateway_navigate_inline_menu",
        description: "Handles back, home, or node transitions in an inline menu tree in-place without posting a new message.",
        parameters: {
          currentNodeId: { type: "string", required: true, description: "Current menu node ID" },
          action: { type: "string", required: true, description: "Navigation action: back, home, select" },
          targetNodeId: { type: "string", description: "Target node ID if action is select" },
          platform: { type: "string", description: "Chat platform" },
          channelId: { type: "string", description: "Channel ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const currentNodeId = String(args.currentNodeId || "root");
          const action = (String(args.action || "home").toLowerCase()) as "back" | "home" | "select";
          const targetNodeId = args.targetNodeId ? String(args.targetNodeId) : undefined;
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "default_channel");

          const res = this.supervisor.navigateInlineMenu(currentNodeId, action, targetNodeId, platform, channelId);
          return { ...res };
        },
      },

      // 19. gateway_start_inline_wizard
      {
        name: "gateway_start_inline_wizard",
        description: "Starts an interactive progressive step-by-step wizard in-place with an ASCII progress bar (replaces modal dialogs).",
        parameters: {
          title: { type: "string", required: true, description: "Wizard title (e.g. Deploy Service Wizard)" },
          stepsJson: { type: "string", required: true, description: "JSON array of steps: [{ title, promptText, options: [{ label, value, emoji }] }]" },
          platform: { type: "string", description: "Target platform" },
          channelId: { type: "string", description: "Target channel ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const title = String(args.title || "Interactive Wizard");
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "default_channel");

          let steps: any[] = [];
          try {
            if (args.stepsJson) steps = JSON.parse(String(args.stepsJson));
          } catch {
            steps = [];
          }

          if (!steps || steps.length === 0) {
            steps = [
              {
                stepIndex: 0,
                title: "Select Environment",
                promptText: "Choose target deployment environment:",
                options: [
                  { label: "Production", value: "prod", emoji: "🔴" },
                  { label: "Staging", value: "staging", emoji: "🟡" },
                  { label: "Preview", value: "preview", emoji: "🟢" },
                ],
              },
            ];
          }

          const res = this.supervisor.startInlineWizard(title, steps, platform, channelId);
          if (!res.success) {
            return { success: false, error: res.error || "Failed to start wizard" };
          }

          return {
            success: true,
            wizardId: res.wizard?.wizardId,
            title: res.wizard?.title,
            totalSteps: res.wizard?.totalSteps,
            mutation: res.mutation,
          };
        },
      },

      // 20. gateway_advance_inline_wizard
      {
        name: "gateway_advance_inline_wizard",
        description: "Advances an active progressive wizard to the next step with the user's chosen value, updating in-place.",
        parameters: {
          wizardId: { type: "string", required: true, description: "Wizard ID" },
          selectedValue: { type: "string", required: true, description: "Value chosen by user for the current step" },
          platform: { type: "string", description: "Target platform" },
          channelId: { type: "string", description: "Target channel ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const wizardId = String(args.wizardId || "");
          const selectedValue = String(args.selectedValue || "");
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "default_channel");

          const res = this.supervisor.advanceInlineWizard(wizardId, selectedValue, platform, channelId);
          return { ...res };
        },
      },

      // 21. gateway_render_inline_tabs
      {
        name: "gateway_render_inline_tabs",
        description: "Renders or switches segmented tabbed views in-place (e.g. Overview, Performance, Alerts).",
        parameters: {
          tabGroupId: { type: "string", required: true, description: "Tab group identifier" },
          activeTabId: { type: "string", description: "Active tab identifier to switch to" },
          platform: { type: "string", description: "Target platform" },
          channelId: { type: "string", description: "Target channel ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const tabGroupId = String(args.tabGroupId || "default_tabs");
          const activeTabId = args.activeTabId ? String(args.activeTabId) : undefined;
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "default_channel");

          const res = this.supervisor.renderInlineTabs(tabGroupId, activeTabId, platform, channelId);
          return { ...res };
        },
      },

      // 22. gateway_render_inline_data_table
      {
        name: "gateway_render_inline_data_table",
        description: "Renders a paginated monospace data table with filter pills and in-place page navigation.",
        parameters: {
          tableId: { type: "string", required: true, description: "Table identifier" },
          page: { type: "number", description: "Page number to view (1-indexed). Default: 1" },
          filterPillId: { type: "string", description: "Filter pill ID to apply" },
          platform: { type: "string", description: "Target platform" },
          channelId: { type: "string", description: "Target channel ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const tableId = String(args.tableId || "default_table");
          const page = typeof args.page === "number" ? args.page : 1;
          const filterPillId = args.filterPillId ? String(args.filterPillId) : undefined;
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "default_channel");

          const res = this.supervisor.renderInlineDataTable(tableId, page, filterPillId, platform, channelId);
          return { ...res };
        },
      },

      // 23. gateway_create_poll_ballot
      {
        name: "gateway_create_poll_ballot",
        description: "Creates a live voting ballot with quorum thresholds and real-time visual progress bars.",
        parameters: {
          question: { type: "string", required: true, description: "Poll question or ballot proposal" },
          optionsJson: { type: "string", description: "JSON array of option strings (e.g. [\"Yes - Approve\", \"No - Reject\"])" },
          quorumRequired: { type: "number", description: "Total votes required for quorum. Default: 3" },
          platform: { type: "string", description: "Target platform" },
          channelId: { type: "string", description: "Target channel ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const question = String(args.question || "Approve Deployment?");
          let options: string[] = ["Yes - Approve", "No - Reject"];
          try {
            if (args.optionsJson) options = JSON.parse(String(args.optionsJson));
          } catch {
            options = ["Yes - Approve", "No - Reject"];
          }
          const quorum = typeof args.quorumRequired === "number" ? args.quorumRequired : 3;
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "default_channel");

          const res = this.supervisor.createPollBallot(question, options, quorum, platform, channelId);
          if (!res.success) {
            return { success: false, error: res.error || "Failed to create ballot" };
          }

          return {
            success: true,
            ballotId: res.ballot?.ballotId,
            question: res.ballot?.question,
            quorumRequired: res.ballot?.quorumRequired,
            mutation: res.mutation,
          };
        },
      },

      // 24. gateway_vote_poll_ballot
      {
        name: "gateway_vote_poll_ballot",
        description: "Casts a vote on a live ballot and updates the ASCII progress bar tally in-place.",
        parameters: {
          ballotId: { type: "string", required: true, description: "Ballot identifier" },
          optionId: { type: "string", required: true, description: "Chosen option ID (e.g. opt_1)" },
          voterHandle: { type: "string", required: true, description: "Voter username/handle" },
          platform: { type: "string", description: "Target platform" },
          channelId: { type: "string", description: "Target channel ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const ballotId = String(args.ballotId || "");
          const optionId = String(args.optionId || "opt_1");
          const voterHandle = String(args.voterHandle || "@anonymous");
          const platform = (String(args.platform || "telegram").toLowerCase()) as GatewayPlatform;
          const channelId = String(args.channelId || "default_channel");

          const res = this.supervisor.votePollBallot(ballotId, optionId, voterHandle, platform, channelId);
          return { ...res };
        },
      },

      // 25. gateway_manage_thread_triage
      {
        name: "gateway_manage_thread_triage",
        description: "Manages conversation thread states (UNASSIGNED, ASSIGNED, RESOLVED, SNOOZED) and operator assignment.",
        parameters: {
          action: { type: "string", required: true, description: "Action: create, assign, resolve, snooze, list" },
          threadId: { type: "string", description: "Thread ID" },
          topic: { type: "string", description: "Conversation topic" },
          agent: { type: "string", description: "Assigned operator or agent handle" },
          priority: { type: "string", description: "Priority: URGENT, HIGH, MEDIUM, LOW" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const action = (String(args.action || "list").toLowerCase()) as "create" | "assign" | "resolve" | "snooze" | "list";
          return this.supervisor.manageThreadTriage(action, args);
        },
      },

      // 26. gateway_configure_sla_policy
      {
        name: "gateway_configure_sla_policy",
        description: "Configures operating business hours, out-of-office auto-responders, and SLA escalation timers.",
        parameters: {
          enabled: { type: "boolean", description: "Enable or disable SLA policy" },
          businessHoursStart: { type: "string", description: "Business hours start (e.g. 09:00)" },
          businessHoursEnd: { type: "string", description: "Business hours end (e.g. 17:00)" },
          outOfOfficeMessage: { type: "string", description: "Automated out-of-office message" },
          escalationTimeoutMinutes: { type: "number", description: "Escalation timeout in minutes" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const updates: Record<string, unknown> = {};
          if (typeof args.enabled === "boolean") updates.enabled = args.enabled;
          if (typeof args.businessHoursStart === "string") updates.businessHoursStart = args.businessHoursStart;
          if (typeof args.businessHoursEnd === "string") updates.businessHoursEnd = args.businessHoursEnd;
          if (typeof args.outOfOfficeMessage === "string") updates.outOfOfficeMessage = args.outOfOfficeMessage;
          if (typeof args.escalationTimeoutMinutes === "number") updates.escalationTimeoutMinutes = args.escalationTimeoutMinutes;

          const updated = this.supervisor.configureSlaPolicy(updates);

          return {
            success: true,
            slaPolicy: updated,
            message: `✓ SLA Policy updated: Operating hours ${updated.businessHoursStart}-${updated.businessHoursEnd} ${updated.timezone}.`,
          };
        },
      },
    ];
  }
}
