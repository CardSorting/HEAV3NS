/**
 * verification-evidence-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing verification evidence records,
 * unverified modified source files, stop-gate status, and quality metrics (Phase 92 / ADR-044 / Target #73).
 */

import type {
  VerificationEvidenceHealthAuditReport,
  VerificationEvidenceMetricsReport,
  VerificationEvidenceRecord,
} from "../../core/contracts/verification-evidence.contracts.js";
import { BroccoliEvidenceSubstrate } from "../../sessions/extensions/evidence/broccoli-evidence-substrate.js";
import { DeterministicEvidenceLedger } from "../../tooling/extensions/evidence/deterministic-evidence-ledger.js";

export type VerificationEvidenceDashboardViewMode = "overview" | "evidence" | "unverified" | "health" | "raw";

export class VerificationEvidenceDashboardModal {
  private readonly substrate: BroccoliEvidenceSubstrate;
  private readonly ledger: DeterministicEvidenceLedger;
  private viewMode: VerificationEvidenceDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliEvidenceSubstrate, ledger?: DeterministicEvidenceLedger) {
    this.substrate = substrate;
    this.ledger = ledger || new DeterministicEvidenceLedger();
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

  public setViewMode(mode: VerificationEvidenceDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): VerificationEvidenceDashboardViewMode {
    const modes: VerificationEvidenceDashboardViewMode[] = ["overview", "evidence", "unverified", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: VerificationEvidenceDashboardViewMode } {
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
        this.setViewMode("evidence");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("unverified");
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
    lines.push("║        🛡️ VERIFICATION EVIDENCE & QUALITY GATES MODAL                       ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "evidence", label: "[2] Evidence" },
      { id: "unverified", label: "[3] Unverified" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const records = this.substrate.listEvidence();
    const modified = this.substrate.getModifiedFiles();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Total Evidence:         \x1b[1m${metrics.totalEvidenceCount}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Pass Rate:              \x1b[32m${metrics.passRatePercent}%\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:         ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Unverified Files:       \x1b[33m${modified.length}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Avg Duration:           ${metrics.averageDurationMs} ms`.padEnd(76) + " ║");
        break;
      }

      case "evidence": {
        if (records.length === 0) {
          lines.push("║  No verification evidence recorded. Run test/build commands to record.     ║");
        } else {
          for (let i = 0; i < Math.min(records.length, 6); i++) {
            const r = records[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const statusStr = r.passed ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
            const line = `${prefix}\x1b[1m${r.kind.toUpperCase()}\x1b[0m (${r.scope}) │ ${statusStr} │ ${r.command.slice(0, 30)} │ ${r.durationMs}ms`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "unverified": {
        if (modified.length === 0) {
          lines.push("║  ✓ All modified code files have verified evidence logged.                 ║");
        } else {
          for (let i = 0; i < Math.min(modified.length, 6); i++) {
            const f = modified[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[33m${f.slice(0, 68)}\x1b[0m`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "critical" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:          ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Pass Rate:              ${health.passRatePercent}%`.padEnd(76) + " ║");
        lines.push(`║  Unverified Files:       ${health.unverifiedFilesCount}`.padEnd(76) + " ║");
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
