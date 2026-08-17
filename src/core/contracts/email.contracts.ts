/**
 * email.contracts.ts
 *
 * Core data contracts for the Deterministic Native Email Subsystem (Phase 93 / ADR-123).
 * Ingested from ancestral Hermes Agent triage & email tools and elevated with Superhuman-grade
 * multi-dimensional triage, thread condensation & action extraction, outbound DLP leak scanning,
 * VIP inbox rule management, one-click smart replies, meeting calendar intent detection,
 * Hey.com-grade sender screener & SPF/DKIM authentication, and team collision locks.
 */

export type EmailDisposition =
  | "urgent_reply"
  | "reply"
  | "action_without_reply"
  | "waiting"
  | "reference"
  | "noise";

export type EmailTonePersona =
  | "executive_concise"
  | "friendly_collaborative"
  | "technical_precise"
  | "diplomatic_urgent";

export interface EmailSkillConfig {
  readonly enabled: boolean;
  readonly allowedAccounts: readonly string[];
  readonly allowedSenders?: readonly string[];
  readonly allowedRecipients?: readonly string[];
  readonly draftOnlyMode: boolean;
  readonly quarantineSuspiciousPayloads: boolean;
  readonly enableOutboundDlpScanner: boolean;
  readonly enableMeetingIntentDetector: boolean;
  readonly enableHeyScreener: boolean;
  readonly defaultTone: EmailTonePersona;
  readonly autoTriageBatchSize: number;
}

export interface EmailAddress {
  readonly name?: string;
  readonly email: string;
}

export interface EmailThreatAlert {
  readonly category: "prompt_injection" | "phishing_link" | "trojan_instruction" | "suspicious_sender" | "tracking_pixel";
  readonly severity: "LOW" | "MEDIUM" | "CRITICAL";
  readonly snippet: string;
  readonly neutralizedAction: string;
}

export interface EmailMessage {
  readonly id: string;
  readonly threadId: string;
  readonly account: string;
  readonly from: EmailAddress;
  readonly to: readonly EmailAddress[];
  readonly cc?: readonly EmailAddress[];
  readonly subject: string;
  readonly date: number;
  readonly bodyText: string;
  readonly sanitizedBodyText: string;
  readonly snippet: string;
  readonly disposition: EmailDisposition;
  readonly dispositionReason: string;
  readonly unread: boolean;
  readonly labels: readonly string[];
  readonly threats: readonly EmailThreatAlert[];
  readonly hasAttachments: boolean;
  readonly attachmentNames?: readonly string[];
}

export interface EmailDraft {
  readonly draftId: string;
  readonly threadId: string;
  readonly account: string;
  readonly to: readonly EmailAddress[];
  readonly subject: string;
  readonly bodyMarkdown: string;
  readonly tone: EmailTonePersona;
  readonly rationale: string;
  readonly status: "staged_in_outbox" | "approved" | "dispatched" | "discarded";
  readonly dlpScanPassed: boolean;
  readonly createdAt: number;
  readonly approvedAt?: number;
  readonly formattedCard: string;
}

export interface EmailTriageReport {
  readonly totalProcessed: number;
  readonly urgentCount: number;
  readonly replyNeededCount: number;
  readonly actionNeededCount: number;
  readonly waitingCount: number;
  readonly referenceCount: number;
  readonly noiseCount: number;
  readonly threatsNeutralizedCount: number;
  readonly threads: readonly EmailMessage[];
  readonly summaryCard: string;
  readonly timestamp: number;
}

export interface EmailThreatAnalysis {
  readonly messageId: string;
  readonly isClean: boolean;
  readonly riskScore: number;
  readonly threatsFound: readonly EmailThreatAlert[];
  readonly sanitizedSubject: string;
  readonly sanitizedBody: string;
  readonly inspectionCard: string;
}

// ---------------------------------------------------------------------------
// Beyond the Fold: Multi-Message Thread Summarization & Action Extraction
// ---------------------------------------------------------------------------

export interface ThreadActionItem {
  readonly assignee: string;
  readonly task: string;
  readonly deadline?: string;
  readonly isCompleted: boolean;
}

export interface ThreadSummaryAnalysis {
  readonly threadId: string;
  readonly subject: string;
  readonly messageCount: number;
  readonly participants: readonly string[];
  readonly executiveSummary: string;
  readonly keyDecisionsMade: readonly string[];
  readonly openActionItems: readonly ThreadActionItem[];
  readonly sentiment: "positive" | "neutral" | "urgent_blocker" | "conflicted";
  readonly formattedSummaryCard: string;
}

