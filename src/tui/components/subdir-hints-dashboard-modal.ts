/**
 * subdir-hints-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for inspecting discovered subdirectory hints,
 * loaded directories, virtual rules, and health posture (Phase 129 / ADR-105 / Target #84).
 */

import type {
  SubdirectoryHintsHealthAuditReport,
  SubdirectoryHintsMetricsReport,
  DiscoveredSubdirHint,
} from "../../core/contracts/subdirectory-hints.contracts.js";
import { BroccoliSubdirHintsSubstrate } from "../../sessions/extensions/subdir_hints/broccoli-subdir-hints-substrate.js";
import { DeterministicSubdirHintEngine } from "../../agents/extensions/subdir_hints/deterministic-subdir-hint-engine.js";

export type SubdirHintsDashboardViewMode = "overview" | "hints" | "config" | "health" | "raw";

export class SubdirHintsDashboardModal {
  private readonly substrate: BroccoliSubdirHintsSubstrate;
  private readonly engine: DeterministicSubdirHintEngine;
  private viewMode: SubdirHintsDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliSubdirHintsSubstrate, engine?: DeterministicSubdirHintEngine) {
    this.substrate = substrate;
    this.engine = engine || new DeterministicSubdirHintEngine();
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

  public setViewMode(mode: SubdirHintsDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): SubdirHintsDashboardViewMode {
    const modes: SubdirHintsDashboardViewMode[] = ["overview", "hints", "config", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: SubdirHintsDashboardViewMode } {
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
        this.setViewMode("hints");
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
    lines.push("║        📁 PROGRESSIVE SUBDIRECTORY CONTEXT HINTS MODAL                     ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "hints", label: "[2] Hints" },
      { id: "config", label: "[3] Config" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const hints = this.substrate.getDiscoveredHints();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();
    const config = this.substrate.getConfig();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Discovered Hints:      \x1b[1m${health.totalHints}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Loaded Directories:    \x1b[32m${health.totalLoadedDirectories}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Bytes Injected:        \x1b[35m${metrics.bytesInjected} B\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Tool Checks Evaluated: \x1b[36m${metrics.totalToolChecks}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Duplicates Skipped:    \x1b[33m${metrics.duplicatesSkipped}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:        ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        break;
      }

      case "hints": {
        if (hints.length === 0) {
          lines.push("║  No subdirectory hints discovered yet.                                    ║");
        } else {
          for (let i = 0; i < Math.min(hints.length, 6); i++) {
            const h = hints[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[1m${h.filename}\x1b[0m in \`${h.relativeDirectory || '.'}\` (${h.charCount} chars, ${h.contentDigest.slice(0, 8)})`;
            lines.push(`║ ${line.slice(0, 72).padEnd(80)} ║`);
          }
        }
        break;
      }

      case "config": {
        lines.push(`║  Working Dir:        ${config.workingDir.slice(0, 50)}`.padEnd(76) + " ║");
        lines.push(`║  Max Hint Chars:     ${config.maxHintChars} chars`.padEnd(76) + " ║");
        lines.push(`║  Max Ancestor Walk:  ${config.maxAncestorWalk} levels`.padEnd(76) + " ║");
        lines.push(`║  Hint Files:         ${config.hintFilenames.join(", ").slice(0, 52)}`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "critical" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:      ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Hints:        ${health.totalHints}`.padEnd(76) + " ║");
        lines.push(`║  Loaded Dirs:        ${health.totalLoadedDirectories}`.padEnd(76) + " ║");
        lines.push(`║  Budget Used:        ${health.budgetUtilizationPercent}% (${health.totalBytesInjected}/${health.maxCharsAllowed} B)`.padEnd(76) + " ║");
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
