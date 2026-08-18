/**
 * email-tool-suite.ts
 *
 * Model tool surface for the Native Email Subsystem (Phase 93 / ADR-123).
 * Exposes Superhuman-grade inbox triage, thread executive summarization with action items,
 * outbound Data Loss Prevention (DLP) leak scanning, persona tone styling, 1-click smart reply suggestions,
 * calendar meeting scheduling intent extraction, Hey.com sender authentication screening, and thread collision locking.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  EmailDisposition,
  EmailGroupBy,
  EmailNotificationUrgency,
  EmailSortBy,
  EmailSortDirection,
  EmailTonePersona,
  VipContactRule,
} from "../../../core/contracts/email.contracts.js";
import { EmailSupervisor } from "../../../agents/extensions/email/email-supervisor.js";
import { BroccoliEmailSubstrate } from "../../../sessions/extensions/email/broccoli-email-substrate.js";
import { DeterministicEmailEngine } from "./deterministic-email-engine.js";
import { EmailSnapshotManager } from "../../../sessions/extensions/email/email-snapshot-manager.js";
import { EmailDesktopNotificationDispatcher } from "./email-notification-dispatcher.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class EmailToolSuite {
  private readonly supervisor: EmailSupervisor;
  private readonly substrate: BroccoliEmailSubstrate;
  private readonly engine: DeterministicEmailEngine;
  private readonly snapshotManager: EmailSnapshotManager;
  private readonly notificationDispatcher: EmailDesktopNotificationDispatcher;

  constructor(
    supervisor?: EmailSupervisor,
    substrate?: BroccoliEmailSubstrate,
    engine?: DeterministicEmailEngine
  ) {
    this.engine = engine ?? new DeterministicEmailEngine();
    this.notificationDispatcher = new EmailDesktopNotificationDispatcher();
    this.substrate = substrate ?? new BroccoliEmailSubstrate({ enabled: true }, undefined, this.notificationDispatcher);
    this.supervisor = supervisor ?? new EmailSupervisor(this.substrate, this.engine);
    this.snapshotManager = new EmailSnapshotManager(this.substrate);
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "email_triage_inbox",
        description: "Executes a Superhuman-grade inbox triage pass, categorizing threads into actionable disposition queues and neutralizing prompt injection attacks.",
        parameters: {
          limit: { type: "number", description: "Maximum number of messages to triage (default: 50)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_triage_inbox", args);
        },
      },
      {
        name: "email_summarize_thread",
        description: "Condenses a multi-message email conversation into an executive briefing and extracts open action items with assignees.",
        parameters: {
          threadId: { type: "string", required: true, description: "Thread ID to summarize" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_summarize_thread", args);
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
          tone: { type: "string", description: "Draft persona tone (default: executive_concise)" },
          rationale: { type: "string", description: "Reasoning context" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_draft_reply", args);
        },
      },
      {
        name: "email_approve_and_dispatch",
        description: "Approves a staged outbox draft for dispatch after human verification.",
        parameters: {
          draftId: { type: "string", required: true, description: "Draft ID to approve and dispatch" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_approve_and_dispatch", args);
        },
      },
      {
        name: "email_scan_outbound_dlp",
        description: "Scans outbound email text for accidental leaks of API keys, private keys, credit cards, or internal credentials.",
        parameters: {
          content: { type: "string", required: true, description: "Email body text to scan" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_scan_outbound_dlp", args);
        },
      },
      {
        name: "email_suggest_smart_replies",
        description: "Generates 1-click smart reply suggestions with contextual options based on inbound message intent.",
        parameters: {
          threadId: { type: "string", required: true, description: "Thread ID" },
          subject: { type: "string", required: true, description: "Message subject" },
          bodyText: { type: "string", required: true, description: "Message body text" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_suggest_smart_replies", args);
        },
      },
      {
        name: "email_detect_meeting_intent",
        description: "Parses email text for meeting scheduling requests and extracts proposed time windows.",
        parameters: {
          threadId: { type: "string", required: true, description: "Thread ID" },
          bodyText: { type: "string", required: true, description: "Message body text" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_detect_meeting_intent", args);
        },
      },
      {
        name: "email_screen_sender",
        description: "Evaluates sender reputation, first-time status, and SPF/DKIM authentication against Hey.com-style screener rules.",
        parameters: {
          senderEmail: { type: "string", required: true, description: "Sender email address" },
          rawHeaders: { type: "string", description: "Raw email headers" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_screen_sender", args);
        },
      },
      {
        name: "email_set_vip_rule",
        description: "Registers a VIP sender or domain routing rule with priority queue boosts and custom SLAs.",
        parameters: {
          emailOrDomain: { type: "string", required: true, description: "Sender email or domain" },
          contactName: { type: "string", required: true, description: "VIP contact name" },
          targetQueue: { type: "string", description: "Target queue: VIP_DIRECT, INVESTOR, EXECUTIVE, URGENT_SUPPORT" },
          priorityBoost: { type: "number", description: "Priority boost (default: 5)" },
          customSlaMinutes: { type: "number", description: "SLA response time in minutes" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_set_vip_rule", args);
        },
      },
      {
        name: "email_set_follow_up_reminder",
        description: "Sets an automated follow-up reminder if a recipient does not reply within a specified window.",
        parameters: {
          threadId: { type: "string", required: true, description: "Thread ID" },
          recipientEmail: { type: "string", required: true, description: "Recipient email" },
          subject: { type: "string", required: true, description: "Thread subject" },
          remindInHours: { type: "number", required: true, description: "Hours to wait" },
          note: { type: "string", description: "Follow-up reminder note" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_set_follow_up_reminder", args);
        },
      },
      {
        name: "email_acquire_thread_lock",
        description: "Acquires a concurrency lock on an email thread to prevent collision with other human/agent editors.",
        parameters: {
          threadId: { type: "string", required: true, description: "Thread ID to lock" },
          agentId: { type: "string", required: true, description: "Agent or user identifier" },
          durationMinutes: { type: "number", description: "Lock duration in minutes" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_acquire_thread_lock", args);
        },
      },
      {
        name: "email_list_inbox",
        description: "Lists all cached email messages with disposition and unread status.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_list_inbox", args);
        },
      },
      {
        name: "email_view_message",
        description: "View full body, headers, and threat analysis for a specific email message.",
        parameters: {
          id: { type: "string", required: true, description: "Email message ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_view_message", args);
        },
      },
      {
        name: "email_audit_health",
        description: "Audits SLA inbox health, unread backlogs, and generates triage recommendations.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_audit_health", args);
        },
      },
      {
        name: "email_get_metrics",
        description: "Fetches aggregate email triage telemetry, latency percentiles, and conversion rates.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_get_metrics", args);
        },
      },
      {
        name: "email_group_and_sort",
        description: "Organizes inbox emails into multi-criteria swimlanes (disposition, urgency, account, priority).",
        parameters: {
          groupBy: { type: "string", description: "Group by: disposition, account, priority, urgency, thread" },
          sortBy: { type: "string", description: "Sort by: date, sender, priority, urgency" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_group_and_sort", args);
        },
      },
      {
        name: "email_search_dsl",
        description: "Searches inbox using natural query DSL (e.g. 'disposition:urgent_reply from:boss is:unread keyword').",
        parameters: {
          query: { type: "string", required: true, description: "DSL search query" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_search_dsl", args);
        },
      },
      {
        name: "email_render_dashboard",
        description: "Renders a human-readable ANSI CLI summary card of inbox triage status.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_render_dashboard", args);
        },
      },
      {
        name: "email_render_thread",
        description: "Renders an ANSI CLI email conversation timeline.",
        parameters: {
          threadId: { type: "string", required: true, description: "Thread ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_render_thread", args);
        },
      },
      {
        name: "email_export_html",
        description: "Exports the entire email inbox and triage queue into an interactive single-page HTML application.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_export_html", args);
        },
      },
      {
        name: "email_export_markdown",
        description: "Exports email triage summary and message list as Markdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_export_markdown", args);
        },
      },
      {
        name: "email_export_csv",
        description: "Exports inbox messages and dispositions as a CSV spreadsheet.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_export_csv", args);
        },
      },
      {
        name: "email_send_notification",
        description: "Dispatches a cross-platform desktop/terminal alert for urgent email events.",
        parameters: {
          subject: { type: "string", required: true, description: "Alert subject" },
          snippet: { type: "string", required: true, description: "Alert body" },
          urgency: { type: "string", description: "Urgency: low, normal, critical" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_send_notification", args);
        },
      },
      {
        name: "email_get_notifications",
        description: "Fetches notification dispatch history for email events.",
        parameters: {
          limit: { type: "number", description: "Max notification records" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_get_notifications", args);
        },
      },
      {
        name: "email_configure_notifications",
        description: "Configures cross-platform notification preferences for the email subsystem.",
        parameters: {
          enableDesktop: { type: "boolean", description: "Enable native desktop alerts" },
          enableTerminalBell: { type: "boolean", description: "Enable terminal bell" },
          minUrgency: { type: "string", description: "Minimum urgency: low, normal, critical" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_configure_notifications", args);
        },
      },
      {
        name: "email_bulk_triage",
        description: "Bulk updates dispositions for multiple email messages atomically.",
        parameters: {
          emailIds: { type: "string", required: true, description: "Comma-separated email IDs" },
          disposition: { type: "string", required: true, description: "Target disposition" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_bulk_triage", args);
        },
      },
      {
        name: "email_undo",
        description: "Undo the last inbox triage or draft mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_undo", args);
        },
      },
      {
        name: "email_redo",
        description: "Redo the previously undone email mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_redo", args);
        },
      },
      {
        name: "email_snapshot_create",
        description: "Captures an O(1) state snapshot of the email substrate.",
        parameters: {
          frameIndex: { type: "number", description: "Snapshot frame identifier" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_snapshot_create", args);
        },
      },
      {
        name: "email_snapshot_restore",
        description: "Restores email substrate state from a previously captured frame snapshot.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index to restore" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("email_snapshot_restore", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    _cwd?: string
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "email_triage_inbox": {
          const result = this.supervisor.triageInbox();
          if (!result.success || !result.report) {
            return { success: false, error: result.error || "Inbox triage failed" };
          }
          return {
            success: true,
            report: result.report,
            totalProcessed: result.report.totalProcessed,
            urgentCount: result.report.urgentCount,
          };
        }

        case "email_summarize_thread": {
          const threadId = String(args.threadId || "").trim();
          const result = this.supervisor.summarizeThread(threadId);
          if (!result.success || !result.summary) {
            return { success: false, error: result.error || "Thread summarization failed" };
          }
          return { success: true, summary: result.summary };
        }

        case "email_draft_reply": {
          const threadId = String(args.threadId || "th_general");
          const recipientEmail = String(args.recipientEmail || "recipient@example.com");
          const recipientName = args.recipientName ? String(args.recipientName) : undefined;
          const subject = String(args.subject || "Reply");
          const bodyMarkdown = String(args.bodyMarkdown || "");
          const tone = (String(args.tone || "executive_concise")) as EmailTonePersona;
          const rationale = args.rationale ? String(args.rationale) : undefined;

          const to = [{ name: recipientName, email: recipientEmail }];
          const result = this.supervisor.draftReply(threadId, "primary@company.com", to, subject, bodyMarkdown, tone, rationale);
          return { success: result.success, draft: result.draft };
        }

        case "email_approve_and_dispatch": {
          const draftId = String(args.draftId || "").trim();
          const success = this.substrate.approveDraft(draftId);
          return { success, dispatched: success };
        }

        case "email_scan_outbound_dlp": {
          const content = String(args.content || "");
          const report = this.supervisor.scanOutboundDlp(content);
          return { success: report.success, report: report.report };
        }

        case "email_suggest_smart_replies": {
          const threadId = String(args.threadId || "th_smart");
          const subject = String(args.subject || "Inquiry");
          const bodyText = String(args.bodyText || "");
          const result = this.supervisor.generateSmartReplies(threadId, subject, bodyText);
          return { success: result.success, suggestions: result.suggestions };
        }

        case "email_detect_meeting_intent": {
          const threadId = String(args.threadId || "th_cal");
          const bodyText = String(args.bodyText || "");
          const result = this.supervisor.detectMeetingIntent(threadId, bodyText);
          return { success: result.success, intent: result.meeting };
        }

        case "email_screen_sender": {
          const senderEmail = String(args.senderEmail || "sender@example.com");
          const result = this.supervisor.evaluateSenderAuth(senderEmail);
          return { success: result.success, status: result.authStatus };
        }

        case "email_set_vip_rule": {
          const emailOrDomain = String(args.emailOrDomain || "").trim();
          const contactName = String(args.contactName || "VIP Contact");
          const targetQueue = (args.targetQueue as any) || "VIP_DIRECT";
          const priorityBoost = Number(args.priorityBoost) || 5;
          const customSlaMinutes = Number(args.customSlaMinutes) || 30;

          const rule: VipContactRule = {
            emailOrDomain,
            contactName,
            targetQueue,
            priorityBoost,
            customSlaMinutes,
          };
          const result = this.supervisor.storeVipRule(rule);
          return { success: result.success, rule: result.rule };
        }

        case "email_set_follow_up_reminder": {
          const threadId = String(args.threadId || "th_remind");
          const recipientEmail = String(args.recipientEmail || "colleague@example.com");
          const subject = String(args.subject || "Follow-up");
          const remindInHours = Number(args.remindInHours) || 24;
          const note = String(args.note || "Check in on status");
          const reminder = {
            reminderId: `rem_${Date.now()}`,
            threadId,
            recipientEmail,
            subject,
            remindAtTimestamp: Date.now() + remindInHours * 3600000,
            note,
            isTriggered: false,
          };
          this.substrate.storeReminder(reminder);
          return { success: true, reminder };
        }

        case "email_acquire_thread_lock": {
          const threadId = String(args.threadId || "th_lock");
          const agentId = String(args.agentId || "agent_01");
          const result = this.supervisor.acquireThreadLock(threadId, agentId);
          return { success: result.success, lock: result.lock };
        }

        case "email_list_inbox": {
          const messages = this.substrate.listMessages();
          return { success: true, messages, totalCount: messages.length };
        }

        case "email_view_message": {
          const id = String(args.id || "");
          const message = this.substrate.getMessage(id);
          return { success: message !== undefined, message };
        }

        case "email_audit_health": {
          const audit = this.substrate.auditEmailHealth();
          return { success: true, audit };
        }

        case "email_get_metrics": {
          const metrics = this.substrate.getEmailMetrics();
          return { success: true, metrics };
        }

        case "email_group_and_sort": {
          const groupBy = (args.groupBy as EmailGroupBy) || "disposition";
          const sortBy = (args.sortBy as EmailSortBy) || "date";
          const direction = (args.direction as EmailSortDirection) || "desc";
          const lanes = this.substrate.getGroupedEmails(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "email_search_dsl": {
          const query = String(args.query || "");
          const messages = this.substrate.queryEmailsDsl(query);
          return { success: true, messages, matchCount: messages.length };
        }

        case "email_render_dashboard": {
          const triage = this.supervisor.triageInbox();
          const report = triage.report || {
            totalProcessed: 0,
            urgentCount: 0,
            replyNeededCount: 0,
            actionNeededCount: 0,
            waitingCount: 0,
            threatsNeutralizedCount: 0,
          };
          const rendered = BroccoliViewRenderer.renderEmailDashboard(report as any);
          return { success: true, rendered };
        }

        case "email_render_thread": {
          const threadId = String(args.threadId || "");
          const thread = this.substrate.getThreadMessages(threadId);
          const rendered = BroccoliViewRenderer.renderEmailThread(thread as any);
          return { success: true, rendered };
        }

        case "email_export_html": {
          const html = this.substrate.exportInteractiveHtmlView();
          return { success: true, html };
        }

        case "email_export_markdown": {
          const markdown = this.substrate.exportMarkdownReport();
          return { success: true, markdown };
        }

        case "email_export_csv": {
          const csv = this.substrate.exportCsvReport();
          return { success: true, csv };
        }

        case "email_send_notification": {
          const subject = String(args.subject || "Email Notification");
          const snippet = String(args.snippet || "");
          const urgency = (args.urgency as EmailNotificationUrgency) || "normal";
          const record = await this.notificationDispatcher.dispatch({
            trigger: "custom",
            subject,
            snippet,
            urgency,
            timestampMs: Date.now(),
          });
          return { success: record !== null, record };
        }

        case "email_get_notifications": {
          const limit = Number(args.limit) || 50;
          const notifications = this.notificationDispatcher.getHistory(limit);
          return { success: true, notifications };
        }

        case "email_configure_notifications": {
          return { success: true, preferences: this.notificationDispatcher.getPreferences() };
        }

        case "email_bulk_triage": {
          const emailIds = String(args.emailIds || "").split(",").map((s) => s.trim()).filter(Boolean);
          const disposition = (args.disposition as EmailDisposition) || "action_without_reply";
          const res = this.substrate.bulkTriage(emailIds, disposition);
          return { success: res.modifiedCount > 0, result: res };
        }

        case "email_undo": {
          const success = this.substrate.undo();
          return { success };
        }

        case "email_redo": {
          const success = this.substrate.redo();
          return { success };
        }

        case "email_snapshot_create": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 0;
          const snap = this.snapshotManager.createSnapshot(frame);
          return { success: true, snapshot: snap };
        }

        case "email_snapshot_restore": {
          const frame = Number(args.frameIndex) || 0;
          const restored = this.snapshotManager.restoreSnapshot(frame);
          return { success: restored, restored };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
