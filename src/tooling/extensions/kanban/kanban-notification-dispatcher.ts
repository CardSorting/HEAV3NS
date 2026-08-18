/**
 * kanban-notification-dispatcher.ts
 *
 * Cross-Platform Desktop & Terminal Notification Dispatcher for the Kanban Subsystem (ADR-118).
 *
 * Supports:
 * - macOS: native osascript notification alerts with audio cues ('Ping', 'Glass', 'Basso')
 * - Linux: native notify-send alerts with urgency flags (-u low/normal/critical)
 * - Windows: PowerShell Toast notifications
 * - Terminal: OSC 99 / OSC 777 escape sequences & Bell alert (\x07)
 * - Web: Web Notification API bridge
 *
 * Includes DND mode, urgency thresholds, per-task rate limiting, and in-memory history buffer.
 */

import { exec } from "node:child_process";
import * as os from "node:os";
import type {
  KanbanNotificationEvent,
  KanbanNotificationPreferences,
  KanbanNotificationRecord,
  KanbanNotificationUrgency,
} from "../../../core/contracts/kanban.contracts.js";

export const DEFAULT_NOTIFICATION_PREFERENCES: KanbanNotificationPreferences = Object.freeze({
  enabled: true,
  desktopEnabled: true,
  terminalEscapesEnabled: true,
  soundEnabled: true,
  dndEnabled: false,
  minUrgency: "normal",
  notifyOnAssign: true,
  notifyOnBlock: true,
  notifyOnDone: true,
  notifyOnWipBreach: true,
  notifyOnDueSoonHours: 24,
  mutedTaskIds: [],
});

export type NotificationListener = (record: KanbanNotificationRecord) => void;

export class KanbanDesktopNotificationDispatcher {
  private preferences: KanbanNotificationPreferences;
  private readonly history: KanbanNotificationRecord[] = [];
  private readonly listeners: Set<NotificationListener> = new Set();
  private readonly lastNotifiedPerTask: Map<string, number> = new Map();
  private static readonly MAX_HISTORY = 500;
  private static readonly TASK_COOLDOWN_MS = 2500;

