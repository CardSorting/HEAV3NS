/**
 * broccoli-email-substrate.ts
 *
 * In-memory Broccolidb repository for email inbox threads, staged outbox drafts,
 * quarantined prompt-injection threats, VIP contact routing rules, follow-up reminders,
 * thread collision locks, and sender screener records (Phase 93 / ADR-123).
 */

import type {
  EmailDraft,
  EmailMessage,
  EmailSkillConfig,
  EmailSubstrateSnapshot,
  EmailThreatAlert,
  FollowUpReminder,
  SenderAuthSecurityStatus,
  ThreadCollisionLock,
  VipContactRule,
} from "../../../core/contracts/email.contracts.js";

export class BroccoliEmailSubstrate {
  private messages: Map<string, EmailMessage>;
  private drafts: Map<string, EmailDraft>;
  private quarantinedThreats: EmailThreatAlert[];
  private vipRules: Map<string, VipContactRule>;
  private reminders: Map<string, FollowUpReminder>;
  private collisionLocks: Map<string, ThreadCollisionLock>;
  private screenerQuarantine: Map<string, SenderAuthSecurityStatus>;
  private config: EmailSkillConfig;

  constructor(initialConfig?: Partial<EmailSkillConfig>) {
    this.messages = new Map();
    this.drafts = new Map();
    this.quarantinedThreats = [];
    this.vipRules = new Map();
    this.reminders = new Map();
    this.collisionLocks = new Map();
    this.screenerQuarantine = new Map();
    this.config = {
      enabled: false,
      allowedAccounts: ["primary@company.com"],
      draftOnlyMode: true,
      quarantineSuspiciousPayloads: true,
      enableOutboundDlpScanner: true,
      enableMeetingIntentDetector: true,
      enableHeyScreener: true,
      defaultTone: "executive_concise",
      autoTriageBatchSize: 50,
      ...initialConfig,
    };
  }

  getConfig(): EmailSkillConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<EmailSkillConfig>): EmailSkillConfig {
    this.config = {
      ...this.config,
      ...updates,
    };
    return this.getConfig();
  }

  storeMessage(message: EmailMessage): void {
    this.messages.set(message.id, message);
  }

  getMessage(id: string): EmailMessage | undefined {
    return this.messages.get(id);
  }

  listMessages(): readonly EmailMessage[] {
    return Array.from(this.messages.values());
  }

  getThreadMessages(threadId: string): readonly EmailMessage[] {
    return Array.from(this.messages.values()).filter((m) => m.threadId === threadId);
  }

  storeDraft(draft: EmailDraft): void {
    this.drafts.set(draft.draftId, draft);
  }

  getDraft(draftId: string): EmailDraft | undefined {
    return this.drafts.get(draftId);
  }

  listDrafts(): readonly EmailDraft[] {
    return Array.from(this.drafts.values());
  }

  updateDraftStatus(draftId: string, status: EmailDraft["status"]): boolean {
    const draft = this.drafts.get(draftId);
    if (!draft) return false;
    this.drafts.set(draftId, {
      ...draft,
      status,
      approvedAt: status === "approved" || status === "dispatched" ? Date.now() : draft.approvedAt,
    });
    return true;
  }

  recordThreat(threat: EmailThreatAlert): void {
    this.quarantinedThreats.push(threat);
  }

  listThreats(): readonly EmailThreatAlert[] {
    return [...this.quarantinedThreats];
  }

  storeVipRule(rule: VipContactRule): void {
    this.vipRules.set(rule.emailOrDomain.toLowerCase(), rule);
  }

  getVipRule(emailOrDomain: string): VipContactRule | undefined {
    return this.vipRules.get(emailOrDomain.toLowerCase());
  }

  listVipRules(): readonly VipContactRule[] {
    return Array.from(this.vipRules.values());
  }

  storeReminder(reminder: FollowUpReminder): void {
    this.reminders.set(reminder.reminderId, reminder);
  }

  getReminder(reminderId: string): FollowUpReminder | undefined {
    return this.reminders.get(reminderId);
  }

  listReminders(): readonly FollowUpReminder[] {
    return Array.from(this.reminders.values());
  }

  acquireThreadLock(threadId: string, agentId: string, durationMs = 300000): ThreadCollisionLock {
    const existing = this.collisionLocks.get(threadId);
    const now = Date.now();
    if (existing && existing.isLocked && existing.lockExpiresAt > now && existing.lockedByAgentId !== agentId) {
      return existing;
    }

    const lock: ThreadCollisionLock = {
      threadId,
      lockedByAgentId: agentId,
      lockAcquiredAt: now,
      lockExpiresAt: now + durationMs,
      activeEditorName: `Agent ${agentId}`,
      isLocked: true,
    };
    this.collisionLocks.set(threadId, lock);
    return lock;
  }

  releaseThreadLock(threadId: string): boolean {
    return this.collisionLocks.delete(threadId);
  }

  getThreadLock(threadId: string): ThreadCollisionLock | undefined {
    const lock = this.collisionLocks.get(threadId);
    if (!lock) return undefined;
    if (lock.lockExpiresAt < Date.now()) {
      this.collisionLocks.delete(threadId);
      return undefined;
    }
    return lock;
  }

  storeScreenerStatus(status: SenderAuthSecurityStatus): void {
    this.screenerQuarantine.set(status.senderEmail.toLowerCase(), status);
  }

  getScreenerStatus(senderEmail: string): SenderAuthSecurityStatus | undefined {
    return this.screenerQuarantine.get(senderEmail.toLowerCase());
  }

  exportSnapshot(): EmailSubstrateSnapshot {
    return {
      messages: Array.from(this.messages.values()),
      drafts: Array.from(this.drafts.values()),
      quarantinedThreats: [...this.quarantinedThreats],
      vipRules: Array.from(this.vipRules.values()),
      reminders: Array.from(this.reminders.values()),
      collisionLocks: Array.from(this.collisionLocks.values()),
      totalMessages: this.messages.size,
      totalDrafts: this.drafts.size,
      totalQuarantinedThreats: this.quarantinedThreats.length,
      totalVipRules: this.vipRules.size,
      totalReminders: this.reminders.size,
      config: { ...this.config },
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: EmailSubstrateSnapshot): void {
    this.config = { ...snapshot.config };
    this.messages = new Map();
    for (const m of snapshot.messages || []) {
      this.messages.set(m.id, m);
    }
    this.drafts = new Map();
    for (const d of snapshot.drafts || []) {
      this.drafts.set(d.draftId, d);
    }
    this.quarantinedThreats = snapshot.quarantinedThreats ? [...snapshot.quarantinedThreats] : [];
    this.vipRules = new Map();
    for (const v of snapshot.vipRules || []) {
      this.vipRules.set(v.emailOrDomain.toLowerCase(), v);
    }
    this.reminders = new Map();
    for (const r of snapshot.reminders || []) {
      this.reminders.set(r.reminderId, r);
    }
    this.collisionLocks = new Map();
    for (const l of snapshot.collisionLocks || []) {
      this.collisionLocks.set(l.threadId, l);
    }
  }

  clear(): void {
    this.messages.clear();
    this.drafts.clear();
    this.quarantinedThreats = [];
    this.vipRules.clear();
    this.reminders.clear();
    this.collisionLocks.clear();
    this.screenerQuarantine.clear();
  }
}
