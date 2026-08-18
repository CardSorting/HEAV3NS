import type {
  SkillHealthAuditReport,
  SkillMetricsReport,
  SkillMutationResult,
  SkillNodeManifest,
  SkillTier,
} from "../../core/contracts/skills.contracts.js";
import { EvolutionarySkillTreeEngine } from "../../agents/extensions/skills/evolutionary-skill-tree-engine.js";
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export type SkillTreeModalViewMode = "skills" | "dag" | "mutations" | "curator" | "health" | "metrics";

/**
 * SkillTreeModal.
 * Interactive Terminal TUI Modal Component for Evolutionary Skill Trees (ADR-014).
 *
 * Features:
 * - Executive KPI Ribbon
 * - Filter Presets (1: All, 2: Active, 3: Pinned, 4: Master+)
 * - 6 View Modes (Skills, DAG Tree, Mutations, Curator Clusters, Health SLA, Metrics)
 * - Actions: Pin/Unpin, Reinforce Mastery, Test Notification
 */
export class SkillTreeModal {
  private readonly engine: EvolutionarySkillTreeEngine;
  private readonly onClose: () => void;

  private selectedIndex = 0;
  private tierFilter?: SkillTier;
  private pinnedFilterOnly = false;
  private viewMode: SkillTreeModalViewMode = "skills";
  private showHelp = false;

  constructor(engine: EvolutionarySkillTreeEngine, onClose: () => void) {
    this.engine = engine;
    this.onClose = onClose;
  }

  public render(maxWidth: number = 100): readonly string[] {
    const lines: string[] = [];
    const width = Math.max(60, maxWidth);
    const border = "─".repeat(width - 2);

    const metrics = this.engine.getSkillMetrics();
    const skills = this.getFilteredSkills();

    // 1. Header
    lines.push(`┌${border}┐`);
    lines.push(this.formatLine(` 🌲 LUMI EVOLUTIONARY SKILL TREE HUB (ADR-014) `, width));
    lines.push(`├${border}┤`);

    // 2. Executive KPI Ribbon
    const kpiText = ` Total: ${metrics.totalSkills} | Avg Mastery: ${metrics.averageMasteryScore}% | Avg Fitness: ${metrics.averageFitnessScore} | Pinned: ${metrics.pinnedSkills} | Mutations: ${metrics.totalMutationsCount}`;
    lines.push(this.formatLine(kpiText, width));
    lines.push(`├${border}┤`);

    // 3. View Mode Bar
    const viewTabs = [
      this.viewMode === "skills" ? "[1: 🌲 Skills]" : " 1: Skills ",
      this.viewMode === "dag" ? "[2: 🌳 DAG]" : " 2: DAG ",
      this.viewMode === "mutations" ? "[3: ⚡ Mutations]" : " 3: Mutations ",
      this.viewMode === "curator" ? "[4: 🧹 Curator]" : " 4: Curator ",
      this.viewMode === "health" ? "[5: 🩺 Health]" : " 5: Health ",
      this.viewMode === "metrics" ? "[6: 📊 Metrics]" : " 6: Metrics ",
    ].join(" │ ");
    lines.push(this.formatLine(` ${viewTabs}`, width));
    lines.push(`├${border}┤`);

    // 4. Content Area
    switch (this.viewMode) {
      case "skills":
        this.renderSkillsView(lines, skills, width);
        break;
      case "dag":
        this.renderDagView(lines, width);
        break;
      case "mutations":
        this.renderMutationsView(lines, width);
        break;
      case "curator":
        this.renderCuratorView(lines, width);
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
      lines.push(this.formatLine(` [j/k] Navigate  [p] Pin/Unpin  [+/-] Adjust Mastery  [v] Switch View  [d] Test Alert  [q] Close`, width));
    } else {
      lines.push(this.formatLine(` [v] View (${this.viewMode})  [1-4] Filters  [p] Pin  [+/-] Mastery  [d] Alert  [?] Help  [q] Close`, width));
    }
    lines.push(`└${border}┘`);

    return lines;
  }

