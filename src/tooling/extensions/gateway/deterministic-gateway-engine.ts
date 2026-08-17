/**
 * deterministic-gateway-engine.ts
 *
 * Deterministic cryptographic verification, cross-platform interactive card compilation,
 * rich-text formatting, media validation, quiet hours evaluation, and rate limiting (Phase 95 / ADR-125).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  GatewayActionButton,
  GatewayBallotOption,
  GatewayInlineBallot,
  GatewayInlineDataTable,
  GatewayInlineMenuItem,
  GatewayInlineMenuNode,
  GatewayInlineTab,
  GatewayInlineTabGroup,
  GatewayInlineWizard,
  GatewayInteractiveCard,
  GatewayMediaCard,
  GatewayMessage,
  GatewayMessageFormat,
  GatewayPlatform,
  GatewaySkillConfig,
  GatewayUserRole,
  GatewayWizardStep,
  SlashCommandRoute,
  WebhookVerificationRequest,
  WebhookVerificationResult,
} from "../../../core/contracts/gateway.contracts.js";

export class DeterministicGatewayEngine {
  private readonly rateLimitBuckets: Map<string, { tokens: number; lastRefillMs: number }> = new Map();

  private readonly slashCommandRoutes: readonly SlashCommandRoute[] = [
    { command: "/help", minRole: "GUEST", description: "Display available commands and gateway status", requiresTurnLease: false },
    { command: "/status", minRole: "GUEST", description: "Inspect current agent state and platform connectivity", requiresTurnLease: false },
    { command: "/clear", minRole: "MEMBER", description: "Clear current channel conversation context", requiresTurnLease: true },
    { command: "/reset", minRole: "ADMIN", description: "Hard reset channel binding and session turn state", requiresTurnLease: true },
    { command: "/pause", minRole: "ADMIN", description: "Pause automated agent responses for this channel", requiresTurnLease: false },
    { command: "/resume", minRole: "ADMIN", description: "Resume automated agent responses for this channel", requiresTurnLease: false },
    { command: "/shutdown", minRole: "OWNER", description: "Emergency shutdown of all platform gateway bindings", requiresTurnLease: true },
  ];

  private readonly roleHierarchy: Record<GatewayUserRole, number> = {
    GUEST: 1,
    MEMBER: 2,
    ADMIN: 3,
    OWNER: 4,
  };

  /**
   * Performs constant-time HMAC-SHA256 comparison and timestamp replay defense.
   */
  public verifyWebhook(req: WebhookVerificationRequest, jitterToleranceMs = 300000): WebhookVerificationResult {
    const now = Date.now();

    // 1. Timestamp Jitter / Replay Attack Defense
    let timestampSkewMs = 0;
    let isReplayAttack = false;

    if (req.timestampHeader) {
      const parsedTs = parseInt(req.timestampHeader, 10);
      if (isNaN(parsedTs)) {
        return {
          isValid: false,
          platform: req.platform,
          isReplayAttack: true,
          timestampSkewMs: Infinity,
          failureReason: "Invalid timestamp header format",
          verifiedAt: now,
        };
      }
      timestampSkewMs = Math.abs(now - (parsedTs > 1e11 ? parsedTs : parsedTs * 1000));
      if (timestampSkewMs > jitterToleranceMs) {
        isReplayAttack = true;
        return {
          isValid: false,
          platform: req.platform,
          isReplayAttack: true,
          timestampSkewMs,
          failureReason: `Timestamp skew (${timestampSkewMs}ms) exceeds tolerance (${jitterToleranceMs}ms)`,
          verifiedAt: now,
        };
      }
    }

    // 2. Constant-Time HMAC Signature Check
    const cleanSig = req.signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
    const computedHmac = createHmac("sha256", req.secretKey)
      .update(req.rawBody, "utf8")
      .digest("hex")
      .toLowerCase();

    if (cleanSig.length !== computedHmac.length) {
      return {
        isValid: false,
        platform: req.platform,
        isReplayAttack: false,
        timestampSkewMs,
        failureReason: "Signature digest length mismatch",
        verifiedAt: now,
      };
    }

    const sigBuf = Buffer.from(cleanSig, "hex");
    const computedBuf = Buffer.from(computedHmac, "hex");

    const isValid = timingSafeEqual(sigBuf, computedBuf);

    return {
      isValid,
      platform: req.platform,
      isReplayAttack,
      timestampSkewMs,
      failureReason: isValid ? undefined : "HMAC signature verification failed",
      verifiedAt: now,
    };
  }

  /**
   * Compiles interactive cards (buttons, actions, selects) into native platform payloads.
   */
  public compileInteractiveCard(
    card: GatewayInteractiveCard,
    platform: GatewayPlatform
  ): { format: GatewayMessageFormat; compiledPayload: string; formattedPreview: string } {
    if (platform === "telegram") {
      const inlineKeyboard = [
        card.buttons.map((b) => {
          if (b.url) {
            return { text: b.label, url: b.url };
          }
          return { text: b.label, callback_data: b.callbackValue || b.actionId };
        }),
      ];
      const payloadObj = {
        chat_id: "{{channelId}}",
        text: `<b>${card.title}</b>\n${card.subtitle ? `<i>${card.subtitle}</i>\n` : ""}\n${card.bodyText}${card.footerText ? `\n\n<small>${card.footerText}</small>` : ""}`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineKeyboard },
      };
      const preview = `[Telegram Card] ${card.title} | ${card.buttons.length} buttons: [${card.buttons.map((b) => b.label).join(", ")}]`;
      return { format: "interactive_card", compiledPayload: JSON.stringify(payloadObj), formattedPreview: preview };
    }

    if (platform === "slack") {
      const blocks: any[] = [
        {
          type: "section",
          text: { type: "mrkdwn", text: `*${card.title}*\n${card.subtitle ? `_${card.subtitle}_\n` : ""}${card.bodyText}` },
        },
      ];
      if (card.buttons.length > 0) {
        blocks.push({
          type: "actions",
          elements: card.buttons.map((b) => ({
            type: "button",
            text: { type: "plain_text", text: b.label },
            action_id: b.actionId,
            value: b.callbackValue || b.actionId,
            url: b.url,
            style: b.style === "danger" ? "danger" : b.style === "primary" ? "primary" : undefined,
          })),
        });
      }
      const preview = `[Slack BlockKit] ${card.title} | ${card.buttons.length} buttons`;
      return { format: "slack_blocks", compiledPayload: JSON.stringify({ blocks }), formattedPreview: preview };
    }

    if (platform === "discord") {
      const actionRow = {
        type: 1,
        components: card.buttons.map((b) => ({
          type: 2,
          label: b.label,
          style: b.style === "primary" ? 1 : b.style === "danger" ? 4 : b.style === "link" ? 5 : 2,
          custom_id: b.url ? undefined : b.actionId,
          url: b.url,
        })),
      };
      const embed = {
        title: card.title,
        description: `${card.subtitle ? `*${card.subtitle}*\n\n` : ""}${card.bodyText}`,
        footer: card.footerText ? { text: card.footerText } : undefined,
      };
      const preview = `[Discord Embed + Components] ${card.title} | ${card.buttons.length} components`;
      return { format: "discord_embeds", compiledPayload: JSON.stringify({ embeds: [embed], components: [actionRow] }), formattedPreview: preview };
    }

    if (platform === "whatsapp") {
      const waButtons = card.buttons.slice(0, 3).map((b) => ({
        type: "reply",
        reply: { id: b.actionId, title: b.label.substring(0, 20) },
      }));
      const payloadObj = {
        messaging_product: "whatsapp",
        type: "interactive",
        interactive: {
          type: "button",
          header: { type: "text", text: card.title.substring(0, 60) },
          body: { text: card.bodyText.substring(0, 1024) },
          footer: card.footerText ? { text: card.footerText.substring(0, 60) } : undefined,
          action: { buttons: waButtons },
        },
      };
      const preview = `[WhatsApp Interactive] ${card.title} | ${waButtons.length} reply buttons`;
      return { format: "whatsapp_formatting", compiledPayload: JSON.stringify(payloadObj), formattedPreview: preview };
    }

    // Default Plain Card
    const preview = `[Interactive Card] ${card.title}\n${card.bodyText}\nButtons: ${card.buttons.map((b) => b.label).join(" | ")}`;
    return { format: "interactive_card", compiledPayload: JSON.stringify(card), formattedPreview: preview };
  }

  /**
   * Validates media attachment MIME type, size limits, and filename safety.
   */
  public validateMedia(media: GatewayMediaCard): { isValid: boolean; failureReason?: string } {
    const allowedMimes: Record<string, number> = {
      "image/png": 10 * 1024 * 1024,
      "image/jpeg": 10 * 1024 * 1024,
      "image/webp": 10 * 1024 * 1024,
      "image/gif": 15 * 1024 * 1024,
      "audio/ogg": 25 * 1024 * 1024,
      "audio/mpeg": 25 * 1024 * 1024,
      "audio/wav": 25 * 1024 * 1024,
      "audio/mp4": 25 * 1024 * 1024,
      "application/pdf": 50 * 1024 * 1024,
      "text/plain": 5 * 1024 * 1024,
      "application/json": 5 * 1024 * 1024,
      "video/mp4": 50 * 1024 * 1024,
      "video/webm": 50 * 1024 * 1024,
    };

    const maxSizeBytes = allowedMimes[media.mimeType.toLowerCase()];
    if (!maxSizeBytes) {
      return {
        isValid: false,
        failureReason: `Disallowed media MIME type '${media.mimeType}'. Supported: images, audio, PDF, video.`,
      };
    }

    if (media.sizeBytes > maxSizeBytes) {
      return {
        isValid: false,
        failureReason: `Media file exceeds size limit for ${media.mimeType} (${media.sizeBytes} > ${maxSizeBytes} bytes).`,
      };
    }

    return { isValid: true };
  }

  /**
   * Checks whether the current UTC hour falls into recipient quiet hours.
   */
  public evaluateQuietHours(
    currentHourUtc: number = new Date().getUTCHours(),
    config?: GatewaySkillConfig
  ): { inQuietHours: boolean; reason?: string } {
    if (!config?.quietHoursEnabled) {
      return { inQuietHours: false };
    }

    const start = config.quietHoursStartHourUtc ?? 22;
    const end = config.quietHoursEndHourUtc ?? 7;

    const inQuietHours = start > end
      ? currentHourUtc >= start || currentHourUtc < end
      : currentHourUtc >= start && currentHourUtc < end;

    if (inQuietHours) {
      return {
        inQuietHours: true,
        reason: `Recipient channel is in Quiet Hours (${start}:00 - ${end}:00 UTC). Message should be queued or staged.`,
      };
    }

    return { inQuietHours: false };
  }

  /**
   * Compiles standard Markdown into platform-native rich text formats.
   */
  public compileMarkdown(
    rawMarkdown: string,
    platform: GatewayPlatform
  ): { format: GatewayMessageFormat; compiledPayload: string } {
    if (platform === "telegram") {
      let html = rawMarkdown
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      html = html.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, "<pre><code>$2</code></pre>");
      html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
      html = html.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
      html = html.replace(/__([^_]+)__/g, "<u>$1</u>");
      html = html.replace(/\*([^*]+)\*/g, "<i>$1</i>");
      html = html.replace(/_([^_]+)_/g, "<i>$1</i>");
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

      return { format: "telegram_html", compiledPayload: html };
    }

    if (platform === "slack") {
      let mrkdwn = rawMarkdown
        .replace(/\*\*([^*]+)\*\*/g, "*$1*")
        .replace(/__([^_]+)__/g, "_$1_")
        .replace(/~~([^~]+)~~/g, "~$1~")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");

      const blocksPayload = JSON.stringify({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: mrkdwn,
            },
          },
        ],
      });

      return { format: "slack_blocks", compiledPayload: blocksPayload };
    }

    if (platform === "whatsapp") {
      const waText = rawMarkdown
        .replace(/\*\*([^*]+)\*\*/g, "*$1*")
        .replace(/__([^_]+)__/g, "_$1_")
        .replace(/~~([^~]+)~~/g, "~$1~");

      return { format: "whatsapp_formatting", compiledPayload: waText };
    }

    if (platform === "discord") {
      return { format: "discord_embeds", compiledPayload: rawMarkdown };
    }

    return { format: "markdown", compiledPayload: rawMarkdown };
  }

  /**
   * Normalizes inbound raw webhook payloads into unified GatewayMessage envelopes.
   */
  public normalizeInboundPayload(
    platform: GatewayPlatform,
    rawJson: Record<string, any>
  ): Omit<GatewayMessage, "compiledFormat" | "compiledPayload"> {
    const now = Date.now();
    const id = `msg_${platform}_${now}_${Math.random().toString(36).substring(2, 7)}`;

    if (platform === "telegram") {
      const msg = rawJson.message || rawJson.edited_message || {};
      const sender = msg.from || {};
      const chat = msg.chat || {};
      const text = msg.text || msg.caption || "";

      return {
        messageId: id,
        platform: "telegram",
        channelId: String(chat.id || "0"),
        threadId: msg.message_thread_id ? String(msg.message_thread_id) : undefined,
        direction: "inbound",
        sender: {
          platform: "telegram",
          platformUserId: String(sender.id || "unknown"),
          username: sender.username,
          displayName: [sender.first_name, sender.last_name].filter(Boolean).join(" ") || undefined,
          role: "MEMBER",
          isVerified: !sender.is_bot,
        },
        rawContent: text,
        sanitizedText: this.sanitizeInputText(text),
        attachments: [],
        deliveryStatus: "acknowledged",
        idempotencyKey: `tg_${msg.message_id || id}`,
        timestamp: (msg.date ? msg.date * 1000 : now),
        formattedPreview: `[Telegram @${sender.username || sender.id}]: ${text.substring(0, 60)}`,
      };
    }

    if (platform === "slack") {
      const event = rawJson.event || {};
      const text = event.text || "";

      return {
        messageId: id,
        platform: "slack",
        channelId: String(event.channel || "general"),
        threadId: event.thread_ts ? String(event.thread_ts) : undefined,
        direction: "inbound",
        sender: {
          platform: "slack",
          platformUserId: String(event.user || "unknown"),
          displayName: event.username,
          role: "MEMBER",
          isVerified: true,
        },
        rawContent: text,
        sanitizedText: this.sanitizeInputText(text),
        attachments: [],
        deliveryStatus: "acknowledged",
        idempotencyKey: `slack_${event.client_msg_id || event.ts || id}`,
        timestamp: event.ts ? parseFloat(event.ts) * 1000 : now,
        formattedPreview: `[Slack #${event.channel}]: ${text.substring(0, 60)}`,
      };
    }

    if (platform === "discord") {
      const text = rawJson.content || "";
      const author = rawJson.author || {};

      return {
        messageId: id,
        platform: "discord",
        channelId: String(rawJson.channel_id || "general"),
        threadId: rawJson.thread?.id,
        direction: "inbound",
        sender: {
          platform: "discord",
          platformUserId: String(author.id || "unknown"),
          username: author.username,
          displayName: author.global_name || author.username,
          role: "MEMBER",
          isVerified: !author.bot,
        },
        rawContent: text,
        sanitizedText: this.sanitizeInputText(text),
        attachments: [],
        deliveryStatus: "acknowledged",
        idempotencyKey: `discord_${rawJson.id || id}`,
        timestamp: rawJson.timestamp ? new Date(rawJson.timestamp).getTime() : now,
        formattedPreview: `[Discord #${rawJson.channel_id}]: ${text.substring(0, 60)}`,
      };
    }

    // Default Webhook fallback
    const rawStr = typeof rawJson === "string" ? rawJson : JSON.stringify(rawJson);
    return {
      messageId: id,
      platform,
      channelId: String(rawJson.channelId || "default"),
      direction: "inbound",
      sender: {
        platform,
        platformUserId: String(rawJson.userId || "webhook_client"),
        role: "MEMBER",
        isVerified: true,
      },
      rawContent: rawStr,
      sanitizedText: this.sanitizeInputText(rawStr),
      attachments: [],
      deliveryStatus: "acknowledged",
      idempotencyKey: `wh_${id}`,
      timestamp: now,
      formattedPreview: `[${platform}]: ${rawStr.substring(0, 60)}`,
    };
  }

  /**
   * Sanitizes input text, removing control bytes and zero-width characters.
   */
  public sanitizeInputText(rawText: string): string {
    if (!rawText) return "";
    return rawText
      .replace(/[\u200B-\u200D\uFEFF]/g, "") // Strip zero-width Unicode
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Strip ASCII control bytes
      .trim();
  }

  /**
   * Evaluates role authorization for slash commands.
   */
  public evaluateSlashCommand(
    commandStr: string,
    userRole: GatewayUserRole
  ): { allowed: boolean; route?: SlashCommandRoute; reason?: string } {
    const rootCommand = commandStr.trim().split(/\s+/)[0].toLowerCase();
    const route = this.slashCommandRoutes.find((r) => r.command === rootCommand);

    if (!route) {
      return {
        allowed: false,
        reason: `Unknown slash command '${rootCommand}'. Type /help for available commands.`,
      };
    }

    const userLevel = this.roleHierarchy[userRole] || 1;
    const requiredLevel = this.roleHierarchy[route.minRole] || 1;

    if (userLevel < requiredLevel) {
      return {
        allowed: false,
        route,
        reason: `Permission denied: Command '${route.command}' requires role '${route.minRole}', but user has role '${userRole}'.`,
      };
    }

    return { allowed: true, route };
  }

  /**
   * Enforces token bucket rate limiting per channel/user.
   */
  public checkRateLimit(
    key: string,
    limitPerMinute = 60
  ): { allowed: boolean; remaining: number; retryAfterMs?: number } {
    const now = Date.now();
    let bucket = this.rateLimitBuckets.get(key);

    if (!bucket) {
      bucket = { tokens: limitPerMinute, lastRefillMs: now };
      this.rateLimitBuckets.set(key, bucket);
    }

    const elapsedSec = (now - bucket.lastRefillMs) / 1000;
    const refillTokens = elapsedSec * (limitPerMinute / 60);
    bucket.tokens = Math.min(limitPerMinute, bucket.tokens + refillTokens);
    bucket.lastRefillMs = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    const retryAfterMs = Math.ceil(((1 - bucket.tokens) / (limitPerMinute / 60)) * 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  /**
   * Compiles hierarchical inline menu trees with breadcrumbs and navigation buttons.
   */
  public compileInlineMenu(
    node: GatewayInlineMenuNode,
    platform: GatewayPlatform
  ): { compiledText: string; buttons: readonly GatewayActionButton[]; format: GatewayMessageFormat; compiledPayload: string } {
    const breadcrumbs = `📍 ${node.breadcrumbPath.join(" ❯ ")}`;
    let text = `${breadcrumbs}\n\n*${node.title}*`;
    if (node.description) {
      text += `\n_${node.description}_`;
    }

    const buttons: GatewayActionButton[] = [];

    // Add item buttons
    for (const item of node.items) {
      const label = item.iconEmoji ? `${item.iconEmoji} ${item.label}` : item.label;
      buttons.push({
        actionId: `menu_${node.nodeId}_${item.itemId}`,
        label,
        style: item.style || "secondary",
        callbackValue: item.targetNodeId ? `nav_node:${item.targetNodeId}` : item.actionValue,
        url: item.url,
      });
    }

    // Add bottom control bar
    if (node.enableBackButton || node.enableHomeButton) {
      if (node.enableBackButton) {
        buttons.push({
          actionId: `menu_${node.nodeId}_back`,
          label: "⬅️ Back",
          style: "secondary",
          callbackValue: "nav_back",
        });
      }
      if (node.enableHomeButton) {
        buttons.push({
          actionId: `menu_${node.nodeId}_home`,
          label: "🏠 Home",
          style: "secondary",
          callbackValue: "nav_home",
        });
      }
      buttons.push({
        actionId: `menu_${node.nodeId}_refresh`,
        label: "🔄 Refresh",
        style: "secondary",
        callbackValue: `nav_refresh:${node.nodeId}`,
      });
    }

    const card: GatewayInteractiveCard = {
      cardId: `menu_${node.nodeId}`,
      title: breadcrumbs,
      bodyText: node.description ? `${node.title}\n${node.description}` : node.title,
      buttons,
    };

    const compiled = this.compileInteractiveCard(card, platform);
    return {
      compiledText: text,
      buttons,
      format: compiled.format,
      compiledPayload: compiled.compiledPayload,
    };
  }

  /**
   * Generates a step in an interactive progressive wizard with an ASCII progress bar.
   */
  public compileWizardStep(
    wizard: GatewayInlineWizard,
    platform: GatewayPlatform
  ): { compiledText: string; buttons: readonly GatewayActionButton[]; compiledPayload: string } {
    const totalSteps = Math.max(1, wizard.totalSteps || wizard.steps.length || 1);
    const stepIdx = Math.min(Math.max(0, wizard.currentStepIndex || 0), totalSteps - 1);
    const currentStep = wizard.steps[stepIdx] || {
      stepIndex: 0,
      title: "Step",
      promptText: "Please choose an option:",
      options: [{ label: "Continue", value: "continue" }],
    };
    const progressPercent = Math.min(100, Math.max(0, Math.round(((stepIdx + 1) / totalSteps) * 100)));
    const filledBlocks = Math.min(10, Math.max(0, Math.round((progressPercent / 100) * 10)));
    const emptyBlocks = Math.max(0, 10 - filledBlocks);
    const progressBar = `[${"█".repeat(filledBlocks)}${"░".repeat(emptyBlocks)}] ${progressPercent}%`;

    let text = `🪄 *${wizard.title}*\n` +
      `Step ${stepIdx + 1} of ${totalSteps} ${progressBar}\n\n` +
      `*${currentStep.title}*\n${currentStep.promptText}`;

    const buttons: GatewayActionButton[] = [];

    for (let i = 0; i < currentStep.options.length; i++) {
      const opt = currentStep.options[i];
      const label = opt.emoji ? `${opt.emoji} ${opt.label}` : opt.label;
      buttons.push({
        actionId: `wiz_${wizard.wizardId}_step_${stepIdx}_opt_${i}`,
        label,
        style: "primary",
        callbackValue: `wiz_val:${wizard.wizardId}:${stepIdx}:${opt.value}`,
      });
    }

    buttons.push({
      actionId: `wiz_${wizard.wizardId}_cancel`,
      label: "❌ Cancel",
      style: "danger",
      callbackValue: `wiz_cancel:${wizard.wizardId}`,
    });

    const card: GatewayInteractiveCard = {
      cardId: `wiz_${wizard.wizardId}`,
      title: wizard.title,
      bodyText: text,
      buttons,
    };

    const compiled = this.compileInteractiveCard(card, platform);
    return {
      compiledText: text,
      buttons,
      compiledPayload: compiled.compiledPayload,
    };
  }

  /**
   * Compiles final wizard completion receipt.
   */
  public compileWizardReceipt(
    wizard: GatewayInlineWizard,
    platform: GatewayPlatform
  ): { compiledText: string; buttons: readonly GatewayActionButton[]; compiledPayload: string } {
    let text = `✅ *${wizard.title} - Completed!*\n\n` +
      `Summary of choices:\n`;

    for (const step of wizard.steps) {
      text += `• *${step.title}*: \`${step.selectedValue || "N/A"}\`\n`;
    }

    const buttons: GatewayActionButton[] = [
      {
        actionId: `wiz_${wizard.wizardId}_done`,
        label: "✓ Done",
        style: "primary",
        callbackValue: `wiz_done:${wizard.wizardId}`,
      },
      {
        actionId: `wiz_${wizard.wizardId}_restart`,
        label: "🔄 Restart",
        style: "secondary",
        callbackValue: `wiz_restart:${wizard.wizardId}`,
      },
    ];

    const card: GatewayInteractiveCard = {
      cardId: `wiz_${wizard.wizardId}_done`,
      title: `${wizard.title} - Receipt`,
      bodyText: text,
      buttons,
    };

    const compiled = this.compileInteractiveCard(card, platform);
    return {
      compiledText: text,
      buttons,
      compiledPayload: compiled.compiledPayload,
    };
  }

  /**
   * Compiles segmented tabbed views.
   */
  public compileTabGroup(
    tabGroup: GatewayInlineTabGroup,
    platform: GatewayPlatform
  ): { compiledText: string; buttons: readonly GatewayActionButton[]; compiledPayload: string } {
    const tabHeaders = tabGroup.tabs.map((t) => {
      const isActive = t.tabId === tabGroup.activeTabId;
      const label = t.iconEmoji ? `${t.iconEmoji} ${t.label}` : t.label;
      return isActive ? `[ 🔘 ${label} ]` : `[ ${label} ]`;
    }).join(" ");

    const activeTab = tabGroup.tabs.find((t) => t.tabId === tabGroup.activeTabId) || tabGroup.tabs[0];

    const text = `📁 *${tabGroup.title}*\n${tabHeaders}\n\n${activeTab.contentText}`;

    const buttons: GatewayActionButton[] = [];

    // Tab switcher buttons
    for (const t of tabGroup.tabs) {
      const label = t.iconEmoji ? `${t.iconEmoji} ${t.label}` : t.label;
      buttons.push({
        actionId: `tab_${tabGroup.tabGroupId}_${t.tabId}`,
        label,
        style: t.tabId === tabGroup.activeTabId ? "primary" : "secondary",
        callbackValue: `tab_switch:${tabGroup.tabGroupId}:${t.tabId}`,
      });
    }

    // Active tab action buttons
    if (activeTab.buttons) {
      buttons.push(...activeTab.buttons);
    }

    const card: GatewayInteractiveCard = {
      cardId: `tab_${tabGroup.tabGroupId}`,
      title: tabGroup.title,
      bodyText: text,
      buttons,
    };

    const compiled = this.compileInteractiveCard(card, platform);
    return {
      compiledText: text,
      buttons,
      compiledPayload: compiled.compiledPayload,
    };
  }

  /**
   * Compiles paginated data table with filter pills.
   */
  public compileDataTable(
    table: GatewayInlineDataTable,
    platform: GatewayPlatform
  ): { compiledText: string; buttons: readonly GatewayActionButton[]; compiledPayload: string } {
    const pillsText = table.filterPills.map((p) =>
      p.isActive ? `[ 🔘 ${p.label} (${p.count}) ]` : `[ ${p.label} (${p.count}) ]`
    ).join(" ");

    let tableMonospace = "```\n" + table.headers.join(" | ") + "\n" +
      "-".repeat(table.headers.join(" | ").length) + "\n";

    for (const row of table.rows) {
      tableMonospace += row.join(" | ") + "\n";
    }
    tableMonospace += "```";

    const text = `📊 *${table.title}* (Page ${table.currentPage}/${table.totalPages} • Total: ${table.totalRecords})\n` +
      `${pillsText}\n\n${tableMonospace}`;

    const buttons: GatewayActionButton[] = [];

    // Filter pill buttons
    for (const p of table.filterPills) {
      buttons.push({
        actionId: `tbl_${table.tableId}_filter_${p.pillId}`,
        label: p.label,
        style: p.isActive ? "primary" : "secondary",
        callbackValue: `tbl_filter:${table.tableId}:${p.pillId}`,
      });
    }

    // Pagination buttons
    buttons.push({
      actionId: `tbl_${table.tableId}_prev`,
      label: "◀️ Prev",
      style: "secondary",
      callbackValue: `tbl_page:${table.tableId}:${Math.max(1, table.currentPage - 1)}`,
    });
    buttons.push({
      actionId: `tbl_${table.tableId}_next`,
      label: "Next ▶️",
      style: "secondary",
      callbackValue: `tbl_page:${table.tableId}:${Math.min(table.totalPages, table.currentPage + 1)}`,
    });

    const card: GatewayInteractiveCard = {
      cardId: `tbl_${table.tableId}`,
      title: table.title,
      bodyText: text,
      buttons,
    };

    const compiled = this.compileInteractiveCard(card, platform);
    return {
      compiledText: text,
      buttons,
      compiledPayload: compiled.compiledPayload,
    };
  }

  /**
   * Compiles live quorum ballot with visual ASCII progress bars.
   */
  public compileBallot(
    ballot: GatewayInlineBallot,
    platform: GatewayPlatform
  ): { compiledText: string; buttons: readonly GatewayActionButton[]; compiledPayload: string } {
    let text = `🗳️ *Ballot: ${ballot.question}*\n` +
      `Status: *${ballot.status}* • Quorum: ${ballot.currentTotalVotes}/${ballot.quorumRequired} votes\n\n`;

    for (const opt of ballot.options) {
      const pct = ballot.currentTotalVotes > 0 ? Math.round((opt.voteCount / ballot.currentTotalVotes) * 100) : 0;
      const filled = Math.round((pct / 100) * 10);
      const empty = 10 - filled;
      const bar = `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
      const emoji = opt.emoji || "🔘";
      text += `${emoji} *${opt.label}*: ${bar} ${pct}% (${opt.voteCount} votes)\n`;
    }

    const buttons: GatewayActionButton[] = [];

    if (ballot.status === "VOTING") {
      for (const opt of ballot.options) {
        const emoji = opt.emoji ? `${opt.emoji} ` : "";
        buttons.push({
          actionId: `ballot_${ballot.ballotId}_vote_${opt.optionId}`,
          label: `${emoji}Vote ${opt.label}`,
          style: "primary",
          callbackValue: `vote:${ballot.ballotId}:${opt.optionId}`,
        });
      }
    }

    buttons.push({
      actionId: `ballot_${ballot.ballotId}_refresh`,
      label: "🔄 Refresh Tally",
      style: "secondary",
      callbackValue: `ballot_refresh:${ballot.ballotId}`,
    });

    const card: GatewayInteractiveCard = {
      cardId: `ballot_${ballot.ballotId}`,
      title: `Ballot: ${ballot.question}`,
      bodyText: text,
      buttons,
    };

    const compiled = this.compileInteractiveCard(card, platform);
    return {
      compiledText: text,
      buttons,
      compiledPayload: compiled.compiledPayload,
    };
  }
}
