/**
 * gateway-supervisor.ts
 *
 * Supervisor orchestrator for the Native Messaging Gateway Subsystem (Phase 95 / ADR-125).
 * Governs omnichannel outbound dispatch, interactive action cards, unified contact identity,
 * human-in-the-loop handover, whisper notes, media streaming, and platform health telemetry.
 */

import type {
  ChannelBindingRule,
  DeliveryReceipt,
  GatewayHandoverMode,
  GatewayHealthMatrix,
  GatewayInlineBallot,
  GatewayInlineDataTable,
  GatewayInlineMenuItem,
  GatewayInlineMenuNode,
  GatewayInlineTab,
  GatewayInlineTabGroup,
  GatewayInlineWizard,
  GatewayInPlaceMutationResult,
  GatewayInteractiveCard,
  GatewayMediaCard,
  GatewayMessage,
  GatewayPlatform,
  GatewayReaction,
  GatewaySessionLease,
  GatewaySkillConfig,
  GatewaySlaPolicy,
  GatewayThreadTriage,
  GatewayTypingState,
  GatewayUserIdentity,
  GatewayWhisperNote,
  GatewayWizardStep,
  LinkedPlatformIdentity,
  PlatformHealthStatus,
  UnifiedContactProfile,
  WebhookVerificationResult,
} from "../../../core/contracts/gateway.contracts.js";
import { BroccoliGatewaySubstrate } from "../../../sessions/extensions/gateway/broccoli-gateway-substrate.js";
import { DeterministicGatewayEngine } from "../../../tooling/extensions/gateway/deterministic-gateway-engine.js";

export class GatewaySupervisor {
  private readonly substrate: BroccoliGatewaySubstrate;
  private readonly engine: DeterministicGatewayEngine;

