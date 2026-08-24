import type {
  EngineProgressEvent,
  EngineProgressPhase,
  EngineProgressStatus,
} from "../../core/contracts/agent.contracts.js";
import type { Component } from "../tui.js";
import { sanitizeProgressText } from "../../core/utilities/progress-sanitizer.js";
import { Text } from "./text.js";
import * as path from "node:path";

const ACTIVE_FRAMES = ["◐", "◓", "◑", "◒"] as const;

export interface AgentActivityTimelineOptions {
  model: string;
  maxVisibleActivities?: number;
  startedAt?: number;
}

/** A compact, persistent activity audit trail for one agent turn. */
export class AgentActivityTimeline implements Component {
  private readonly model: string;
  private readonly maxVisibleActivities: number;
  private readonly startedAt: number;
  private readonly entries = new Map<string, EngineProgressEvent>();
  private readonly order: string[] = [];
  private readonly text = new Text("", 0, 0);
  private elapsedMs = 0;
  private terminalStatus: "completed" | "failed" | "cancelled" | null = null;
  private highestSequence = -1;

  constructor(options: AgentActivityTimelineOptions) {
    this.model = sanitizeProgressText(options.model, 80);
    this.maxVisibleActivities = Math.max(3, options.maxVisibleActivities ?? 16);
    this.startedAt = options.startedAt ?? Date.now();
  }

  update(event: EngineProgressEvent): void {
    // A turn terminal is immutable. Late provider events, retry races, and
    // renderer callbacks cannot rewrite the visible outcome after settlement.
    if (this.terminalStatus) return;
    const safeEvent: EngineProgressEvent = {
      ...event,
      message: sanitizeProgressText(event.message, 96),
      ...(event.detail ? { detail: sanitizeProgressText(event.detail, 220) } : {}),
      timestamp: Number.isFinite(event.timestamp) ? event.timestamp : Date.now(),
      elapsedMs: event.elapsedMs === undefined || !Number.isFinite(event.elapsedMs)
        ? undefined
        : Math.max(0, event.elapsedMs),
      sequence: Number.isFinite(event.sequence) ? event.sequence : 0,
    };
    if (safeEvent.sequence < this.highestSequence) return;
    const existing = this.entries.get(safeEvent.activityId);
    if (existing && existing.sequence > safeEvent.sequence) return;
    if (!existing) this.order.push(event.activityId);
    this.entries.set(safeEvent.activityId, safeEvent);
    this.highestSequence = Math.max(this.highestSequence, safeEvent.sequence);
    this.elapsedMs = Math.max(
      this.elapsedMs,
      safeEvent.timestamp - this.startedAt,
      safeEvent.elapsedMs ?? 0
    );
    const isTurnEvent = safeEvent.metadata?.scope === undefined
      ? safeEvent.activityId.endsWith(":turn")
      : safeEvent.metadata.scope === "turn";
    if (isTurnEvent && safeEvent.status === "completed" && safeEvent.phase === "completed") {
      this.terminalStatus = "completed";
      this.settleActiveEntries(safeEvent, "completed");
    } else if (isTurnEvent && safeEvent.status === "failed") {
      this.terminalStatus = "failed";
      this.settleActiveEntries(safeEvent, "failed");
    } else if (isTurnEvent && safeEvent.status === "cancelled") {
      this.terminalStatus = "cancelled";
      this.settleActiveEntries(safeEvent, "cancelled");
    }
    this.invalidate();
  }

  setElapsed(elapsedMs: number): void {
    if (this.terminalStatus) return;
    this.elapsedMs = Math.max(0, elapsedMs);
    this.invalidate();
  }

  completeIfNeeded(elapsedMs: number): void {
    if (this.terminalStatus) return;
    this.update({
      activityId: "lumi:turn",
      phase: "completed",
      status: "completed",
      message: "Request complete",
      timestamp: this.startedAt + elapsedMs,
      elapsedMs,
      sequence: Number.MAX_SAFE_INTEGER,
      metadata: { source: "lumi", scope: "turn" },
    });
  }

