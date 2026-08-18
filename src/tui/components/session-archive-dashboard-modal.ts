/**
 * session-archive-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing session archives,
 * export manifests, format footprints, and SLA health audits (Phase 99 / ADR-053 / Target #70).
 */

import type {
  ExportedDocumentResult,
  SessionArchiveHealthAuditReport,
  SessionArchiveManifest,
  SessionArchiveMetricsReport,
} from "../../core/contracts/session-archive.contracts.js";
import { BroccoliArchiveSubstrate } from "../../sessions/extensions/archive/broccoli-archive-substrate.js";
import { DeterministicSessionArchiver } from "../../tooling/extensions/archive/deterministic-session-archiver.js";

export type SessionArchiveDashboardViewMode = "overview" | "archives" | "formats" | "health" | "raw";

export class SessionArchiveDashboardModal {
  private readonly substrate: BroccoliArchiveSubstrate;
  private readonly archiver: DeterministicSessionArchiver;
  private viewMode: SessionArchiveDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliArchiveSubstrate, archiver?: DeterministicSessionArchiver) {
    this.substrate = substrate;
    this.archiver = archiver || new DeterministicSessionArchiver();
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

  public setViewMode(mode: SessionArchiveDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): SessionArchiveDashboardViewMode {
    const modes: SessionArchiveDashboardViewMode[] = ["overview", "archives", "formats", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: SessionArchiveDashboardViewMode } {
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
        this.setViewMode("archives");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("formats");
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
    lines.push("║        📦 SESSION ARCHIVE & COLD STORAGE VAULT MODAL                       ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "archives", label: "[2] Manifests" },
      { id: "formats", label: "[3] Formats" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const manifests = this.substrate.listManifests();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Total Archives:         \x1b[1m${metrics.totalExportsAttempted}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:         ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Turns Archived:   \x1b[36m${metrics.totalTurnsExported}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Storage Footprint: \x1b[35m${(metrics.totalBytesArchived / 1024).toFixed(1)} KB\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Avg Export Size:        ${metrics.averageExportSizeBytes} bytes`.padEnd(76) + " ║");
        break;
      }

      case "archives": {
        if (manifests.length === 0) {
          lines.push("║  No session archives recorded. Use export tools to generate archives.     ║");
        } else {
          for (let i = 0; i < Math.min(manifests.length, 6); i++) {
            const m = manifests[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[1m${m.sessionId.slice(0, 16)}\x1b[0m │ ${m.format.toUpperCase()} │ ${m.turnCount} turns │ ${m.totalSizeBytes}B │ ${m.archiveId.slice(0, 14)}`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "formats": {
        lines.push(`║  Markdown Archives (.md):   \x1b[32m${metrics.formatBreakdown.markdown}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  HTML5 Standalone (.html):  \x1b[36m${metrics.formatBreakdown.html}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  JSONL Event Stream (.jsonl):\x1b[33m${metrics.formatBreakdown.jsonl}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Binary Archive (.bin):     \x1b[35m${metrics.formatBreakdown.binary_archive}\x1b[0m`.padEnd(85) + " ║");
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "unhealthy" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:          ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Archives:         ${health.totalArchivesCount}`.padEnd(76) + " ║");
        lines.push(`║  Total Bytes:            ${health.totalSizeBytes} bytes`.padEnd(76) + " ║");
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
