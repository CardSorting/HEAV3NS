import type {
  SoulArchetype,
  SoulHealthAuditReport,
  SoulManifest,
  SoulMetricsReport,
  SoulMutationResult,
  SoulTrait,
} from "../../core/contracts/soul.contracts.js";
import { BroccoliSoulSubstrate } from "../../sessions/extensions/soul/broccoli-soul-substrate.js";
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export type SoulDashboardViewMode = "traits" | "axioms" | "style" | "mutations" | "health" | "metrics";

/**
 * SoulDashboardModal.
 * Interactive Terminal TUI Modal Component for SOUL Persona & Ethos Kernel (SOUL-001).
 *
 * Features:
 * - Executive KPI Ribbon
 * - Filter Presets (1: All Traits, 2: Cognition, 3: Execution, 4: High Weight)
 * - 6 View Modes (Traits Matrix, Axioms, Style Directives, Mutations, Health Diagnostics, Metrics)
 * - Actions: Tune Trait Weight, Cycle Archetype, Inspect
 */
export class SoulDashboardModal {
  private readonly substrate: BroccoliSoulSubstrate;
  private readonly onClose: () => void;

  private selectedIndex = 0;
  private categoryFilter?: "communication" | "cognition" | "execution" | "behavior";
  private highWeightFilterOnly = false;
  private viewMode: SoulDashboardViewMode = "traits";
  private showHelp = false;

  constructor(substrate: BroccoliSoulSubstrate, onClose: () => void) {
    this.substrate = substrate;
    this.onClose = onClose;
  }

  public render(maxWidth = 100): readonly string[] {
    const lines: string[] = [];
    const width = Math.max(60, maxWidth);
    const border = "─".repeat(width - 2);

    const manifest = this.substrate.getActiveManifest();
    const metrics = this.substrate.getSoulMetrics();
    const traits = this.getFilteredTraits(manifest);

    // 1. Header
    lines.push(`┌${border}┐`);
    lines.push(this.formatLine(` 🔮 LUMI SOUL PERSONA & ETHOS KERNEL (SOUL-001) `, width));
    lines.push(`├${border}┤`);

    // 2. Executive KPI Ribbon
    const kpiText = ` Archetype: ${manifest.archetype} | Traits: ${metrics.totalTraits} | Avg Weight: ${metrics.averageTraitWeight} | Axioms: ${manifest.axioms.length} | Mutations: ${metrics.totalMutationsCount}`;
    lines.push(this.formatLine(kpiText, width));
    lines.push(`├${border}┤`);

    // 3. View Mode Bar
    const viewTabs = [
      this.viewMode === "traits" ? "[1: 🧬 Traits]" : " 1: Traits ",
      this.viewMode === "axioms" ? "[2: 🛡️ Axioms]" : " 2: Axioms ",
      this.viewMode === "style" ? "[3: 🎨 Style]" : " 3: Style ",
      this.viewMode === "mutations" ? "[4: ⚡ Mutations]" : " 4: Mutations ",
      this.viewMode === "health" ? "[5: 🩺 Health]" : " 5: Health ",
      this.viewMode === "metrics" ? "[6: 📊 Metrics]" : " 6: Metrics ",
    ].join(" │ ");
    lines.push(this.formatLine(` ${viewTabs}`, width));
    lines.push(`├${border}┤`);

    // 4. Content Area
    switch (this.viewMode) {
      case "traits":
        this.renderTraitsView(lines, traits, width);
        break;
      case "axioms":
        this.renderAxiomsView(lines, manifest, width);
        break;
      case "style":
        this.renderStyleView(lines, manifest, width);
        break;
      case "mutations":
        this.renderMutationsView(lines, width);
        break;
      case "health":
        this.renderHealthView(lines, width);
        break;
      case "metrics":
        this.renderMetricsView(lines, metrics, width);
        break;
    }

    lines.push(`├${border}┤`);

    // 5. Footer & Keybindings
    if (this.showHelp) {
      lines.push(this.formatLine(` [j/k] Navigate  [+/-] Tune Weight  [a] Cycle Archetype  [v] Switch View  [q] Close`, width));
    } else {
      lines.push(this.formatLine(` [v] View (${this.viewMode})  [1-4] Filters  [+/-] Tune  [a] Archetype  [?] Help  [q] Close`, width));
    }
    lines.push(`└${border}┘`);

    return lines;
  }

