/**
 * streaming-scrubber-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing streaming delta scrub events,
 * reasoning tag suppression metrics, and multi-session holdback states (Phase 137 / ADR-113 / Target #77).
 */

import type {
  StreamingScrubberHealthAuditReport,
  StreamingScrubberMetricsReport,
  StreamingScrubberEventRow,
} from "../../core/contracts/streaming-think-scrubber.contracts.js";
import { BroccoliStreamingScrubberSubstrate } from "../../sessions/extensions/streaming_scrubber/broccoli-streaming-scrubber-substrate.js";
import { DeterministicStreamingScrubberEngine } from "../../agents/extensions/streaming_scrubber/deterministic-streaming-scrubber-engine.js";

export type StreamingScrubberDashboardViewMode = "overview" | "sessions" | "events" | "health" | "raw";

export class StreamingScrubberDashboardModal {
  private readonly substrate: BroccoliStreamingScrubberSubstrate;
  private readonly engine: DeterministicStreamingScrubberEngine;
  private viewMode: StreamingScrubberDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliStreamingScrubberSubstrate, engine?: DeterministicStreamingScrubberEngine) {
    this.substrate = substrate;
    this.engine = engine || new DeterministicStreamingScrubberEngine();
    this.viewMode = "overview";
    this.selectedIndex = 0;
    this.isVisible = false;
  }

  public open(): void {
    this.isVisible = true;
    this.selectedIndex = 0;
  }

  public close(): void {
    this.isVisible = false;
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  public setViewMode(mode: StreamingScrubberDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): StreamingScrubberDashboardViewMode {
    const modes: StreamingScrubberDashboardViewMode[] = ["overview", "sessions", "events", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: StreamingScrubberDashboardViewMode } {
    if (!this.isVisible) return { action: "none", viewMode: this.viewMode };

    switch (key.toLowerCase()) {
      case "q":
      case "escape":
        this.close();
        return { action: "close", viewMode: this.viewMode };

      case "\t":
      case "tab":
        this.cycleViewMode();
        return { action: "render", viewMode: this.viewMode };

      case "1":
        this.setViewMode("overview");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("sessions");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("events");
        return { action: "render", viewMode: this.viewMode };

      case "4":
        this.setViewMode("health");
        return { action: "render", viewMode: this.viewMode };

      case "5":
        this.setViewMode("raw");
        return { action: "render", viewMode: this.viewMode };

      case "j":
      case "down":
        this.selectedIndex = Math.min(this.selectedIndex + 1, 100);
        return { action: "render", viewMode: this.viewMode };

      case "k":
      case "up":
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        return { action: "render", viewMode: this.viewMode };

      default:
        return { action: "none", viewMode: this.viewMode };
    }
  }

  public render(): string {
    if (!this.isVisible) return "";

    const lines: string[] = [];
    lines.push("╔════════════════════════════════════════════════════════════════════════════╗");
    lines.push("║        🧬 STREAMING REASONING TAG SCRUBBER MODAL                           ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "sessions", label: "[2] Sessions" },
      { id: "events", label: "[3] Events" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const events = this.substrate.listEvents();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();
    const snapshot = this.substrate.exportSnapshot();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Total Deltas Processed: \x1b[1m${metrics.totalDeltasProcessed}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Chunks Suppressed:      \x1b[31m${metrics.reasoningChunksSuppressed}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Blocks Encountered:     \x1b[32m${metrics.blocksEncountered}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Flushes Executed:       \x1b[33m${metrics.flushesExecuted}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:         ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        break;
      }

      case "sessions": {
        const sessionKeys = Object.keys(snapshot.sessionStates);
        if (sessionKeys.length === 0) {
          lines.push("║  No active streaming sessions registered in substrate.                    ║");
        } else {
          for (let i = 0; i < Math.min(sessionKeys.length, 6); i++) {
            const sid = sessionKeys[i];
            const state = snapshot.sessionStates[sid];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[1m${sid.slice(0, 24)}\x1b[0m │ Turn #${state.turnIndex} │ InBlock: ${state.inBlock ? '\x1b[31mtrue\x1b[0m' : '\x1b[32mfalse\x1b[0m'} │ Held: ${state.heldBuffer.length}B`;
            lines.push(`║ ${line.slice(0, 72).padEnd(80)} ║`);
          }
        }
        break;
      }

      case "events": {
        if (events.length === 0) {
          lines.push("║  No delta scrubbing events recorded yet in memory ledger.                  ║");
        } else {
          for (let i = 0; i < Math.min(events.length, 6); i++) {
            const e = events[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[1m${e.id.slice(0, 16)}\x1b[0m │ ${e.sessionId.slice(0, 12)} │ ${e.deltaSize}B->${e.emittedSize}B │ InBlock: ${e.inBlock}`;
            lines.push(`║ ${line.slice(0, 72).padEnd(80)} ║`);
          }
        }
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "critical" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:          ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Deltas:           ${health.totalDeltasProcessed}`.padEnd(76) + " ║");
        lines.push(`║  Suppressed Chunks:      ${health.reasoningChunksSuppressed}`.padEnd(76) + " ║");
        lines.push(`║  Active Sessions:        ${health.activeSessions}`.padEnd(76) + " ║");
        for (const rec of health.recommendations) {
          lines.push(`║  💡 ${rec.slice(0, 68)}`.padEnd(76) + " ║");
        }
        break;
      }

      case "raw": {
        const rawJson = JSON.stringify(snapshot, null, 2).split("\n");
        for (const r of rawJson.slice(0, 10)) {
          lines.push(`║  ${r.slice(0, 72)}`.padEnd(76) + " ║");
        }
        break;
      }
    }

    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");
    lines.push("║ [Tab] Cycle View  [1-5] Direct View  [j/k] Navigate  [q/Esc] Close Modal   ║");
    lines.push("╚════════════════════════════════════════════════════════════════════════════╝");

    return lines.join("\n");
  }
}
