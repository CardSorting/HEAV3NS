/**
 * heredoc-terminal-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for inspecting shell heredoc sanitizations,
 * risk evaluations, actionable diagnostics, and health posture (Phase 110 / ADR-086 / Target #86).
 */

import type {
  HeredocTerminalHealthAuditReport,
  HeredocTerminalMetricsReport,
  HeredocSanitizationLogRecord,
  TerminalExecutionDiagnostics,
} from "../../core/contracts/heredoc-terminal.contracts.js";
import { BroccoliHeredocTerminalSubstrate } from "../../sessions/extensions/heredoc_terminal/broccoli-heredoc-terminal-substrate.js";
import { DeterministicHeredocSanitizer } from "../../agents/extensions/heredoc_terminal/deterministic-heredoc-sanitizer.js";

export type HeredocTerminalDashboardViewMode = "overview" | "sanitizations" | "diagnostics" | "health" | "raw";

export class HeredocTerminalDashboardModal {
  private readonly substrate: BroccoliHeredocTerminalSubstrate;
  private readonly sanitizer: DeterministicHeredocSanitizer;
  private viewMode: HeredocTerminalDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliHeredocTerminalSubstrate, sanitizer?: DeterministicHeredocSanitizer) {
    this.substrate = substrate;
    this.sanitizer = sanitizer || new DeterministicHeredocSanitizer();
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

  public setViewMode(mode: HeredocTerminalDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): HeredocTerminalDashboardViewMode {
    const modes: HeredocTerminalDashboardViewMode[] = ["overview", "sanitizations", "diagnostics", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: HeredocTerminalDashboardViewMode } {
    if (!this.isVisible) return { action: "none", viewMode: this.viewMode };

    if (key === "\u001b" || key === "q" || key === "Q") {
      this.close();
      return { action: "close", viewMode: this.viewMode };
    }

    if (key === "\t") {
      this.cycleViewMode();
      return { action: "render", viewMode: this.viewMode };
    }

    if (key === "1") {
      this.setViewMode("overview");
      return { action: "render", viewMode: this.viewMode };
    }
    if (key === "2") {
      this.setViewMode("sanitizations");
      return { action: "render", viewMode: this.viewMode };
    }
    if (key === "3") {
      this.setViewMode("diagnostics");
      return { action: "render", viewMode: this.viewMode };
    }
    if (key === "4") {
      this.setViewMode("health");
      return { action: "render", viewMode: this.viewMode };
    }
    if (key === "5") {
      this.setViewMode("raw");
      return { action: "render", viewMode: this.viewMode };
    }

    if (key === "j" || key === "\u001b[B") {
      this.selectedIndex++;
      return { action: "render", viewMode: this.viewMode };
    }
    if (key === "k" || key === "\u001b[A") {
      if (this.selectedIndex > 0) this.selectedIndex--;
      return { action: "render", viewMode: this.viewMode };
    }

    return { action: "none", viewMode: this.viewMode };
  }

  public render(): string {
    if (!this.isVisible) return "";

    const lines: string[] = [];
    const health = this.substrate.auditHealth();
    const metrics = this.substrate.getMetricsReport();

    lines.push("╔══════════════════════════════════════════════════════════════════════════════╗");
    lines.push("║        💻 HEREDOC TERMINAL EXECUTION & SANITIZATION DASHBOARD MODAL          ║");
    lines.push("╚══════════════════════════════════════════════════════════════════════════════╝");
    lines.push(
      ` Tabs: [1] Overview  [2] Sanitizations  [3] Diagnostics  [4] Health  [5] Raw (Active: ${this.viewMode.toUpperCase()})`
    );
    lines.push("────────────────────────────────────────────────────────────────────────────────");

    if (this.viewMode === "overview") {
      lines.push(` Health Status:         ${health.healthStatus.toUpperCase()}`);
      lines.push(` Total Sanitizations:   ${metrics.totalSanitizations}`);
      lines.push(` Masked Body Spans:     ${metrics.totalMaskedBodies}`);
      lines.push(` Dangerous Blocked:     ${metrics.totalDangerousCommandsBlocked}`);
      lines.push(` Diagnostics Emitted:   ${metrics.totalDiagnosticsGenerated}`);
      lines.push(` Avg Sanitization SLA:  ${metrics.avgSanitizationLatencyMs.toFixed(3)} ms`);
    } else if (this.viewMode === "sanitizations") {
      const logs = this.substrate.getRecentLogs(10);
      lines.push(` Recent Sanitizations (${logs.length}):`);
      if (logs.length === 0) {
        lines.push("   (No sanitization events recorded yet)");
      } else {
        for (let i = 0; i < logs.length; i++) {
          const log = logs[i];
          const cursor = i === this.selectedIndex ? ">" : " ";
          lines.push(
            ` ${cursor} [${log.recordId}] Risk: ${log.riskLevel.toUpperCase()} | Masked: ${log.maskedBodiesCount} | ${log.latencyMs.toFixed(3)}ms`
          );
        }
      }
    } else if (this.viewMode === "diagnostics") {
      const diags = this.substrate.getRecentDiagnostics(10);
      lines.push(` Recent Diagnostics (${diags.length}):`);
      if (diags.length === 0) {
        lines.push("   (No terminal execution diagnostics recorded yet)");
      } else {
        for (let i = 0; i < diags.length; i++) {
          const diag = diags[i];
          const cursor = i === this.selectedIndex ? ">" : " ";
          lines.push(
            ` ${cursor} Exit Code ${diag.exitCode}: ${diag.rootCauseSummary} (Recoverable: ${diag.isRecoverable})`
          );
        }
      }
    } else if (this.viewMode === "health") {
      lines.push(` SLA Health Status: ${health.healthStatus.toUpperCase()}`);
      lines.push(` Clean Command Ratio: ${health.cleanRatioPercent}%`);
      lines.push(` Recommendations (${health.recommendations.length}):`);
      for (const rec of health.recommendations) {
        lines.push(`   • ${rec}`);
      }
    } else if (this.viewMode === "raw") {
      lines.push(" Raw Metrics JSON Snapshot:");
      lines.push(JSON.stringify(metrics, null, 2));
    }

    lines.push("────────────────────────────────────────────────────────────────────────────────");
    lines.push(" [Tab] Cycle Tab  [1-5] Jump  [j/k] Navigate  [q/Esc] Close");
    return lines.join("\n");
  }
}