  private renderSkillsView(lines: string[], skills: readonly SkillNodeManifest[], width: number): void {
    if (skills.length === 0) {
      lines.push(this.formatLine(" (No skills matching current filter)", width));
      return;
    }

    for (let i = 0; i < skills.length; i++) {
      const s = skills[i];
      const isSelected = i === this.selectedIndex;
      const marker = isSelected ? "▶" : " ";
      const pinIcon = s.pinned ? "📌" : "  ";
      const masteryBar = "■".repeat(Math.floor(s.masteryScore / 10)) + "□".repeat(10 - Math.floor(s.masteryScore / 10));

      const row = `${marker} ${pinIcon} [${s.tier.toUpperCase().padEnd(9)}] ${s.name.slice(0, 24).padEnd(24)} [${masteryBar}] ${String(s.masteryScore).padStart(3)}% │ ${s.useCount} uses`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderDagView(lines: string[], width: number): void {
    const dag = this.engine.getSubstrate().getDag();
    const rawDag = BroccoliViewRenderer.renderSkillTreeDag(dag as any);
    const dagLines = rawDag.split("\n");
    for (const d of dagLines) {
      lines.push(this.formatLine(d, width));
    }
  }

  private renderMutationsView(lines: string[], width: number): void {
    const mutations = this.engine.getSubstrate().getMutations(undefined, 10);
    if (mutations.length === 0) {
      lines.push(this.formatLine(" (No historical skill mutations recorded)", width));
      return;
    }

    for (const m of mutations) {
      const icon = m.success ? "✓" : "✗";
      const row = ` ${icon} [${m.skillId}] Mutation ${m.mutationId.slice(0, 12)} ── ${m.success ? "Success" : m.error || "Failed"}`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderCuratorView(lines: string[], width: number): void {
    const all = this.engine.getSubstrate().getAllNodes();
    const stale = all.filter((n) => n.lifecycleState === "dormant");
    lines.push(this.formatLine(` ── Stale & Dormant Skills (${stale.length} nodes):`, width));
    if (stale.length === 0) {
      lines.push(this.formatLine("  • All skills active and fresh.", width));
    } else {
      for (const s of stale.slice(0, 5)) {
        lines.push(this.formatLine(`  • ${s.name} (${s.id}) ── ${s.useCount} uses`, width));
      }
    }
  }

  private renderHealthView(lines: string[], width: number): void {
    const audit = this.engine.auditSkillHealth();
    lines.push(this.formatLine(` Overall Health: ${audit.healthStatus.toUpperCase()} (Avg Mastery: ${audit.averageMasteryScore}%)`, width));
    lines.push(this.formatLine(` Locked Prerequisites: ${audit.lockedPrerequisitesCount} │ Degraded Skills: ${audit.degradedSkillsCount}`, width));
    lines.push(this.formatLine(` ── Diagnostic Recommendations:`, width));
    for (const r of audit.recommendations) {
      lines.push(this.formatLine(`  • ${r}`, width));
    }
  }

  private renderMetricsView(lines: string[], metrics: SkillMetricsReport, width: number): void {
    lines.push(this.formatLine(` Total Skills: ${metrics.totalSkills} (Active: ${metrics.activeSkills}, Dormant: ${metrics.dormantSkills})`, width));
    lines.push(this.formatLine(` Tier Distribution: Novice: ${metrics.tierDistribution.novice}, Adept: ${metrics.tierDistribution.adept}, Master: ${metrics.tierDistribution.master}, Sovereign: ${metrics.tierDistribution.sovereign}`, width));
    lines.push(this.formatLine(` Mutation Success Rate: ${metrics.mutationSuccessRatePercent}% (${metrics.totalMutationsCount} mutations)`, width));
    lines.push(this.formatLine(` P50 Mutation Latency: ${metrics.p50MutationLatencyMs}ms │ P95: ${metrics.p95MutationLatencyMs}ms`, width));
  }

  public handleInput(key: string): void {
    const skills = this.getFilteredSkills();

    switch (key) {
      case "j":
      case "down":
        if (this.selectedIndex < skills.length - 1) {
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
        this.tierFilter = undefined;
        this.pinnedFilterOnly = false;
        this.selectedIndex = 0;
        break;
      case "2":
        this.tierFilter = undefined;
        this.pinnedFilterOnly = false;
        this.selectedIndex = 0;
        break;
      case "3":
        this.pinnedFilterOnly = true;
        this.selectedIndex = 0;
        break;
      case "4":
        this.tierFilter = "master";
        this.pinnedFilterOnly = false;
        this.selectedIndex = 0;
        break;

      case "v": {
        const modes: SkillTreeModalViewMode[] = ["skills", "dag", "mutations", "curator", "health", "metrics"];
        const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
        this.viewMode = modes[nextIdx];
        break;
      }

      case "p": {
        const current = skills[this.selectedIndex];
        if (current) {
          this.engine.getSubstrate().saveNode({
            ...current,
            pinned: !current.pinned,
            updatedAtMs: Date.now(),
          });
        }
        break;
      }

      case "+":
      case "=": {
        const current = skills[this.selectedIndex];
        if (current) {
          this.engine.updateMastery(current.id, true);
        }
        break;
      }

      case "-": {
        const current = skills[this.selectedIndex];
        if (current) {
          this.engine.updateMastery(current.id, false);
        }
        break;
      }

      case "d": {
        this.engine.getNotificationDispatcher().dispatch({
          title: "Skill Tree Diagnostic Alert",
          message: "TUI Manual Notification Triggered",
          urgency: "normal",
          trigger: "custom",
        }).catch(() => {});
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

  private getFilteredSkills(): readonly SkillNodeManifest[] {
    let list = this.engine.getSubstrate().getAllNodes();
    if (this.tierFilter) {
      list = list.filter((s) => s.tier === this.tierFilter || s.tier === "sovereign");
    }
    if (this.pinnedFilterOnly) {
      list = list.filter((s) => s.pinned);
    }
    return list;
  }

  private formatLine(content: string, width: number): string {
    const cleanContent = content.length > width - 4 ? content.slice(0, width - 4) : content;
    const padding = Math.max(0, width - 2 - cleanContent.length);
    return `│${cleanContent}${" ".repeat(padding)}│`;
  }
}
