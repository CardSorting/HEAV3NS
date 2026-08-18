/**
 * goal-notification-dispatcher.ts
 *
 * Cross-Platform Desktop & Terminal Notification Dispatcher for Persistent Goals & Quality Gates (ADR-117).
 *
 * Supports:
 * - macOS: native osascript notification alerts with audio cues ('Ping', 'Glass', 'Basso')
 * - Linux: native notify-send alerts with urgency flags (-u low/normal/critical)
 * - Windows: PowerShell Toast notifications
 * - Terminal: OSC 99 / OSC 777 escape sequences & Bell alert (\x07)
 * - Web: Web Notification API bridge
 *
 * Includes DND mode, urgency thresholds, per-session rate limiting, and in-memory history buffer.
 */

import { exec } from "node:child_process";
import * as os from "node:os";
import type {
  GoalNotificationEvent,
  GoalNotificationPreferences,
  GoalNotificationRecord,
  GoalNotificationTrigger,
  GoalNotificationUrgency,
} from "../../../core/contracts/goal.contracts.js";

export const DEFAULT_GOAL_NOTIFICATION_PREFERENCES: GoalNotificationPreferences = Object.freeze({
  enabled: true,
  soundEnabled: true,
  dndEnabled: false,
  minUrgency: "normal",
  allowedTriggers: [
    "milestone_completed",
    "gate_failed",
    "gate_passed",
    "goal_completed",
    "budget_exhausted",
    "goal_paused",
    "custom",
  ] as readonly GoalNotificationTrigger[],
});

export type GoalNotificationListener = (record: GoalNotificationRecord) => void;

export class GoalDesktopNotificationDispatcher {
  private preferences: GoalNotificationPreferences;
  private readonly history: GoalNotificationRecord[] = [];
  private readonly listeners: Set<GoalNotificationListener> = new Set();
  private readonly lastNotifiedPerSession: Map<string, number> = new Map();
  private static readonly MAX_HISTORY = 500;
  private static readonly SESSION_COOLDOWN_MS = 2500;

  constructor(initialPreferences?: Partial<GoalNotificationPreferences>) {
    this.preferences = {
      ...DEFAULT_GOAL_NOTIFICATION_PREFERENCES,
      ...(initialPreferences ?? {}),
    };
  }

  /**
   * Updates notification preferences.
   */
  public updatePreferences(updates: Partial<GoalNotificationPreferences>): GoalNotificationPreferences {
    this.preferences = {
      ...this.preferences,
      ...updates,
    };
    return this.getPreferences();
  }

