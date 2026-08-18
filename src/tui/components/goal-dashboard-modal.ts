/**
 * goal-dashboard-modal.ts
 *
 * Interactive TUI Goal Dashboard Modal with Keyboard Navigation,
 * Above-the-Fold Executive KPI Ribbon, Quick Filter Pills,
 * Milestone DAG Dependency Tree Visualizer, Desktop Notification Trigger,
 * Quality Gate Inspector, and Responsive Multi-View Support (ADR-117).
 */

import type { Component, Focusable } from "../tui.js";
import { Box } from "./box.js";
import { VStack } from "./v-stack.js";
import { Text } from "./text.js";
import { Markdown, type MarkdownTheme } from "./markdown.js";
import { matchesKey } from "../keys.js";
import type {
  GoalCategory,
  GoalGate,
  GoalMilestone,
  GoalState,
  GoalStatus,
} from "../../core/contracts/goal.contracts.js";
import type { GoalSupervisor } from "../../agents/extensions/goals/goal-supervisor.js";

const GOAL_MARKDOWN_THEME: MarkdownTheme = {
  heading: (text) => `\x1b[1;36m${text}\x1b[0m`,
  link: (text) => `\x1b[4;34m${text}\x1b[0m`,
  linkUrl: (text) => `\x1b[90m${text}\x1b[0m`,
  code: (text) => `\x1b[1;33m${text}\x1b[0m`,
  codeBlock: (text) => text,
  codeBlockBorder: (text) => `\x1b[90m${text}\x1b[0m`,
  quote: (text) => `\x1b[36m${text}\x1b[0m`,
  quoteBorder: (text) => `\x1b[90m${text}\x1b[0m`,
  hr: (text) => `\x1b[90m${text}\x1b[0m`,
  listBullet: (text) => `\x1b[36m${text}\x1b[0m`,
  bold: (text) => `\x1b[1;37m${text}\x1b[0m`,
  italic: (text) => `\x1b[3m${text}\x1b[0m`,
  strikethrough: (text) => `\x1b[9m${text}\x1b[0m`,
  underline: (text) => `\x1b[4m${text}\x1b[0m`,
};

export class GoalDashboardModal implements Component, Focusable {
  focused: boolean = true;
  private readonly container: Box;
  private readonly vstack: VStack;
  private readonly supervisor: GoalSupervisor;
  private readonly sessionId: string;
  private readonly onClose: () => void;

  private selectedMilestoneIndex: number = 0;
  private viewMode: "milestones" | "gates" | "dag_graph" | "trajectory" | "health" | "burnup" = "milestones";
  private filterPreset: "all" | "completed" | "blocked" | "pending" | "in_progress" = "all";
  private isShowingHelp: boolean = false;
  private isInspecting: boolean = false;
  private inspectedMilestone?: GoalMilestone;
  private statusMessage: string = "";

  constructor(
    supervisor: GoalSupervisor,
    sessionId: string = "default",
    onClose: () => void
  ) {
    this.supervisor = supervisor;
    this.sessionId = sessionId;
    this.onClose = onClose;

    const bgFn = (text: string) => `\x1b[48;5;235m${text}\x1b[0m`;
    this.container = new Box(2, 1, bgFn);
    this.vstack = new VStack();
    this.container.addChild(this.vstack);

    this.rebuildView();
  }

  invalidate(): void {
    this.rebuildView();
    this.container.invalidate();
  }

  private rebuildView(): void {
    while (this.vstack.children.length > 0) {
      this.vstack.children.pop();
    }

    const goal = this.supervisor.getGoal(this.sessionId);
    if (!goal) {
      this.vstack.addChild(new Text(`\x1b[31mGoal for session '${this.sessionId}' not found\x1b[0m`, 0, 0));
      return;
    }

    // Header
    const hStatus = goal.healthStatus === "on_track" ? "\x1b[1;32m[🟢 ON TRACK]\x1b[0m" : goal.healthStatus === "at_risk" ? "\x1b[1;33m[🟡 AT RISK]\x1b[0m" : goal.healthStatus === "off_track" ? "\x1b[1;31m[🔴 OFF TRACK]\x1b[0m" : "";
    const headerText = `\x1b[1;36m🎯 LUMI GOAL: ${goal.icon || "🎯"} ${goal.goal.toUpperCase()}\x1b[0m ${hStatus} \x1b[90m[Status: ${goal.status.toUpperCase()} | View: ${this.viewMode.toUpperCase()}]\x1b[0m`;
    this.vstack.addChild(new Text(headerText, 0, 0));

    // Above-the-fold Executive KPI Ribbon
    const completedM = goal.milestones.filter((m) => m.status === "completed").length;
    const totalM = goal.milestones.length;
    const filledBlocks = Math.round(goal.progressPercent / 10);
    const progressBar = "█".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);
    const gatesPass = goal.gates.filter((g) => g.lastExitCode === 0).length;
    const totalGates = goal.gates.length;

