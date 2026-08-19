import type {
  SkillHealthAuditReport,
  SkillMetricsReport,
  SkillMutationResult,
  SkillNodeManifest,
  SkillProgressionTrack,
  SkillEvolutionMilestone,
  SkillStrategyPlan,
  SkillTier,
} from "../../core/contracts/skills.contracts.js";
import { EvolutionarySkillTreeEngine } from "../../agents/extensions/skills/evolutionary-skill-tree-engine.js";
import { SkillStrategyEngine } from "../../agents/extensions/skills/skill-strategy-engine.js";
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export type SkillTreeModalViewMode = "skills" | "dag" | "strategy" | "tracks" | "quests" | "lineage" | "mutations" | "curator" | "health" | "metrics";

/**
 * SkillTreeModal.
 * World-Class Interactive Terminal TUI Modal for the Evolutionary Skill Tree (ADR-014).
 *
 * Features:
 * - Executive KPI Ribbon
 * - Filter Presets (1: All, 2: Active, 3: Pinned, 4: Master+)
 * - Dual-Pane Split Layout (Skill List + 4D Competency Inspector)
 * - 10 View Modes (Skills, DAG Tree, Strategy Studio, Tracks, Quests, Lineage, Mutations, Curator, Health, Metrics)
 * - Interactive Hotkeys: [s] Synthesize Strategy, [p] Pin, [+/-] Mastery Adjust, [v] Switch View
 */
export class SkillTreeModal {
  private readonly engine: EvolutionarySkillTreeEngine;
  private readonly strategyEngine: SkillStrategyEngine;
  private readonly onClose: () => void;

  private selectedIndex = 0;
  private tierFilter?: SkillTier;
  private pinnedFilterOnly = false;
  private viewMode: SkillTreeModalViewMode = "skills";
  private showHelp = false;
  private activeStrategyPlan: SkillStrategyPlan | null = null;

  constructor(engine: EvolutionarySkillTreeEngine, onClose: () => void) {
    this.engine = engine;
    this.strategyEngine = new SkillStrategyEngine(engine.getSubstrate() as any);
    this.onClose = onClose;
  }

  public render(maxWidth: number = 100): readonly string[] {
    const lines: string[] = [];
    const width = Math.max(70, maxWidth);
    const border = "─".repeat(width - 2);

    const metrics = this.engine.getSkillMetrics();
    const skills = this.getFilteredSkills();

    // 1. Header
    lines.push(`┌${border}┐`);
    lines.push(this.formatLine(` 🌲 LUMI EVOLUTIONARY SKILL TREE & TALENT HUB (ADR-014) `, width));
    lines.push(`├${border}┤`);

    // 2. Executive KPI Ribbon
    const kpiText = ` Total: ${metrics.totalSkills} | Avg Mastery: ${metrics.averageMasteryScore}% | Avg Fitness: ${metrics.averageFitnessScore} | Pinned: ${metrics.pinnedSkills} | Mutations: ${metrics.totalMutationsCount}`;
    lines.push(this.formatLine(kpiText, width));
    lines.push(`├${border}┤`);

    // 3. View Mode Bar
    const viewTabs = [
      this.viewMode === "skills" ? "[1: 🌲 Skills]" : " 1: Skills ",
      this.viewMode === "dag" ? "[2: 🌳 DAG]" : " 2: DAG ",
      this.viewMode === "strategy" ? "[3: ⚡ Strategy]" : " 3: Strategy ",
      this.viewMode === "tracks" ? "[4: 🎯 Tracks]" : " 4: Tracks ",
      this.viewMode === "quests" ? "[5: 🏆 Quests]" : " 5: Quests ",
      this.viewMode === "lineage" ? "[6: 🧬 Lineage]" : " 6: Lineage ",
      this.viewMode === "health" ? "[7: 🩺 Health]" : " 7: Health ",
      this.viewMode === "metrics" ? "[8: 📊 Metrics]" : " 8: Metrics ",
    ].join(" │ ");
    lines.push(this.formatLine(` ${viewTabs}`, width));
    lines.push(`├${border}┤`);

    // 4. Content Area
    switch (this.viewMode) {
      case "skills":
        this.renderDualPaneSkillsView(lines, skills, width);
        break;
      case "dag":
        this.renderDagView(lines, width);
        break;
      case "strategy":
        this.renderStrategyView(lines, width);
        break;
      case "tracks":
        this.renderTracksView(lines, width);
        break;
      case "quests":
        this.renderQuestsView(lines, width);
        break;
      case "lineage":
        this.renderLineageView(lines, skills, width);
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
      lines.push(this.formatLine(` [j/k] Navigate  [s] Synthesize Strategy  [p] Pin  [+/-] Mastery  [v] Switch View  [q] Close`, width));
    } else {
      lines.push(this.formatLine(` [v] Tab (${this.viewMode})  [s] Strategy  [1-4] Filter  [p] Pin  [+/-] Mastery  [?] Help  [q] Close`, width));
    }
    lines.push(`└${border}┘`);

    return lines;
  }