  failIfNeeded(message: string, elapsedMs: number): void {
    if (this.terminalStatus) return;
    this.update({
      activityId: "lumi:turn",
      phase: "failed",
      status: "failed",
      message: "Request failed",
      detail: message,
      timestamp: this.startedAt + elapsedMs,
      elapsedMs,
      sequence: Number.MAX_SAFE_INTEGER,
      metadata: { source: "lumi", scope: "turn" },
    });
  }

  cancelIfNeeded(message: string, elapsedMs: number): void {
    if (this.terminalStatus) return;
    this.update({
      activityId: "lumi:turn",
      phase: "cancelled",
      status: "cancelled",
      message: "Request cancelled",
      detail: message,
      timestamp: this.startedAt + elapsedMs,
      elapsedMs,
      sequence: Number.MAX_SAFE_INTEGER,
      metadata: { source: "lumi", scope: "turn" },
    });
  }

  settleIfNeeded(
    outcome: "completed" | "failed" | "cancelled",
    message: string,
    elapsedMs: number
  ): void {
    if (outcome === "completed") {
      this.completeIfNeeded(elapsedMs);
    } else if (outcome === "cancelled") {
      this.cancelIfNeeded(message, elapsedMs);
    } else {
      this.failIfNeeded(message, elapsedMs);
    }
  }

  isTerminal(): boolean {
    return this.terminalStatus !== null;
  }

  getTerminalStatus(): "completed" | "failed" | "cancelled" | null {
    return this.terminalStatus;
  }

  invalidate(): void {
    this.text.invalidate();
  }

  render(width: number): string[] {
    this.text.setText(this.buildText(width));
    return this.text.render(width);
  }

  private buildText(width = 80): string {
    const boxWidth = Math.max(24, Math.min(width, 100));
    const hr = "─".repeat(Math.max(10, boxWidth - 2));
    const topBorder = `\x1b[90m╭${hr}╮\x1b[0m`;
    const midBorder = `\x1b[90m├${hr}┤\x1b[0m`;
    const botBorder = `\x1b[90m╰${hr}╯\x1b[0m`;

    const elapsed = this.formatElapsed(this.elapsedMs);
    const state = this.terminalStatus === "completed"
      ? `\x1b[1;32m✓ Completed in ${elapsed}\x1b[0m`
      : this.terminalStatus === "failed"
        ? `\x1b[1;31m✗ Failed after ${elapsed}\x1b[0m`
        : this.terminalStatus === "cancelled"
          ? `\x1b[1;33m■ Cancelled after ${elapsed}\x1b[0m`
          : `\x1b[1;33m◐ Working (${elapsed})\x1b[0m`;
    let statsBadge = "";
    if (this.terminalStatus === "completed") {
      const toolEvents = Array.from(this.entries.values()).filter((e) => e.phase === "tool");
      const writeEvents = Array.from(this.entries.values()).filter((e) => e.phase === "writing");
      const parts: string[] = [];
      if (writeEvents.length > 0) parts.push(`${writeEvents.length} ${writeEvents.length === 1 ? "file edit" : "file edits"}`);
      if (toolEvents.length > 0) parts.push(`${toolEvents.length} ${toolEvents.length === 1 ? "command" : "commands"}`);
      if (parts.length > 0) statsBadge = `  ·  \x1b[90m${parts.join(", ")}\x1b[0m`;
    }
    const header = `\x1b[1;37m✦ LUMI ENGINE\x1b[0m  ·  ${state}${statsBadge}  ·  \x1b[36m${this.model}\x1b[0m`;

    let overallId: string | undefined;
    for (const id of this.order) {
      const event = this.entries.get(id);
      const isTurnEvent = event?.metadata?.scope === undefined
        ? id.endsWith(":turn")
        : event.metadata.scope === "turn";
      if (isTurnEvent) overallId = id;
    }
    const isCompleted = this.terminalStatus !== null;
    const activityIds = this.order.filter((id) => {
      if (id === overallId) return false;
      // Filter out transient watchdog telemetry heartbeats once the turn finishes
      if (isCompleted && id.includes(":telemetry:")) return false;
      return true;
    });
    const activityBudget = Math.max(0, this.maxVisibleActivities - (overallId ? 1 : 0));
    const visibleIds = [
      ...(overallId ? [overallId] : []),
      ...activityIds.slice(-activityBudget),
    ];
    const hidden = this.order.length - visibleIds.length;
    const rows: string[] = [
      topBorder,
      `  ${header}`,
    ];

    // Live Stage Pipeline in-flight or Executive Artifact Highlights on completion
    if (!isCompleted) {
      rows.push(this.renderStagePipeline(boxWidth));
    } else if (this.terminalStatus === "completed") {
      const highlights = this.renderCompletionHighlights();
      if (highlights.length > 0) {
        rows.push(...highlights);
      }
      rows.push(this.renderStagePipeline(boxWidth));
    }

    rows.push(midBorder);

    if (hidden > 0) rows.push(`\x1b[90m  … ${hidden} earlier ${hidden === 1 ? "activity" : "activities"}\x1b[0m`);
    for (const id of visibleIds) {
      const event = this.entries.get(id);
      if (!event) continue;
      rows.push(this.formatRow(event));
    }
    if (visibleIds.length === 0) {
      rows.push("\x1b[33m  ◐\x1b[0m Starting request");
    }

    // Follow-up suggestions upon completion
    if (this.terminalStatus === "completed") {
      const suggestions = this.renderFollowUpSuggestions();
      if (suggestions.length > 0) {
        rows.push(midBorder);
        rows.push(...suggestions);
      }
    }

    rows.push(botBorder);
    return rows.join("\n");
  }