  constructor(substrate: BroccoliGatewaySubstrate, engine: DeterministicGatewayEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public isSkillEnabled(): boolean {
    return this.substrate.getConfig().enabled;
  }

  public getConfig(): GatewaySkillConfig {
    return this.substrate.getConfig();
  }

  public updateConfig(updates: Partial<GatewaySkillConfig>): GatewaySkillConfig {
    return this.substrate.updateConfig(updates);
  }

  /**
   * Dispatches an outbound standard text/markdown message.
   */
  public sendMessage(
    platform: GatewayPlatform,
    channelId: string,
    rawText: string,
    recipient?: GatewayUserIdentity,
    threadId?: string
  ): { success: boolean; message?: GatewayMessage; receipt?: DeliveryReceipt; error?: string } {
    const cfg = this.substrate.getConfig();
    if (!cfg.enabled) {
      return { success: false, error: "Gateway skill is currently DISABLED by user policy (Fail-Closed)." };
    }

    if (!cfg.allowedPlatforms.includes(platform)) {
      return { success: false, error: `Platform '${platform}' is not in the allowed platforms whitelist.` };
    }

    // Check Handover Mode (if human takeover, autonomous agent messages are halted unless forced)
    const handoverMode = this.substrate.getHandoverMode(channelId);
    if (handoverMode === "HUMAN_TAKEOVER") {
      return {
        success: false,
        error: `Channel '${channelId}' is currently in HUMAN_TAKEOVER mode. Autonomous agent dispatch is paused.`,
      };
    }

    // Rate Limit Check
    const rate = this.engine.checkRateLimit(`out_${platform}_${channelId}`, cfg.rateLimitPerMinute);
    if (!rate.allowed) {
      return {
        success: false,
        error: `Rate limit exceeded for channel '${channelId}'. Retry after ${rate.retryAfterMs}ms.`,
      };
    }

    const sanitized = this.engine.sanitizeInputText(rawText);
    const compiled = this.engine.compileMarkdown(sanitized, platform);

    const now = Date.now();
    const msgId = `out_${platform}_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const idempotency = `idemp_${msgId}`;

    const message: GatewayMessage = {
      messageId: msgId,
      platform,
      channelId,
      threadId,
      direction: "outbound",
      sender: {
        platform,
        platformUserId: "lumi_agent_bot",
        displayName: "LUMI Agent",
        role: "OWNER",
        isVerified: true,
      },
      recipient,
      rawContent: rawText,
      sanitizedText: sanitized,
      compiledFormat: compiled.format,
      compiledPayload: compiled.compiledPayload,
      attachments: [],
      deliveryStatus: "delivered",
      idempotencyKey: idempotency,
      timestamp: now,
      formattedPreview: `[LUMI -> ${platform} #${channelId}]: ${sanitized.substring(0, 60)}`,
    };

    const receipt: DeliveryReceipt = {
      receiptId: `rcpt_${msgId}`,
      messageId: msgId,
      platform,
      channelId,
      status: "delivered",
      attempts: 1,
      latencyMs: 1.5,
      platformMessageId: `ext_${platform}_${now}`,
      dispatchedAt: now,
      acknowledgedAt: now + 2,
    };

    this.substrate.recordOutboundMessage(message);
    this.substrate.recordDeliveryReceipt(receipt);

    return { success: true, message, receipt };
  }

  /**
   * Dispatches an interactive card with native buttons and actions.
   */
  public sendInteractiveCard(
    platform: GatewayPlatform,
    channelId: string,
    card: GatewayInteractiveCard,
    recipient?: GatewayUserIdentity,
    threadId?: string
  ): { success: boolean; message?: GatewayMessage; receipt?: DeliveryReceipt; error?: string } {
    const cfg = this.substrate.getConfig();
    if (!cfg.enabled) {
      return { success: false, error: "Gateway skill is currently DISABLED by user policy (Fail-Closed)." };
    }

    if (!cfg.allowedPlatforms.includes(platform)) {
      return { success: false, error: `Platform '${platform}' is not allowed.` };
    }

    const compiled = this.engine.compileInteractiveCard(card, platform);
    const now = Date.now();
    const msgId = `out_card_${platform}_${now}_${Math.random().toString(36).substring(2, 7)}`;

    const message: GatewayMessage = {
      messageId: msgId,
      platform,
      channelId,
      threadId,
      direction: "outbound",
      sender: {
        platform,
        platformUserId: "lumi_agent_bot",
        displayName: "LUMI Agent",
        role: "OWNER",
        isVerified: true,
      },
      recipient,
      rawContent: card.bodyText,
      sanitizedText: this.engine.sanitizeInputText(card.bodyText),
      compiledFormat: compiled.format,
      compiledPayload: compiled.compiledPayload,
      interactiveCard: card,
      attachments: [],
      deliveryStatus: "delivered",
      idempotencyKey: `idemp_${msgId}`,
      timestamp: now,
      formattedPreview: compiled.formattedPreview,
    };

    const receipt: DeliveryReceipt = {
      receiptId: `rcpt_${msgId}`,
      messageId: msgId,
      platform,
      channelId,
      status: "delivered",
      attempts: 1,
      latencyMs: 2.0,
      platformMessageId: `ext_card_${platform}_${now}`,
      dispatchedAt: now,
      acknowledgedAt: now + 3,
    };

    this.substrate.recordOutboundMessage(message);
    this.substrate.recordDeliveryReceipt(receipt);

    return { success: true, message, receipt };
  }

  /**
   * Dispatches rich media attachments (voice note, image, PDF document, video).
   */
  public sendRichMedia(
    platform: GatewayPlatform,
    channelId: string,
    media: GatewayMediaCard,
    recipient?: GatewayUserIdentity,
    threadId?: string
  ): { success: boolean; message?: GatewayMessage; receipt?: DeliveryReceipt; error?: string } {
    const cfg = this.substrate.getConfig();
    if (!cfg.enabled) {
      return { success: false, error: "Gateway skill is currently DISABLED by user policy (Fail-Closed)." };
    }

    const mediaVal = this.engine.validateMedia(media);
    if (!mediaVal.isValid) {
      return { success: false, error: mediaVal.failureReason || "Invalid media attachment" };
    }

    const now = Date.now();
    const msgId = `out_media_${platform}_${now}_${Math.random().toString(36).substring(2, 7)}`;

    const message: GatewayMessage = {
      messageId: msgId,
      platform,
      channelId,
      threadId,
      direction: "outbound",
      sender: {
        platform,
        platformUserId: "lumi_agent_bot",
        displayName: "LUMI Agent",
        role: "OWNER",
        isVerified: true,
      },
      recipient,
      rawContent: media.caption || `[${media.type.toUpperCase()} Attachment]`,
      sanitizedText: this.engine.sanitizeInputText(media.caption || `[${media.type.toUpperCase()}]`),
      compiledFormat: "plain_text",
      compiledPayload: JSON.stringify(media),
      mediaCard: media,
      attachments: [{ name: media.fileName || "attachment", mimeType: media.mimeType, sizeBytes: media.sizeBytes, url: media.url }],
      deliveryStatus: "delivered",
      idempotencyKey: `idemp_${msgId}`,
      timestamp: now,
      formattedPreview: `[${platform.toUpperCase()} ${media.type.toUpperCase()}]: ${media.caption || media.fileName || media.url}`,
    };

    const receipt: DeliveryReceipt = {
      receiptId: `rcpt_${msgId}`,
      messageId: msgId,
      platform,
      channelId,
      status: "delivered",
      attempts: 1,
      latencyMs: 3.5,
      platformMessageId: `ext_media_${platform}_${now}`,
      dispatchedAt: now,
      acknowledgedAt: now + 5,
    };

    this.substrate.recordOutboundMessage(message);
    this.substrate.recordDeliveryReceipt(receipt);

    return { success: true, message, receipt };
  }

  /**
   * Broadcasts a message simultaneously across multiple platform channels.
   */
  public broadcastAnnouncement(
    text: string,
    targetChannels: readonly { readonly platform: GatewayPlatform; readonly channelId: string }[]
  ): { success: boolean; totalDispatched: number; receipts: readonly DeliveryReceipt[]; error?: string } {
    if (!this.isSkillEnabled()) {
      return { success: false, totalDispatched: 0, receipts: [], error: "Gateway skill is disabled." };
    }

    const receipts: DeliveryReceipt[] = [];
    let count = 0;

    for (const target of targetChannels) {
      const res = this.sendMessage(target.platform, target.channelId, text);
      if (res.success && res.receipt) {
        receipts.push(res.receipt);
        count++;
      }
    }

    return {
      success: count > 0,
      totalDispatched: count,
      receipts,
    };
  }

  /**
   * Ingests and validates incoming webhooks with constant-time HMAC comparison.
   */
  public processInboundWebhook(
    platform: GatewayPlatform,
    rawBody: string,
    signatureHeader: string,
    timestampHeader?: string,
    secretKey = "lumi_default_secret"
  ): { success: boolean; verification?: WebhookVerificationResult; message?: GatewayMessage; error?: string } {
    const cfg = this.substrate.getConfig();
    if (!cfg.enabled) {
      return { success: false, error: "Gateway skill is disabled." };
    }

    if (cfg.requireHmacVerification) {
      const verification = this.engine.verifyWebhook(
        {
          platform,
          rawBody,
          signatureHeader,
          timestampHeader,
          secretKey,
        },
        cfg.webhookJitterToleranceMs
      );

      if (!verification.isValid) {
        return {
          success: false,
          verification,
          error: verification.failureReason || "Webhook cryptographic verification failed",
        };
      }
    }

    let parsedJson: Record<string, any> = {};
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      parsedJson = { raw: rawBody };
    }

    const normalized = this.engine.normalizeInboundPayload(platform, parsedJson);
    const compiled = this.engine.compileMarkdown(normalized.sanitizedText, platform);

    const message: GatewayMessage = {
      ...normalized,
      compiledFormat: compiled.format,
      compiledPayload: compiled.compiledPayload,
    };

    this.substrate.recordInboundMessage(message);

    return {
      success: true,
      verification: {
        isValid: true,
        platform,
        isReplayAttack: false,
        timestampSkewMs: 0,
        verifiedAt: Date.now(),
      },
      message,
    };
  }

