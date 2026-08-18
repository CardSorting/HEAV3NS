import { exec } from "node:child_process";
import * as os from "node:os";
import type {
  EmailNotificationEvent,
  EmailNotificationPreferences,
  EmailNotificationRecord,
  EmailNotificationUrgency,
} from "../../../core/contracts/email.contracts.js";

export const DEFAULT_EMAIL_NOTIFICATION_PREFERENCES: EmailNotificationPreferences = {
  enableDesktop: true,
  enableTerminalBell: true,
  enableTerminalOsc: true,
  minUrgency: "low",
  perThreadCooldownMs: 3000,
};

export class EmailDesktopNotificationDispatcher {
  private readonly preferences: EmailNotificationPreferences;
  private readonly notificationHistory: EmailNotificationRecord[] = [];
  private readonly lastNotifiedPerThread = new Map<string, number>();
  private readonly subscribers = new Set<(record: EmailNotificationRecord) => void>();

  private static readonly MAX_HISTORY = 500;

  constructor(preferences?: Partial<EmailNotificationPreferences>) {
    this.preferences = {
      ...DEFAULT_EMAIL_NOTIFICATION_PREFERENCES,
      ...preferences,
    };
  }

  public subscribe(cb: (record: EmailNotificationRecord) => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  public getPreferences(): EmailNotificationPreferences {
    return { ...this.preferences };
  }

  public getHistory(limit = 50): readonly EmailNotificationRecord[] {
    return Object.freeze(this.notificationHistory.slice(0, limit));
  }

  public markAllAsRead(): void {
    for (let i = 0; i < this.notificationHistory.length; i++) {
      (this.notificationHistory[i] as any).isRead = true;
    }
  }

  public async dispatch(event: EmailNotificationEvent): Promise<EmailNotificationRecord | null> {
    if (!this.meetsUrgencyThreshold(event.urgency)) {
      return null;
    }

    if (this.isInQuietHours()) {
      return null;
    }

    const key = event.threadId || event.emailId || event.trigger;
    const now = Date.now();
    const lastTime = this.lastNotifiedPerThread.get(key) || 0;
    if (now - lastTime < this.preferences.perThreadCooldownMs) {
      return null; // Cooldown rate limit
    }
    this.lastNotifiedPerThread.set(key, now);

    let deliveredDesktop = false;
    let deliveredTerminal = false;

    if (this.preferences.enableDesktop) {
      deliveredDesktop = await this.sendDesktopAlert(event);
    }

    if (this.preferences.enableTerminalOsc || this.preferences.enableTerminalBell) {
      deliveredTerminal = this.sendTerminalAlert(event);
    }

    const record: EmailNotificationRecord = {
      id: `email-notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      event: Object.freeze(event),
      deliveredDesktop,
      deliveredTerminal,
      timestampMs: now,
      isRead: false,
    };

    this.notificationHistory.unshift(record);
    if (this.notificationHistory.length > EmailDesktopNotificationDispatcher.MAX_HISTORY) {
      this.notificationHistory.pop();
    }

    for (const subscriber of this.subscribers) {
      try {
        subscriber(record);
      } catch {
        // Non-blocking subscriber
      }
    }

    return record;
  }

  private meetsUrgencyThreshold(urgency: EmailNotificationUrgency): boolean {
    const ranks: Record<EmailNotificationUrgency, number> = { low: 0, normal: 1, critical: 2 };
    return ranks[urgency] >= ranks[this.preferences.minUrgency];
  }

  private isInQuietHours(): boolean {
    if (
      this.preferences.quietHoursStartHour === undefined ||
      this.preferences.quietHoursEndHour === undefined
    ) {
      return false;
    }
    const currentHour = new Date().getHours();
    const start = this.preferences.quietHoursStartHour;
    const end = this.preferences.quietHoursEndHour;

    if (start <= end) {
      return currentHour >= start && currentHour < end;
    }
    return currentHour >= start || currentHour < end;
  }

  private async sendDesktopAlert(event: EmailNotificationEvent): Promise<boolean> {
    const platform = os.platform();
    const title = `📧 LUMI Inbox: ${event.subject.slice(0, 40)}`;
    const body = event.snippet.slice(0, 80).replace(/"/g, '\\"');

    return new Promise((resolve) => {
      try {
        if (platform === "darwin") {
          const sound = event.urgency === "critical" ? "Basso" : "Ping";
          const script = `display notification "${body}" with title "${title}" sound name "${sound}"`;
          exec(`osascript -e '${script}'`, (err) => resolve(!err));
        } else if (platform === "linux") {
          const urgencyFlag = event.urgency === "critical" ? "critical" : "normal";
          exec(`notify-send -u ${urgencyFlag} "${title}" "${body}"`, (err) => resolve(!err));
        } else if (platform === "win32") {
          const psCommand = `powershell -Command "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; [Windows.UI.Notifications.ToastNotification]::new([Windows.Data.Xml.Dom.XmlDocument]::new()).Show()"`;
          exec(psCommand, (err) => resolve(!err));
        } else {
          resolve(false);
        }
      } catch {
        resolve(false);
      }
    });
  }

  private sendTerminalAlert(event: EmailNotificationEvent): boolean {
    try {
      if (this.preferences.enableTerminalOsc) {
        process.stdout.write(`\x1b]99;i=1:d=0;LUMI Inbox: ${event.subject}\x1b\\`);
      }
      if (this.preferences.enableTerminalBell) {
        process.stdout.write("\x07");
      }
      return true;
    } catch {
      return false;
    }
  }
}
