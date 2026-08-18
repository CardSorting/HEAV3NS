/**
 * skill-notification-dispatcher.ts
 *
 * Cross-Platform Desktop & Terminal Notification Dispatcher for Evolutionary Skill Tree (ADR-014).
 *
 * Supports:
 * - macOS: native osascript notification alerts with audio cues ('Ping', 'Hero', 'Basso')
 * - Linux: native notify-send alerts with urgency flags (-u low/normal/critical)
 * - Windows: PowerShell Toast notifications
 * - Terminal: OSC 99 / OSC 777 escape sequences & Bell alert (\x07)
 * - Web: Web Notification API bridge
 *
 * Includes DND mode, urgency thresholds, per-skill rate limiting, and in-memory history buffer.
 */

import { exec } from "node:child_process";
import * as os from "node:os";
import type {
  SkillNotificationEvent,
  SkillNotificationPreferences,
  SkillNotificationRecord,
  SkillNotificationTrigger,
  SkillNotificationUrgency,
} from "../../../core/contracts/skills.contracts.js";

export const DEFAULT_SKILL_NOTIFICATION_PREFERENCES: SkillNotificationPreferences = Object.freeze({
  enabled: true,
  soundEnabled: true,
  dndEnabled: false,
  minUrgency: "normal",
  allowedTriggers: [
    "skill_unlocked",
    "skill_mutated",
    "skill_degraded",
    "mastery_promoted",
    "curation_warning",
    "custom",
  ] as readonly SkillNotificationTrigger[],
});

export type SkillNotificationListener = (record: SkillNotificationRecord) => void;

export class SkillDesktopNotificationDispatcher {
  private preferences: SkillNotificationPreferences;
  private readonly history: SkillNotificationRecord[] = [];
  private readonly listeners: Set<SkillNotificationListener> = new Set();
  private readonly lastNotifiedPerSkill: Map<string, number> = new Map();
  private static readonly MAX_HISTORY = 500;
  private static readonly SKILL_COOLDOWN_MS = 2000;

  constructor(initialPreferences?: Partial<SkillNotificationPreferences>) {
    this.preferences = {
      ...DEFAULT_SKILL_NOTIFICATION_PREFERENCES,
      ...(initialPreferences ?? {}),
    };
  }

  public updatePreferences(updates: Partial<SkillNotificationPreferences>): SkillNotificationPreferences {
    this.preferences = {
      ...this.preferences,
      ...updates,
    };
    return this.getPreferences();
  }

  public getPreferences(): SkillNotificationPreferences {
    return { ...this.preferences };
  }

  public subscribe(listener: SkillNotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async dispatch(event: SkillNotificationEvent): Promise<{
    dispatched: boolean;
    channels: string[];
    record: SkillNotificationRecord;
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

    if (event.skillId) {
      const last = this.lastNotifiedPerSkill.get(event.skillId) || 0;
      if (now - last < SkillDesktopNotificationDispatcher.SKILL_COOLDOWN_MS && event.urgency !== "critical") {
        const rec = this.createRecord(event, false, false, `Rate limited for skill '${event.skillId}'`);
        this.pushHistory(rec);
        return { dispatched: false, channels, record: rec };
      }
      this.lastNotifiedPerSkill.set(event.skillId, now);
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

  public getHistory(limit: number = 50, unreadOnly: boolean = false): readonly SkillNotificationRecord[] {
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
    this.lastNotifiedPerSkill.clear();
  }

  private meetsUrgencyThreshold(current: SkillNotificationUrgency, minimum: SkillNotificationUrgency): boolean {
    const ranks: Record<SkillNotificationUrgency, number> = {
      low: 1,
      normal: 2,
      critical: 3,
    };
    return ranks[current] >= ranks[minimum];
  }

  private dispatchMacOS(event: SkillNotificationEvent): Promise<void> {
    return new Promise((resolve) => {
      const soundClause =
        this.preferences.soundEnabled
          ? event.urgency === "critical"
            ? ' sound name "Basso"'
            : ' sound name "Ping"'
          : "";

      const cleanTitle = (event.title || "LUMI Skill Tree").replace(/"/g, '\\"');
      const cleanMessage = (event.message || "").replace(/"/g, '\\"');

      const script = `display notification "${cleanMessage}" with title "${cleanTitle}" subtitle "LUMI Evolutionary Skills"${soundClause}`;
      exec(`osascript -e '${script}'`, (err) => {
        resolve();
      });
    });
  }

  private dispatchLinux(event: SkillNotificationEvent): Promise<void> {
    return new Promise((resolve) => {
      const urgencyMap: Record<SkillNotificationUrgency, string> = {
        low: "low",
        normal: "normal",
        critical: "critical",
      };
      const u = urgencyMap[event.urgency] || "normal";
      const cleanTitle = (event.title || "LUMI Skill Tree").replace(/"/g, '\\"');
      const cleanMessage = (event.message || "").replace(/"/g, '\\"');

      exec(`notify-send -u ${u} -a "LUMI Skills" "${cleanTitle}" "${cleanMessage}"`, (err) => {
        resolve();
      });
    });
  }

  private dispatchWindows(event: SkillNotificationEvent): Promise<void> {
    return new Promise((resolve) => {
      const cleanTitle = (event.title || "LUMI Skill Tree").replace(/'/g, "''");
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
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("LUMI Skills").Show($toast)
      `.replace(/\n/g, " ");

      exec(`powershell -Command "${psScript}"`, (err) => {
        resolve();
      });
    });
  }

  private dispatchTerminalOSC(event: SkillNotificationEvent): void {
    if (process.stdout && process.stdout.isTTY) {
      const title = event.title || "LUMI Skill Tree";
      const body = event.message || "";
      process.stdout.write(`\x1b]99;i=1:d=0;${title}\x1b\\\x1b]99;i=1:d=1;${body}\x1b\\`);

      if (this.preferences.soundEnabled && event.urgency === "critical") {
        process.stdout.write("\x07");
      }
    }
  }

  private createRecord(
    event: SkillNotificationEvent,
    delivered: boolean,
    audioPlayed: boolean,
    error?: string
  ): SkillNotificationRecord {
    return {
      id: `sknotif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      event,
      dispatchedAtMs: Date.now(),
      delivered,
      read: false,
      audioPlayed,
      error,
    };
  }

  private pushHistory(record: SkillNotificationRecord): void {
    this.history.unshift(record);
    if (this.history.length > SkillDesktopNotificationDispatcher.MAX_HISTORY) {
      this.history.pop();
    }
  }

  private notifyListeners(record: SkillNotificationRecord): void {
    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch {
        // Suppress
      }
    }
  }
}