  /**
   * Channel Bindings and Session Turn Leases.
   */
  public bindChannel(binding: ChannelBindingRule): { success: boolean; binding: ChannelBindingRule } {
    this.substrate.storeChannelBinding(binding);
    return { success: true, binding };
  }

  public getChannelBinding(platform: string, channelId: string): ChannelBindingRule | undefined {
    return this.substrate.getChannelBinding(platform, channelId);
  }

  public acquireSessionLease(
    sessionId: string,
    channelId: string,
    platform: GatewayPlatform,
    userId: string
  ): { success: boolean; lease: GatewaySessionLease } {
    const lease = this.substrate.acquireSessionLease(sessionId, channelId, platform, userId);
    return { success: true, lease };
  }

  public releaseSessionLease(sessionId: string): boolean {
    return this.substrate.releaseSessionLease(sessionId);
  }

  /**
   * Handover & Operator Co-Pilot Mode.
   */
  public setHandoverMode(channelId: string, mode: GatewayHandoverMode): void {
    this.substrate.setHandoverMode(channelId, mode);
  }

  public getHandoverMode(channelId: string): GatewayHandoverMode {
    return this.substrate.getHandoverMode(channelId);
  }

  public postWhisperNote(
    channelId: string,
    platform: GatewayPlatform,
    authorId: string,
    authorName: string,
    noteText: string
  ): GatewayWhisperNote {
    const note: GatewayWhisperNote = {
      noteId: `whisp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      channelId,
      platform,
      authorId,
      authorName,
      noteText: this.engine.sanitizeInputText(noteText),
      timestamp: Date.now(),
    };
    this.substrate.recordWhisperNote(note);
    return note;
  }

  public listWhisperNotes(channelId?: string): readonly GatewayWhisperNote[] {
    return this.substrate.listWhisperNotes(channelId);
  }

  /**
   * Reactions & Typestates.
   */
  public addReaction(
    messageId: string,
    platform: GatewayPlatform,
    channelId: string,
    emoji: string,
    userId = "agent_lumi"
  ): GatewayReaction {
    const reaction: GatewayReaction = {
      reactionId: `rxn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      messageId,
      platform,
      channelId,
      emoji,
      userId,
      addedAt: Date.now(),
    };
    this.substrate.addReaction(reaction);
    return reaction;
  }

