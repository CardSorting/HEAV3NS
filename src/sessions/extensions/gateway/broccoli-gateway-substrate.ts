/**
 * broccoli-gateway-substrate.ts
 *
 * In-memory Broccolidb repository for inbound/outbound messaging ledgers,
 * delivery receipts, channel binding rules, unified omnichannel contacts,
 * whisper notes, reactions, and turn leases (Phase 95 / ADR-125).
 */

import type {
  ChannelBindingRule,
  DeliveryReceipt,
  GatewayBallotOption,
  GatewayChannelSession,
  GatewayHandoverMode,
  GatewayInlineBallot,
  GatewayInlineDataTable,
  GatewayInlineMenuItem,
  GatewayInlineMenuNode,
  GatewayInlineTab,
  GatewayInlineTabGroup,
  GatewayInlineWizard,
  GatewayMessage,
  GatewayPlatform,
  GatewayPlatformType,
  GatewayReaction,
  GatewaySessionLease,
  GatewaySkillConfig,
  GatewaySlaPolicy,
  GatewaySubstrateSnapshot,
  GatewayThreadTriage,
  GatewayWhisperNote,
  GatewayWizardStep,
  LinkedPlatformIdentity,
  UnifiedContactProfile,
} from "../../../core/contracts/gateway.contracts.js";

export class BroccoliGatewaySubstrate {
  private inboundLedger: GatewayMessage[];
  private outboundLedger: GatewayMessage[];
  private deliveryReceipts: Map<string, DeliveryReceipt>;
  private channelBindings: Map<string, ChannelBindingRule>;
  private activeLeases: Map<string, GatewaySessionLease>;
  private idempotencyKeys: Set<string>;
  private channelActivity: Map<string, number>;
  private channels: Map<string, GatewayChannelSession>;
  private contacts: Map<string, UnifiedContactProfile>;
  private identityIndex: Map<string, string>; // platform:userId -> contactId
  private handoverStates: Map<string, GatewayHandoverMode>;
  private whisperNotes: GatewayWhisperNote[];
  private reactions: Map<string, GatewayReaction>; // reactionId -> reaction
  private menus: Map<string, GatewayInlineMenuNode>;
  private wizards: Map<string, GatewayInlineWizard>;
  private tabGroups: Map<string, GatewayInlineTabGroup>;
  private dataTables: Map<string, GatewayInlineDataTable>;
  private ballots: Map<string, GatewayInlineBallot>;
  private threads: Map<string, GatewayThreadTriage>;
  private slaPolicy: GatewaySlaPolicy;
  private config: GatewaySkillConfig;
  private readonly maxLedgerCapacity = 500;

  constructor(initialConfig?: Partial<GatewaySkillConfig>) {
    this.inboundLedger = [];
    this.outboundLedger = [];
    this.deliveryReceipts = new Map();
    this.channelBindings = new Map();
    this.activeLeases = new Map();
    this.idempotencyKeys = new Set();
    this.channelActivity = new Map();
    this.channels = new Map();
    this.contacts = new Map();
    this.identityIndex = new Map();
    this.handoverStates = new Map();
    this.whisperNotes = [];
    this.reactions = new Map();
    this.menus = new Map();
    this.wizards = new Map();
    this.tabGroups = new Map();
    this.dataTables = new Map();
    this.ballots = new Map();
    this.threads = new Map();
    this.slaPolicy = {
      enabled: true,
      timezone: "UTC",
      businessHoursStart: "09:00",
      businessHoursEnd: "17:00",
      workingDays: [1, 2, 3, 4, 5],
      outOfOfficeMessage: "Thanks for reaching out! Our team is currently offline. We will respond at 09:00 UTC.",
      escalationTimeoutMinutes: 15,
    };
    this.config = {
      enabled: false,
      allowedPlatforms: ["telegram", "slack", "discord", "whatsapp", "signal", "webhook"],
      requireHmacVerification: true,
      maxPayloadSizeBytes: 1048576, // 1 MB
      rateLimitPerMinute: 60,
      webhookJitterToleranceMs: 300000, // 5 min
      enableRichFormattingCompilation: true,
      defaultDeliveryTimeoutMs: 5000,
      quietHoursEnabled: false,
      quietHoursStartHourUtc: 22,
      quietHoursEndHourUtc: 7,
      ...initialConfig,
    };
  }

