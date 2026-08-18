/**
 * url-safety-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for inspecting SSRF firewall checks,
 * blocked metadata/private IP attempts, security config, and health posture (Phase 118 / ADR-094 / Target #87).
 */

import type {
  UrlSafetyHealthAuditReport,
  UrlSafetyMetricsReport,
  UrlSafetyCheckRow,
} from "../../core/contracts/url-safety.contracts.js";
import { BroccoliUrlSafetySubstrate } from "../../sessions/extensions/url_safety/broccoli-url-safety-substrate.js";
import { DeterministicUrlSafety } from "../../agents/extensions/url_safety/deterministic-url-safety.js";

export type UrlSafetyDashboardViewMode = "overview" | "checks" | "config" | "health" | "raw";

export class UrlSafetyDashboardModal {
  private readonly substrate: BroccoliUrlSafetySubstrate;
  private readonly urlSafety: DeterministicUrlSafety;
  private viewMode: UrlSafetyDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliUrlSafetySubstrate, urlSafety?: DeterministicUrlSafety) {
    this.substrate = substrate;
    this.urlSafety = urlSafety || new DeterministicUrlSafety();
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

  public setViewMode(mode: UrlSafetyDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): UrlSafetyDashboardViewMode {
    const modes: UrlSafetyDashboardViewMode[] = ["overview", "checks", "config", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: UrlSafetyDashboardViewMode } {
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
      this.setViewMode("checks");
      return { action: "render", viewMode: this.viewMode };
    }
    if (key === "3") {
      this.setViewMode("config");
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

    return { action: "render", viewMode: this.viewMode };
  }

  public render(): string {
    if (!this.isVisible) return "";

    const lines: string[] = [];
    const nav = this.renderNavHeader();
    lines.push(nav);

    switch (this.viewMode) {
      case "overview":
        lines.push(this.renderOverview());
        break;
      case "checks":
        lines.push(this.renderChecks());
        break;
      case "config":
        lines.push(this.renderConfig());
        break;
      case "health":
        lines.push(this.renderHealth());
        break;
      case "raw":
        lines.push(this.renderRaw());
        break;
    }

    lines.push(this.renderFooter());
    return lines.join("\n");
  }

  private renderNavHeader(): string {
    const tabs: { mode: UrlSafetyDashboardViewMode; label: string; key: string }[] = [
      { mode: "overview", label: "Overview", key: "1" },
      { mode: "checks", label: "Checks", key: "2" },
      { mode: "config", label: "Config", key: "3" },
      { mode: "health", label: "Health", key: "4" },
      { mode: "raw", label: "Raw JSON", key: "5" },
    ];

    const tabStr = tabs
      .map((t) => {
        if (t.mode === this.viewMode) {
          return `\x1b[1;7;36m [${t.key}] ${t.label} \x1b[0m`;
        }
        return `\x1b[90m [${t.key}] ${t.label} \x1b[0m`;
      })
      .join(" ");

    return `\x1b[1;36m┌── 🛡️ SSRF DEFENSE FIREWALL & URL SAFETY MODAL ────────────────────────────────┐\x1b[0m\n│ ${tabStr}\n├────────────────────────────────────────────────────────────────────────┤`;
  }

  private renderOverview(): string {
    const metrics = this.substrate.getMetrics();
    const checks = this.substrate.getRecentChecks(5);

    const lines: string[] = [];
    lines.push(`│  Total Checks: \x1b[1;36m${metrics.totalChecks}\x1b[0m │ Allowed: \x1b[1;32m${metrics.allowedCount}\x1b[0m │ Metadata Blocks: \x1b[1;31m${metrics.blockedMetadataCount}\x1b[0m`);
    lines.push(`│  Private Blocks: \x1b[33m${metrics.blockedPrivateCount}\x1b[0m │ Loopback Blocks: \x1b[35m${metrics.blockedLoopbackCount}\x1b[0m │ Custom: \x1b[36m${metrics.blockedCustomCount}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Recent URL Checks:`);

    if (checks.length === 0) {
      lines.push(`│  \x1b[90m(No checks recorded yet)\x1b[0m`);
    } else {
      for (const c of checks) {
        const icon = c.isSafe ? "\x1b[32m[SAFE]\x1b[0m" : "\x1b[31m[BLOCKED]\x1b[0m";
        lines.push(`│  ${icon} \x1b[1m${c.verdict.padEnd(22)}\x1b[0m \x1b[90m${c.normalizedUrl.slice(0, 40)}\x1b[0m`);
      }
    }

    return lines.join("\n");
  }

  private renderChecks(): string {
    const checks = this.substrate.getRecentChecks(10);
    const lines: string[] = [];
    lines.push(`│  URL Checks (${checks.length} recent):`);

    if (checks.length === 0) {
      lines.push(`│  \x1b[90m(No checks recorded)\x1b[0m`);
    } else {
      for (let i = 0; i < checks.length; i++) {
        const c = checks[i];
        if (!c) continue;
        const prefix = i === this.selectedIndex ? "\x1b[1;36m>\x1b[0m" : " ";
        const icon = c.isSafe ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
        lines.push(`│ ${prefix} ${icon} [${c.checkId.slice(0, 16)}] \x1b[35m${c.normalizedUrl.slice(0, 36)}\x1b[0m (${c.latencyMs.toFixed(2)}ms)`);
      }
    }
    return lines.join("\n");
  }

  private renderConfig(): string {
    const config = this.substrate.getConfig();
    const lines: string[] = [];
    lines.push(`│  SSRF Defense Configuration:`);
    lines.push(`│  Allow Private URLs: \x1b[1;33m${config.allowPrivateUrls ? "YES" : "NO"}\x1b[0m`);
    lines.push(`│  Allow Localhost:    \x1b[1;33m${config.allowLocalhost ? "YES" : "NO"}\x1b[0m`);
    lines.push(`│  Custom Blocked Hosts (${config.customBlockedHosts.length}): ${config.customBlockedHosts.join(", ") || "none"}`);
    lines.push(`│  Custom Allowed Hosts (${config.customAllowedHosts.length}): ${config.customAllowedHosts.join(", ") || "none"}`);
    return lines.join("\n");
  }

  private renderHealth(): string {
    const health = this.substrate.auditHealth();
    const statusColor =
      health.status === "critical"
        ? "\x1b[1;31m"
        : health.status === "degraded"
        ? "\x1b[1;33m"
        : "\x1b[1;32m";

    const lines: string[] = [];
    lines.push(`│  Firewall Health: ${statusColor}${health.status.toUpperCase()}\x1b[0m (Safe Ratio: ${health.safeRatioPercent.toFixed(1)}%)`);
    lines.push(`│  Avg Latency: ${health.avgLatencyMs.toFixed(3)} ms (SLA: < 1.0 ms)`);
    if (health.slaViolations.length > 0) {
      lines.push(`│  \x1b[1;31mSLA Violations:\x1b[0m`);
      for (const v of health.slaViolations) {
        lines.push(`│    - ${v}`);
      }
    } else {
      lines.push(`│  \x1b[32m✔ All SSRF firewall SLAs fully compliant\x1b[0m`);
    }
    return lines.join("\n");
  }

  private renderRaw(): string {
    const metrics = this.substrate.getMetrics();
    const raw = JSON.stringify(metrics, null, 2);
    const rawLines = raw.split("\n").slice(0, 8);
    return rawLines.map((l) => `│  \x1b[90m${l}\x1b[0m`).join("\n");
  }

  private renderFooter(): string {
    return `├────────────────────────────────────────────────────────────────────────┤\n│ \x1b[90m[Tab/1-5] Switch Tab │ [j/k] Scroll │ [q/Esc] Close Modal\x1b[0m                    │\n└────────────────────────────────────────────────────────────────────────┘`;
  }
}