    const kpiLine = `\x1b[1;32m⚡ Progress: [${progressBar}] ${goal.progressPercent}%\x1b[0m  \x1b[1;35m🎯 Milestones: ${completedM}/${totalM}\x1b[0m  \x1b[1;33m⏱️ Turns: ${goal.turnsUsed}/${goal.maxTurns}\x1b[0m  \x1b[1;36m🛡️ Gates: ${gatesPass}/${totalGates}\x1b[0m`;
    this.vstack.addChild(new Text(kpiLine, 0, 0));

    // Above-the-fold Filter Bar
    const p1 = this.filterPreset === "all" ? `\x1b[1;36m[1: All]\x1b[0m` : `\x1b[90m1: All\x1b[0m`;
    const p2 = this.filterPreset === "completed" ? `\x1b[1;32m[2: ✓ Completed]\x1b[0m` : `\x1b[90m2: Completed\x1b[0m`;
    const p3 = this.filterPreset === "blocked" ? `\x1b[1;31m[3: 🛑 Blocked]\x1b[0m` : `\x1b[90m3: Blocked\x1b[0m`;
    const p4 = this.filterPreset === "pending" ? `\x1b[1;33m[4: ⏳ Pending]\x1b[0m` : `\x1b[90m4: Pending\x1b[0m`;
    this.vstack.addChild(new Text(`\x1b[90mFilters:\x1b[0m ${p1}  ${p2}  ${p3}  ${p4}  \x1b[90m[v: Cycle View (Milestones/Gates/DAG/Trajectory/Health/Burnup)]\x1b[0m`, 0, 0));

    if (this.statusMessage) {
      this.vstack.addChild(new Text(`\x1b[1;33mℹ ${this.statusMessage}\x1b[0m`, 0, 0));
    }

    if (this.isShowingHelp) {
      let helpMd = `## ⌨️ Goal Dashboard Shortcuts & Familiar Navigation\n\n`;
      helpMd += `| Key | Action | Description |\n`;
      helpMd += `| :---: | :--- | :--- |\n`;
      helpMd += `| \`j\` / \`k\` / \`↑\` / \`↓\` | Select Item | Navigate milestones or quality gates vertically |\n`;
      helpMd += `| \`Enter\` | Inspect / Toggle | Inspect milestone details or toggle completion |\n`;
      helpMd += `| \`c\` | Toggle Subtask | Toggle checklist subtask item in milestone |\n`;
      helpMd += `| \`t\` | Toggle Tag | Add / toggle tag on selected milestone |\n`;
      helpMd += `| \`r\` | Revert Milestone | Revert milestone to pending & rollback dependents |\n`;
      helpMd += `| \`+\` / \`-\` | Adjust Progress | Increment / Decrement milestone progress by 10% |\n`;
      helpMd += `| \`b\` | Toggle Blocked | Mark or unmark milestone as blocked |\n`;
      helpMd += `| \`v\` | Cycle View | Switch between Milestones, Gates, DAG, Trajectory, Health, and Burnup |\n`;
      helpMd += `| \`g\` | Run Gates | Evaluate all quality gates for active session |\n`;
      helpMd += `| \`p\` | Pause / Resume | Toggle paused/active status of standing goal |\n`;
      helpMd += `| \`d\` | Desktop Alert | Trigger test desktop notification |\n`;
      helpMd += `| \`1\` - \`4\` | Filter Pills | Switch quick filter presets |\n`;
      helpMd += `| \`z\` | Undo Mutation | Undo last goal/milestone mutation |\n`;
      helpMd += `| \`q\` / \`Esc\` | Close / Back | Return to previous view or exit |\n\n`;
      helpMd += `\x1b[90mPress [Esc], [Enter], or [?] to dismiss help\x1b[0m`;
      this.vstack.addChild(new Markdown(helpMd, 0, 0, GOAL_MARKDOWN_THEME));
      return;
    }

