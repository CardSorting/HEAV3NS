/**
 * terminal-cleaner-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing terminal output cleaning events,
 * ANSI stripping metrics, binary file guards, and health telemetry (Phase 136 / ADR-112 / Target #76).
 */

import type {
  TerminalCleanerHealthAuditReport,
  TerminalCleanerMetricsReport,
  TerminalCleanEventRow,
} from "../../core/contracts/terminal-cleaner.contracts.js";
import { BroccoliTerminalCleanerSubstrate } from "../../sessions/extensions/terminal_cleaner/broccoli-terminal-cleaner-substrate.js";
import { DeterministicTerminalCleanerEngine } from "../../agents/extensions/terminal_cleaner/deterministic-terminal-cleaner-engine.js";

export type TerminalCleanerDashboardViewMode = "overview" | "events" | "config" | "health" | "raw";

export class TerminalCleanerDashboardModal {
  private readonly substrate: BroccoliTerminalCleanerSubstrate;
  private readonly engine: DeterministicTerminalCleanerEngine;
  private viewMode: TerminalCleanerDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliTerminalCleanerSubstrate, engine?: DeterministicTerminalCleanerEngine) {
    this.substrate = substrate;
    this.engine = engine || new DeterministicTerminalCleanerEngine();
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

  public setViewMode(mode: TerminalCleanerDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): TerminalCleanerDashboardViewMode {
    const modes: TerminalCleanerDashboardViewMode[] = ["overview", "events", "config", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: TerminalCleanerDashboardViewMode } {
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
        this.setViewMode("events");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("config");
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
    lines.push("║        🧹 TERMINAL OUTPUT CLEANER & ANSI SANITIZER MODAL                   ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "events", label: "[2] Events" },
      { id: "config", label: "[3] Config" },
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
    const config = this.substrate.getConfig();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Strings Cleaned:        \x1b[1m${metrics.totalStringsCleaned}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  ANSI Codes Stripped:    \x1b[32m${metrics.ansiSequencesStripped}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Control Bytes Filtered: \x1b[33m${metrics.controlCharsFiltered}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Blocked Writes:         \x1b[31m${metrics.opaqueDocumentWritesBlocked}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:         ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        break;
      }

      case "events": {
        if (events.length === 0) {
          lines.push("║  No cleaning events recorded yet in memory ledger.                         ║");
        } else {
          for (let i = 0; i < Math.min(events.length, 6); i++) {
            const e = events[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[1m${e.id.slice(0, 20)}\x1b[0m │ \x1b[35m${e.mode}\x1b[0m │ ${e.originalLength}B->${e.cleanedLength}B │ ANSI:${e.ansiCodesCount}`;
            lines.push(`║ ${line.slice(0, 72).padEnd(80)} ║`);
          }
        }
        break;
      }

      case "config": {
        lines.push(`║  Enabled:                ${config.enabled ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Strip ANSI Sequences:   ${config.stripAnsiSequences ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Normalize Carriage Ret: ${config.normalizeCarriageReturns ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Strip Control Chars:    ${config.stripControlChars ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Guard Opaque Documents: ${config.guardOpaqueDocuments ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "critical" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:          ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Strings Cleaned:  ${health.totalStringsCleaned}`.padEnd(76) + " ║");
        lines.push(`║  ANSI Stripped:          ${health.ansiSequencesStripped}`.padEnd(76) + " ║");
        lines.push(`║  Fast Path Ratio:        ${(health.fastPathRatio * 100).toFixed(1)}%`.padEnd(76) + " ║");
        for (const rec of health.recommendations) {
          lines.push(`║  💡 ${rec.slice(0, 68)}`.padEnd(76) + " ║");
        }
        break;
      }

      case "raw": {
        const snapshot = this.substrate.exportSnapshot();
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
