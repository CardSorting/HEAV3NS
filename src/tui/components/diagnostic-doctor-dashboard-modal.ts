/**
 * diagnostic-doctor-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing diagnostic health reports,
 * check categories, session transcript salvages, and SLA health audits (Phase 97 / ADR-049 / Target #68).
 */

import type {
  DiagnosticCheckResult,
  DiagnosticDoctorHealthAuditReport,
  DiagnosticDoctorMetricsReport,
  SessionSalvageReport,
  SystemDiagnosticReport,
} from "../../core/contracts/diagnostic-doctor.contracts.js";
import { BroccoliDoctorSubstrate } from "../../sessions/extensions/doctor/broccoli-doctor-substrate.js";
import { DeterministicDiagnosticDoctor } from "../../tooling/extensions/doctor/deterministic-diagnostic-doctor.js";

export type DiagnosticDoctorDashboardViewMode = "overview" | "checks" | "salvage" | "health" | "raw";

export class DiagnosticDoctorDashboardModal {
  private readonly substrate: BroccoliDoctorSubstrate;
  private readonly doctor: DeterministicDiagnosticDoctor;
  private viewMode: DiagnosticDoctorDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliDoctorSubstrate, doctor?: DeterministicDiagnosticDoctor) {
    this.substrate = substrate;
    this.doctor = doctor || new DeterministicDiagnosticDoctor();
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

  public setViewMode(mode: DiagnosticDoctorDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): DiagnosticDoctorDashboardViewMode {
    const modes: DiagnosticDoctorDashboardViewMode[] = ["overview", "checks", "salvage", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: DiagnosticDoctorDashboardViewMode } {
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
        this.setViewMode("checks");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("salvage");
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
    lines.push("║        🩺 DIAGNOSTIC DOCTOR & FORENSIC STATE SALVAGE MODAL                 ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "checks", label: "[2] Health Checks" },
      { id: "salvage", label: "[3] Session Salvage" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const latest = this.substrate.getLatestReport();
    const salvages = this.substrate.listSalvages();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();

    switch (this.viewMode) {
      case "overview": {
        const sevColor = latest?.overallHealth === "healthy" ? "\x1b[32m" : latest?.overallHealth === "warning" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Total Reports Run:      \x1b[1m${metrics.totalReportsGenerated}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Overall Health:         ${sevColor}${latest ? latest.overallHealth.toUpperCase() : "UNKNOWN"}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Checks Executed:        \x1b[36m${metrics.totalChecksExecuted}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Sessions Salvaged:      \x1b[35m${metrics.totalSalvagesAttempted}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Turns Repaired:         ${metrics.totalTurnsRepaired}`.padEnd(76) + " ║");
        break;
      }

      case "checks": {
        if (!latest || latest.checks.length === 0) {
          lines.push("║  No diagnostic checks recorded yet. Run a diagnostic probe.               ║");
        } else {
          for (let i = 0; i < Math.min(latest.checks.length, 6); i++) {
            const c = latest.checks[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const sevColor = c.severity === "healthy" ? "\x1b[32m" : c.severity === "warning" ? "\x1b[33m" : "\x1b[31m";
            const line = `${prefix}\x1b[1m${c.checkId}\x1b[0m │ ${sevColor}${c.severity.toUpperCase()}\x1b[0m │ ${c.message.slice(0, 42)}`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "salvage": {
        if (salvages.length === 0) {
          lines.push("║  No sessions salvaged yet. All transcripts are healthy.                   ║");
        } else {
          for (let i = 0; i < Math.min(salvages.length, 6); i++) {
            const s = salvages[i];
            const line = `  [${s.sessionId.slice(0, 16)}] Repaired: ${s.repairedTurnsCount}/${s.totalTurnsExamined} turns (Success: ${s.success ? "YES" : "NO"})`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "unhealthy" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Posture:         ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Latest Severity:        ${health.latestHealthSeverity.toUpperCase()}`.padEnd(76) + " ║");
        lines.push(`║  Total Reports:          ${health.totalReports}`.padEnd(76) + " ║");
        lines.push(`║  Total Salvages:         ${health.totalSalvages}`.padEnd(76) + " ║");
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
