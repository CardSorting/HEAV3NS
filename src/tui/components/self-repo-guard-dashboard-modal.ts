/**
 * self-repo-guard-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing self-repository mutation incidents,
 * Git command safety metrics, and root protection configuration (Phase 138 / ADR-114 / Target #78).
 */

import type {
  SelfRepoGuardHealthAuditReport,
  SelfRepoGuardMetricsReport,
  SelfRepoGuardIncidentRow,
} from "../../core/contracts/self-repo-guard.contracts.js";
import { BroccoliSelfRepoGuardSubstrate } from "../../sessions/extensions/self_repo_guard/broccoli-self-repo-guard-substrate.js";
import { DeterministicSelfRepoGuardEngine } from "../../agents/extensions/self_repo_guard/deterministic-self-repo-guard-engine.js";

export type SelfRepoGuardDashboardViewMode = "overview" | "incidents" | "config" | "health" | "raw";

export class SelfRepoGuardDashboardModal {
  private readonly substrate: BroccoliSelfRepoGuardSubstrate;
  private readonly engine: DeterministicSelfRepoGuardEngine;
  private viewMode: SelfRepoGuardDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliSelfRepoGuardSubstrate, engine?: DeterministicSelfRepoGuardEngine) {
    this.substrate = substrate;
    this.engine = engine || new DeterministicSelfRepoGuardEngine();
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

  public setViewMode(mode: SelfRepoGuardDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): SelfRepoGuardDashboardViewMode {
    const modes: SelfRepoGuardDashboardViewMode[] = ["overview", "incidents", "config", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: SelfRepoGuardDashboardViewMode } {
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
        this.setViewMode("incidents");
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
    lines.push("║        🛡️ SELF-REPOSITORY MUTATION GUARD MODAL                             ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "incidents", label: "[2] Incidents" },
      { id: "config", label: "[3] Config" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const incidents = this.substrate.listIncidents();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();
    const config = this.substrate.getConfig();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Commands Inspected:    \x1b[1m${metrics.totalCommandsInspected}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Mutations Blocked:     \x1b[31m${metrics.destructiveGitMutationsBlocked}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Safe Ops Passed:       \x1b[32m${metrics.safeGitOperationsPassed}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Foreign Repos Allowed: \x1b[33m${metrics.foreignRepoMutationsAllowed}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:        ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        break;
      }

      case "incidents": {
        if (incidents.length === 0) {
          lines.push("║  No destructive mutation incidents recorded in memory ledger.             ║");
        } else {
          for (let i = 0; i < Math.min(incidents.length, 6); i++) {
            const inc = incidents[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[1m${inc.incidentId.slice(0, 16)}\x1b[0m │ \x1b[31m${inc.operation}\x1b[0m │ ${inc.command.slice(0, 35)}`;
            lines.push(`║ ${line.slice(0, 72).padEnd(80)} ║`);
          }
        }
        break;
      }

      case "config": {
        lines.push(`║  Enabled:                  ${config.enabled ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Strict Root Protection:   ${config.enforceStrictRootProtection ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Allow Worktree Sandboxes: ${config.allowWorktreeSandboxes ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Running Root:             ${(config.runningSourceRoot || "auto-detected").slice(0, 45)}`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "critical" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:            ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Commands Inspected:       ${health.totalCommandsInspected}`.padEnd(76) + " ║");
        lines.push(`║  Blocked Mutations:        ${health.destructiveGitMutationsBlocked}`.padEnd(76) + " ║");
        lines.push(`║  Safe Passed:              ${health.safeGitOperationsPassed}`.padEnd(76) + " ║");
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
