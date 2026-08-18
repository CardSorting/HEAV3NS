/**
 * patch-mutation-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing staged file mutations,
 * diff previews, transactional status, and mutation health metrics (Phase 77 / ADR-029 / Target #74).
 */

import type {
  FileMutationEntry,
  PatchMutationHealthAuditReport,
  PatchMutationMetricsReport,
} from "../../core/contracts/patch-mutation.contracts.js";
import { BroccoliPatchSubstrate } from "../../sessions/extensions/patch/broccoli-patch-substrate.js";
import { DeterministicPatchEngine } from "../../tooling/extensions/patch/deterministic-patch-engine.js";

export type PatchMutationDashboardViewMode = "overview" | "staged" | "diffs" | "health" | "raw";

export class PatchMutationDashboardModal {
  private readonly substrate: BroccoliPatchSubstrate;
  private readonly patchEngine: DeterministicPatchEngine;
  private viewMode: PatchMutationDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliPatchSubstrate, patchEngine?: DeterministicPatchEngine) {
    this.substrate = substrate;
    this.patchEngine = patchEngine || new DeterministicPatchEngine();
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

  public setViewMode(mode: PatchMutationDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): PatchMutationDashboardViewMode {
    const modes: PatchMutationDashboardViewMode[] = ["overview", "staged", "diffs", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: PatchMutationDashboardViewMode } {
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
        this.setViewMode("staged");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("diffs");
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
    lines.push("║        📝 ATOMIC PATCH & FILE MUTATION MODAL                               ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "staged", label: "[2] Staged" },
      { id: "diffs", label: "[3] Diffs" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const staged = this.substrate.listStaged();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Active Staged:          \x1b[1m${metrics.totalStaged}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Committed:        \x1b[32m${metrics.totalCommitted}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Reverted:         \x1b[31m${metrics.totalReverted}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:         ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Staged Bytes:           ${metrics.totalBytesStaged} bytes`.padEnd(76) + " ║");
        break;
      }

      case "staged": {
        if (staged.length === 0) {
          lines.push("║  No files currently staged in transactional memory buffer.                 ║");
        } else {
          for (let i = 0; i < Math.min(staged.length, 6); i++) {
            const e = staged[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const size = e.stagedContent ? e.stagedContent.length : 0;
            const line = `${prefix}\x1b[1m${e.path.slice(0, 45)}\x1b[0m │ \x1b[35m${e.status.toUpperCase()}\x1b[0m │ ${size}B`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "diffs": {
        if (staged.length === 0) {
          lines.push("║  No staged file diffs to display.                                          ║");
        } else {
          for (let i = 0; i < Math.min(staged.length, 4); i++) {
            const e = staged[i];
            lines.push(`║ \x1b[1;36m--- a/${e.path}\x1b[0m`.padEnd(85) + " ║");
            lines.push(`║ \x1b[1;32m+++ b/${e.path}\x1b[0m`.padEnd(85) + " ║");
            const preview = (e.stagedContent || "").split("\n").slice(0, 2).map((l) => `+ ${l.slice(0, 50)}`);
            for (const pl of preview) {
              lines.push(`║  \x1b[32m${pl}\x1b[0m`.padEnd(85) + " ║");
            }
          }
        }
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "critical" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:          ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Active Staged:          ${health.totalStaged}`.padEnd(76) + " ║");
        lines.push(`║  Committed:              ${health.totalCommitted}`.padEnd(76) + " ║");
        lines.push(`║  Reverted:               ${health.totalReverted}`.padEnd(76) + " ║");
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