  private renderStagePipeline(width = 80): string {
    let activePhase: EngineProgressPhase = "thinking";
    for (let i = this.order.length - 1; i >= 0; i--) {
      const entry = this.entries.get(this.order[i]);
      if (entry && (entry.status === "started" || entry.status === "in_progress")) {
        activePhase = entry.phase;
        break;
      }
    }

    const isThink = activePhase === "thinking";
    const isPlan = activePhase === "planning";
    const isWrite = activePhase === "writing";
    const isTool = activePhase === "tool" || activePhase === "verifying";
    const isReady = activePhase === "responding";

    const sThink = isThink ? "\x1b[1;35m● Think\x1b[0m" : this.entriesHavePhase("thinking") ? "\x1b[32m✓ Think\x1b[0m" : "\x1b[90mThink\x1b[0m";
    const sPlan = isPlan ? "\x1b[1;36m● Plan\x1b[0m" : this.entriesHavePhase("planning") ? "\x1b[32m✓ Plan\x1b[0m" : "\x1b[90mPlan\x1b[0m";
    const sWrite = isWrite ? "\x1b[1;32m● Write\x1b[0m" : this.entriesHavePhase("writing") ? "\x1b[32m✓ Write\x1b[0m" : "\x1b[90mWrite\x1b[0m";
    const sVerify = isTool ? "\x1b[1;33m● Verify\x1b[0m" : (this.entriesHavePhase("tool") || this.entriesHavePhase("verifying")) ? "\x1b[32m✓ Verify\x1b[0m" : "\x1b[90mVerify\x1b[0m";
    const sReady = isReady ? "\x1b[1;35m● Ready\x1b[0m" : "\x1b[90mReady\x1b[0m";

    const arrow = width < 65 ? " \x1b[90m→\x1b[0m " : " \x1b[90m──▶\x1b[0m ";
    return `  \x1b[90mStage:\x1b[0m ${sThink}${arrow}${sPlan}${arrow}${sWrite}${arrow}${sVerify}${arrow}${sReady}`;
  }

  private entriesHavePhase(phase: EngineProgressPhase): boolean {
    return Array.from(this.entries.values()).some((e) => e.phase === phase && e.status === "completed");
  }