  private renderDualPaneSkillsView(lines: string[], skills: readonly SkillNodeManifest[], width: number): void {
    if (skills.length === 0) {
      lines.push(this.formatLine(" (No skills matching current filter)", width));
      return;
    }

    const current = skills[this.selectedIndex] || skills[0];
    const leftWidth = Math.floor(width * 0.52);
    const rightWidth = width - leftWidth - 3;

    lines.push(this.formatLine(` ${"SKILL ROSTER".padEnd(leftWidth - 4)} │ ${"4D COMPETENCY INSPECTOR".padEnd(rightWidth - 2)}`, width));
    lines.push(this.formatLine(` ${"─".repeat(leftWidth - 4)} ┼ ${"─".repeat(rightWidth - 2)}`, width));

    const maxRows = Math.min(10, skills.length);

    for (let i = 0; i < maxRows; i++) {
      const s = skills[i];
      const isSelected = i === this.selectedIndex;
      const marker = isSelected ? "▶" : " ";
      const tierIcon = s.tier === "sovereign" ? "👑" : s.tier === "master" ? "🥇" : s.tier === "adept" ? "🥈" : "🥉";
      const pinIcon = s.pinned ? "📌" : "  ";
      const masteryBar = "■".repeat(Math.floor(s.masteryScore / 20)) + "□".repeat(5 - Math.floor(s.masteryScore / 20));

      const leftText = `${marker} ${tierIcon}${pinIcon} ${s.name.slice(0, 16).padEnd(16)} [${masteryBar}] ${String(s.masteryScore).padStart(3)}%`;

      let rightText = "";
      if (i === 0) {
        rightText = `Skill: ${current.name} [${current.tier.toUpperCase()}]`;
      } else if (i === 1) {
        const comp = current.competencies || { syntaxAccuracy: current.masteryScore, executionReliability: current.masteryScore, recoveryResilience: current.masteryScore, speedEfficiency: 85 };
        rightText = `Syntax:      [${this.makeBar(comp.syntaxAccuracy)}] ${comp.syntaxAccuracy}%`;
      } else if (i === 2) {
        const comp = current.competencies || { syntaxAccuracy: current.masteryScore, executionReliability: current.masteryScore, recoveryResilience: current.masteryScore, speedEfficiency: 85 };
        rightText = `Reliability: [${this.makeBar(comp.executionReliability)}] ${comp.executionReliability}%`;
      } else if (i === 3) {
        const comp = current.competencies || { syntaxAccuracy: current.masteryScore, executionReliability: current.masteryScore, recoveryResilience: current.masteryScore, speedEfficiency: 85 };
        rightText = `Resilience:  [${this.makeBar(comp.recoveryResilience)}] ${comp.recoveryResilience}%`;
      } else if (i === 4) {
        const comp = current.competencies || { syntaxAccuracy: current.masteryScore, executionReliability: current.masteryScore, recoveryResilience: current.masteryScore, speedEfficiency: 85 };
        rightText = `Speed:       [${this.makeBar(comp.speedEfficiency)}] ${comp.speedEfficiency}%`;
      } else if (i === 5) {
        rightText = `Prereqs: ${current.prerequisites.length > 0 ? current.prerequisites.join(", ") : "None (Root Node)"}`;
      } else if (i === 6) {
        rightText = `Ancestry: Gen ${current.lineage?.generation || 1} ${current.lineage?.branchOrigin ? `(${current.lineage.branchOrigin})` : ""}`;
      } else if (i === 7) {
        rightText = `Usage: ${current.useCount} runs | Fitness: ${current.fitnessScore}`;
      }

      const combined = ` ${leftText.padEnd(leftWidth - 4)} │ ${rightText.padEnd(rightWidth - 2)}`;
      lines.push(this.formatLine(combined, width));
    }
  }

  private makeBar(score: number): string {
    const filled = Math.min(8, Math.max(0, Math.floor(score / 12.5)));
    return "█".repeat(filled) + "░".repeat(8 - filled);
  }

  private renderDagView(lines: string[], width: number): void {
    const dag = this.engine.getSubstrate().getDag();
    const rawDag = BroccoliViewRenderer.renderSkillTreeDag(dag as any);
    const dagLines = rawDag.split("\n");
    for (const d of dagLines) {
      lines.push(this.formatLine(d, width));
    }
  }