  constructor(initialPreferences?: Partial<KanbanNotificationPreferences>) {
    this.preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(initialPreferences ?? {}),
    };
  }

  /**
   * Updates notification preferences.
   */
  public updatePreferences(updates: Partial<KanbanNotificationPreferences>): KanbanNotificationPreferences {
    this.preferences = {
      ...this.preferences,
      ...updates,
    };
    return this.getPreferences();
  }

  /**
   * Retrieves active notification preferences.
   */
  public getPreferences(): KanbanNotificationPreferences {
    return { ...this.preferences, mutedTaskIds: [...this.preferences.mutedTaskIds] };
  }

  /**
   * Subscribes a listener to emitted notifications.
   */
  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Dispatches a notification event across configured channels.
   */
  public async dispatch(
    event: Omit<KanbanNotificationEvent, "id" | "timestampMs"> & { id?: string; timestampMs?: number }
  ): Promise<{ dispatched: boolean; record?: KanbanNotificationRecord; reason?: string }> {
    const fullEvent: KanbanNotificationEvent = {
      id: event.id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskId: event.taskId,
      boardId: event.boardId,
      title: event.title,
      message: event.message,
      urgency: event.urgency ?? "normal",
      trigger: event.trigger,
      soundName: event.soundName,
      timestampMs: event.timestampMs ?? Date.now(),
      metadata: event.metadata,
    };

    // Check master enabled switch
    if (!this.preferences.enabled) {
      return { dispatched: false, reason: "Notifications are globally disabled" };
    }

    // Check DND
    if (this.preferences.dndEnabled && fullEvent.urgency !== "urgent") {
      return { dispatched: false, reason: "Do Not Disturb (DND) active" };
    }

    // Check muted task
    if (fullEvent.taskId && this.preferences.mutedTaskIds.includes(fullEvent.taskId)) {
      return { dispatched: false, reason: `Task '${fullEvent.taskId}' is muted` };
    }

    // Check urgency threshold
    if (!this.isUrgencySufficient(fullEvent.urgency, this.preferences.minUrgency)) {
      return { dispatched: false, reason: `Urgency '${fullEvent.urgency}' is below minimum '${this.preferences.minUrgency}'` };
    }

    // Check per-task rate limit (urgent bypasses rate-limit)
    if (fullEvent.taskId && fullEvent.urgency !== "urgent") {
      const last = this.lastNotifiedPerTask.get(fullEvent.taskId);
      if (last && Date.now() - last < KanbanDesktopNotificationDispatcher.TASK_COOLDOWN_MS) {
        return { dispatched: false, reason: "Per-task rate limit active" };
      }
      this.lastNotifiedPerTask.set(fullEvent.taskId, Date.now());
    }

    const deliveredVia: ("desktop" | "terminal" | "web" | "internal")[] = ["internal"];

    // 1. Deliver to Native Desktop if enabled
    if (this.preferences.desktopEnabled) {
      try {
        await this.emitNativeOsNotification(fullEvent);
        deliveredVia.push("desktop");
      } catch {
        // Fallback gracefully without throwing
      }
    }

    // 2. Deliver Terminal Escapes if enabled
    if (this.preferences.terminalEscapesEnabled) {
      this.emitTerminalEscape(fullEvent);
      deliveredVia.push("terminal");
    }

    const record: KanbanNotificationRecord = {
      id: fullEvent.id,
      event: fullEvent,
      read: false,
      deliveredVia,
      createdAtMs: Date.now(),
    };

    this.history.unshift(record);
    if (this.history.length > KanbanDesktopNotificationDispatcher.MAX_HISTORY) {
      this.history.pop();
    }

    // Notify in-process subscribers
    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch {
        // Suppress listener errors
      }
    }

    return { dispatched: true, record };
  }

  /**
   * Retrieves notification history.
   */
  public getHistory(options: { unreadOnly?: boolean; limit?: number } = {}): readonly KanbanNotificationRecord[] {
    let filtered = this.history;
    if (options.unreadOnly) {
      filtered = filtered.filter((r) => !r.read);
    }
    if (options.limit && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  }

  /**
   * Marks a notification as read.
   */
  public markAsRead(notificationId: string): boolean {
    const found = this.history.find((r) => r.id === notificationId);
    if (found) {
      (found as { read: boolean }).read = true;
      return true;
    }
    return false;
  }

  /**
   * Marks all notifications as read.
   */
  public markAllAsRead(): number {
    let count = 0;
    for (const item of this.history) {
      if (!item.read) {
        (item as { read: boolean }).read = true;
        count++;
      }
    }
    return count;
  }

  /**
   * Clears notification history.
   */
  public clearHistory(): void {
    this.history.length = 0;
  }

  /**
   * Native OS Desktop Notification dispatcher using platform-specific commands.
   */
  private emitNativeOsNotification(event: KanbanNotificationEvent): Promise<void> {
    return new Promise((resolve) => {
      const platform = os.platform();
      const sanitizedTitle = this.escapeShellArg(event.title);
      const sanitizedMsg = this.escapeShellArg(event.message);

      if (platform === "darwin") {
        // macOS osascript
        let soundClause = "";
        if (this.preferences.soundEnabled) {
          const sound = event.soundName ?? (event.urgency === "urgent" ? "Basso" : "Ping");
          soundClause = ` sound name "${sound}"`;
        }
        const script = `display notification "${sanitizedMsg}" with title "LUMI Kanban" subtitle "${sanitizedTitle}"${soundClause}`;
        exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 3000 }, () => resolve());
      } else if (platform === "linux") {
        // Linux notify-send
        let urgencyFlag = "-u normal";
        if (event.urgency === "urgent" || event.urgency === "high") {
          urgencyFlag = "-u critical";
        } else if (event.urgency === "low") {
          urgencyFlag = "-u low";
        }
        exec(`notify-send ${urgencyFlag} "LUMI Kanban: ${sanitizedTitle}" "${sanitizedMsg}"`, { timeout: 3000 }, () => resolve());
      } else if (platform === "win32") {
        // Windows PowerShell Toast
        const psScript = `
          [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
          [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
          $xml = @"
          <toast>
            <visual>
              <binding template="ToastGeneric">
                <text>LUMI Kanban: ${sanitizedTitle}</text>
                <text>${sanitizedMsg}</text>
              </binding>
            </visual>
          </toast>
"@
          $doc = New-Object Windows.Data.Xml.Dom.XmlDocument
          $doc.LoadXml($xml)
          $toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
          [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("LUMI").Show($toast)
        `;
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '`"')}"`, { timeout: 3000 }, () => resolve());
      } else {
        resolve();
      }
    });
  }

  /**
   * Emits terminal notifications via OSC 99 / OSC 777 and ASCII Bell.
   */
  private emitTerminalEscape(event: KanbanNotificationEvent): void {
    if (!process.stdout || !process.stdout.isTTY) return;

    try {
      // OSC 99 (Kitty/iTerm2)
      process.stdout.write(`\x1b]99;i=1:d=0;${event.title}: ${event.message}\x1b\\`);
      // OSC 777 (Ghostty/rxvt)
      process.stdout.write(`\x1b]777;notify;${event.title};${event.message}\x1b\\`);

      if (this.preferences.soundEnabled && (event.urgency === "urgent" || event.urgency === "high")) {
        process.stdout.write("\x07"); // ASCII Bell
      }
    } catch {
      // Ignore write errors in closed stdouts
    }
  }

  private isUrgencySufficient(urgency: KanbanNotificationUrgency, minUrgency: KanbanNotificationUrgency): boolean {
    const weights: Record<KanbanNotificationUrgency, number> = {
      low: 1,
      normal: 2,
      high: 3,
      urgent: 4,
    };
    return (weights[urgency] ?? 2) >= (weights[minUrgency] ?? 2);
  }

  private escapeShellArg(arg: string): string {
    return arg.replace(/["\\`$]/g, "\\$&").slice(0, 200);
  }
}