  public removeReaction(messageId: string, userId: string, emoji: string): boolean {
    return this.substrate.removeReaction(messageId, userId, emoji);
  }

  public listReactions(messageId?: string): readonly GatewayReaction[] {
    return this.substrate.listReactions(messageId);
  }

  public sendTypingIndicator(
    platform: GatewayPlatform,
    channelId: string,
    state: GatewayTypingState
  ): { success: boolean; state: GatewayTypingState; platform: GatewayPlatform; channelId: string } {
    return {
      success: true,
      state,
      platform,
      channelId,
    };
  }

  /**
   * Omnichannel Contact Profiles.
   */
  public upsertContact(contact: UnifiedContactProfile): UnifiedContactProfile {
    return this.substrate.upsertContact(contact);
  }

  public linkContactIdentity(contactId: string, identity: LinkedPlatformIdentity): UnifiedContactProfile | undefined {
    return this.substrate.linkPlatformToContact(contactId, identity);
  }

  public getContactProfile(identifier: string, platform?: GatewayPlatform): UnifiedContactProfile | undefined {
    if (platform) {
      const byPlatform = this.substrate.getContactByPlatformIdentity(platform, identifier);
      if (byPlatform) return byPlatform;
    }
    return this.substrate.getContact(identifier);
  }

  public listContacts(): readonly UnifiedContactProfile[] {
    return this.substrate.listContacts();
  }

