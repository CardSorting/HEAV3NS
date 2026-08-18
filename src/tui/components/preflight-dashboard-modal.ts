/**
 * preflight-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for reviewing pre-exec command security scans,
 * threat findings, security policies, and circuit breaker status (Phase 113 / ADR-089 / Target #79).
 */

import type {
  PreflightHealthAuditReport,
  PreflightMetricsReport,
  PreflightScanResultRow,
} from "../../core/contracts/preflight-scanner.contracts.js";
import { BroccoliPreflightSubstrate } from "../../sessions/extensions/preflight_scanner/broccoli-preflight-substrate.js";
import { DeterministicPreflightScanner } from "../../agents/extensions/preflight_scanner/deterministic-preflight-scanner.js";

export type PreflightDashboardViewMode = "overview" | "scans" | "policy" | "health" | "raw";

export class PreflightDashboardModal {
  private readonly substrate: BroccoliPreflightSubstrate;
  private readonly scanner: DeterministicPreflightScanner;
  private viewMode: PreflightDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliPreflightSubstrate, scanner?: DeterministicPreflightScanner) {
    this.substrate = substrate;
    this.scanner = scanner || new DeterministicPreflightScanner();
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

  public setViewMode(mode: PreflightDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): PreflightDashboardViewMode {
    const modes: PreflightDashboardViewMode[] = ["overview", "scans", "policy", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: PreflightDashboardViewMode } {
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
        this.setViewMode("scans");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("policy");
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
    lines.push("║        🔍 PREFLIGHT SECURITY THREAT GATE MODAL                             ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "scans", label: "[2] Scans" },
      { id: "policy", label: "[3] Policy" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const scans = this.substrate.listScans();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();
    const policy = this.substrate.getPolicy();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Total Commands Scanned: \x1b[1m${metrics.totalScans}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Threats Blocked:       \x1b[31m${metrics.totalBlocked}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Warnings Issued:       \x1b[33m${metrics.totalWarned}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Commands Allowed:      \x1b[32m${metrics.totalAllowed}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Circuit Breaker:       ${metrics.circuitBreakerTripped ? '\x1b[31mTRIPPED\x1b[0m' : '\x1b[32mCLOSED\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:        ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        break;
      }

      case "scans": {
        if (scans.length === 0) {
          lines.push("║  No scanned command security audits recorded in memory ledger.            ║");
        } else {
          for (let i = 0; i < Math.min(scans.length, 6); i++) {
            const s = scans[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const verdictColor = s.verdict === "block" ? "\x1b[31m" : s.verdict === "warn" ? "\x1b[33m" : "\x1b[32m";
            const line = `${prefix}\x1b[1m${s.scanId.slice(0, 14)}\x1b[0m │ ${verdictColor}${s.verdict.toUpperCase()}\x1b[0m │ ${s.command.slice(0, 35)}`;
            lines.push(`║ ${line.slice(0, 72).padEnd(80)} ║`);
          }
        }
        break;
      }

      case "policy": {
        lines.push(`║  Enabled:              ${policy.enabled ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Fail-Open Mode:       ${policy.failOpen ? '\x1b[33mtrue\x1b[0m' : '\x1b[32mfalse (Fail-Closed)\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Timeout SLA:          ${policy.timeoutMs} ms`.padEnd(76) + " ║");
        lines.push(`║  Circuit Breaker Limit: ${policy.circuitBreakerLimit} failures`.padEnd(76) + " ║");
        lines.push(`║  Blocked Categories:   ${policy.blockedCategories.length} categories active`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "critical" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:        ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Commands Scanned:     ${health.totalScans}`.padEnd(76) + " ║");
        lines.push(`║  Blocked Threats:      ${health.totalBlocked}`.padEnd(76) + " ║");
        lines.push(`║  Allowed:              ${health.totalAllowed}`.padEnd(76) + " ║");
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
