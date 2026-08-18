import type {
  EmailDisposition,
  EmailDraft,
  EmailHealthAuditReport,
  EmailMessage,
  EmailMetricsReport,
} from "../../core/contracts/email.contracts.js";
import { BroccoliEmailSubstrate } from "../../sessions/extensions/email/broccoli-email-substrate.js";
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export type EmailInboxViewMode = "inbox" | "urgent" | "drafts" | "threads" | "health" | "metrics";

/**
 * EmailInboxModal.
 * Interactive Terminal TUI Modal Component for Superhuman-Grade Native Email (ADR-123).
 *
 * Features:
 * - Executive KPI Ribbon
 * - Filter Presets (1: All, 2: Urgent Only, 3: Unread Only, 4: VIP Contacts)
 * - 6 View Modes (Inbox, Urgent, Drafts, Threads, Health, Metrics)
 * - Actions: View Message, Stage Smart Reply, Approve Draft, Discard Draft, Dispatch Test Alert
 */
export class EmailInboxModal {
  private readonly substrate: BroccoliEmailSubstrate;
  private readonly onClose: () => void;

  private selectedIndex = 0;
  private filterMode: "all" | "urgent" | "unread" | "vip" = "all";
  private viewMode: EmailInboxViewMode = "inbox";
  private showHelp = false;

  constructor(substrate: BroccoliEmailSubstrate, onClose: () => void) {
    this.substrate = substrate;
    this.onClose = onClose;
  }

  public render(maxWidth = 100): readonly string[] {
    const lines: string[] = [];
    const width = Math.max(60, maxWidth);
    const border = "─".repeat(width - 2);

    const metrics = this.substrate.getEmailMetrics();
    const messages = this.getFilteredMessages();
    const drafts = this.substrate.listDrafts();

    // 1. Header
    lines.push(`┌${border}┐`);
    lines.push(this.formatLine(` 📧 LUMI SUPERHUMAN EMAIL INBOX & DISPATCHER (ADR-123) `, width));
    lines.push(`├${border}┤`);

    // 2. Executive KPI Ribbon
    const kpiText = ` Total: ${metrics.totalMessages} | Unread: ${metrics.unreadCount} | Urgent: ${metrics.dispositionCounts.urgent_reply} | Staged Drafts: ${metrics.stagedDraftsCount} | Dispatched: ${metrics.approvedDraftsCount}`;
    lines.push(this.formatLine(kpiText, width));
    lines.push(`├${border}┤`);

    // 3. View Mode Bar
    const viewTabs = [
      this.viewMode === "inbox" ? "[1: 📥 Inbox]" : " 1: Inbox ",
      this.viewMode === "urgent" ? "[2: 🔥 Urgent]" : " 2: Urgent ",
      this.viewMode === "drafts" ? "[3: 📝 Drafts]" : " 3: Drafts ",
      this.viewMode === "threads" ? "[4: 🧵 Threads]" : " 4: Threads ",
      this.viewMode === "health" ? "[5: 🩺 Health]" : " 5: Health ",
      this.viewMode === "metrics" ? "[6: 📊 Metrics]" : " 6: Metrics ",
    ].join(" │ ");
    lines.push(this.formatLine(` ${viewTabs}`, width));
    lines.push(`├${border}┤`);

    // 4. Content Area
    switch (this.viewMode) {
      case "inbox":
      case "urgent":
        this.renderInboxView(lines, messages, width);
        break;
      case "drafts":
        this.renderDraftsView(lines, drafts, width);
        break;
      case "threads":
        this.renderThreadsView(lines, messages, width);
        break;
      case "health":
        this.renderHealthView(lines, width);
        break;
      case "metrics":
        this.renderMetricsView(lines, metrics, width);
        break;
    }

    lines.push(`├${border}┤`);

    // 5. Footer & Keybindings
    if (this.showHelp) {
      lines.push(this.formatLine(` [j/k] Navigate  [Enter] View  [r] Reply  [a] Approve  [x] Discard  [d] Alert  [q] Close`, width));
    } else {
      lines.push(this.formatLine(` [v] View (${this.viewMode})  [1-4] Filters  [Enter] Inspect  [a] Approve  [d] Alert  [?] Help  [q] Close`, width));
    }
    lines.push(`└${border}┘`);

    return lines;
  }