  getConfig(): GatewaySkillConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<GatewaySkillConfig>): GatewaySkillConfig {
    this.config = {
      ...this.config,
      ...updates,
    };
    return this.getConfig();
  }

  // --- Channel Sessions & Activity ---
  registerChannel(session: GatewayChannelSession): void {
    this.channels.set(session.channelId, session);
  }

  getChannel(channelId: string): GatewayChannelSession | undefined {
    return this.channels.get(channelId);
  }

  listChannels(platform?: GatewayPlatformType): readonly GatewayChannelSession[] {
    const list = Array.from(this.channels.values());
    if (!platform) return list;
    return list.filter((c) => c.platform === platform);
  }

  recordInbound(channelId: string, platform?: GatewayPlatform): void {
    const key = platform ? `${platform}:${channelId}` : channelId;
    this.channelActivity.set(key, (this.channelActivity.get(key) || 0) + 1);

    const existing = this.channels.get(channelId);
    if (existing) {
      this.channels.set(channelId, {
        ...existing,
        totalMessagesInbound: existing.totalMessagesInbound + 1,
        lastActiveTimestampMs: Date.now(),
      });
    } else if (platform) {
      this.channels.set(channelId, {
        channelId,
        platform,
        sessionKey: `sess-${platform}-${channelId}`,
        totalMessagesInbound: 1,
        totalMessagesOutbound: 0,
        lastActiveTimestampMs: Date.now(),
      });
    }
  }

  recordOutbound(channelId: string, platform?: GatewayPlatform): void {
    const key = platform ? `${platform}:${channelId}` : channelId;
    this.channelActivity.set(key, (this.channelActivity.get(key) || 0) + 1);

    const existing = this.channels.get(channelId);
    if (existing) {
      this.channels.set(channelId, {
        ...existing,
        totalMessagesOutbound: existing.totalMessagesOutbound + 1,
        lastActiveTimestampMs: Date.now(),
      });
    }
  }

  getChannelActivity(): Readonly<Record<string, number>> {
    return Object.fromEntries(this.channelActivity);
  }

  // --- Message Ledgers ---
  recordInboundMessage(message: GatewayMessage): void {
    if (this.inboundLedger.length >= this.maxLedgerCapacity) {
      this.inboundLedger.shift();
    }
    this.inboundLedger.push(message);
    this.idempotencyKeys.add(message.idempotencyKey);
    this.recordInbound(message.channelId, message.platform);
  }

  listInboundMessages(): readonly GatewayMessage[] {
    return [...this.inboundLedger];
  }

  recordOutboundMessage(message: GatewayMessage): void {
    if (this.outboundLedger.length >= this.maxLedgerCapacity) {
      this.outboundLedger.shift();
    }
    this.outboundLedger.push(message);
    this.idempotencyKeys.add(message.idempotencyKey);
    this.recordOutbound(message.channelId, message.platform);
  }

  listOutboundMessages(): readonly GatewayMessage[] {
    return [...this.outboundLedger];
  }

  // --- Delivery Receipts ---
  recordDeliveryReceipt(receipt: DeliveryReceipt): void {
    this.deliveryReceipts.set(receipt.receiptId, receipt);
  }

  getDeliveryReceipt(receiptId: string): DeliveryReceipt | undefined {
    return this.deliveryReceipts.get(receiptId);
  }

  listDeliveryReceipts(): readonly DeliveryReceipt[] {
    return Array.from(this.deliveryReceipts.values());
  }

  // --- Channel Bindings ---
  storeChannelBinding(binding: ChannelBindingRule): void {
    const key = `${binding.platform}:${binding.channelId}`;
    this.channelBindings.set(key, binding);
    if (binding.handoverMode) {
      this.handoverStates.set(binding.channelId, binding.handoverMode);
    }
  }

  getChannelBinding(platform: string, channelId: string): ChannelBindingRule | undefined {
    const key = `${platform}:${channelId}`;
    return this.channelBindings.get(key);
  }

  listChannelBindings(): readonly ChannelBindingRule[] {
    return Array.from(this.channelBindings.values());
  }

  removeChannelBinding(platform: string, channelId: string): boolean {
    const key = `${platform}:${channelId}`;
    return this.channelBindings.delete(key);
  }

  // --- Session Leases ---
  acquireSessionLease(
    sessionId: string,
    channelId: string,
    platform: any,
    userId: string,
    ttlMs = 60000
  ): GatewaySessionLease {
    const now = Date.now();
    const existing = this.activeLeases.get(sessionId);
    if (existing && existing.isHeld && existing.expiresAt > now && existing.acquiredByUserId !== userId) {
      return existing;
    }

    const lease: GatewaySessionLease = {
      leaseId: `lease_${sessionId}_${now}`,
      sessionId,
      channelId,
      platform,
      acquiredByUserId: userId,
      acquiredAt: now,
      expiresAt: now + ttlMs,
      isHeld: true,
    };
    this.activeLeases.set(sessionId, lease);
    return lease;
  }

  releaseSessionLease(sessionId: string): boolean {
    return this.activeLeases.delete(sessionId);
  }

  getSessionLease(sessionId: string): GatewaySessionLease | undefined {
    const lease = this.activeLeases.get(sessionId);
    if (!lease) return undefined;
    if (lease.expiresAt < Date.now()) {
      this.activeLeases.delete(sessionId);
      return undefined;
    }
    return lease;
  }

  hasIdempotencyKey(key: string): boolean {
    return this.idempotencyKeys.has(key);
  }

  // --- Omnichannel Unified Contact Profiles ---
  upsertContact(contact: UnifiedContactProfile): UnifiedContactProfile {
    this.contacts.set(contact.contactId, contact);
    for (const id of contact.linkedIdentities) {
      const idxKey = `${id.platform}:${id.platformUserId}`;
      this.identityIndex.set(idxKey, contact.contactId);
    }
    return contact;
  }

  getContact(contactId: string): UnifiedContactProfile | undefined {
    return this.contacts.get(contactId);
  }

  getContactByPlatformIdentity(platform: GatewayPlatform, platformUserId: string): UnifiedContactProfile | undefined {
    const idxKey = `${platform}:${platformUserId}`;
    const contactId = this.identityIndex.get(idxKey);
    if (!contactId) return undefined;
    return this.contacts.get(contactId);
  }

  listContacts(): readonly UnifiedContactProfile[] {
    return Array.from(this.contacts.values());
  }

  linkPlatformToContact(contactId: string, identity: LinkedPlatformIdentity): UnifiedContactProfile | undefined {
    const existing = this.contacts.get(contactId);
    if (!existing) return undefined;

    const filtered = existing.linkedIdentities.filter(
      (id) => !(id.platform === identity.platform && id.platformUserId === identity.platformUserId)
    );
    const updated: UnifiedContactProfile = {
      ...existing,
      linkedIdentities: [...filtered, identity],
      lastActiveAt: Date.now(),
    };
    this.upsertContact(updated);
    return updated;
  }

  // --- Handover & Co-Pilot Modes ---
  setHandoverMode(channelId: string, mode: GatewayHandoverMode): void {
    this.handoverStates.set(channelId, mode);
  }

  getHandoverMode(channelId: string): GatewayHandoverMode {
    return this.handoverStates.get(channelId) || "AGENT_AUTONOMOUS";
  }

  // --- Whisper Notes ---
  recordWhisperNote(note: GatewayWhisperNote): void {
    if (this.whisperNotes.length >= this.maxLedgerCapacity) {
      this.whisperNotes.shift();
    }
    this.whisperNotes.push(note);
  }

  listWhisperNotes(channelId?: string): readonly GatewayWhisperNote[] {
    if (!channelId) return [...this.whisperNotes];
    return this.whisperNotes.filter((n) => n.channelId === channelId);
  }

  // --- Reactions ---
  addReaction(reaction: GatewayReaction): void {
    this.reactions.set(reaction.reactionId, reaction);
  }

  removeReaction(messageId: string, userId: string, emoji: string): boolean {
    let deleted = false;
    for (const [id, r] of this.reactions.entries()) {
      if (r.messageId === messageId && r.userId === userId && r.emoji === emoji) {
        this.reactions.delete(id);
        deleted = true;
      }
    }
    return deleted;
  }

  listReactions(messageId?: string): readonly GatewayReaction[] {
    const all = Array.from(this.reactions.values());
    if (!messageId) return all;
    return all.filter((r) => r.messageId === messageId);
  }

  // --- Menus ---
  upsertMenuNode(node: GatewayInlineMenuNode): void {
    this.menus.set(node.nodeId, node);
  }

  getMenuNode(nodeId: string): GatewayInlineMenuNode | undefined {
    return this.menus.get(nodeId);
  }

  listMenuNodes(): readonly GatewayInlineMenuNode[] {
    return Array.from(this.menus.values());
  }

  // --- Wizards ---
  upsertWizard(wizard: GatewayInlineWizard): void {
    this.wizards.set(wizard.wizardId, wizard);
  }

  getWizard(wizardId: string): GatewayInlineWizard | undefined {
    return this.wizards.get(wizardId);
  }

  listWizards(): readonly GatewayInlineWizard[] {
    return Array.from(this.wizards.values());
  }

  // --- Tab Groups ---
  upsertTabGroup(tabGroup: GatewayInlineTabGroup): void {
    this.tabGroups.set(tabGroup.tabGroupId, tabGroup);
  }

  getTabGroup(tabGroupId: string): GatewayInlineTabGroup | undefined {
    return this.tabGroups.get(tabGroupId);
  }

  // --- Data Tables ---
  upsertDataTable(table: GatewayInlineDataTable): void {
    this.dataTables.set(table.tableId, table);
  }

  getDataTable(tableId: string): GatewayInlineDataTable | undefined {
    return this.dataTables.get(tableId);
  }

  // --- Ballots ---
  upsertBallot(ballot: GatewayInlineBallot): void {
    this.ballots.set(ballot.ballotId, ballot);
  }

  getBallot(ballotId: string): GatewayInlineBallot | undefined {
    return this.ballots.get(ballotId);
  }

  listBallots(): readonly GatewayInlineBallot[] {
    return Array.from(this.ballots.values());
  }

  // --- Thread Triage & SLAs ---
  upsertThread(thread: GatewayThreadTriage): void {
    this.threads.set(thread.threadId, thread);
  }

  getThread(threadId: string): GatewayThreadTriage | undefined {
    return this.threads.get(threadId);
  }

  listThreads(status?: "UNASSIGNED" | "ASSIGNED" | "RESOLVED" | "SNOOZED"): readonly GatewayThreadTriage[] {
    const list = Array.from(this.threads.values());
    if (!status) return list;
    return list.filter((t) => t.status === status);
  }

  getSlaPolicy(): GatewaySlaPolicy {
    return { ...this.slaPolicy };
  }

  updateSlaPolicy(updates: Partial<GatewaySlaPolicy>): GatewaySlaPolicy {
    this.slaPolicy = {
      ...this.slaPolicy,
      ...updates,
    };
    return this.getSlaPolicy();
  }

  // --- Snapshotting & State Rollback ---
  exportSnapshot(): GatewaySubstrateSnapshot {
    return {
      inboundLedger: [...this.inboundLedger],
      outboundLedger: [...this.outboundLedger],
      deliveryReceipts: Array.from(this.deliveryReceipts.values()),
      channelBindings: Array.from(this.channelBindings.values()),
      activeLeases: Array.from(this.activeLeases.values()),
      contacts: Array.from(this.contacts.values()),
      whisperNotes: [...this.whisperNotes],
      reactions: Array.from(this.reactions.values()),
      handoverStates: Object.fromEntries(this.handoverStates),
      menus: Array.from(this.menus.values()),
      wizards: Array.from(this.wizards.values()),
      tabGroups: Array.from(this.tabGroups.values()),
      dataTables: Array.from(this.dataTables.values()),
      ballots: Array.from(this.ballots.values()),
      threads: Array.from(this.threads.values()),
      slaPolicy: { ...this.slaPolicy },
      idempotencyCache: Array.from(this.idempotencyKeys),
      totalInbound: this.inboundLedger.length,
      totalOutbound: this.outboundLedger.length,
      totalReceipts: this.deliveryReceipts.size,
      totalBindings: this.channelBindings.size,
      totalContacts: this.contacts.size,
      channelActivity: this.getChannelActivity(),
      config: { ...this.config },
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: GatewaySubstrateSnapshot): void {
    this.config = { ...snapshot.config };
    this.inboundLedger = snapshot.inboundLedger ? [...snapshot.inboundLedger] : [];
    this.outboundLedger = snapshot.outboundLedger ? [...snapshot.outboundLedger] : [];
    this.deliveryReceipts = new Map();
    for (const r of snapshot.deliveryReceipts || []) {
      this.deliveryReceipts.set(r.receiptId, r);
    }
    this.channelBindings = new Map();
    for (const b of snapshot.channelBindings || []) {
      const key = `${b.platform}:${b.channelId}`;
      this.channelBindings.set(key, b);
    }
    this.activeLeases = new Map();
    for (const l of snapshot.activeLeases || []) {
      this.activeLeases.set(l.sessionId, l);
    }
    this.contacts = new Map();
    this.identityIndex = new Map();
    for (const c of snapshot.contacts || []) {
      this.upsertContact(c);
    }
    this.whisperNotes = snapshot.whisperNotes ? [...snapshot.whisperNotes] : [];
    this.reactions = new Map();
    for (const r of snapshot.reactions || []) {
      this.reactions.set(r.reactionId, r);
    }
    this.menus = new Map();
    for (const m of snapshot.menus || []) {
      this.menus.set(m.nodeId, m);
    }
    this.wizards = new Map();
    for (const w of snapshot.wizards || []) {
      this.wizards.set(w.wizardId, w);
    }
    this.tabGroups = new Map();
    for (const tg of snapshot.tabGroups || []) {
      this.tabGroups.set(tg.tabGroupId, tg);
    }
    this.dataTables = new Map();
    for (const dt of snapshot.dataTables || []) {
      this.dataTables.set(dt.tableId, dt);
    }
    this.ballots = new Map();
    for (const bl of snapshot.ballots || []) {
      this.ballots.set(bl.ballotId, bl);
    }
    this.threads = new Map();
    for (const th of snapshot.threads || []) {
      this.threads.set(th.threadId, th);
    }
    if (snapshot.slaPolicy) {
      this.slaPolicy = { ...snapshot.slaPolicy };
    }
    this.handoverStates = new Map(Object.entries(snapshot.handoverStates || {}));
    this.idempotencyKeys = new Set(snapshot.idempotencyCache || []);
    this.channelActivity = new Map(Object.entries(snapshot.channelActivity || {}));
  }

  clear(): void {
    this.inboundLedger = [];
    this.outboundLedger = [];
    this.deliveryReceipts.clear();
    this.channelBindings.clear();
    this.activeLeases.clear();
    this.contacts.clear();
    this.identityIndex.clear();
    this.handoverStates.clear();
    this.whisperNotes = [];
    this.reactions.clear();
    this.menus.clear();
    this.wizards.clear();
    this.tabGroups.clear();
    this.dataTables.clear();
    this.ballots.clear();
    this.threads.clear();
    this.idempotencyKeys.clear();
    this.channelActivity.clear();
    this.channels.clear();
  }
}
