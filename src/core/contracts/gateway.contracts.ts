/**
 * gateway.contracts.ts
 *
 * Core data contracts for the Deterministic Native Messaging Gateway Subsystem (Phase 95 / ADR-125).
 * Absorbed from ancestral Hermes Agent gateway adapters and elevated into a hardened, zero-GC,
 * omnichannel messaging platform supporting Telegram, Slack, Discord, WhatsApp, Signal, Webhooks, Matrix,
 * and iMessage with interactive action cards, unified contact profiles, human-in-the-loop handover,
 * internal whisper notes, media streaming, reaction ledgers, and fail-closed opt-in gating.
 */

export type GatewayPlatform =
  | "telegram"
  | "slack"
  | "discord"
  | "whatsapp"
  | "signal"
  | "webhook"
  | "matrix"
  | "imessage";

export type GatewayPlatformType = GatewayPlatform;

export type GatewayMessageDirection = "inbound" | "outbound";

export type GatewayMessageFormat =
  | "plain_text"
  | "markdown"
  | "slack_blocks"
  | "discord_embeds"
  | "telegram_html"
  | "whatsapp_formatting"
  | "interactive_card";

export type GatewayDeliveryStatus =
  | "queued"
  | "sending"
  | "staged"
  | "dispatching"
  | "delivered"
  | "failed"
  | "retrying"
  | "acknowledged"
  | "quarantined";

export type GatewayUserRole = "OWNER" | "ADMIN" | "MEMBER" | "GUEST";

export type ContactVipTier = "STANDARD" | "VIP" | "EXECUTIVE" | "ENTERPRISE";

export type GatewayHandoverMode = "AGENT_AUTONOMOUS" | "COPILOT_ASSIST" | "HUMAN_TAKEOVER";

export type GatewayTypingState = "typing" | "recording_audio" | "uploading_file" | "idle";

export type GatewayMediaType = "image" | "audio_voice" | "document" | "video";

export type GatewayActionButtonStyle = "primary" | "secondary" | "danger" | "success" | "link";

export interface GatewayActionButton {
  readonly actionId: string;
  readonly label: string;
  readonly style: GatewayActionButtonStyle;
  readonly url?: string;
  readonly callbackValue?: string;
  readonly confirmPrompt?: string;
}

export interface GatewayInteractiveCard {
  readonly cardId: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly bodyText: string;
  readonly heroImageUrl?: string;
  readonly buttons: readonly GatewayActionButton[];
  readonly selectOptions?: readonly { readonly label: string; readonly value: string }[];
  readonly footerText?: string;
}

export interface LinkedPlatformIdentity {
  readonly platform: GatewayPlatform;
  readonly platformUserId: string;
  readonly username?: string;
  readonly displayName?: string;
  readonly phoneNumber?: string;
  readonly email?: string;
  readonly linkedAt: number;
}

export interface UnifiedContactProfile {
  readonly contactId: string;
  readonly primaryDisplayName: string;
  readonly primaryPlatform: GatewayPlatform;
  readonly vipTier: ContactVipTier;
  readonly linkedIdentities: readonly LinkedPlatformIdentity[];
  readonly avatarUrl?: string;
  readonly timezone?: string;
  readonly notes?: string;
  readonly tags: readonly string[];
  readonly totalInteractions: number;
  readonly lastActiveAt: number;
  readonly createdAt: number;
}

export interface GatewayWhisperNote {
  readonly noteId: string;
  readonly channelId: string;
  readonly platform: GatewayPlatform;
  readonly authorId: string;
  readonly authorName: string;
  readonly noteText: string;
  readonly timestamp: number;
}

export interface GatewayReaction {
  readonly reactionId: string;
  readonly messageId: string;
  readonly platform: GatewayPlatform;
  readonly channelId: string;
  readonly emoji: string;
  readonly userId: string;
  readonly addedAt: number;
}

export interface GatewayMediaCard {
  readonly mediaId: string;
  readonly type: GatewayMediaType;
  readonly url: string;
  readonly caption?: string;
  readonly fileName?: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly durationSeconds?: number;
  readonly thumbnailDataUrl?: string;
}