    if (this.viewMode === "dag_graph") {
      const graph = this.supervisor.renderDagGraph(this.sessionId);
      this.vstack.addChild(new Text(`\n${graph}\n\n\x1b[90m[v] Next View | [?] Help | [q/Esc] Close\x1b[0m`, 0, 0));
      return;
    }

    if (this.viewMode === "burnup") {
      const forecast = this.supervisor.getBurnupForecast(this.sessionId);
      if (!forecast) {
        this.vstack.addChild(new Text(`\x1b[90m(No burnup forecast data available)\x1b[0m`, 0, 0));
      } else {
        this.vstack.addChild(new Text(`\n\x1b[1;36m${forecast.asciiChart}\x1b[0m\n\n\x1b[90m[v] Next View | [?] Help | [q] Close\x1b[0m`, 0, 0));
      }
      return;
    }

    if (this.viewMode === "health") {
      const health = this.supervisor.auditGoalHealth(this.sessionId);
      const risks = this.supervisor.diagnoseGoalRisks(this.sessionId);
      if (!health || !risks) {
        this.vstack.addChild(new Text(`\x1b[90m(No health audit data available)\x1b[0m`, 0, 0));
      } else {
        const hBadge = health.healthStatus === "on_track" ? "\x1b[1;32m[🟢 ON TRACK]\x1b[0m" : health.healthStatus === "at_risk" ? "\x1b[1;33m[🟡 AT RISK]\x1b[0m" : "\x1b[1;31m[🔴 OFF TRACK]\x1b[0m";
        let md = `\n### 🩺 Health & SLA Audit: ${hBadge}\n\n`;
        md += `- **Pacing Rate**: \`${health.turnConsumptionRate}% progress / turn\`\n`;
        md += `- **Estimated Turns to Completion**: \`~${health.estimatedTurnsToCompletion} turns\` (Budget Remaining: \`${health.turnsRemaining} turns\`)\n`;
        md += `- **Overall Risk Level**: \`${risks.overallRiskLevel.toUpperCase()}\`\n\n`;
        if (risks.riskFactors.length > 0) {
          md += `### ⚠️ Risk Factors (${risks.riskFactors.length})\n`;
          risks.riskFactors.forEach((rf) => {
            md += `• **${rf.title}**: ${rf.description}\n`;
          });
          md += `\n`;
        }
        if (risks.immediateRemediationPlan.length > 0) {
          md += `### 💡 Recommended Remediation Plan\n`;
          risks.immediateRemediationPlan.forEach((plan, i) => {
            md += `${i + 1}. \`${plan}\`\n`;
          });
        }
        md += `\n\x1b[90m[v] Next View | [?] Help | [q] Close\x1b[0m`;
        this.vstack.addChild(new Markdown(md, 0, 0, GOAL_MARKDOWN_THEME));
      }
      return;
    }

    if (this.viewMode === "trajectory") {
      let md = `\n### 📈 Trajectory Execution Stream (${goal.trajectory?.length || 0} events)\n\n`;
      if (!goal.trajectory || goal.trajectory.length === 0) {
        md += `\x1b[90m(No turn trajectory events captured yet)\x1b[0m\n`;
      } else {
        goal.trajectory.slice(-6).forEach((evt) => {
          const vColor = evt.verdict === "done" ? "\x1b[1;32m" : evt.verdict === "continue" ? "\x1b[1;36m" : "\x1b[1;33m";
          md += `• **Turn ${evt.turnIndex}** ${vColor}[${evt.verdict.toUpperCase()}]\x1b[0m \x1b[90m(${new Date(evt.timestampMs).toLocaleTimeString()})\x1b[0m\n`;
          md += `  ${evt.actionSummary} \x1b[90m(Gates: ${evt.gatesPassed}/${evt.gatesEvaluated})\x1b[0m\n\n`;
        });
      }
      md += `\x1b[90m[v] Next View | [?] Help | [q] Close\x1b[0m`;
      this.vstack.addChild(new Markdown(md, 0, 0, GOAL_MARKDOWN_THEME));
      return;
    }

