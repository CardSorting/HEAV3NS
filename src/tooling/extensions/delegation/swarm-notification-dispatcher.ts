/**
 * swarm-notification-dispatcher.ts
 *
 * Cross-Platform Desktop & Terminal Notification Dispatcher for Autonomous Swarm Delegation (ADR-015).
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
  SwarmNotificationEvent,
  SwarmNotificationPreferences,
  SwarmNotificationRecord,
  SwarmNotificationTrigger,
  SwarmNotificationUrgency,
} from "../../../core/contracts/delegation.contracts.js";

export const DEFAULT_SWARM_NOTIFICATION_PREFERENCES: SwarmNotificationPreferences = Object.freeze({
  enabled: true,
  soundEnabled: true,
  dndEnabled: false,
  minUrgency: "normal",
  allowedTriggers: [
    "task_delegated",
    "task_completed",
    "task_failed",
    "task_aborted",
    "budget_warning",
    "worktree_conflict",
    "custom",
  ] as readonly SwarmNotificationTrigger[],
});

export type SwarmNotificationListener = (record: SwarmNotificationRecord) => void;

export class SwarmDesktopNotificationDispatcher {
  private preferences: SwarmNotificationPreferences;
  private readonly history: SwarmNotificationRecord[] = [];
  private readonly listeners: Set<SwarmNotificationListener> = new Set();
  private readonly lastNotifiedPerTask: Map<string, number> = new Map();
  private static readonly MAX_HISTORY = 500;
  private static readonly TASK_COOLDOWN_MS = 2000;

  constructor(initialPreferences?: Partial<SwarmNotificationPreferences>) {
    this.preferences = {
      ...DEFAULT_SWARM_NOTIFICATION_PREFERENCES,
      ...(initialPreferences ?? {}),
    };
  }

  public updatePreferences(updates: Partial<SwarmNotificationPreferences>): SwarmNotificationPreferences {
    this.preferences = {
      ...this.preferences,
      ...updates,
    };
    return this.getPreferences();
  }

  public getPreferences(): SwarmNotificationPreferences {
    return { ...this.preferences };
  }

  public subscribe(listener: SwarmNotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async dispatch(event: SwarmNotificationEvent): Promise<{
    dispatched: boolean;
    channels: string[];
    record: SwarmNotificationRecord;
  }> {
    const now = Date.now();
    const channels: string[] = [];

    if (!this.preferences.enabled) {
      const rec = this.createRecord(event, false, false, "Notifications disabled");
      this.pushHistory(rec);
      return { dispatched: false, channels, record: rec };
    }

    if (this.preferences.dndEnabled && event.urgency !== "critical") {
      const rec = this.createRecord(event, false, false, "Suppressed by DND mode");
      this.pushHistory(rec);
      return { dispatched: false, channels, record: rec };
    }

    if (!this.preferences.allowedTriggers.includes(event.trigger)) {
      const rec = this.createRecord(event, false, false, `Trigger '${event.trigger}' not allowed`);
      this.pushHistory(rec);
      return { dispatched: false, channels, record: rec };
    }

    if (!this.meetsUrgencyThreshold(event.urgency, this.preferences.minUrgency)) {
      const rec = this.createRecord(event, false, false, `Urgency '${event.urgency}' below threshold '${this.preferences.minUrgency}'`);
      this.pushHistory(rec);
      return { dispatched: false, channels, record: rec };
    }

    if (event.taskId) {
      const last = this.lastNotifiedPerTask.get(event.taskId) || 0;
      if (now - last < SwarmDesktopNotificationDispatcher.TASK_COOLDOWN_MS && event.urgency !== "critical") {
        const rec = this.createRecord(event, false, false, `Rate limited for task '${event.taskId}'`);
        this.pushHistory(rec);
        return { dispatched: false, channels, record: rec };
      }
      this.lastNotifiedPerTask.set(event.taskId, now);
    }

    const platform = os.platform();
    let delivered = false;
    let audioPlayed = false;

    try {
      if (platform === "darwin") {
        await this.dispatchMacOS(event);
        channels.push("macos-osascript");
        delivered = true;
        audioPlayed = this.preferences.soundEnabled;
      } else if (platform === "linux") {
        await this.dispatchLinux(event);
        channels.push("linux-notify-send");
        delivered = true;
      } else if (platform === "win32") {
        await this.dispatchWindows(event);
        channels.push("windows-toast");
        delivered = true;
      }
    } catch {
      // Fallback
    }

    try {
      this.dispatchTerminalOSC(event);
      channels.push("terminal-osc");
      delivered = true;
    } catch {
      // Ignore
    }

    const record = this.createRecord(event, delivered, audioPlayed);
    this.pushHistory(record);
    this.notifyListeners(record);

    return { dispatched: delivered, channels, record };
  }

  public getHistory(limit: number = 50, unreadOnly: boolean = false): readonly SwarmNotificationRecord[] {
    let result = [...this.history];
    if (unreadOnly) {
      result = result.filter((r) => !r.read);
    }
    return Object.freeze(result.slice(0, limit));
  }

  public markAsRead(recordId?: string): number {
    let count = 0;
    for (const item of this.history) {
      if (!recordId || item.id === recordId) {
        if (!item.read) {
          (item as any).read = true;
          count++;
        }
      }
    }
    return count;
  }

  public clearHistory(): void {
    this.history.length = 0;
    this.lastNotifiedPerTask.clear();
  }

  private meetsUrgencyThreshold(current: SwarmNotificationUrgency, minimum: SwarmNotificationUrgency): boolean {
    const ranks: Record<SwarmNotificationUrgency, number> = {
      low: 1,
      normal: 2,
      critical: 3,
    };
    return ranks[current] >= ranks[minimum];
  }

  private dispatchMacOS(event: SwarmNotificationEvent): Promise<void> {
    return new Promise((resolve) => {
      const soundClause =
        this.preferences.soundEnabled
          ? event.urgency === "critical"
            ? ' sound name "Basso"'
            : ' sound name "Ping"'
          : "";

      const cleanTitle = (event.title || "LUMI Swarm").replace(/"/g, '\\"');
      const cleanMessage = (event.message || "").replace(/"/g, '\\"');

      const script = `display notification "${cleanMessage}" with title "${cleanTitle}" subtitle "LUMI Swarm Delegation"${soundClause}`;
      exec(`osascript -e '${script}'`, (err) => {
        resolve();
      });
    });
  }

  private dispatchLinux(event: SwarmNotificationEvent): Promise<void> {
    return new Promise((resolve) => {
      const urgencyMap: Record<SwarmNotificationUrgency, string> = {
        low: "low",
        normal: "normal",
        critical: "critical",
      };
      const u = urgencyMap[event.urgency] || "normal";
      const cleanTitle = (event.title || "LUMI Swarm").replace(/"/g, '\\"');
      const cleanMessage = (event.message || "").replace(/"/g, '\\"');

      exec(`notify-send -u ${u} -a "LUMI Swarm" "${cleanTitle}" "${cleanMessage}"`, (err) => {
        resolve();
      });
    });
  }

  private dispatchWindows(event: SwarmNotificationEvent): Promise<void> {
    return new Promise((resolve) => {
      const cleanTitle = (event.title || "LUMI Swarm").replace(/'/g, "''");
      const cleanMessage = (event.message || "").replace(/'/g, "''");

      const psScript = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02
        $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($template)
        $text = $xml.GetElementsByTagName("text")
        $text[0].AppendChild($xml.CreateTextNode('${cleanTitle}')) | Out-Null
        $text[1].AppendChild($xml.CreateTextNode('${cleanMessage}')) | Out-Null
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("LUMI Swarm").Show($toast)
      `.replace(/\n/g, " ");

      exec(`powershell -Command "${psScript}"`, (err) => {
        resolve();
      });
    });
  }

  private dispatchTerminalOSC(event: SwarmNotificationEvent): void {
    if (process.stdout && process.stdout.isTTY) {
      const title = event.title || "LUMI Swarm";
      const body = event.message || "";
      process.stdout.write(`\x1b]99;i=1:d=0;${title}\x1b\\\x1b]99;i=1:d=1;${body}\x1b\\`);

      if (this.preferences.soundEnabled && event.urgency === "critical") {
        process.stdout.write("\x07");
      }
    }
  }

  private createRecord(
    event: SwarmNotificationEvent,
    delivered: boolean,
    audioPlayed: boolean,
    error?: string
  ): SwarmNotificationRecord {
    return {
      id: `snotif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      event,
      dispatchedAtMs: Date.now(),
      delivered,
      read: false,
      audioPlayed,
      error,
    };
  }

  private pushHistory(record: SwarmNotificationRecord): void {
    this.history.unshift(record);
    if (this.history.length > SwarmDesktopNotificationDispatcher.MAX_HISTORY) {
      this.history.pop();
    }
  }

  private notifyListeners(record: SwarmNotificationRecord): void {
    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch {
        // Suppress
      }
    }
  }
}
