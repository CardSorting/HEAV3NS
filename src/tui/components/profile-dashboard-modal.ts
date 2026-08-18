/**
 * profile-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing agent profiles,
 * blueprints, session bindings, and SLA health audits (Target #76 / ADR-119).
 */

import type {
  ProfileBlueprint,
  ProfileDescriptor,
  ProfileHealthAuditReport,
  ProfileMetricsReport,
  ProfileWorkspaceSnapshot,
} from "../../core/contracts/profile.contracts.js";
import { BroccoliProfileSubstrate } from "../../sessions/extensions/profiles/broccoli-profile-substrate.js";
import { DeterministicProfileEngine } from "../../agents/extensions/profiles/deterministic-profile-engine.js";

export type ProfileDashboardViewMode = "profiles" | "blueprints" | "bindings" | "health" | "raw";

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
    const modes: ProfileDashboardViewMode[] = ["profiles", "blueprints", "bindings", "health", "raw"];
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
        this.setViewMode("bindings");
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
    lines.push("║           👤 PERSISTENT MULTI-PROFILE ORCHESTRATOR MODAL                   ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "profiles", label: "[1] Profiles" },
      { id: "blueprints", label: "[2] Blueprints" },
      { id: "bindings", label: "[3] Bindings" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    switch (this.viewMode) {
      case "profiles": {
        const list = this.substrate.listProfiles();
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          const isSelected = i === this.selectedIndex;
          const prefix = isSelected ? "▶ " : "  ";
          const line = `${prefix}${p.icon || "👤"} \x1b[1m${p.id.padEnd(12)}\x1b[0m │ ${p.name.slice(0, 22).padEnd(22)} │ \x1b[32m${p.status.toUpperCase()}\x1b[0m │ ${(p.category || "general").toUpperCase()}`;
          lines.push(`║ ${line.padEnd(78)} ║`);
        }
        break;
      }

      case "blueprints": {
        const list = this.engine.listBlueprints();
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          const isSelected = i === this.selectedIndex;
          const prefix = isSelected ? "▶ " : "  ";
          const line = `${prefix}${b.icon} \x1b[1m${b.id.padEnd(12)}\x1b[0m │ ${b.name.slice(0, 24).padEnd(24)} │ ${(b.category).toUpperCase()}`;
          lines.push(`║ ${line.padEnd(78)} ║`);
        }
        break;
      }

      case "bindings": {
        const snapshot = this.substrate.exportSnapshot();
        const entries = Object.entries(snapshot.sessionBindings);
        if (entries.length === 0) {
          lines.push("║  No dynamic session bindings active (all routing to default).              ║");
        } else {
          for (const [sessId, profId] of entries) {
            const line = `  Session: ${sessId.slice(0, 20)}... -> Profile: \x1b[36m${profId}\x1b[0m`;
            lines.push(`║ ${line.padEnd(80)} ║`);
          }
        }
        break;
      }

      case "health": {
        const health = this.substrate.auditHealth();
        const statusColor = health.healthStatus === "critical_unbound" ? "\x1b[31m" : "\x1b[32m";
        lines.push(`║  Health Status:      ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Active Profiles:    \x1b[32m${health.activeProfilesCount} / ${health.totalProfiles}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Favorite Profiles:  ${health.favoriteProfilesCount}`.padEnd(76) + " ║");
        lines.push(`║  Bound Sessions:     ${health.boundSessionsCount}`.padEnd(76) + " ║");
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
