/**
 * schema-sanitizer-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for reviewing JSON Schema transformations,
 * non-conforming property renamings, and LLM grammar firewall status (Phase 139 / ADR-115 / Target #80).
 */

import type {
  SchemaSanitizerHealthAuditReport,
  SchemaSanitizerMetricsReport,
  SchemaSanitizationEventRow,
} from "../../core/contracts/schema-sanitizer.contracts.js";
import { BroccoliSchemaSanitizerSubstrate } from "../../sessions/extensions/schema_sanitizer/broccoli-schema-sanitizer-substrate.js";
import { DeterministicSchemaSanitizerEngine } from "../../agents/extensions/schema_sanitizer/deterministic-schema-sanitizer-engine.js";

export type SchemaSanitizerDashboardViewMode = "overview" | "events" | "config" | "health" | "raw";

export class SchemaSanitizerDashboardModal {
  private readonly substrate: BroccoliSchemaSanitizerSubstrate;
  private readonly engine: DeterministicSchemaSanitizerEngine;
  private viewMode: SchemaSanitizerDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliSchemaSanitizerSubstrate, engine?: DeterministicSchemaSanitizerEngine) {
    this.substrate = substrate;
    this.engine = engine || new DeterministicSchemaSanitizerEngine();
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

  public setViewMode(mode: SchemaSanitizerDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): SchemaSanitizerDashboardViewMode {
    const modes: SchemaSanitizerDashboardViewMode[] = ["overview", "events", "config", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: SchemaSanitizerDashboardViewMode } {
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
        this.setViewMode("events");
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
    lines.push("║        🧬 JSON SCHEMA SANITIZER & GBNF FIREWALL MODAL                       ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "events", label: "[2] Events" },
      { id: "config", label: "[3] Config" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const events = this.substrate.listEvents();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();
    const config = this.substrate.getConfig();

    switch (this.viewMode) {
      case "overview": {
        const healthColor = health.healthStatus === "optimal" ? "\x1b[32m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[31m";
        lines.push(`║  Schemas Sanitized:    \x1b[1m${metrics.totalSchemasSanitized}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Keys Renamed:         \x1b[31m${metrics.invalidPropertyKeysRenamed}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Unions Collapsed:     \x1b[32m${metrics.nullableUnionsCollapsed}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Siblings Stripped:    \x1b[33m${metrics.refSiblingsStripped}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Combinators Cleaned:  \x1b[35m${metrics.topLevelCombinatorsCleaned}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Arguments Restored:   \x1b[36m${metrics.argumentsUnrenamed}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Health Posture:       ${healthColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        break;
      }

      case "events": {
        if (events.length === 0) {
          lines.push("║  No schema transformation events recorded in memory ledger.               ║");
        } else {
          for (let i = 0; i < Math.min(events.length, 6); i++) {
            const ev = events[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[1m${ev.schemaName.slice(0, 20)}\x1b[0m │ \x1b[33m${ev.renamedKeyCount} renamed\x1b[0m │ \x1b[32m${ev.mutationsApplied.length} muts\x1b[0m`;
            lines.push(`║ ${line.slice(0, 72).padEnd(80)} ║`);
          }
        }
        break;
      }

      case "config": {
        lines.push(`║  Enabled:                  ${config.enabled ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Enforce Conforming Keys:  ${config.enforceConformingKeys ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Collapse Nullable Unions: ${config.collapseNullableUnions ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Strip $ref Siblings:      ${config.stripRefSiblings ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Strip Combinators:        ${config.stripTopLevelCombinators ? '\x1b[32mtrue\x1b[0m' : '\x1b[31mfalse\x1b[0m'}`.padEnd(85) + " ║");
        lines.push(`║  Max Key Length:           ${config.maxPropertyKeyLength} chars`.padEnd(76) + " ║");
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "critical" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:            ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Schemas Sanitized:        ${health.totalSchemasSanitized}`.padEnd(76) + " ║");
        lines.push(`║  Keys Renamed:             ${health.invalidPropertyKeysRenamed}`.padEnd(76) + " ║");
        lines.push(`║  Unions Collapsed:         ${health.nullableUnionsCollapsed}`.padEnd(76) + " ║");
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