  private renderInboxView(lines: string[], messages: readonly EmailMessage[], width: number): void {
    if (messages.length === 0) {
      lines.push(this.formatLine(" (No messages in this view)", width));
      return;
    }

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const isSelected = i === this.selectedIndex;
      const marker = isSelected ? "▶" : " ";
      const unreadDot = m.unread ? "●" : " ";
      const fromStr = (m.from.name || m.from.email).slice(0, 18).padEnd(18);
      const dispBadge = `[${m.disposition.slice(0, 6).toUpperCase()}]`;

      const row = `${marker} ${unreadDot} ${dispBadge} ${fromStr} │ ${m.subject.slice(0, width - 42)}`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderDraftsView(lines: string[], drafts: readonly EmailDraft[], width: number): void {
    if (drafts.length === 0) {
      lines.push(this.formatLine(" (No staged outbox drafts)", width));
      return;
    }

    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      const isSelected = i === this.selectedIndex;
      const marker = isSelected ? "▶" : " ";
      const statusBadge = `[${d.status.toUpperCase()}]`;
      const toStr = d.to.map((t) => t.email).join(", ").slice(0, 20).padEnd(20);

      const row = `${marker} ${statusBadge} To: ${toStr} │ ${d.subject.slice(0, width - 40)}`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderThreadsView(lines: string[], messages: readonly EmailMessage[], width: number): void {
    const threadMap = new Map<string, EmailMessage[]>();
    for (const m of messages) {
      if (!threadMap.has(m.threadId)) threadMap.set(m.threadId, []);
      threadMap.get(m.threadId)!.push(m);
    }

    lines.push(this.formatLine(` ── Active Conversation Threads (${threadMap.size} threads):`, width));
    for (const [threadId, items] of threadMap.entries()) {
      const subject = items[0]?.subject || "Untitled";
      lines.push(this.formatLine(` • Thread [${threadId.slice(0, 10)}] (${items.length} msgs): ${subject.slice(0, width - 35)}`, width));
    }
  }

  private renderHealthView(lines: string[], width: number): void {
    const audit = this.substrate.auditEmailHealth();
    lines.push(this.formatLine(` Inbox Health: ${audit.healthStatus.toUpperCase()} │ Unread: ${audit.unreadCount} │ Urgent Breaches: ${audit.slaBreachedCount}`, width));
    lines.push(this.formatLine(` Pending Drafts: ${audit.pendingDraftsCount} │ Quarantined Threats: ${audit.quarantinedThreatsCount}`, width));
    lines.push(this.formatLine(` ── Diagnostic Recommendations:`, width));
    for (const r of audit.recommendations) {
      lines.push(this.formatLine(`  • ${r}`, width));
    }
  }

  private renderMetricsView(lines: string[], metrics: EmailMetricsReport, width: number): void {
    lines.push(this.formatLine(` Total: ${metrics.totalMessages} │ Staged: ${metrics.stagedDraftsCount} │ Approved: ${metrics.approvedDraftsCount} │ DLP Blocks: ${metrics.dlpViolationsBlockedCount}`, width));
    lines.push(this.formatLine(` Dispositions: Urgent: ${metrics.dispositionCounts.urgent_reply} │ Reply: ${metrics.dispositionCounts.reply} │ Action: ${metrics.dispositionCounts.action_without_reply} │ Waiting: ${metrics.dispositionCounts.waiting}`, width));
    lines.push(this.formatLine(` Latency: Triage: ${metrics.avgTriageLatencyMs}ms │ Dispatch P50: ${metrics.p50DispatchLatencyMs}ms │ P95: ${metrics.p95DispatchLatencyMs}ms`, width));
  }

  public handleInput(key: string): void {
    const messages = this.getFilteredMessages();
    const drafts = this.substrate.listDrafts();

    switch (key) {
      case "j":
      case "down":
        if (this.selectedIndex < messages.length - 1) {
          this.selectedIndex++;
        }
        break;

      case "k":
      case "up":
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
        }
        break;

      case "1":
        this.filterMode = "all";
        this.selectedIndex = 0;
        break;
      case "2":
        this.filterMode = "urgent";
        this.selectedIndex = 0;
        break;
      case "3":
        this.filterMode = "unread";
        this.selectedIndex = 0;
        break;
      case "4":
        this.filterMode = "vip";
        this.selectedIndex = 0;
        break;

      case "v": {
        const modes: EmailInboxViewMode[] = ["inbox", "urgent", "drafts", "threads", "health", "metrics"];
        const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
        this.viewMode = modes[nextIdx];
        break;
      }

      case "a": {
        const currentDraft = drafts[this.selectedIndex];
        if (currentDraft && currentDraft.status === "staged_in_outbox") {
          this.substrate.approveDraft(currentDraft.draftId);
        }
        break;
      }

      case "x": {
        const currentDraft = drafts[this.selectedIndex];
        if (currentDraft) {
          this.substrate.discardDraft(currentDraft.draftId);
        }
        break;
      }

      case "d": {
        const dispatcher = this.substrate.getNotificationDispatcher();
        if (dispatcher) {
          dispatcher.dispatch({
            trigger: "urgent_received",
            subject: "Test Urgent Message",
            snippet: "This is a test notification from the terminal UI.",
            urgency: "critical",
            timestampMs: Date.now(),
          });
        }
        break;
      }

      case "?":
        this.showHelp = !this.showHelp;
        break;

      case "q":
      case "escape":
        this.onClose();
        break;
    }
  }

  private getFilteredMessages(): readonly EmailMessage[] {
    let list = this.substrate.listMessages();
    if (this.viewMode === "urgent" || this.filterMode === "urgent") {
      list = list.filter((m) => m.disposition === "urgent_reply");
    } else if (this.filterMode === "unread") {
      list = list.filter((m) => m.unread);
    } else if (this.filterMode === "vip") {
      const vips = new Set(this.substrate.listVipRules().map((v) => v.emailOrDomain.toLowerCase()));
      list = list.filter((m) => vips.has(m.from.email.toLowerCase()));
    }
    return list;
  }

  private formatLine(content: string, width: number): string {
    const cleanContent = content.length > width - 4 ? content.slice(0, width - 4) : content;
    const padding = Math.max(0, width - 2 - cleanContent.length);
    return `│${cleanContent}${" ".repeat(padding)}│`;
  }
}
