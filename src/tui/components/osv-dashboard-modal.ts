/**
 * osv-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for reviewing OSV security advisories,
 * package malware detections, cache status, and health posture (Phase 128 / ADR-104 / Target #81).
 */

import type {
  OsvHealthAuditReport,
  OsvMetricsReport,
  OsvScanResultRow,
} from "../../core/contracts/osv-scanner.contracts.js";
import { BroccoliOsvSubstrate } from "../../sessions/extensions/osv/broccoli-osv-substrate.js";
import { DeterministicOsvParser } from "../../agents/extensions/osv/deterministic-osv-parser.js";

export type OsvDashboardViewMode = "overview" | "scans" | "cache" | "health" | "raw";

export class OsvDashboardModal {
  private readonly substrate: BroccoliOsvSubstrate;
  private readonly parser: DeterministicOsvParser;
  private viewMode: OsvDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliOsvSubstrate, parser?: DeterministicOsvParser) {
    this.substrate = substrate;
    this.parser = parser || new DeterministicOsvParser();
    this.viewMode = "overview";
    this.selectedIndex = 0;
    this.isVisible = false;
  }

  public open(mode?: OsvDashboardViewMode): void {
    if (mode) {
      this.viewMode = mode;
    }
    this.isVisible = true;
    this.selectedIndex = 0;
  }

  public close(): void {
    this.isVisible = false;
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  public setViewMode(mode: OsvDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): OsvDashboardViewMode {
    const modes: OsvDashboardViewMode[] = ["overview", "scans", "cache", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: OsvDashboardViewMode } {
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
        this.setViewMode("cache");
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
    lines.push("║        🛡️ OSV MALWARE SCANNER & PACKAGE FIREWALL MODAL                       ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "scans", label: "[2] Scans" },
      { id: "cache", label: "[3] Cache" },
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
    const config = this.substrate.getConfig();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Total Packages Scanned: \x1b[1m${metrics.totalScans}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Malware Blocked:        \x1b[31m${metrics.malwareBlocked}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Clean Allowed:          \x1b[32m${metrics.cleanAllowed}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Cache Hits:             \x1b[36m${metrics.cacheHits}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Network Failures:       \x1b[33m${metrics.networkFailures}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:         ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        break;
      }

      case "scans": {
        if (scans.length === 0) {
          lines.push("║  No package vulnerability scans recorded in memory ledger.                ║");
        } else {
          for (let i = 0; i < Math.min(scans.length, 6); i++) {
            const s = scans[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const statusColor = s.allowed ? "\x1b[32mALLOW\x1b[0m" : "\x1b[31mBLOCK\x1b[0m";
            const line = `${prefix}\x1b[1m${s.packageName.slice(0, 22)}\x1b[0m │ ${statusColor} │ ${s.ecosystem} │ ${s.advisories.length} advs`;
            lines.push(`║ ${line.slice(0, 72).padEnd(80)} ║`);
          }
        }
        break;
      }

      case "cache": {
        lines.push(`║  Cache TTL:           ${config.cacheTtlMs / 1000} seconds`.padEnd(76) + " ║");
        lines.push(`║  Max Entries:         ${config.maxCacheEntries}`.padEnd(76) + " ║");
        lines.push(`║  Block Malware Only:  ${config.blockMalwareOnly ? '\x1b[32mtrue\x1b[0m' : '\x1b[33mfalse (Block All Advisories)\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Fail-Open Mode:      ${config.failOpen ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Custom Blocked:      ${this.substrate.getCustomBlockedPackages().length} packages`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "critical" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:       ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Scanned:       ${health.totalScans}`.padEnd(76) + " ║");
        lines.push(`║  Cache Hit Rate:      ${health.cacheHitRatePercent}%`.padEnd(76) + " ║");
        lines.push(`║  Malware Intercepted: ${health.malwareBlocked}`.padEnd(76) + " ║");
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