export interface PlatformHealthStatus {
  readonly platform: GatewayPlatform;
  readonly isConnected: boolean;
  readonly latencyMs: number;
  readonly uptimePercent: number;
  readonly activeLeases: number;
  readonly totalDelivered: number;
  readonly totalFailed: number;
  readonly lastPingAt: number;
}

export interface GatewayHealthMatrix {
  readonly totalPlatformsActive: number;
  readonly overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  readonly platforms: readonly PlatformHealthStatus[];
  readonly queueDepth: number;
  readonly errorRatePercent: number;
  readonly timestamp: number;
}

export interface GatewaySkillConfig {
  readonly enabled: boolean;
  readonly allowedPlatforms: readonly GatewayPlatform[];
  readonly requireHmacVerification: boolean;
  readonly maxPayloadSizeBytes: number;
  readonly rateLimitPerMinute: number;
  readonly webhookJitterToleranceMs: number; // e.g. 300,000 ms (5 min)
  readonly enableRichFormattingCompilation: boolean;
  readonly defaultDeliveryTimeoutMs: number;
  readonly quietHoursEnabled?: boolean;
  readonly quietHoursStartHourUtc?: number; // e.g. 22 (10 PM UTC)
  readonly quietHoursEndHourUtc?: number;   // e.g. 7 (7 AM UTC)
  readonly platformCredentials?: Readonly<Record<string, unknown>>;
}

export interface GatewayUserIdentity {
  readonly platform: GatewayPlatform;
  readonly platformUserId: string;
  readonly username?: string;
  readonly displayName?: string;
  readonly role: GatewayUserRole;
  readonly isVerified: boolean;
}

export interface GatewayAttachment {
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly url?: string;
}

export interface GatewayMessage {
  readonly messageId: string;
  readonly platform: GatewayPlatform;
  readonly channelId: string;
  readonly threadId?: string;
  readonly direction: GatewayMessageDirection;
  readonly sender: GatewayUserIdentity;
  readonly recipient?: GatewayUserIdentity;
  readonly rawContent: string;
  readonly sanitizedText: string;
  readonly compiledFormat: GatewayMessageFormat;
  readonly compiledPayload: string;
  readonly interactiveCard?: GatewayInteractiveCard;
  readonly mediaCard?: GatewayMediaCard;
  readonly attachments: readonly GatewayAttachment[];
  readonly deliveryStatus: GatewayDeliveryStatus;
  readonly idempotencyKey: string;
  readonly timestamp: number;
  readonly formattedPreview: string;
}

export interface DeliveryReceipt {
  readonly receiptId: string;
  readonly messageId: string;
  readonly platform: GatewayPlatform;
  readonly channelId: string;
  readonly status: GatewayDeliveryStatus;
  readonly attempts: number;
  readonly latencyMs: number;
  readonly platformMessageId?: string;
  readonly errorMessage?: string;
  readonly dispatchedAt: number;
  readonly acknowledgedAt?: number;
}

export interface WebhookVerificationRequest {
  readonly platform: GatewayPlatform;
  readonly rawBody: string;
  readonly signatureHeader: string;
  readonly timestampHeader?: string;
  readonly secretKey: string;
}

export interface WebhookVerificationResult {
  readonly isValid: boolean;
  readonly platform: GatewayPlatform;
  readonly isReplayAttack: boolean;
  readonly timestampSkewMs: number;
  readonly failureReason?: string;
  readonly verifiedAt: number;
}

export interface ChannelBindingRule {
  readonly bindingId: string;
  readonly platform: GatewayPlatform;
  readonly channelId: string;
  readonly targetSessionId: string;
  readonly channelName?: string;
  readonly authorizedRoles: readonly GatewayUserRole[];
  readonly autoReplyEnabled: boolean;
  readonly handoverMode?: GatewayHandoverMode;
  readonly customWelcomePrompt?: string;
  readonly createdAt: number;
}

export interface GatewaySessionLease {
  readonly leaseId: string;
  readonly sessionId: string;
  readonly channelId: string;
  readonly platform: GatewayPlatform;
  readonly acquiredByUserId: string;
  readonly acquiredAt: number;
  readonly expiresAt: number;
  readonly isHeld: boolean;
}

