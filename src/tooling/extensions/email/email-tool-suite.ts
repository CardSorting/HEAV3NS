/**
 * email-tool-suite.ts
 *
 * Model tool surface for the Native Email Subsystem (Phase 93 / ADR-123).
 * Exposes Superhuman-grade inbox triage, thread executive summarization with action items,
 * outbound Data Loss Prevention (DLP) leak scanning, persona tone styling, 1-click smart reply suggestions,
 * calendar meeting scheduling intent extraction, Hey.com sender authentication screening, and thread collision locking.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { EmailTonePersona, VipContactRule } from "../../../core/contracts/email.contracts.js";
import { EmailSupervisor } from "../../../agents/extensions/email/email-supervisor.js";

export class EmailToolSuite {
  private readonly supervisor: EmailSupervisor;

  constructor(supervisor: EmailSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "email_triage_inbox",
        description: "Executes a Superhuman-grade inbox triage pass, categorizing threads into actionable disposition queues and neutralizing prompt injection attacks.",
        parameters: {
          limit: { type: "number", description: "Maximum number of messages to triage (default: 50)" },
        },
        execute: async (_args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const result = this.supervisor.triageInbox();

          if (!result.success || !result.report) {
            return {
              success: false,
              error: result.error || "Inbox triage failed",
            };
          }

          return {
            success: true,
            totalProcessed: result.report.totalProcessed,
            urgentCount: result.report.urgentCount,
            replyNeededCount: result.report.replyNeededCount,
            actionNeededCount: result.report.actionNeededCount,
            waitingCount: result.report.waitingCount,
            referenceCount: result.report.referenceCount,
            noiseCount: result.report.noiseCount,
            threatsNeutralizedCount: result.report.threatsNeutralizedCount,
            preview: result.report.summaryCard,
          };
        },
      },
      {
        name: "email_summarize_thread",
        description: "Condenses a multi-message email conversation into an executive briefing and extracts open action items with assignees.",
        parameters: {
          threadId: { type: "string", required: true, description: "Thread ID to summarize" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const threadId = String(args.threadId || "").trim();
          const result = this.supervisor.summarizeThread(threadId);

          if (!result.success || !result.summary) {
            return {
              success: false,
              error: result.error || "Thread summarization failed",
            };
          }

          return {
            success: true,
            threadId: result.summary.threadId,
            subject: result.summary.subject,
            messageCount: result.summary.messageCount,
            participants: result.summary.participants,
            executiveSummary: result.summary.executiveSummary,
            actionItemsCount: result.summary.openActionItems.length,
            preview: result.summary.formattedSummaryCard,
          };
        },
      },
      {
        name: "email_draft_reply",
        description: "Stages a safe reply draft in the local outbox with persona tone styling (executive_concise, friendly_collaborative, technical_precise, diplomatic_urgent) and DLP verification.",
        parameters: {
          threadId: { type: "string", required: true, description: "Parent thread identifier" },
          recipientEmail: { type: "string", required: true, description: "Recipient email address" },
          recipientName: { type: "string", description: "Recipient display name" },
          subject: { type: "string", required: true, description: "Email subject line" },
          bodyMarkdown: { type: "string", required: true, description: "Proposed draft body in Markdown" },
          tone: { type: "string", description: "Draft persona tone: executive_concise, friendly_collaborative, technical_precise, diplomatic_urgent (default: executive_concise)" },
          rationale: { type: "string", description: "Reasoning context explaining why this response was structured this way" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const threadId = String(args.threadId || "th_general");
          const recipientEmail = String(args.recipientEmail || "recipient@example.com");
          const recipientName = args.recipientName ? String(args.recipientName) : undefined;
          const subject = String(args.subject || "Reply");
          const bodyMarkdown = String(args.bodyMarkdown || "");
          const tone = (String(args.tone || "executive_concise")) as EmailTonePersona;
          const rationale = args.rationale ? String(args.rationale) : undefined;

          const to = [{ name: recipientName, email: recipientEmail }];
          const result = this.supervisor.draftReply(
            threadId,
            "primary@company.com",
            to,
            subject,
            bodyMarkdown,
            tone,
            rationale
          );

          if (!result.success || !result.draft) {
            return {
              success: false,
              error: result.error || "Draft generation failed",
            };
          }

          return {
            success: true,
            draftId: result.draft.draftId,
            status: result.draft.status,
            tone: result.draft.tone,
            dlpScanPassed: result.draft.dlpScanPassed,
            preview: result.draft.formattedCard,
          };
        },
      },
      {
        name: "email_generate_smart_replies",
        description: "Generates 3 contextual 1-click smart reply suggestions (Confirm, Request Info, Decline) based on message intent.",
        parameters: {
          threadId: { type: "string", required: true, description: "Parent thread ID" },
          subject: { type: "string", required: true, description: "Email subject" },
          bodyText: { type: "string", required: true, description: "Email body text" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const threadId = String(args.threadId || "th_01");
          const subject = String(args.subject || "");
          const bodyText = String(args.bodyText || "");

          const result = this.supervisor.generateSmartReplies(threadId, subject, bodyText);
          if (!result.success || !result.suggestions) {
            return {
              success: false,
              error: result.error || "Smart reply generation failed",
            };
          }

          return {
            success: true,
            detectedIntent: result.suggestions.detectedIntent,
            optionsCount: result.suggestions.suggestedOptions.length,
            options: result.suggestions.suggestedOptions,
            preview: result.suggestions.formattedSuggestionsCard,
          };
        },
      },
      {
        name: "email_detect_meeting_intent",
        description: "Extracts calendar meeting scheduling requests, proposed timeslots, and generates instant hold confirmations.",
        parameters: {
          threadId: { type: "string", required: true, description: "Thread ID" },
          bodyText: { type: "string", required: true, description: "Message body text" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const threadId = String(args.threadId || "th_01");
          const bodyText = String(args.bodyText || "");

          const result = this.supervisor.detectMeetingIntent(threadId, bodyText);
          if (!result.success || !result.meeting) {
            return {
              success: false,
              error: result.error || "Meeting detection failed",
            };
          }

          return {
            success: true,
            isMeetingRequested: result.meeting.isMeetingRequested,
            proposedSlots: result.meeting.proposedTimeWindows,
            confirmationDraft: result.meeting.suggestedConfirmationDraft,
            preview: result.meeting.formattedCalendarCard,
          };
        },
      },
      {
        name: "email_evaluate_sender_auth",
        description: "Inspects SPF/DKIM/DMARC headers and runs sender reputation through the Hey.com-grade First-Time Screener.",
        parameters: {
          senderEmail: { type: "string", required: true, description: "Sender email address" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const senderEmail = String(args.senderEmail || "");
          const result = this.supervisor.evaluateSenderAuth(senderEmail);

          if (!result.success || !result.authStatus) {
            return {
              success: false,
              error: result.error || "Sender evaluation failed",
            };
          }

          return {
            success: true,
            screenerStatus: result.authStatus.screenerStatus,
            isFirstTimeSender: result.authStatus.isFirstTimeSender,
            reputationScore: result.authStatus.senderReputationScore,
            preview: result.authStatus.formattedScreenerCard,
          };
        },
      },
      {
        name: "email_manage_thread_lock",
        description: "Acquires or releases a thread edit lock to prevent duplicate responses across multi-agent or team sessions.",
        parameters: {
          threadId: { type: "string", required: true, description: "Thread identifier" },
          action: { type: "string", description: "Lock action (acquire, release). Default: acquire" },
          agentId: { type: "string", description: "Agent or user ID acquiring the lock" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const threadId = String(args.threadId || "");
          const action = String(args.action || "acquire").toLowerCase();
          const agentId = String(args.agentId || "agent_primary");

          if (action === "release") {
            const released = this.supervisor.releaseThreadLock(threadId);
            return {
              success: true,
              message: released ? `✓ Lock released for thread '${threadId}'.` : `Thread '${threadId}' was not locked.`,
            };
          }

          const lockRes = this.supervisor.acquireThreadLock(threadId, agentId);
          return {
            success: true,
            isLocked: lockRes.lock.isLocked,
            lockedBy: lockRes.lock.lockedByAgentId,
            expiresInSeconds: Math.round((lockRes.lock.lockExpiresAt - Date.now()) / 1000),
          };
        },
      },
      {
        name: "email_scan_outbound_dlp",
        description: "Scans outbound text against Data Loss Prevention (DLP) heuristics to block accidental leaks of API keys, private keys, credit cards, or tokens.",
        parameters: {
          text: { type: "string", required: true, description: "Outbound text content to inspect" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const text = String(args.text || "");
          const result = this.supervisor.scanOutboundDlp(text);

          if (!result.success || !result.report) {
            return {
              success: false,
              error: result.error || "DLP scan failed",
            };
          }

          return {
            success: true,
            isSafeToDispatch: result.report.isSafeToDispatch,
            findingsCount: result.report.findings.length,
            findings: result.report.findings,
            preview: result.report.formattedReportCard,
          };
        },
      },
      {
        name: "email_inspect_threats",
        description: "Performs a forensic security scan on raw email text for prompt injections, trojan zero-width characters, tracking pixels, and malicious links.",
        parameters: {
          subject: { type: "string", required: true, description: "Email subject line" },
          body: { type: "string", required: true, description: "Email body text" },
          messageId: { type: "string", description: "Optional message ID for forensic tracking" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const subject = String(args.subject || "");
          const body = String(args.body || "");
          const messageId = args.messageId ? String(args.messageId) : "msg_inspect";

          const result = this.supervisor.inspectThreats(subject, body, messageId);

          if (!result.success || !result.analysis) {
            return {
              success: false,
              error: result.error || "Forensic inspection failed",
            };
          }

          return {
            success: true,
            isClean: result.analysis.isClean,
            riskScore: result.analysis.riskScore,
            threatsCount: result.analysis.threatsFound.length,
            threats: result.analysis.threatsFound,
            preview: result.analysis.inspectionCard,
          };
        },
      },
      {
        name: "email_manage_vip_rule",
        description: "Configures a VIP sender rule, SLA priority queue, and response deadline.",
        parameters: {
          emailOrDomain: { type: "string", required: true, description: "Sender email or domain (@client.com)" },
          contactName: { type: "string", required: true, description: "Display name or VIP tag" },
          targetQueue: { type: "string", description: "Target queue (VIP_DIRECT, INVESTOR, EXECUTIVE, URGENT_SUPPORT). Default: VIP_DIRECT" },
          customSlaMinutes: { type: "number", description: "Response SLA target in minutes. Default: 60" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const emailOrDomain = String(args.emailOrDomain || "").trim();
          const contactName = String(args.contactName || "VIP Contact");
          const targetQueue = (String(args.targetQueue || "VIP_DIRECT")) as VipContactRule["targetQueue"];
          const customSlaMinutes = typeof args.customSlaMinutes === "number" ? args.customSlaMinutes : 60;

          const result = this.supervisor.storeVipRule({
            emailOrDomain,
            contactName,
            priorityBoost: 50,
            targetQueue,
            customSlaMinutes,
          });

          return {
            success: true,
            message: `✓ VIP rule created for '${emailOrDomain}' -> Queue: ${targetQueue} (${customSlaMinutes}m SLA).`,
            rule: result.rule,
          };
        },
      },
      {
        name: "email_manage_config",
        description: "Enables, disables, or updates security policies (draft-only mode, DLP enforcement, tone) for the Native Email skill.",
        parameters: {
          enabled: { type: "boolean", description: "Enable or disable native email capabilities" },
          draftOnlyMode: { type: "boolean", description: "Enforce safe outbox staging without automated sending" },
          enableOutboundDlpScanner: { type: "boolean", description: "Enable outbound secret and credential leak scanning" },
          defaultTone: { type: "string", description: "Default tone persona (executive_concise, friendly_collaborative, technical_precise, diplomatic_urgent)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const updates: Record<string, unknown> = {};
          if (typeof args.enabled === "boolean") updates.enabled = args.enabled;
          if (typeof args.draftOnlyMode === "boolean") updates.draftOnlyMode = args.draftOnlyMode;
          if (typeof args.enableOutboundDlpScanner === "boolean") updates.enableOutboundDlpScanner = args.enableOutboundDlpScanner;
          if (typeof args.defaultTone === "string") updates.defaultTone = args.defaultTone;

          const updated = this.supervisor.updateConfig(updates);

          return {
            success: true,
            status: updated.enabled ? "ACTIVE (ENABLED)" : "DISABLED (FAIL-CLOSED)",
            config: updated,
            message: updated.enabled
              ? `✓ Email skill is now ENABLED in ${updated.draftOnlyMode ? "DRAFT-ONLY" : "ACTIVE"} mode with default tone '${updated.defaultTone}'.`
              : "✓ Email skill is now DISABLED. All operations will fail closed.",
          };
        },
      },
    ];
  }
}