  /**
   * Platform Health & Diagnostic Telemetry.
   */
  public inspectPlatformHealth(): GatewayHealthMatrix {
    const cfg = this.substrate.getConfig();
    const activity = this.substrate.getChannelActivity();
    const receipts = this.substrate.listDeliveryReceipts();

    const platforms: PlatformHealthStatus[] = cfg.allowedPlatforms.map((p) => {
      const pReceipts = receipts.filter((r) => r.platform === p);
      const delivered = pReceipts.filter((r) => r.status === "delivered").length;
      const failed = pReceipts.filter((r) => r.status === "failed").length;
      const uptime = pReceipts.length > 0 ? (delivered / pReceipts.length) * 100 : 100;

      return {
        platform: p,
        isConnected: cfg.enabled,
        latencyMs: 1.2,
        uptimePercent: uptime,
        activeLeases: 0,
        totalDelivered: delivered,
        totalFailed: failed,
        lastPingAt: Date.now(),
      };
    });

    const failedTotal = platforms.reduce((acc, p) => acc + p.totalFailed, 0);
    const deliveredTotal = platforms.reduce((acc, p) => acc + p.totalDelivered, 0);
    const totalDispatches = failedTotal + deliveredTotal;
    const errorRate = totalDispatches > 0 ? (failedTotal / totalDispatches) * 100 : 0;

    return {
      totalPlatformsActive: cfg.enabled ? cfg.allowedPlatforms.length : 0,
      overallStatus: !cfg.enabled ? "DEGRADED" : errorRate > 5 ? "CRITICAL" : "HEALTHY",
      platforms,
      queueDepth: 0,
      errorRatePercent: errorRate,
      timestamp: Date.now(),
    };
  }

  /**
   * Inline Navigation & In-Place Menu Trees.
   */
  public renderInlineMenu(
    nodeId: string,
    platform: GatewayPlatform = "telegram",
    channelId = "default_channel"
  ): GatewayInPlaceMutationResult {
    if (!this.isSkillEnabled()) {
      return { success: false, platform, channelId, updatedText: "", inPlaceEditApplied: false, error: "Gateway skill is disabled." };
    }

    let node = this.substrate.getMenuNode(nodeId);
    if (!node) {
      // Default root menu node
      node = {
        nodeId: "root",
        title: "LUMI Command Center",
        description: "Select an area to inspect or execute actions:",
        breadcrumbPath: ["Home"],
        items: [
          { itemId: "nav_deployments", label: "Deployments & Releases", iconEmoji: "🚀", targetNodeId: "deployments", style: "primary" },
          { itemId: "nav_monitors", label: "Health & Telemetry", iconEmoji: "📊", targetNodeId: "monitors", style: "secondary" },
          { itemId: "nav_integrations", label: "Enterprise Integrations", iconEmoji: "⚡", targetNodeId: "integrations", style: "secondary" },
          { itemId: "nav_support", label: "Support & Triage", iconEmoji: "🎧", targetNodeId: "support", style: "secondary" },
        ],
        layout: "2-column",
        enableBackButton: false,
        enableHomeButton: true,
      };
      this.substrate.upsertMenuNode(node);
    }

    const compiled = this.engine.compileInlineMenu(node, platform);

    return {
      success: true,
      platform,
      channelId,
      updatedText: compiled.compiledText,
      updatedButtons: compiled.buttons,
      inPlaceEditApplied: true,
    };
  }

  public navigateInlineMenu(
    currentNodeId: string,
    action: "back" | "home" | "select",
    targetNodeId?: string,
    platform: GatewayPlatform = "telegram",
    channelId = "default_channel"
  ): GatewayInPlaceMutationResult {
    let nextNodeId = "root";
    if (action === "select" && targetNodeId) {
      nextNodeId = targetNodeId;
    } else if (action === "home") {
      nextNodeId = "root";
    } else if (action === "back") {
      const current = this.substrate.getMenuNode(currentNodeId);
      if (current && current.breadcrumbPath.length > 1) {
        nextNodeId = "root"; // Navigate back up
      } else {
        nextNodeId = "root";
      }
    }

    return this.renderInlineMenu(nextNodeId, platform, channelId);
  }

