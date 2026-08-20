/**
 * profile-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing agent profiles,
 * blueprints, session bindings, revisions, few-shot exemplars, and SLA health audits
 * (Target #76 / ADR-119 / Zenith Tier).
 */

import type {
  ProfileBlueprint,
  ProfileDescriptor,
  ProfileHealthAuditReport,
  ProfileMetricsReport,
  ProfileRevision,
  ProfileWorkspaceSnapshot,
} from "../../core/contracts/profile.contracts.js";
import { BroccoliProfileSubstrate } from "../../sessions/extensions/profiles/broccoli-profile-substrate.js";
import { DeterministicProfileEngine } from "../../agents/extensions/profiles/deterministic-profile-engine.js";

export type ProfileDashboardViewMode = "profiles" | "blueprints" | "revisions" | "exemplars" | "health" | "raw";

export class ProfileDashboardModal {
  private readonly substrate: BroccoliProfileSubstrate;
  private readonly engine: DeterministicProfileEngine;
  private viewMode: ProfileDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliProfileSubstrate, engine: DeterministicProfileEngine) {
    this.substrate = substrate;
    this.engine = engine;
    this.viewMode = "profiles";
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

  public setViewMode(mode: ProfileDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): ProfileDashboardViewMode {
    const modes: ProfileDashboardViewMode[] = ["profiles", "blueprints", "revisions", "exemplars", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: ProfileDashboardViewMode } {
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
        this.setViewMode("profiles");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("blueprints");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("revisions");
        return { action: "render", viewMode: this.viewMode };

      case "4":
        this.setViewMode("exemplars");
        return { action: "render", viewMode: this.viewMode };

      case "5":
        this.setViewMode("health");
        return { action: "render", viewMode: this.viewMode };

      case "6":
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
    lines.push("╔══════════════════════════════════════════════════════════════════════════════════════════════════╗");
    lines.push("║           👤 ZENITH PERSISTENT MULTI-PROFILE ORCHESTRATOR MODAL & STUDIO                         ║");
    lines.push("╠══════════════════════════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "profiles", label: "[1] Profiles" },
      { id: "blueprints", label: "[2] Blueprints" },
      { id: "revisions", label: "[3] Revisions" },
      { id: "exemplars", label: "[4] Exemplars" },
      { id: "health", label: "[5] SLA Health" },
      { id: "raw", label: "[6] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(98)} ║`);
    lines.push("╠══════════════════════════════════════════════════════════════════════════════════════════════════╣");

    switch (this.viewMode) {
      case "profiles": {
        const list = this.substrate.listProfiles();
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          const isSelected = i === this.selectedIndex;
          const prefix = isSelected ? "▶ " : "  ";
          const fav = p.isFavorite ? "⭐" : "  ";
          const line = `${prefix}${fav}${p.icon || "👤"} \x1b[1m${p.id.padEnd(14)}\x1b[0m │ ${p.name.slice(0, 24).padEnd(24)} │ \x1b[32m${p.status.toUpperCase().padEnd(8)}\x1b[0m │ ${(p.category || "general").toUpperCase().padEnd(12)} │ \x1b[33m${(p.modelPreference || "default").slice(0, 14)}\x1b[0m`;
          lines.push(`║ ${line.padEnd(96)} ║`);
        }
        break;
      }

      case "blueprints": {
        const list = this.engine.listBlueprints();
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          const isSelected = i === this.selectedIndex;
          const prefix = isSelected ? "▶ " : "  ";
          const line = `${prefix}${b.icon} \x1b[1m${b.id.padEnd(14)}\x1b[0m │ ${b.name.slice(0, 26).padEnd(26)} │ ${(b.category).toUpperCase().padEnd(14)} │ \x1b[36m${b.recommendedModel}\x1b[0m`;
          lines.push(`║ ${line.padEnd(96)} ║`);
        }
        break;
      }

      case "revisions": {
        const list = this.substrate.listProfiles();
        let totalRevs = 0;
        for (const p of list) {
          const revs = this.substrate.listRevisions(p.id);
          if (revs.length > 0) {
            totalRevs += revs.length;
            for (const r of revs) {
              const line = `  \x1b[36m${p.id.padEnd(12)}\x1b[0m │ v${r.semanticVersion.padEnd(6)} │ ${r.changeLog.slice(0, 36).padEnd(36)} │ by ${r.author || "system"}`;
              lines.push(`║ ${line.padEnd(96)} ║`);
            }
          }
        }
        if (totalRevs === 0) {
          lines.push("║  No historical revisions recorded yet.                                                           ║");
        }
        break;
      }

      case "exemplars": {
        const list = this.substrate.listProfiles();
        let totalEx = 0;
        for (const p of list) {
          if (p.exemplars && p.exemplars.length > 0) {
            totalEx += p.exemplars.length;
            for (const ex of p.exemplars) {
              const line = `  \x1b[36m${p.id.padEnd(12)}\x1b[0m │ \x1b[1m${ex.title.slice(0, 24).padEnd(24)}\x1b[0m │ ${ex.input.slice(0, 42)}`;
              lines.push(`║ ${line.padEnd(96)} ║`);
            }
          }
        }
        if (totalEx === 0) {
          lines.push("║  No few-shot demonstrations attached to active profiles.                                         ║");
        }
        break;
      }

      case "health": {
        const health = this.substrate.auditHealth();
        const metrics = this.substrate.getMetrics();
        const statusColor = health.healthStatus === "critical_unbound" ? "\x1b[31m" : "\x1b[32m";
        lines.push(`║  Health Status:      ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(105) + " ║");
        lines.push(`║  Active Profiles:    \x1b[32m${health.activeProfilesCount} / ${health.totalProfiles}\x1b[0m`.padEnd(105) + " ║");
        lines.push(`║  Favorite Profiles:  ${health.favoriteProfilesCount}`.padEnd(96) + " ║");
        lines.push(`║  Bound Sessions:     ${health.boundSessionsCount}`.padEnd(96) + " ║");
        lines.push(`║  Tokens Consumed:    ${metrics.totalTokensConsumed.toLocaleString()} (Saved: ${metrics.totalTokensSaved.toLocaleString()})`.padEnd(96) + " ║");
        lines.push(`║  Total Cost (USD):   $${metrics.totalCostUsd.toFixed(4)}`.padEnd(96) + " ║");
        for (const rec of health.recommendations) {
          lines.push(`║  💡 ${rec.slice(0, 88)}`.padEnd(96) + " ║");
        }
        break;
      }

      case "raw": {
        const snapshot = this.substrate.exportSnapshot();
        const rawJson = JSON.stringify(snapshot, null, 2).split("\n");
        for (const r of rawJson.slice(0, 10)) {
          lines.push(`║  ${r.slice(0, 92)}`.padEnd(96) + " ║");
        }
        break;
      }
    }

    lines.push("╠══════════════════════════════════════════════════════════════════════════════════════════════════╣");
    lines.push("║ [Tab] Cycle View  [1-6] Direct View  [j/k] Navigate  [q/Esc] Close Modal                         ║");
    lines.push("╚══════════════════════════════════════════════════════════════════════════════════════════════════╝");

    return lines.join("\n");
  }
}