  private renderStrategyView(lines: string[], width: number): void {
    if (!this.activeStrategyPlan) {
      const all = this.engine.getSubstrate().getAllNodes();
      const sampleGoal = all[0]?.name || "general execution";
      this.activeStrategyPlan = this.engine.synthesizeStrategy({
        prompt: `Execute goal requiring ${sampleGoal}`,
        policy: "balanced_adaptive",
      });
    }

    const plan = this.activeStrategyPlan;
    lines.push(this.formatLine(` ── Strategy Plan: ${plan.strategyId} [Policy: ${plan.policy.toUpperCase()}]`, width));
    lines.push(this.formatLine(` Confidence: ${Math.round(plan.confidenceScore * 100)}% | Primary Anchor: ${plan.primarySkill.name}`, width));
    lines.push(this.formatLine(` Execution Pipeline (${plan.executionChain.length} stages):`, width));

    for (const step of plan.executionChain) {
      lines.push(this.formatLine(`  ${step.stepIndex}. [${step.tier.toUpperCase()} | ${step.masteryScore}%] ${step.skillName} ── ${step.rationale.slice(0, 45)}`, width));
    }

    if (plan.synergies.length > 0) {
      lines.push(this.formatLine(` ── Active Combo Synergies:`, width));
      for (const syn of plan.synergies) {
        lines.push(this.formatLine(`  ⚡ ${syn.name} (+${Math.round((syn.fitnessMultiplier - 1) * 100)}% fitness)`, width));
      }
    }
  }

  private renderTracksView(lines: string[], width: number): void {
    const tracks = this.strategyEngine.getProgressionTracks();
    lines.push(this.formatLine(` ── Role-Based Progression Tracks (${tracks.length} pathways):`, width));
    for (const t of tracks) {
      const bar = "█".repeat(Math.floor(t.progressPercent / 10)) + "░".repeat(10 - Math.floor(t.progressPercent / 10));
      lines.push(this.formatLine(`  ${t.icon} ${t.name.padEnd(30)} [${bar}] ${t.progressPercent}%`, width));
      lines.push(this.formatLine(`     Role: ${t.targetRole} | Stages: ${t.stages.length}`, width));
    }
  }

  private renderQuestsView(lines: string[], width: number): void {
    const quests = this.strategyEngine.getEvolutionMilestones();
    lines.push(this.formatLine(` ── Evolutionary Quests & Milestone Achievements:`, width));
    for (const q of quests) {
      const statusIcon = q.unlocked ? "✓ [UNLOCKED]" : "○ [IN PROGRESS]";
      lines.push(this.formatLine(`  ${q.icon} ${q.title.padEnd(25)} ${statusIcon.padEnd(16)} Perk: ${q.rewardPerk}`, width));
    }
  }

  private renderLineageView(lines: string[], skills: readonly SkillNodeManifest[], width: number): void {
    lines.push(this.formatLine(` ── Evolutionary Lineage & Speciation Ancestry:`, width));
    const current = skills[this.selectedIndex] || skills[0];
    if (current) {
      const lin = current.lineage || { generation: 1, mutationCount: 0 };
      lines.push(this.formatLine(` Skill: ${current.name} (${current.id})`, width));
      lines.push(this.formatLine(` Generation: ${lin.generation} | Ancestor: ${lin.ancestorId || "Root Generation"}`, width));
      lines.push(this.formatLine(` Branch Origin: ${lin.branchOrigin || "Core"} | Mutation Count: ${lin.mutationCount}`, width));
      if (lin.speciatedChildren && lin.speciatedChildren.length > 0) {
        lines.push(this.formatLine(` Speciated Children: ${lin.speciatedChildren.join(", ")}`, width));
      }
      if (lin.consolidatedFrom && lin.consolidatedFrom.length > 0) {
        lines.push(this.formatLine(` Consolidated From: ${lin.consolidatedFrom.join(", ")}`, width));
      }
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
        const modes: SkillTreeModalViewMode[] = ["skills", "dag", "strategy", "tracks", "quests", "lineage", "mutations", "curator", "health", "metrics"];
        const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
        this.viewMode = modes[nextIdx];
        break;
      }

      case "s": {
        const current = skills[this.selectedIndex];
        this.activeStrategyPlan = this.engine.synthesizeStrategy({
          prompt: current ? `Apply capability ${current.name}` : "General problem solving",
          policy: "balanced_adaptive",
        });
        this.viewMode = "strategy";
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
