/**
 * identity-federation-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing token leases,
 * pending OAuth2 PKCE device authorizations, tier quotas, and SLA health audits (Phase 98 / ADR-052 / Target #69).
 */

import type {
  DeviceAuthorizationPending,
  IdentityFederationHealthAuditReport,
  IdentityFederationMetricsReport,
  TokenLeaseRecord,
} from "../../core/contracts/identity-federation.contracts.js";
import { BroccoliAuthSubstrate } from "../../sessions/extensions/auth/broccoli-auth-substrate.js";
import { DeterministicAuthFederator } from "../../tooling/extensions/auth/deterministic-auth-federator.js";

export type IdentityFederationDashboardViewMode = "overview" | "leases" | "pending" | "health" | "raw";

export class IdentityFederationDashboardModal {
  private readonly substrate: BroccoliAuthSubstrate;
  private readonly federator: DeterministicAuthFederator;
  private viewMode: IdentityFederationDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliAuthSubstrate, federator?: DeterministicAuthFederator) {
    this.substrate = substrate;
    this.federator = federator || new DeterministicAuthFederator();
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

  public setViewMode(mode: IdentityFederationDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): IdentityFederationDashboardViewMode {
    const modes: IdentityFederationDashboardViewMode[] = ["overview", "leases", "pending", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: IdentityFederationDashboardViewMode } {
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
        this.setViewMode("leases");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("pending");
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
    lines.push("║        🔐 IDENTITY FEDERATION & TOKEN LEASE VAULT MODAL                     ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "leases", label: "[2] Active Leases" },
      { id: "pending", label: "[3] Pending Logins" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const leases = this.substrate.listLeases();
    const pending = this.substrate.listPendingAuths();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Active Leases:          \x1b[1m${metrics.activeLeaseCount}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:         ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Pending Authorizations: \x1b[33m${health.pendingAuthorizationsCount}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Expired Leases:         \x1b[31m${health.expiredLeasesCount}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Tier Breakdown:         Free: ${metrics.tierDistribution.free} │ Pro: ${metrics.tierDistribution.pro} │ Team: ${metrics.tierDistribution.team}`.padEnd(76) + " ║");
        break;
      }

      case "leases": {
        if (leases.length === 0) {
          lines.push("║  No active token leases registered. Login with OAuth2 PKCE device flow.   ║");
        } else {
          for (let i = 0; i < Math.min(leases.length, 6); i++) {
            const l = leases[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const isExp = l.expiresAt <= Date.now();
            const statusColor = isExp ? "\x1b[31m" : "\x1b[32m";
            const line = `${prefix}\x1b[1m${l.providerId.toUpperCase()}\x1b[0m │ ${l.tier.toUpperCase()} │ ${statusColor}${isExp ? "EXPIRED" : "ACTIVE"}\x1b[0m │ ${l.leaseId.slice(0, 20)}`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "pending": {
        if (pending.length === 0) {
          lines.push("║  No pending device authorizations in progress.                            ║");
        } else {
          for (let i = 0; i < Math.min(pending.length, 6); i++) {
            const p = pending[i];
            const line = `  Code: \x1b[1;36m${p.userCode}\x1b[0m -> ${p.verificationUri} (Expires in ${p.expiresIn}s)`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "unhealthy" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:          ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Active Leases:          ${health.totalActiveLeases}`.padEnd(76) + " ║");
        lines.push(`║  Expired Leases:         ${health.expiredLeasesCount}`.padEnd(76) + " ║");
        lines.push(`║  Pending Authorizations: ${health.pendingAuthorizationsCount}`.padEnd(76) + " ║");
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
