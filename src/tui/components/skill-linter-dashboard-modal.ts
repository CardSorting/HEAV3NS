/**
 * skill-linter-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing skill tree lint reports,
 * quality findings, frontmatter compliance, and health metrics (Phase 135 / ADR-111 / Target #75).
 */

import type {
  SkillLinterHealthAuditReport,
  SkillLinterMetricsReport,
  SkillLintReport,
} from "../../core/contracts/skill-linter.contracts.js";
import { BroccoliSkillLinterSubstrate } from "../../sessions/extensions/skill_linter/broccoli-skill-linter-substrate.js";
import { DeterministicSkillLinterEngine } from "../../agents/extensions/skill_linter/deterministic-skill-linter-engine.js";

export type SkillLinterDashboardViewMode = "overview" | "skills" | "findings" | "health" | "raw";

export class SkillLinterDashboardModal {
  private readonly substrate: BroccoliSkillLinterSubstrate;
  private readonly engine: DeterministicSkillLinterEngine;
  private viewMode: SkillLinterDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliSkillLinterSubstrate, engine?: DeterministicSkillLinterEngine) {
    this.substrate = substrate;
    this.engine = engine || new DeterministicSkillLinterEngine();
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

  public setViewMode(mode: SkillLinterDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): SkillLinterDashboardViewMode {
    const modes: SkillLinterDashboardViewMode[] = ["overview", "skills", "findings", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: SkillLinterDashboardViewMode } {
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
        this.setViewMode("skills");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("findings");
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
    lines.push("║        🧬 SKILL TREE LINTER & CONVENTIONS MODAL                            ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "skills", label: "[2] Skills" },
      { id: "findings", label: "[3] Findings" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const reports = this.substrate.listReports();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Audited Skills:         \x1b[1m${metrics.totalSkillsAudited}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Clean Skills:           \x1b[32m${metrics.cleanSkillsCount}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Errors:           \x1b[31m${metrics.totalErrorsFound}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Warnings:         \x1b[33m${metrics.totalWarningsFound}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:         ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        break;
      }

      case "skills": {
        if (reports.length === 0) {
          lines.push("║  No skill bundles audited yet in memory ledger.                            ║");
        } else {
          for (let i = 0; i < Math.min(reports.length, 6); i++) {
            const r = reports[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const statusColor = r.isValid ? "\x1b[32mVALID\x1b[0m" : "\x1b[31mINVALID\x1b[0m";
            const line = `${prefix}\x1b[1m${r.skillName.slice(0, 30)}\x1b[0m │ ${statusColor} │ E:${r.errorCount} W:${r.warningCount}`;
            lines.push(`║ ${line.slice(0, 72).padEnd(80)} ║`);
          }
        }
        break;
      }

      case "findings": {
        const allFindings = reports.flatMap((r) => r.findings);
        if (allFindings.length === 0) {
          lines.push("║  No lint findings or warnings detected across skill tree.                  ║");
        } else {
          for (let i = 0; i < Math.min(allFindings.length, 5); i++) {
            const f = allFindings[i];
            const sevColor = f.severity === "error" ? "\x1b[31mERR\x1b[0m" : "\x1b[33mWARN\x1b[0m";
            const line = `[${sevColor}] \x1b[1m${f.ruleCode}\x1b[0m: ${f.message.slice(0, 48)}`;
            lines.push(`║  ${line.slice(0, 72).padEnd(80)} ║`);
          }
        }
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "critical" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:          ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Compliance Rate:        ${health.complianceRatePercent}%`.padEnd(76) + " ║");
        lines.push(`║  Clean Skills:           ${health.cleanSkillsCount} / ${health.totalSkillsAudited}`.padEnd(76) + " ║");
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