    if (this.viewMode === "gates") {
      let md = `\n### 🛡️ Quality Gates (${goal.gates.length})\n\n`;
      if (goal.gates.length === 0) {
        md += `\x1b[90m(No quality gates configured for this goal)\x1b[0m\n`;
      } else {
        goal.gates.forEach((g, idx) => {
          const pass = g.lastExitCode === 0;
          const status = pass ? `\x1b[1;32m[✓ PASS]\x1b[0m` : g.lastExitCode !== undefined ? `\x1b[1;31m[❌ FAIL (${g.lastExitCode})]\x1b[0m` : `\x1b[90m[PENDING]\x1b[0m`;
          md += `• **${g.name || g.command}** ${status} \x1b[90m(${g.policy || "blocking"} | attempts: ${g.attempts}/${g.maxRetries})\x1b[0m\n`;
          md += `  \`${g.command}\`\n\n`;
        });
      }
      md += `\x1b[90m[g] Evaluate Gates | [v] Next View | [?] Help | [q] Close\x1b[0m`;
      this.vstack.addChild(new Markdown(md, 0, 0, GOAL_MARKDOWN_THEME));
      return;
    }

    if (this.isInspecting && this.inspectedMilestone) {
      const m = this.inspectedMilestone;
      let md = `## 🔍 Milestone Inspector: #${m.id} - ${m.title}\n\n`;
      md += `- **Status**: \`${m.status.toUpperCase()}\`\n`;
      md += `- **Progress**: \`${m.progressPercent}%\`\n`;
      if (m.tags && m.tags.length > 0) md += `- **Tags**: ${m.tags.map((t) => `\`#${t}\``).join(" ")}\n`;
      if (m.dependsOn && m.dependsOn.length > 0) md += `- **Depends On**: ${m.dependsOn.map((d) => `\`#${d}\``).join(", ")}\n`;
      if (m.blockers && m.blockers.length > 0) md += `- **Active Blockers**: ${m.blockers.map((b) => `\`#${b}\``).join(", ")}\n`;
      if (m.description) md += `\n### Description\n${m.description}\n`;
      if (m.checklist && m.checklist.length > 0) {
        md += `\n### Subtask Checklist (${m.checklist.filter((c) => c.done).length}/${m.checklist.length})\n`;
        m.checklist.forEach((c) => {
          const checkIcon = c.done ? `\x1b[1;32m[✓]\x1b[0m` : `\x1b[90m[ ]\x1b[0m`;
          md += `- ${checkIcon} ${c.text}\n`;
        });
      }

      md += `\n\x1b[90m[Enter] Toggle Status | [c] Toggle Subtask | [Esc/q] Back to List\x1b[0m`;
      this.vstack.addChild(new Markdown(md, 0, 0, GOAL_MARKDOWN_THEME));
      return;
    }

    // Milestones List View
    const visibleMilestones = this.getVisibleMilestones(goal);
    if (this.selectedMilestoneIndex >= visibleMilestones.length) {
      this.selectedMilestoneIndex = Math.max(0, visibleMilestones.length - 1);
    }

    let md = `\n### 🎯 Milestone Progression (${visibleMilestones.length}/${goal.milestones.length})\n\n`;
    if (visibleMilestones.length === 0) {
      md += `\x1b[90m(No milestones matching active filter)\x1b[0m\n`;
    } else {
      visibleMilestones.forEach((m, idx) => {
        const isSelected = idx === this.selectedMilestoneIndex;
        const prefix = isSelected ? `\x1b[1;36m➜\x1b[0m ` : `  • `;
        const icon = m.status === "completed" ? `\x1b[1;32m[✓ DONE]\x1b[0m` : m.status === "blocked" ? `\x1b[1;31m[🛑 BLOCKED]\x1b[0m` : `\x1b[90m[${m.status.toUpperCase()}]\x1b[0m`;
        const chkBadge = m.checklist && m.checklist.length > 0
          ? ` \x1b[1;36m[✓ ${m.checklist.filter((c) => c.done).length}/${m.checklist.length}]\x1b[0m`
          : "";
        const tagBadge = m.tags && m.tags.length > 0 ? ` \x1b[90m[${m.tags.map((t) => `#${t}`).join(" ")}]\x1b[0m` : "";
        const title = isSelected ? `**\x1b[1;37m[#${m.id}] ${m.title}\x1b[0m**` : `[#${m.id}] ${m.title}`;
        md += `${prefix}${title} ${icon}${chkBadge}${tagBadge} \x1b[90m(${m.progressPercent}%)\x1b[0m\n`;
      });
    }

    md += `\n\x1b[90m[j/k] Select | [Enter] Inspect | [c] Subtask | [t] Tag | [r] Revert | [+/-] Progress | [b] Block | [v] View | [g] Gates | [p] Pause | [?] Help | [q] Close\x1b[0m`;
    this.vstack.addChild(new Markdown(md, 0, 0, GOAL_MARKDOWN_THEME));
  }

  private getVisibleMilestones(goal: GoalState): readonly GoalMilestone[] {
    if (this.filterPreset === "all") return goal.milestones;
    return goal.milestones.filter((m) => m.status === this.filterPreset);
  }

  handleInput(data: string): void {
    if (this.isShowingHelp) {
      if (matchesKey(data, "escape") || data === "q" || data === "Q" || matchesKey(data, "return") || data === "?") {
        this.isShowingHelp = false;
        this.invalidate();
        return;
      }
    }

    if (this.isInspecting) {
      if (matchesKey(data, "escape") || data === "q" || data === "Q") {
        this.isInspecting = false;
        this.invalidate();
        return;
      }
      if (data === "c" || data === "C") {
        if (this.inspectedMilestone) {
          const checkId = `task-${(this.inspectedMilestone.checklist?.length || 0) + 1}`;
          this.supervisor.toggleMilestoneChecklist(this.sessionId, this.inspectedMilestone.id, checkId);
          const reloaded = this.supervisor.getGoal(this.sessionId)?.milestones.find((m) => m.id === this.inspectedMilestone!.id);
          if (reloaded) this.inspectedMilestone = reloaded;
          this.statusMessage = `Toggled checklist item in milestone #${this.inspectedMilestone?.id}`;
          this.invalidate();
          return;
        }
      }
      if (matchesKey(data, "return") && this.inspectedMilestone) {
        // Toggle milestone status
        const nextStatus = this.inspectedMilestone.status === "completed" ? "pending" : "completed";
        this.supervisor.updateMilestone(this.sessionId, this.inspectedMilestone.id, {
          status: nextStatus,
          progressPercent: nextStatus === "completed" ? 100 : 0,
        });
        this.isInspecting = false;
        this.statusMessage = `Milestone #${this.inspectedMilestone.id} marked as ${nextStatus}`;
        this.invalidate();
        return;
      }
    }

    if (matchesKey(data, "escape") || data === "q" || data === "Q") {
      this.onClose();
      return;
    }

    if (data === "?") {
      this.isShowingHelp = true;
      this.invalidate();
      return;
    }

    if (data === "t" || data === "T") {
      const goal = this.supervisor.getGoal(this.sessionId);
      if (goal) {
        const visible = this.getVisibleMilestones(goal);
        const selectedM = visible[this.selectedMilestoneIndex];
        if (selectedM) {
          this.supervisor.tagGoalOrMilestone(this.sessionId, ["p0"], selectedM.id);
          this.statusMessage = `Tagged milestone #${selectedM.id} with #p0`;
          this.invalidate();
          return;
        }
      }
    }

    if (data === "r" || data === "R") {
      const goal = this.supervisor.getGoal(this.sessionId);
      if (goal) {
        const visible = this.getVisibleMilestones(goal);
        const selectedM = visible[this.selectedMilestoneIndex];
        if (selectedM) {
          const rollback = this.supervisor.revertMilestone(this.sessionId, selectedM.id, "TUI rollback requested");
          this.statusMessage = rollback.success ? `Reverted milestone #${selectedM.id} (affected: ${rollback.affectedDownstreamMilestoneIds.length} downstream)` : `Rollback failed`;
          this.invalidate();
          return;
        }
      }
    }

    if (data === "c" || data === "C") {
      const goal = this.supervisor.getGoal(this.sessionId);
      if (goal) {
        const visible = this.getVisibleMilestones(goal);
        const selectedM = visible[this.selectedMilestoneIndex];
        if (selectedM) {
          const checkId = `task-${(selectedM.checklist?.length || 0) + 1}`;
          this.supervisor.toggleMilestoneChecklist(this.sessionId, selectedM.id, checkId);
          this.statusMessage = `Toggled checklist item in milestone #${selectedM.id}`;
          this.invalidate();
          return;
        }
      }
    }

    if (data === "+" || data === "=") {
      const goal = this.supervisor.getGoal(this.sessionId);
      if (goal) {
        const visible = this.getVisibleMilestones(goal);
        const selectedM = visible[this.selectedMilestoneIndex];
        if (selectedM) {
          this.supervisor.adjustMilestoneProgress(this.sessionId, selectedM.id, 10);
          this.statusMessage = `Adjusted #${selectedM.id} progress by +10%`;
          this.invalidate();
          return;
        }
      }
    }

    if (data === "-" || data === "_") {
      const goal = this.supervisor.getGoal(this.sessionId);
      if (goal) {
        const visible = this.getVisibleMilestones(goal);
        const selectedM = visible[this.selectedMilestoneIndex];
        if (selectedM) {
          this.supervisor.adjustMilestoneProgress(this.sessionId, selectedM.id, -10);
          this.statusMessage = `Adjusted #${selectedM.id} progress by -10%`;
          this.invalidate();
          return;
        }
      }
    }

    if (data === "b" || data === "B") {
      const goal = this.supervisor.getGoal(this.sessionId);
      if (goal) {
        const visible = this.getVisibleMilestones(goal);
        const selectedM = visible[this.selectedMilestoneIndex];
        if (selectedM) {
          const isBlocked = selectedM.status === "blocked";
          this.supervisor.setMilestoneBlocked(this.sessionId, selectedM.id, !isBlocked, isBlocked ? undefined : "Manual user block");
          this.statusMessage = `Milestone #${selectedM.id} ${isBlocked ? "unblocked" : "marked as BLOCKED"}`;
          this.invalidate();
          return;
        }
      }
    }

    if (data === "v" || data === "V") {
      if (this.viewMode === "milestones") this.viewMode = "gates";
      else if (this.viewMode === "gates") this.viewMode = "dag_graph";
      else if (this.viewMode === "dag_graph") this.viewMode = "trajectory";
      else if (this.viewMode === "trajectory") this.viewMode = "health";
      else if (this.viewMode === "health") this.viewMode = "burnup";
      else this.viewMode = "milestones";
      this.statusMessage = `View: ${this.viewMode.toUpperCase()}`;
      this.invalidate();
      return;
    }

    // Number keys for filter pills
    if (data === "1") { this.filterPreset = "all"; this.statusMessage = "Filter: All Milestones"; this.invalidate(); return; }
    if (data === "2") { this.filterPreset = "completed"; this.statusMessage = "Filter: Completed Milestones"; this.invalidate(); return; }
    if (data === "3") { this.filterPreset = "blocked"; this.statusMessage = "Filter: Blocked Milestones"; this.invalidate(); return; }
    if (data === "4") { this.filterPreset = "pending"; this.statusMessage = "Filter: Pending Milestones"; this.invalidate(); return; }

    const goal = this.supervisor.getGoal(this.sessionId);
    if (!goal) return;

    const visible = this.getVisibleMilestones(goal);

    if (matchesKey(data, "up") || data === "k" || data === "K") {
      if (this.selectedMilestoneIndex > 0) {
        this.selectedMilestoneIndex--;
        this.invalidate();
      }
    } else if (matchesKey(data, "down") || data === "j" || data === "J") {
      if (this.selectedMilestoneIndex < visible.length - 1) {
        this.selectedMilestoneIndex++;
        this.invalidate();
      }
    } else if (matchesKey(data, "return")) {
      if (visible[this.selectedMilestoneIndex]) {
        this.inspectedMilestone = visible[this.selectedMilestoneIndex];
        this.isInspecting = true;
        this.invalidate();
      }
    } else if (data === "p" || data === "P") {
      const nextStatus = goal.status === "paused" ? "active" : "paused";
      this.supervisor.updateGoal(this.sessionId, { status: nextStatus });
      this.statusMessage = `Goal status set to: ${nextStatus.toUpperCase()}`;
      this.invalidate();
    } else if (data === "g" || data === "G") {
      this.supervisor.evaluateGates(this.sessionId, process.cwd()).then((res) => {
        this.statusMessage = `Evaluated ${res.totalEvaluated} gates (${res.passed} passed, ${res.failed} failed)`;
        this.invalidate();
      }).catch(() => {});
    } else if (data === "d" || data === "D") {
      this.supervisor.getSubstrate().getNotificationDispatcher().dispatch({
        sessionId: this.sessionId,
        title: "TUI Goal Notification",
        message: `Interactive notification from LUMI Goal Dashboard: "${goal.goal}"`,
        urgency: "normal",
        trigger: "custom",
      }).catch(() => {});
      this.statusMessage = "Desktop alert dispatched!";
      this.invalidate();
    } else if (data === "z" || data === "Z") {
      const res = this.supervisor.undo(this.sessionId);
      if (res.success) {
        this.statusMessage = "Undid previous goal mutation";
      } else {
        this.statusMessage = "Nothing to undo";
      }
      this.invalidate();
    }
  }

  render(width: number): string[] {
    return this.container.render(width);
  }
}