export interface SlashCommandRoute {
  readonly command: string;
  readonly minRole: GatewayUserRole;
  readonly description: string;
  readonly requiresTurnLease: boolean;
}

// ---------------------------------------------------------------------------
// Protocol & Legacy Compatibility Contracts
// ---------------------------------------------------------------------------

export interface GatewayChannelSession {
  readonly channelId: string;
  readonly platform: GatewayPlatformType;
  readonly sessionKey?: string;
  readonly totalMessagesInbound: number;
  readonly totalMessagesOutbound: number;
  readonly lastActiveTimestampMs: number;
}

export interface GatewayStateSnapshot {
  readonly channels: readonly GatewayChannelSession[];
  readonly totalInbound: number;
  readonly totalOutbound: number;
  readonly timestampMs: number;
}

export interface GatewayMessageEnvelope {
  readonly id: string;
  readonly platform: GatewayPlatformType;
  readonly channelId: string;
  readonly threadId?: string;
  readonly senderId: string;
  readonly senderName?: string;
  readonly content: string;
  readonly timestampMs: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface GatewayOutboundPayload {
  readonly id: string;
  readonly turnId?: string;
  readonly platform: GatewayPlatformType;
  readonly channelId: string;
  readonly threadId?: string;
  readonly content?: string;
  readonly text?: string;
  readonly chunks: readonly string[];
  readonly status: GatewayDeliveryStatus;
  readonly attempts: number;
  readonly timestampMs: number;
  readonly deliveredTimestampMs?: number;
  readonly error?: string;
}

export interface IGatewayPlatformAdapter {
  readonly platform: GatewayPlatformType;
  readonly maxChunkLength: number;
  formatMessageChunks(text: string): readonly string[];
  sendChunk(
    channelId: string,
    chunk: string,
    threadId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface IGatewayDispatcher {
  registerAdapter(adapter: IGatewayPlatformAdapter): void;
  getAdapter(platform: GatewayPlatformType): IGatewayPlatformAdapter | undefined;
  handleInboundMessage(
    envelope: GatewayMessageEnvelope
  ): Promise<{ dispatched: boolean; turnId?: string; error?: string }>;
  broadcastMessage(
    platform: GatewayPlatformType,
    channelId: string,
    text: string,
    threadId?: string
  ): Promise<GatewayOutboundPayload>;
}

export interface GatewayInlineMenuItem {
  readonly itemId: string;
  readonly label: string;
  readonly iconEmoji?: string;
  readonly description?: string;
  readonly targetNodeId?: string;
  readonly actionValue?: string;
  readonly style?: "primary" | "secondary" | "danger" | "link";
  readonly url?: string;
}

export interface GatewayInlineMenuNode {
  readonly nodeId: string;
  readonly title: string;
  readonly description?: string;
  readonly breadcrumbPath: readonly string[];
  readonly items: readonly GatewayInlineMenuItem[];
  readonly layout: "1-column" | "2-column" | "grid-3";
  readonly enableBackButton?: boolean;
  readonly enableHomeButton?: boolean;
}

export interface GatewayWizardStep {
  readonly stepIndex: number;
  readonly title: string;
  readonly promptText: string;
  readonly options: readonly {
    readonly label: string;
    readonly value: string;
    readonly emoji?: string;
    readonly description?: string;
  }[];
  readonly selectedValue?: string;
}

export interface GatewayInlineWizard {
  readonly wizardId: string;
  readonly title: string;
  readonly totalSteps: number;
  readonly currentStepIndex: number;
  readonly steps: readonly GatewayWizardStep[];
  readonly status: "IN_PROGRESS" | "COMPLETED" | "ABORTED";
  readonly completedPayload?: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface GatewayInlineTab {
  readonly tabId: string;
  readonly label: string;
  readonly iconEmoji?: string;
  readonly contentText: string;
  readonly buttons?: readonly GatewayActionButton[];
}

export interface GatewayInlineTabGroup {
  readonly tabGroupId: string;
  readonly title: string;
  readonly activeTabId: string;
  readonly tabs: readonly GatewayInlineTab[];
}

export interface GatewayFilterPill {
  readonly pillId: string;
  readonly label: string;
  readonly count: number;
  readonly isActive: boolean;
}

export interface GatewayInlineDataTable {
  readonly tableId: string;
  readonly title: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly filterPills: readonly GatewayFilterPill[];
  readonly currentPage: number;
  readonly totalPages: number;
  readonly totalRecords: number;
}

export interface GatewayBallotOption {
  readonly optionId: string;
  readonly label: string;
  readonly emoji?: string;
  readonly voteCount: number;
  readonly voterHandles: readonly string[];
}

export interface GatewayInlineBallot {
  readonly ballotId: string;
  readonly question: string;
  readonly options: readonly GatewayBallotOption[];
  readonly quorumRequired: number;
  readonly currentTotalVotes: number;
  readonly isAnonymous: boolean;
  readonly status: "VOTING" | "QUORUM_REACHED" | "CLOSED";
  readonly expiresAt?: number;
  readonly createdAt: number;
}

export interface GatewayThreadTriage {
  readonly threadId: string;
  readonly channelId: string;
  readonly platform: GatewayPlatform;
  readonly topic: string;
  readonly status: "UNASSIGNED" | "ASSIGNED" | "RESOLVED" | "SNOOZED";
  readonly assignedAgent?: string;
  readonly priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  readonly createdAt: number;
  readonly lastActiveAt: number;
  readonly slaDeadlineAt?: number;
}

export interface GatewaySlaPolicy {
  readonly enabled: boolean;
  readonly timezone: string;
  readonly businessHoursStart: string; // e.g. "09:00"
  readonly businessHoursEnd: string;   // e.g. "17:00"
  readonly workingDays: readonly number[]; // 1=Mon, 5=Fri
  readonly outOfOfficeMessage: string;
  readonly escalationTimeoutMinutes: number;
}

export interface GatewayInPlaceMutationResult {
  readonly success: boolean;
  readonly channelId: string;
  readonly platform: GatewayPlatform;
  readonly messageId?: string;
  readonly updatedText: string;
  readonly updatedButtons?: readonly GatewayActionButton[];
  readonly inPlaceEditApplied: boolean;
  readonly error?: string;
}

export interface IGatewayDeliveryLedger {
  enqueue(
    payload: Omit<GatewayOutboundPayload, "chunks" | "status" | "attempts" | "timestampMs">,
    chunks: readonly string[]
  ): GatewayOutboundPayload;
  markStatus(payloadId: string, status: GatewayDeliveryStatus, error?: string): void;
  getPending(): readonly GatewayOutboundPayload[];
  getHistory?(limit?: number): readonly GatewayOutboundPayload[];
  clear(): void;
}

export interface GatewaySubstrateSnapshot {
  readonly inboundLedger: readonly GatewayMessage[];
  readonly outboundLedger: readonly GatewayMessage[];
  readonly deliveryReceipts: readonly DeliveryReceipt[];
  readonly channelBindings: readonly ChannelBindingRule[];
  readonly activeLeases: readonly GatewaySessionLease[];
  readonly contacts?: readonly UnifiedContactProfile[];
  readonly whisperNotes?: readonly GatewayWhisperNote[];
  readonly reactions?: readonly GatewayReaction[];
  readonly handoverStates?: Readonly<Record<string, GatewayHandoverMode>>;
  readonly menus?: readonly GatewayInlineMenuNode[];
  readonly wizards?: readonly GatewayInlineWizard[];
  readonly tabGroups?: readonly GatewayInlineTabGroup[];
  readonly dataTables?: readonly GatewayInlineDataTable[];
  readonly ballots?: readonly GatewayInlineBallot[];
  readonly threads?: readonly GatewayThreadTriage[];
  readonly slaPolicy?: GatewaySlaPolicy;
  readonly idempotencyCache: readonly string[];
  readonly totalInbound: number;
  readonly totalOutbound: number;
  readonly totalReceipts: number;
  readonly totalBindings: number;
  readonly totalContacts?: number;
  readonly channelActivity?: Readonly<Record<string, number>>;
  readonly queuedCount?: number;
  readonly config: GatewaySkillConfig;
  readonly timestamp: number;
}