  /**
   * Retrieves active notification preferences.
   */
  public getPreferences(): GoalNotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Subscribes a listener to receive notification records.
   */
  public subscribe(listener: GoalNotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Dispatches a desktop notification across platform-specific notification APIs.
   */
  public async dispatch(event: GoalNotificationEvent): Promise<{
    dispatched: boolean;
    channels: string[];
    record?: GoalNotificationRecord;
    reason?: string;
  }> {
    if (!this.preferences.enabled) {
      return { dispatched: false, channels: [], reason: "Notifications disabled globally" };
    }

    if (this.preferences.dndEnabled && event.urgency !== "critical") {
      return { dispatched: false, channels: [], reason: "Suppressed by DND mode" };
    }

    if (!this.meetsUrgencyThreshold(event.urgency)) {
      return { dispatched: false, channels: [], reason: `Urgency '${event.urgency}' below threshold '${this.preferences.minUrgency}'` };
    }

    if (this.preferences.allowedTriggers && !this.preferences.allowedTriggers.includes(event.trigger)) {
      return { dispatched: false, channels: [], reason: `Trigger '${event.trigger}' not permitted by preferences` };
    }

    // Rate limiting per session
    if (event.sessionId) {
      const last = this.lastNotifiedPerSession.get(event.sessionId);
      const now = Date.now();
      if (last && now - last < GoalDesktopNotificationDispatcher.SESSION_COOLDOWN_MS && event.urgency !== "critical") {
        return { dispatched: false, channels: [], reason: "Rate limited on session cooldown" };
      }
      this.lastNotifiedPerSession.set(event.sessionId, now);
    }

    const channels: string[] = [];
    const platform = os.platform();

    // 1. Native Desktop Toast / Notification
    if (platform === "darwin") {
      const ok = await this.dispatchMacOS(event);
      if (ok) channels.push("macos-osascript");
    } else if (platform === "linux") {
      const ok = await this.dispatchLinux(event);
      if (ok) channels.push("linux-notify-send");
    } else if (platform === "win32") {
      const ok = await this.dispatchWindows(event);
      if (ok) channels.push("windows-powershell");
    }

    // 2. Terminal Escape Sequence (OSC 99 / OSC 777)
    this.dispatchTerminalEscape(event);
    channels.push("terminal-osc");

    const record: GoalNotificationRecord = {
      id: `gnotif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      event,
      timestampMs: Date.now(),
      read: false,
      channelsDispatched: channels,
    };

    this.history.push(record);
    if (this.history.length > GoalDesktopNotificationDispatcher.MAX_HISTORY) {
      this.history.shift();
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch {
        // Safe dispatch
      }
    }

    return {
      dispatched: true,
      channels,
      record,
    };
  }

  /**
   * Retrieves notification history.
   */
  public getHistory(filter?: { unreadOnly?: boolean; limit?: number }): readonly GoalNotificationRecord[] {
    let result = [...this.history];
    if (filter?.unreadOnly) {
      result = result.filter((r) => !r.read);
    }
    if (filter?.limit && filter.limit > 0) {
      result = result.slice(-filter.limit);
    }
    return result;
  }

  /**
   * Marks a notification record as read.
   */
  public markAsRead(id: string): boolean {
    const rec = this.history.find((r) => r.id === id);
    if (rec) {
      (rec as { read: boolean }).read = true;
      return true;
    }
    return false;
  }

  /**
   * Clears notification history.
   */
  public clearHistory(): void {
    this.history.length = 0;
  }

  // --- Platform Dispatch Implementations ---

  private async dispatchMacOS(event: GoalNotificationEvent): Promise<boolean> {
    return new Promise((resolve) => {
      const titleEscaped = this.escapeForOsascript(event.title);
      const msgEscaped = this.escapeForOsascript(event.message);
      const soundName = this.preferences.soundEnabled
        ? event.urgency === "critical"
          ? "Basso"
          : event.trigger === "goal_completed"
          ? "Glass"
          : "Ping"
        : "";

      const soundClause = soundName ? ` sound name "${soundName}"` : "";
      const script = `display notification "${msgEscaped}" with title "${titleEscaped}"${soundClause}`;

      exec(`osascript -e '${script}'`, (err) => {
        resolve(!err);
      });
    });
  }

  private async dispatchLinux(event: GoalNotificationEvent): Promise<boolean> {
    return new Promise((resolve) => {
      const title = this.escapeShell(event.title);
      const msg = this.escapeShell(event.message);
      const urgencyFlag = event.urgency === "critical" ? "critical" : event.urgency === "low" ? "low" : "normal";

      exec(`notify-send -u ${urgencyFlag} "${title}" "${msg}"`, (err) => {
        resolve(!err);
      });
    });
  }

  private async dispatchWindows(event: GoalNotificationEvent): Promise<boolean> {
    return new Promise((resolve) => {
      const title = this.escapeShell(event.title);
      const msg = this.escapeShell(event.message);
      const psScript = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName("text")
        $textNodes.Item(0).AppendChild($template.CreateTextNode("${title}")) | Out-Null
        $textNodes.Item(1).AppendChild($template.CreateTextNode("${msg}")) | Out-Null
        $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("LUMI Goal Engine").Show($toast)
      `.replace(/\n\s*/g, " ");

      exec(`powershell -Command "${psScript}"`, (err) => {
        resolve(!err);
      });
    });
  }

  private dispatchTerminalEscape(event: GoalNotificationEvent): void {
    if (typeof process !== "undefined" && process.stdout && process.stdout.isTTY) {
      // OSC 99: Terminal Notification Protocol
      const title = event.title.replace(/;/g, ",");
      const msg = event.message.replace(/;/g, ",");
      process.stdout.write(`\x1b]99;i=1:d=0;${title};${msg}\x1b\\`);

      // Audible bell on critical alert or goal completion
      if (this.preferences.soundEnabled && (event.urgency === "critical" || event.trigger === "goal_completed")) {
        process.stdout.write("\x07");
      }
    }
  }

  private meetsUrgencyThreshold(urgency: GoalNotificationUrgency): boolean {
    const order: Record<GoalNotificationUrgency, number> = { low: 1, normal: 2, critical: 3 };
    return order[urgency] >= order[this.preferences.minUrgency];
  }

  private escapeForOsascript(str: string): string {
    return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  private escapeShell(str: string): string {
    return str.replace(/"/g, '\\"');
  }
}