  getFollowUpSuggestions(): string[] {
    const suggestions: string[] = [];
    const entries = Array.from(this.entries.values());
    const hasFailures = entries.some((e) => e.status === "failed");

    // If an error or failed command occurred, prioritize error recovery
    if (hasFailures) {
      suggestions.push("Analyze error diagnostics and apply automated recovery fix");
    }

    // Inspect modified files
    const writtenFiles: string[] = [];
    for (const entry of entries) {
      if (entry.phase === "writing" && entry.status === "completed") {
        if (entry.metadata?.files && entry.metadata.files.length > 0) {
          writtenFiles.push(...entry.metadata.files);
        } else if (entry.message.startsWith("Created ") || entry.message.startsWith("Updated ")) {
          writtenFiles.push(entry.message.replace(/^(?:Created|Updated)\s+/, ""));
        }
      }
    }
    const uniqueFiles = Array.from(new Set(writtenFiles));
    const hasTs = uniqueFiles.some((f) => /\.[jt]sx?$/i.test(f));
    const hasCss = uniqueFiles.some((f) => /\.(css|scss|html)$/i.test(f));
    const hasTest = uniqueFiles.some((f) => /(test|spec)\.[jt]sx?$/i.test(f));

    // Check for active preview URL
    const hasPreview = entries.some((e) => /https?:\/\/(?:localhost|127\.0\.0\.1):\d+/i.test(`${e.message} ${e.detail ?? ""}`));
    if (hasPreview) {
      suggestions.push("Test interactive functionality in the active browser preview");
    }

    if (hasTs && !hasTest) {
      suggestions.push("Run tsc --noEmit and execute test suite to verify changes");
      suggestions.push("Add automated unit tests for modified components");
    } else if (hasTest) {
      suggestions.push("Run full test suite and verify edge cases");
    }

    if (hasCss) {
      suggestions.push("Verify responsive layout and theme styling across breakpoints");
    }

    const allText = entries.map((e) => `${e.message} ${e.detail ?? ""}`).join(" ").toLowerCase();
    if (allText.includes("game") || allText.includes("canvas") || allText.includes("kart") || allText.includes("audio")) {
      suggestions.push("Add sound effects and audio feedback using Web Audio API");
      suggestions.push("Implement persistent high scores with localStorage");
    }

    suggestions.push("Review git diff and stage verified changes");
    return Array.from(new Set(suggestions)).slice(0, 5);
  }

  private renderCompletionHighlights(): string[] {
    const highlights: string[] = [];

    // Look for preview URLs in commands or messages
    let previewUrl: string | undefined;
    for (const entry of this.entries.values()) {
      const text = `${entry.message} ${entry.detail ?? ""}`;
      const match = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+/i);
      if (match) {
        previewUrl = match[0];
        break;
      }
    }
    if (previewUrl) {
      highlights.push(`  \x1b[1;36m🌐 Preview Active:\x1b[0m \x1b[1;4;36m${previewUrl}\x1b[0m \x1b[32m(Ready in browser)\x1b[0m`);
    }

    // Look for created/modified files
    const writtenFiles: string[] = [];
    for (const entry of this.entries.values()) {
      if (entry.phase === "writing" && entry.status === "completed") {
        if (entry.metadata?.files && entry.metadata.files.length > 0) {
          writtenFiles.push(...entry.metadata.files);
        } else if (entry.message.startsWith("Created ") || entry.message.startsWith("Updated ")) {
          writtenFiles.push(entry.message.replace(/^(?:Created|Updated)\s+/, ""));
        }
      }
    }
    const uniqueFiles = Array.from(new Set(writtenFiles));
    if (uniqueFiles.length > 0) {
      highlights.push(`  \x1b[1;32m📄 Artifacts:\x1b[0m \x1b[1;37m${uniqueFiles.slice(0, 4).join(", ")}${uniqueFiles.length > 4 ? ` (+${uniqueFiles.length - 4} more)` : ""}\x1b[0m`);
    }