  private renderTraitsView(lines: string[], traits: readonly SoulTrait[], width: number): void {
    if (traits.length === 0) {
      lines.push(this.formatLine(" (No traits matching current filter)", width));
      return;
    }

    for (let i = 0; i < traits.length; i++) {
      const t = traits[i];
      const isSelected = i === this.selectedIndex;
      const marker = isSelected ? "▶" : " ";
      const bars = "■".repeat(Math.round(t.weight * 10)) + "□".repeat(10 - Math.round(t.weight * 10));

      const row = `${marker} [${t.category.slice(0, 4).toUpperCase()}] ${t.name.slice(0, 20).padEnd(20)} [${bars}] ${t.weight.toFixed(2)} ([${t.minWeight}, ${t.maxWeight}])`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderAxiomsView(lines: string[], manifest: SoulManifest, width: number): void {
    lines.push(this.formatLine(` ── Immutable & Operational Axioms (${manifest.axioms.length} total):`, width));
    for (const a of manifest.axioms) {
      const imm = a.isImmutable ? "🔒" : "  ";
      const row = ` ${imm} [P${a.priority}] ${a.statement.slice(0, width - 16)}`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderStyleView(lines: string[], manifest: SoulManifest, width: number): void {
    const s = manifest.style;
    lines.push(this.formatLine(` ── Active Persona Style Directives:`, width));
    lines.push(this.formatLine(`  • Tone:               ${s.tone.toUpperCase()}`, width));
    lines.push(this.formatLine(`  • Verbosity:          ${s.verbosity.toUpperCase()}`, width));
    lines.push(this.formatLine(`  • Code Preference:    ${s.codePreference}`, width));
    lines.push(this.formatLine(`  • Mathematical Rigor: ${s.mathematicalRigor}`, width));
  }

  private renderMutationsView(lines: string[], width: number): void {
    const mutations = this.substrate.getMutations(10);
    if (mutations.length === 0) {
      lines.push(this.formatLine(" (No historical SOUL mutations recorded)", width));
      return;
    }

    for (const m of mutations) {
      const icon = m.success ? "✓" : "✗";
      const row = ` ${icon} Mutation [${m.mutationId?.slice(0, 14) || "mut"}] ── ${m.success ? "Success" : m.failureReason || "Failed"}`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderHealthView(lines: string[], width: number): void {
    const audit = this.substrate.auditSoulHealth();
    lines.push(this.formatLine(` Persona Alignment: ${audit.healthStatus.toUpperCase()} (Integrity: ${audit.integrityVerified ? "VERIFIED" : "MISMATCH"})`, width));
    lines.push(this.formatLine(` Immutable Axioms: ${audit.immutableAxiomsCount} │ Avg Trait Weight: ${audit.averageTraitWeight}`, width));
    lines.push(this.formatLine(` ── Diagnostic Recommendations:`, width));
    for (const r of audit.recommendations) {
      lines.push(this.formatLine(`  • ${r}`, width));
    }
  }

  private renderMetricsView(lines: string[], metrics: SoulMetricsReport, width: number): void {
    lines.push(this.formatLine(` Archetype: ${metrics.archetype} │ Total Traits: ${metrics.totalTraits} │ Axioms: ${metrics.totalAxioms}`, width));
    lines.push(this.formatLine(` Category Averages: Cognition: ${metrics.categoryAverages.cognition} │ Execution: ${metrics.categoryAverages.execution} │ Comm: ${metrics.categoryAverages.communication}`, width));
    lines.push(this.formatLine(` Mutation Success Rate: ${metrics.mutationSuccessRatePercent}% (${metrics.totalMutationsCount} mutations)`, width));
    lines.push(this.formatLine(` Latency: P50: ${metrics.p50MutationLatencyMs}ms │ P95: ${metrics.p95MutationLatencyMs}ms`, width));
  }

  public handleInput(key: string): void {
    const manifest = this.substrate.getActiveManifest();
    const traits = this.getFilteredTraits(manifest);

    switch (key) {
      case "j":
      case "down":
        if (this.selectedIndex < traits.length - 1) {
          this.selectedIndex++;
        }
        break;

      case "k":
      case "up":
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
        }
        break;

      case "1":
        this.categoryFilter = undefined;
        this.highWeightFilterOnly = false;
        this.selectedIndex = 0;
        break;
      case "2":
        this.categoryFilter = "cognition";
        this.highWeightFilterOnly = false;
        this.selectedIndex = 0;
        break;
      case "3":
        this.categoryFilter = "execution";
        this.highWeightFilterOnly = false;
        this.selectedIndex = 0;
        break;
      case "4":
        this.categoryFilter = undefined;
        this.highWeightFilterOnly = true;
        this.selectedIndex = 0;
        break;

      case "v": {
        const modes: SoulDashboardViewMode[] = ["traits", "axioms", "style", "mutations", "health", "metrics"];
        const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
        this.viewMode = modes[nextIdx];
        break;
      }

      case "+":
      case "=": {
        const current = traits[this.selectedIndex];
        if (current) {
          this.substrate.tuneTrait(current.id, 0.05, true);
        }
        break;
      }

      case "-": {
        const current = traits[this.selectedIndex];
        if (current) {
          this.substrate.tuneTrait(current.id, -0.05, true);
        }
        break;
      }

      case "a": {
        const archetypes: SoulArchetype[] = [
          "lumi_core",
          "game_engine_architect",
          "formal_verifier",
          "autonomous_critic",
          "security_sentinel",
        ];
        const nextIdx = (archetypes.indexOf(manifest.archetype) + 1) % archetypes.length;
        this.substrate.switchArchetype(archetypes[nextIdx]);
        break;
      }

      case "?":
        this.showHelp = !this.showHelp;
        break;

      case "q":
      case "escape":
        this.onClose();
        break;
    }
  }

  private getFilteredTraits(manifest: SoulManifest): readonly SoulTrait[] {
    let list = manifest.traits;
    if (this.categoryFilter) {
      list = list.filter((t) => t.category === this.categoryFilter);
    }
    if (this.highWeightFilterOnly) {
      list = list.filter((t) => t.weight >= 0.7);
    }
    return list;
  }

  private formatLine(content: string, width: number): string {
    const cleanContent = content.length > width - 4 ? content.slice(0, width - 4) : content;
    const padding = Math.max(0, width - 2 - cleanContent.length);
    return `│${cleanContent}${" ".repeat(padding)}│`;
  }
}
