/**
 * prompt-cache-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for inspecting prompt cache envelopes,
 * breakpoints alignment, reasoning sanitizations, and health posture (Phase 93 / ADR-045 / Target #82).
 */

import type {
  PromptCacheHealthAuditReport,
  PromptCacheMetricsReport,
  PromptCacheBreakpointRow,
} from "../../core/contracts/prompt-cache.contracts.js";
import { BroccoliPromptCacheSubstrate } from "../../sessions/extensions/prompt/broccoli-prompt-cache-substrate.js";
import { DeterministicPromptCacher } from "../../tooling/extensions/prompt/deterministic-prompt-cacher.js";

export type PromptCacheDashboardViewMode = "overview" | "breakpoints" | "config" | "health" | "raw";

export class PromptCacheDashboardModal {
  private readonly substrate: BroccoliPromptCacheSubstrate;
  private readonly cacher: DeterministicPromptCacher;
  private viewMode: PromptCacheDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliPromptCacheSubstrate, cacher?: DeterministicPromptCacher) {
    this.substrate = substrate;
    this.cacher = cacher || new DeterministicPromptCacher();
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

  public setViewMode(mode: PromptCacheDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): PromptCacheDashboardViewMode {
    const modes: PromptCacheDashboardViewMode[] = ["overview", "breakpoints", "config", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: PromptCacheDashboardViewMode } {
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
        this.setViewMode("breakpoints");
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
    lines.push("║        ⚡ PROMPT CACHE OPTIMIZER & BOUNDARY MODAL                           ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "breakpoints", label: "[2] Breakpoints" },
      { id: "config", label: "[3] Config" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const breakpoints = this.substrate.listBreakpoints();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();
    const config = this.substrate.getConfig();
    const env = this.substrate.getLatestEnvelope();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Envelopes Calculated:   \x1b[1m${metrics.totalEnvelopesCalculated}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Breakpoints Inserted:   \x1b[32m${metrics.totalBreakpointsInserted}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Tokens Cached (~est):   \x1b[35m${metrics.estimatedTokensCached}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Reasonings Sanitized:   \x1b[36m${metrics.totalSanitizedReasonings}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Static Prefix Avg:      ${metrics.staticPrefixBytesAvg} bytes`.padEnd(76) + " ║");
        lines.push(`║  Health Posture:         ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        break;
      }

      case "breakpoints": {
        if (breakpoints.length === 0) {
          lines.push("║  No active prompt cache breakpoints registered.                           ║");
        } else {
          for (let i = 0; i < Math.min(breakpoints.length, 6); i++) {
            const b = breakpoints[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}[#${b.breakpointIndex}] \x1b[1m${b.target}:${b.breakpointType}\x1b[0m │ offset: \x1b[32m${b.byteOffset}B\x1b[0m │ ~${b.tokenEstimate} tok`;
            lines.push(`║ ${line.slice(0, 72).padEnd(80)} ║`);
          }
        }
        break;
      }

      case "config": {
        lines.push(`║  Min Breakpoint Tokens:   ${config.minBreakpointTokens}`.padEnd(76) + " ║");
        lines.push(`║  Max Breakpoints:         ${config.maxBreakpoints}`.padEnd(76) + " ║");
        lines.push(`║  Reasoning Sanitization:  ${config.enableReasoningSanitization ? '\x1b[32menabled\x1b[0m' : '\x1b[33mdisabled\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Prefix Threshold:        ${config.bytePrefixThreshold} bytes`.padEnd(76) + " ║");
        lines.push(`║  Active Envelope Hash:    ${env ? env.systemPromptHash.slice(0, 16) : 'None'}`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "critical" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:           ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Total Envelopes:         ${health.totalEnvelopes}`.padEnd(76) + " ║");
        lines.push(`║  Total Breakpoints:       ${health.totalBreakpoints}`.padEnd(76) + " ║");
        lines.push(`║  Prefix Coverage:         ${health.staticPrefixCoveragePercent}%`.padEnd(76) + " ║");
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