// ---------------------------------------------------------------------------
// Beyond the Fold: Outbound DLP (Data Loss Prevention) Scanner
// ---------------------------------------------------------------------------

export interface DataLossPreventionFinding {
  readonly leakType: "api_key" | "private_key" | "credit_card" | "social_security" | "password_credential" | "internal_token";
  readonly severity: "CRITICAL" | "HIGH" | "MEDIUM";
  readonly maskedSnippet: string;
  readonly recommendation: string;
}

export interface OutboundDlpReport {
  readonly isSafeToDispatch: boolean;
  readonly findings: readonly DataLossPreventionFinding[];
  readonly inspectedLength: number;
  readonly formattedReportCard: string;
}

// ---------------------------------------------------------------------------
// Beyond the Fold: VIP Inboxes & Follow-Up Reminders
// ---------------------------------------------------------------------------

export interface VipContactRule {
  readonly emailOrDomain: string;
  readonly contactName: string;
  readonly priorityBoost: number;
  readonly targetQueue: "VIP_DIRECT" | "INVESTOR" | "EXECUTIVE" | "URGENT_SUPPORT";
  readonly customSlaMinutes: number;
}

export interface FollowUpReminder {
  readonly reminderId: string;
  readonly threadId: string;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly remindAtTimestamp: number;
  readonly note: string;
  readonly isTriggered: boolean;
}

// ---------------------------------------------------------------------------
// Next Frontier: 1-Click Smart Replies & Intent Suggestion Matrix
// ---------------------------------------------------------------------------

export interface QuickReplyOption {
  readonly optionId: string;
  readonly label: string; // e.g. "Confirm & Approve", "Request More Context", "Politely Decline"
  readonly generatedSnippet: string;
  readonly tone: EmailTonePersona;
}

export interface SmartReplySuggestions {
  readonly threadId: string;
  readonly suggestedOptions: readonly QuickReplyOption[];
  readonly detectedIntent: "approval_request" | "information_inquiry" | "scheduling" | "feedback" | "fyi";
  readonly formattedSuggestionsCard: string;
}

// ---------------------------------------------------------------------------
// Next Frontier: Meeting Scheduling Intent & Calendar Assistant
// ---------------------------------------------------------------------------

export interface MeetingScheduleIntent {
  readonly threadId: string;
  readonly isMeetingRequested: boolean;
  readonly requestedDurationMinutes?: number;
  readonly proposedTimeWindows: readonly string[]; // e.g. ["Thursday 2 PM EST", "Friday 10 AM EST"]
  readonly timezone?: string;
  readonly suggestedConfirmationDraft: string;
  readonly formattedCalendarCard: string;
}

// ---------------------------------------------------------------------------
// Next Frontier: Sender Authentication & Hey.com-Grade Screener
// ---------------------------------------------------------------------------

export interface SenderAuthSecurityStatus {
  readonly senderEmail: string;
  readonly isFirstTimeSender: boolean;
  readonly dkimPassed: boolean;
  readonly spfPassed: boolean;
  readonly dmarcPassed: boolean;
  readonly screenerStatus: "INBOX" | "SCREENER_QUARANTINE" | "BLOCKED_SPAM";
  readonly senderReputationScore: number; // 0-100
  readonly formattedScreenerCard: string;
}

// ---------------------------------------------------------------------------
// Next Frontier: Thread Collision Lock & Team Presence Protection
// ---------------------------------------------------------------------------

export interface ThreadCollisionLock {
  readonly threadId: string;
  readonly lockedByAgentId: string;
  readonly lockAcquiredAt: number;
  readonly lockExpiresAt: number;
  readonly activeEditorName?: string;
  readonly isLocked: boolean;
}

export interface EmailSubstrateSnapshot {
  readonly messages: readonly EmailMessage[];
  readonly drafts: readonly EmailDraft[];
  readonly quarantinedThreats: readonly EmailThreatAlert[];
  readonly vipRules: readonly VipContactRule[];
  readonly reminders: readonly FollowUpReminder[];
  readonly collisionLocks: readonly ThreadCollisionLock[];
  readonly totalMessages: number;
  readonly totalDrafts: number;
  readonly totalQuarantinedThreats: number;
  readonly totalVipRules: number;
  readonly totalReminders: number;
  readonly config: EmailSkillConfig;
  readonly timestamp: number;
}