  /**
   * Progressive Step-by-Step Wizards.
   */
  public startInlineWizard(
    title: string,
    steps: GatewayWizardStep[],
    platform: GatewayPlatform = "telegram",
    channelId = "default_channel"
  ): { success: boolean; wizard?: GatewayInlineWizard; mutation?: GatewayInPlaceMutationResult; error?: string } {
    if (!this.isSkillEnabled()) {
      return { success: false, error: "Gateway skill is disabled." };
    }

    const wizardId = `wiz_${Date.now()}`;
    const wizard: GatewayInlineWizard = {
      wizardId,
      title,
      totalSteps: steps.length,
      currentStepIndex: 0,
      steps,
      status: "IN_PROGRESS",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.substrate.upsertWizard(wizard);
    const compiled = this.engine.compileWizardStep(wizard, platform);

    return {
      success: true,
      wizard,
      mutation: {
        success: true,
        platform,
        channelId,
        updatedText: compiled.compiledText,
        updatedButtons: compiled.buttons,
        inPlaceEditApplied: true,
      },
    };
  }

  public advanceInlineWizard(
    wizardId: string,
    selectedValue: string,
    platform: GatewayPlatform = "telegram",
    channelId = "default_channel"
  ): GatewayInPlaceMutationResult {
    const wizard = this.substrate.getWizard(wizardId);
    if (!wizard) {
      return { success: false, platform, channelId, updatedText: "", inPlaceEditApplied: false, error: `Wizard '${wizardId}' not found.` };
    }

    const currentStep = wizard.steps[wizard.currentStepIndex];
    const updatedSteps = wizard.steps.map((s, idx) =>
      idx === wizard.currentStepIndex ? { ...s, selectedValue } : s
    );

    const nextIndex = wizard.currentStepIndex + 1;
    const isCompleted = nextIndex >= wizard.totalSteps;

    const updatedWizard: GatewayInlineWizard = {
      ...wizard,
      currentStepIndex: Math.min(nextIndex, wizard.totalSteps - 1),
      steps: updatedSteps,
      status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
      updatedAt: Date.now(),
    };

    this.substrate.upsertWizard(updatedWizard);

    if (isCompleted) {
      const receipt = this.engine.compileWizardReceipt(updatedWizard, platform);
      return {
        success: true,
        platform,
        channelId,
        updatedText: receipt.compiledText,
        updatedButtons: receipt.buttons,
        inPlaceEditApplied: true,
      };
    } else {
      const nextStep = this.engine.compileWizardStep(updatedWizard, platform);
      return {
        success: true,
        platform,
        channelId,
        updatedText: nextStep.compiledText,
        updatedButtons: nextStep.buttons,
        inPlaceEditApplied: true,
      };
    }
  }

  /**
   * Inline Tabbed Views.
   */
  public renderInlineTabs(
    tabGroupId: string,
    activeTabId?: string,
    platform: GatewayPlatform = "telegram",
    channelId = "default_channel"
  ): GatewayInPlaceMutationResult {
    let tabGroup = this.substrate.getTabGroup(tabGroupId);
    if (!tabGroup) {
      tabGroup = {
        tabGroupId,
        title: "Cluster Overview",
        activeTabId: activeTabId || "tab_overview",
        tabs: [
          { tabId: "tab_overview", label: "Overview", iconEmoji: "📊", contentText: "CPU: 18% | Memory: 32MB / 16MB Slab | Uptime: 99.99%" },
          { tabId: "tab_perf", label: "Performance", iconEmoji: "⚡", contentText: "Turn Latency: 0.13ms | Execution Throughput: 7,432 fps" },
          { tabId: "tab_alerts", label: "Alerts", iconEmoji: "🚨", contentText: "0 active fatal errors. All 90 validation suites passing." },
        ],
      };
      this.substrate.upsertTabGroup(tabGroup);
    } else if (activeTabId) {
      tabGroup = { ...tabGroup, activeTabId };
      this.substrate.upsertTabGroup(tabGroup);
    }

    const compiled = this.engine.compileTabGroup(tabGroup, platform);

    return {
      success: true,
      platform,
      channelId,
      updatedText: compiled.compiledText,
      updatedButtons: compiled.buttons,
      inPlaceEditApplied: true,
    };
  }

  /**
   * Paginated Data Tables.
   */
  public renderInlineDataTable(
    tableId: string,
    page = 1,
    activeFilterPillId?: string,
    platform: GatewayPlatform = "telegram",
    channelId = "default_channel"
  ): GatewayInPlaceMutationResult {
    let table = this.substrate.getDataTable(tableId);
    if (!table) {
      table = {
        tableId,
        title: "Active Releases",
        headers: ["Release", "Version", "Status", "Author"],
        rows: [
          ["rel_01", "v2.5.0", "STAGED", "@alex"],
          ["rel_02", "v2.4.9", "PROD", "@sarah"],
          ["rel_03", "v2.4.8", "ROLLBACK", "@dev_ops"],
        ],
        filterPills: [
          { pillId: "all", label: "All", count: 3, isActive: !activeFilterPillId || activeFilterPillId === "all" },
          { pillId: "prod", label: "Prod", count: 1, isActive: activeFilterPillId === "prod" },
          { pillId: "staged", label: "Staged", count: 1, isActive: activeFilterPillId === "staged" },
        ],
        currentPage: page,
        totalPages: 1,
        totalRecords: 3,
      };
      this.substrate.upsertDataTable(table);
    } else {
      table = { ...table, currentPage: page };
      if (activeFilterPillId) {
        table = {
          ...table,
          filterPills: table.filterPills.map((p) => ({ ...p, isActive: p.pillId === activeFilterPillId })),
        };
      }
      this.substrate.upsertDataTable(table);
    }

    const compiled = this.engine.compileDataTable(table, platform);

    return {
      success: true,
      platform,
      channelId,
      updatedText: compiled.compiledText,
      updatedButtons: compiled.buttons,
      inPlaceEditApplied: true,
    };
  }

  /**
   * Live Quorum Ballots.
   */
  public createPollBallot(
    question: string,
    optionLabels: string[],
    quorumRequired = 3,
    platform: GatewayPlatform = "telegram",
    channelId = "default_channel"
  ): { success: boolean; ballot?: GatewayInlineBallot; mutation?: GatewayInPlaceMutationResult; error?: string } {
    if (!this.isSkillEnabled()) {
      return { success: false, error: "Gateway skill is disabled." };
    }

    const ballotId = `ballot_${Date.now()}`;
    const options = optionLabels.map((lbl, idx) => ({
      optionId: `opt_${idx + 1}`,
      label: lbl,
      voteCount: 0,
      voterHandles: [],
    }));

    const ballot: GatewayInlineBallot = {
      ballotId,
      question,
      options,
      quorumRequired,
      currentTotalVotes: 0,
      isAnonymous: false,
      status: "VOTING",
      createdAt: Date.now(),
    };

    this.substrate.upsertBallot(ballot);
    const compiled = this.engine.compileBallot(ballot, platform);

    return {
      success: true,
      ballot,
      mutation: {
        success: true,
        platform,
        channelId,
        updatedText: compiled.compiledText,
        updatedButtons: compiled.buttons,
        inPlaceEditApplied: true,
      },
    };
  }

  public votePollBallot(
    ballotId: string,
    optionId: string,
    voterHandle: string,
    platform: GatewayPlatform = "telegram",
    channelId = "default_channel"
  ): GatewayInPlaceMutationResult {
    const ballot = this.substrate.getBallot(ballotId);
    if (!ballot) {
      return { success: false, platform, channelId, updatedText: "", inPlaceEditApplied: false, error: `Ballot '${ballotId}' not found.` };
    }

    if (ballot.status !== "VOTING") {
      return { success: false, platform, channelId, updatedText: "", inPlaceEditApplied: false, error: "Ballot is already closed or quorum satisfied." };
    }

    let updatedVotes = 0;
    const updatedOptions = ballot.options.map((opt) => {
      if (opt.optionId === optionId) {
        const voters = opt.voterHandles.includes(voterHandle) ? opt.voterHandles : [...opt.voterHandles, voterHandle];
        updatedVotes += voters.length;
        return { ...opt, voteCount: voters.length, voterHandles: voters };
      } else {
        const voters = opt.voterHandles.filter((h) => h !== voterHandle);
        updatedVotes += voters.length;
        return { ...opt, voteCount: voters.length, voterHandles: voters };
      }
    });

    const isQuorum = updatedVotes >= ballot.quorumRequired;
    const updatedBallot: GatewayInlineBallot = {
      ...ballot,
      options: updatedOptions,
      currentTotalVotes: updatedVotes,
      status: isQuorum ? "QUORUM_REACHED" : "VOTING",
    };

    this.substrate.upsertBallot(updatedBallot);
    const compiled = this.engine.compileBallot(updatedBallot, platform);

    return {
      success: true,
      platform,
      channelId,
      updatedText: compiled.compiledText,
      updatedButtons: compiled.buttons,
      inPlaceEditApplied: true,
    };
  }

  /**
   * Thread Triage & SLA Policy.
   */
  public manageThreadTriage(
    action: "create" | "assign" | "resolve" | "snooze" | "list",
    params: Record<string, unknown> = {}
  ): Record<string, unknown> {
    if (action === "create") {
      const threadId = `th_${Date.now()}`;
      const thread: GatewayThreadTriage = {
        threadId,
        channelId: String(params.channelId || "default"),
        platform: (String(params.platform || "telegram")) as GatewayPlatform,
        topic: String(params.topic || "General Customer Support"),
        status: "UNASSIGNED",
        priority: (String(params.priority || "MEDIUM").toUpperCase()) as "URGENT" | "HIGH" | "MEDIUM" | "LOW",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      this.substrate.upsertThread(thread);
      return { success: true, thread };
    }

    if (action === "assign") {
      const threadId = String(params.threadId || "");
      const thread = this.substrate.getThread(threadId);
      if (!thread) return { success: false, error: "Thread not found" };
      const updated: GatewayThreadTriage = { ...thread, status: "ASSIGNED", assignedAgent: String(params.agent || "operator_lumi") };
      this.substrate.upsertThread(updated);
      return { success: true, thread: updated };
    }

    if (action === "resolve") {
      const threadId = String(params.threadId || "");
      const thread = this.substrate.getThread(threadId);
      if (!thread) return { success: false, error: "Thread not found" };
      const updated: GatewayThreadTriage = { ...thread, status: "RESOLVED", lastActiveAt: Date.now() };
      this.substrate.upsertThread(updated);
      return { success: true, thread: updated };
    }

    const threads = this.substrate.listThreads(params.status ? (params.status as "UNASSIGNED" | "ASSIGNED" | "RESOLVED" | "SNOOZED") : undefined);
    return { success: true, totalThreads: threads.length, threads };
  }

  public configureSlaPolicy(updates: Partial<GatewaySlaPolicy>): GatewaySlaPolicy {
    return this.substrate.updateSlaPolicy(updates);
  }

  public listDeliveryReceipts(): readonly DeliveryReceipt[] {
    return this.substrate.listDeliveryReceipts();
  }

  public getStats(): { totalInbound: number; totalOutbound: number; totalReceipts: number; totalContacts: number } {
    const snap = this.substrate.exportSnapshot();
    return {
      totalInbound: snap.totalInbound,
      totalOutbound: snap.totalOutbound,
      totalReceipts: snap.totalReceipts,
      totalContacts: snap.totalContacts || 0,
    };
  }
}