    // Look for screenshots captured
    const screenshots: string[] = [];
    for (const entry of this.entries.values()) {
      const text = `${entry.message} ${entry.detail ?? ""}`;
      const match = text.match(/(?:--screenshot=|\.impeccable\/review\/|screenshot\s+)([a-zA-Z0-9_./-]+\.png)/i);
      if (match && match[1]) {
        screenshots.push(path.basename(match[1]));
      }
    }
    const uniqueScreenshots = Array.from(new Set(screenshots));
    if (uniqueScreenshots.length > 0) {
      highlights.push(`  \x1b[1;35m📸 Captures:\x1b[0m \x1b[1;37m${uniqueScreenshots.slice(0, 3).join(", ")}${uniqueScreenshots.length > 3 ? ` (+${uniqueScreenshots.length - 3} more)` : ""}\x1b[0m`);
    }

    return highlights;
  }

  private renderFollowUpSuggestions(): string[] {
    const rawSuggestions = this.getFollowUpSuggestions();
    return rawSuggestions.slice(0, 3).map((s) => `  \x1b[90m💡 Next (Tab to autofill):\x1b[0m \x1b[36m'${s}'\x1b[0m`);
  }

  private phaseBadge(phase: string, attempt?: number): string {
    const attemptTag = attempt && attempt > 1 ? ` #${attempt}` : "";
    switch (phase) {
      case "thinking":
        return `\x1b[35m[Think${attemptTag}]\x1b[0m`;
      case "planning":
        return "\x1b[36m[Plan]\x1b[0m";
      case "tool":
        return "\x1b[34m[Tool]\x1b[0m";
      case "writing":
        return "\x1b[32m[Write]\x1b[0m";
      case "verifying":
        return "\x1b[33m[Check]\x1b[0m";
      case "responding":
        return "\x1b[35m[Draft]\x1b[0m";
      case "connecting":
        return `\x1b[90m[Init${attemptTag}]\x1b[0m`;
      case "failed":
        return `\x1b[31m[Fail${attemptTag}]\x1b[0m`;
      default:
        return "";
    }
  }

  private formatRow(event: EngineProgressEvent): string {
    const { icon, color } = this.statusStyle(event.status);
    const badge = event.phase ? ` ${this.phaseBadge(event.phase, event.metadata?.attempt)}` : "";
    const detail = event.detail ? ` \x1b[90m— ${event.detail}\x1b[0m` : "";
    const duration = event.elapsedMs && event.elapsedMs >= 1000
      ? ` \x1b[90m(${this.formatElapsed(event.elapsedMs)})\x1b[0m`
      : "";
    const warning = event.metadata?.telemetry?.warning
      ? ` \x1b[33m[⚠ ${event.metadata.telemetry.warning}]\x1b[0m`
      : "";
    return `  ${color}${icon}\x1b[0m${badge} ${event.message}${detail}${duration}${warning}`;
  }

  private settleActiveEntries(
    terminalEvent: EngineProgressEvent,
    status: "completed" | "failed" | "cancelled"
  ): void {
    for (const [id, entry] of this.entries) {
      if (id === terminalEvent.activityId) continue;
      if (entry.status !== "started" && entry.status !== "in_progress") continue;
      this.entries.set(id, {
        ...entry,
        phase: status,
        status,
        message: status === "completed" ? entry.message : `${entry.message} (${status === "cancelled" ? "stopped" : "interrupted"})`,
        timestamp: terminalEvent.timestamp,
        elapsedMs: Math.max(0, terminalEvent.timestamp - entry.timestamp),
        sequence: terminalEvent.sequence,
      });
    }
  }

  private statusStyle(status: EngineProgressStatus): { icon: string; color: string } {
    switch (status) {
      case "completed":
        return { icon: "✓", color: "\x1b[32m" };
      case "failed":
        return { icon: "✗", color: "\x1b[31m" };
      case "cancelled":
        return { icon: "■", color: "\x1b[33m" };
      case "started":
      case "in_progress":
        return {
          icon: ACTIVE_FRAMES[Math.floor(this.elapsedMs / 250) % ACTIVE_FRAMES.length],
          color: "\x1b[33m",
        };
    }
  }

  private formatElapsed(elapsedMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;
  }
}
