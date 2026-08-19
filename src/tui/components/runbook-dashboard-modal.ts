/**
 * runbook-dashboard-modal.ts
 *
 * Interactive TUI Runbook FSM Dashboard Modal with Visual Pipeline DAG Breadcrumb Trail,
 * Above-the-Fold Executive KPI Ribbon, Quality Gate Inspector, Dynamic Check Substrate Viewer,
 * Chronological WAL Timeline, and Plain-English Executive Storyteller (ADR-123).
 */

import type { Component, Focusable } from "../tui.js";
import { Box } from "./box.js";
import { VStack } from "./v-stack.js";
import { Text } from "./text.js";
import { Markdown, type MarkdownTheme } from "./markdown.js";
import { matchesKey } from "../keys.js";
import type { RunbookSupervisor } from "../../agents/extensions/runbooks/runbook-supervisor.js";
import { RunbookHumanizer } from "../../agents/extensions/runbooks/runbook-humanizer.js";
import { StatefulCompactionSynthesizer } from "../../tooling/extensions/compaction/stateful-compaction-synthesizer.js";
import type {
  RunbookSpec,
  RunbookRuntimeState,
  RunbookHistoryEvent,
  DynamicEntryCheckManifest,
} from "../../core/contracts/runbook.contracts.js";

const RUNBOOK_MARKDOWN_THEME: MarkdownTheme = {
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

export type RunbookDashboardViewMode = "pipeline" | "gates" | "dynamic" | "timeline" | "story";

export class RunbookDashboardModal implements Component, Focusable {
  focused: boolean = true;
  private readonly container: Box;
  private readonly vstack: VStack;
  private readonly supervisor: RunbookSupervisor;
  private readonly runId?: string;
  private readonly onClose: () => void;

  private viewMode: RunbookDashboardViewMode = "pipeline";
  private selectedTransitionIndex: number = 0;
  private isShowingHelp: boolean = false;
  private isShowingCompactPrompt: boolean = false;
  private statusMessage: string = "";

  // Cached state for rendering
  private activeRun?: RunbookRuntimeState;
  private activeSpec?: RunbookSpec;
  private activeHistory: readonly RunbookHistoryEvent[] = [];
  private activeDynamicChecks: readonly DynamicEntryCheckManifest[] = [];

  constructor(
    supervisor: RunbookSupervisor,
    runId?: string,
    onClose: () => void = () => {}
  ) {
    this.supervisor = supervisor;
    this.runId = runId;
    this.onClose = onClose;

    const bgFn = (text: string) => `\x1b[48;5;235m${text}\x1b[0m`;
    this.container = new Box(2, 1, bgFn);
    this.vstack = new VStack();
    this.container.addChild(this.vstack);

    this.refreshState().catch(() => {});
  }

  async refreshState(): Promise<void> {
    try {
      this.activeRun = await this.supervisor.getRun(this.runId);
      this.activeSpec = await this.supervisor.getSpec(this.runId);
      this.activeHistory = await this.supervisor.history();
      this.activeDynamicChecks = await this.supervisor.dynamicList();
    } catch {
      // Fallback
    }
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

    if (!this.activeRun || !this.activeSpec) {
      this.vstack.addChild(
        new Text(
          `\x1b[31mNo active Runbook FSM found for runId: '${this.runId || "active"}'. Start one with '/runbook start <preset>'.\x1b[0m\n\x1b[90m[q/Esc] Close\x1b[0m`,
          0,
          0
        )
      );
      return;
    }

    const state = this.activeRun;
    const spec = this.activeSpec;
    const humanState = RunbookHumanizer.humanizeState(state.current, spec.nodes[state.current], spec);

    // 1. Header
    const headerText = `\x1b[1;36m🗺️ LUMI RUNBOOK FSM: ${humanState.icon} ${RunbookHumanizer.formatTitle(spec.name).toUpperCase()}\x1b[0m  \x1b[90m[Run: ${state.runId} | Entry: #${state.currentEntryId.substring(0, 8)}]\x1b[0m`;
    this.vstack.addChild(new Text(headerText, 0, 0));

    // 2. Above-the-Fold Executive KPI Ribbon
    const filledBlocks = Math.round(humanState.progressPercent / 10);
    const progressBar = "█".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);
    const gateCount = (spec.nodes[state.current]?.beforeTransfer || []).length;
    const dynCount = this.activeDynamicChecks.length;
    const attempts = state.edgeAttempts[state.current] || 0;

    const kpiRibbon = [
      `\x1b[1;32m⚡ Progress: [${progressBar}] ${humanState.progressPercent}%\x1b[0m`,
      `\x1b[1;35m📍 Stage: ${humanState.displayName}\x1b[0m`,
      `\x1b[1;36m🛡️ Gates: ${gateCount} defined\x1b[0m`,
      `\x1b[1;33m🔬 Dynamic: ${dynCount} active\x1b[0m`,
      `\x1b[1;34m🔄 Attempts: ${attempts}\x1b[0m`,
    ].join("  ");
    this.vstack.addChild(new Text(kpiRibbon, 0, 0));

    // 3. Navigation View Filter Pills
    const p1 = this.viewMode === "pipeline" ? `\x1b[1;36;7m 1: Pipeline \x1b[0m` : `\x1b[90m1: Pipeline\x1b[0m`;
    const p2 = this.viewMode === "gates" ? `\x1b[1;32;7m 2: Gates \x1b[0m` : `\x1b[90m2: Gates\x1b[0m`;
    const p3 = this.viewMode === "dynamic" ? `\x1b[1;33;7m 3: Dynamic \x1b[0m` : `\x1b[90m3: Dynamic\x1b[0m`;
    const p4 = this.viewMode === "timeline" ? `\x1b[1;35;7m 4: Timeline \x1b[0m` : `\x1b[90m4: Timeline\x1b[0m`;
    const p5 = this.viewMode === "story" ? `\x1b[1;34;7m 5: Executive Story \x1b[0m` : `\x1b[90m5: Executive Story\x1b[0m`;

    this.vstack.addChild(new Text(`\x1b[90mViews:\x1b[0m ${p1}  ${p2}  ${p3}  ${p4}  ${p5}  \x1b[90m[v: Cycle View | ?: Help]\x1b[0m`, 0, 0));

    if (this.statusMessage) {
      this.vstack.addChild(new Text(`\x1b[1;33mℹ ${this.statusMessage}\x1b[0m`, 0, 0));
    }

    // 4. Help View Overlay
    if (this.isShowingHelp) {
      let helpMd = `## ⌨️ Runbook FSM Shortcuts & Approachable Navigation\n\n`;
      helpMd += `| Key | Action | Description |\n`;
      helpMd += `| :---: | :--- | :--- |\n`;
      helpMd += `| \`1\` - \`5\` | View Switch | Instantly switch between Pipeline, Gates, Dynamic, Timeline, and Story views |\n`;
      helpMd += `| \`v\` | Cycle View | Cycle sequentially through all 5 view modes |\n`;
      helpMd += `| \`j\` / \`k\` / \`↑\` / \`↓\` | Navigate | Select outgoing transition targets or gate items |\n`;
      helpMd += `| \`Enter\` / \`g\` | Advance Stage | Transition the workflow to the selected next stage (\`runbook_goto\`) |\n`;
      helpMd += `| \`s\` | Checkpoint | Commit state and execute node out-hook |\n`;
      helpMd += `| \`c\` | Compaction Prompt | View amnesia-proof \`/compact\` prompt for context hygiene |\n`;
      helpMd += `| \`r\` | Refresh State | Reload state and history from BroccoliDB substrate |\n`;
      helpMd += `| \`?\` | Help | Toggle this keyboard reference |\n`;
      helpMd += `| \`q\` / \`Esc\` | Close | Exit runbook dashboard modal |\n\n`;
      helpMd += `\x1b[90mPress [Esc], [Enter], or [?] to return to dashboard\x1b[0m`;
      this.vstack.addChild(new Markdown(helpMd, 0, 0, RUNBOOK_MARKDOWN_THEME));
      return;
    }

    // 5. Compaction Prompt View
    if (this.isShowingCompactPrompt) {
      const synth = new StatefulCompactionSynthesizer();
      const prompt = synth.synthesizeCompactionPrompt(state, spec);
      let compMd = `## 🧹 Amnesia-Proof Compaction Synthesis\n\n`;
      compMd += `\`\`\`text\n${prompt}\n\`\`\`\n\n`;
      compMd += `\x1b[90m[c] Close Prompt | [q/Esc] Return to Dashboard\x1b[0m`;
      this.vstack.addChild(new Markdown(compMd, 0, 0, RUNBOOK_MARKDOWN_THEME));
      return;
    }

    // 6. Mode: Pipeline View
    if (this.viewMode === "pipeline") {
      let md = `\n### 🚀 Visual Execution Pipeline\n\n`;
      md += `${RunbookHumanizer.renderAsciiPipeline(spec, state.current)}\n\n`;
      md += `**Active Stage Details**: ${humanState.summary}\n\n`;

      const outgoingEdges = (spec.edges || []).filter((e) => e.from === state.current);
      if (outgoingEdges.length === 0) {
        md += `\x1b[1;32m🏁 Terminal Node reached: No further transitions required.\x1b[0m\n`;
      } else {
        md += `### ➡️ Permitted Next Stages (${outgoingEdges.length})\n`;
        outgoingEdges.forEach((edge, idx) => {
          const isSelected = idx === this.selectedTransitionIndex;
          const selector = isSelected ? `\x1b[1;36m▶\x1b[0m` : ` `;
          const targetTitle = RunbookHumanizer.formatTitle(edge.to);
          const cond = edge.condition ? ` \x1b[90m— Condition: "${edge.condition}"\x1b[0m` : "";
          const maxAtt = edge.maxAttempts ? ` \x1b[33m(max ${edge.maxAttempts} attempts)\x1b[0m` : "";
          md += `${selector} **${idx + 1}. [Advance to ${targetTitle}]**${cond}${maxAtt}\n`;
        });
      }

      md += `\n\x1b[90m[Enter/g] Advance Stage | [v] Next View | [c] Compact Prompt | [?] Help | [q] Close\x1b[0m`;
      this.vstack.addChild(new Markdown(md, 0, 0, RUNBOOK_MARKDOWN_THEME));
      return;
    }

    // 7. Mode: Quality Gates View
    if (this.viewMode === "gates") {
      const currentNodeDef = spec.nodes[state.current];
      const beforeChecks = currentNodeDef?.beforeTransfer || [];
      const dynamicConfig = currentNodeDef?.dynamicBeforeTransfer;

      let md = `\n### 🛡️ Pre-Transfer Quality Gates for Stage '${humanState.displayName}'\n\n`;

      if (beforeChecks.length === 0 && !dynamicConfig?.required) {
        md += `\x1b[32m✔ No blocking gates required for this stage. Ready to advance.\x1b[0m\n`;
      } else {
        beforeChecks.forEach((check, idx) => {
          if (check.type === "predicate") {
            md += `• **Static Predicate**: \`${check.path}\` \x1b[90m(exists: ${check.exists ?? false}, nonEmpty: ${check.nonEmpty ?? false})\x1b[0m\n`;
            if (check.jsonPath) md += `  └─ JSONPath: \`${check.jsonPath}\` = \`${check.equals ?? check.oneOf}\`\n`;
          } else {
            md += `• **Checklist**: ${(check.items || []).join(", ")}\n`;
          }
        });

        if (dynamicConfig?.required) {
          const pass = this.activeDynamicChecks.length >= (dynamicConfig.minItems ?? 1);
          const icon = pass ? `\x1b[1;32m[✔ READY]\x1b[0m` : `\x1b[1;31m[⏳ PENDING]\x1b[0m`;
          md += `\n• **Dynamic Micro-Manifest Gate**: ${icon} Required min ${dynamicConfig.minItems ?? 1} item(s). Current registered: ${this.activeDynamicChecks.length}.\n`;
        }
      }

      md += `\n\x1b[90m[v] Next View | [s] Checkpoint | [?] Help | [q] Close\x1b[0m`;
      this.vstack.addChild(new Markdown(md, 0, 0, RUNBOOK_MARKDOWN_THEME));
      return;
    }

    // 8. Mode: Dynamic Checks View
    if (this.viewMode === "dynamic") {
      let md = `\n### 🔬 Entry-Scoped Dynamic Verification Manifests (#${state.currentEntryId.substring(0, 8)})\n\n`;

      if (this.activeDynamicChecks.length === 0) {
        md += `\x1b[90mNo dynamic micro-checks registered for this entry yet. Register using 'runbook_dynamic_write'.\x1b[0m\n`;
      } else {
        this.activeDynamicChecks.forEach((manifest, idx) => {
          md += `• **Manifest #${idx + 1}** (Producer: \`${manifest.producer?.role || "agent"}\`)\n`;
          if (manifest.basis?.taskContract) md += `  └─ Contract: *${manifest.basis.taskContract}*\n`;
          manifest.checks.forEach((chk) => {
            const blockBadge = chk.blocking ? `\x1b[1;31m[BLOCKING]\x1b[0m` : `\x1b[90m[ADVISORY]\x1b[0m`;
            md += `    • ${blockBadge} \`${chk.type}\` ${chk.path ? `(${chk.path})` : ""}\n`;
            if (chk.reason) md += `      └─ Reason: *${chk.reason}*\n`;
          });
        });
      }

      md += `\n\x1b[90m[v] Next View | [?] Help | [q] Close\x1b[0m`;
      this.vstack.addChild(new Markdown(md, 0, 0, RUNBOOK_MARKDOWN_THEME));
      return;
    }

    // 9. Mode: Timeline & WAL History View
    if (this.viewMode === "timeline") {
      let md = `\n### 📜 Chronological Transition Audit Trail (${this.activeHistory.length} events)\n\n`;

      if (this.activeHistory.length === 0) {
        md += `\x1b[90mNo historical transitions logged yet.\x1b[0m\n`;
      } else {
        this.activeHistory.slice(-8).forEach((evt) => {
          const isSuccess = evt.event !== "goto_blocked";
          const statusIcon = isSuccess ? `\x1b[1;32m[✓]\x1b[0m` : `\x1b[1;31m[🛑 BLOCKED]\x1b[0m`;
          const time = new Date(evt.timestamp).toLocaleTimeString();
          const from = evt.from ? RunbookHumanizer.formatTitle(evt.from) : "Start";
          const to = evt.to ? RunbookHumanizer.formatTitle(evt.to) : "Target";

          md += `• ${statusIcon} **${time}** — \`${evt.event}\`: ${from} ──► ${to}\n`;
        });
      }

      md += `\n\x1b[90m[v] Next View | [?] Help | [q] Close\x1b[0m`;
      this.vstack.addChild(new Markdown(md, 0, 0, RUNBOOK_MARKDOWN_THEME));
      return;
    }

    // 10. Mode: Plain-English Executive Story
    if (this.viewMode === "story") {
      const story = RunbookHumanizer.humanizeStory(state, spec, this.activeHistory);
      let md = `\n### 📖 Plain-English Stakeholder Story\n\n`;
      md += `${story.plainSummary}\n\n`;

      md += `### 🛠️ Accomplished Stages\n`;
      story.whatWasDone.forEach((item) => {
        md += `• ${item}\n`;
      });

      md += `\n### 🔜 Upcoming Steps\n`;
      story.whatWillHappenNext.forEach((step) => {
        md += `• ${step}\n`;
      });

      md += `\n\x1b[90m[v] Next View | [?] Help | [q] Close\x1b[0m`;
      this.vstack.addChild(new Markdown(md, 0, 0, RUNBOOK_MARKDOWN_THEME));
      return;
    }
  }

  handleKey(key: string): boolean {
    if (matchesKey(key, "escape") || key === "q") {
      if (this.isShowingHelp || this.isShowingCompactPrompt) {
        this.isShowingHelp = false;
        this.isShowingCompactPrompt = false;
        this.invalidate();
        return true;
      }
      this.onClose();
      return true;
    }

    if (key === "?") {
      this.isShowingHelp = !this.isShowingHelp;
      this.invalidate();
      return true;
    }

    if (key === "c") {
      this.isShowingCompactPrompt = !this.isShowingCompactPrompt;
      this.invalidate();
      return true;
    }

    if (key === "1") {
      this.viewMode = "pipeline";
      this.invalidate();
      return true;
    }
    if (key === "2") {
      this.viewMode = "gates";
      this.invalidate();
      return true;
    }
    if (key === "3") {
      this.viewMode = "dynamic";
      this.invalidate();
      return true;
    }
    if (key === "4") {
      this.viewMode = "timeline";
      this.invalidate();
      return true;
    }
    if (key === "5") {
      this.viewMode = "story";
      this.invalidate();
      return true;
    }

    if (key === "v") {
      const modes: RunbookDashboardViewMode[] = ["pipeline", "gates", "dynamic", "timeline", "story"];
      const nextIndex = (modes.indexOf(this.viewMode) + 1) % modes.length;
      this.viewMode = modes[nextIndex];
      this.invalidate();
      return true;
    }

    if (key === "r") {
      this.statusMessage = "Reloading runbook state from BroccoliDB...";
      this.refreshState().then(() => {
        this.statusMessage = "Refreshed state successfully.";
        this.invalidate();
      });
      return true;
    }

    if (matchesKey(key, "up") || key === "k") {
      this.selectedTransitionIndex = Math.max(0, this.selectedTransitionIndex - 1);
      this.invalidate();
      return true;
    }

    if (matchesKey(key, "down") || key === "j") {
      const outgoingEdges = (this.activeSpec?.edges || []).filter(
        (e) => e.from === this.activeRun?.current
      );
      this.selectedTransitionIndex = Math.min(
        Math.max(0, outgoingEdges.length - 1),
        this.selectedTransitionIndex + 1
      );
      this.invalidate();
      return true;
    }

    if (matchesKey(key, "enter") || key === "g") {
      if (!this.activeRun || !this.activeSpec) return false;
      const outgoingEdges = (this.activeSpec.edges || []).filter(
        (e) => e.from === this.activeRun?.current
      );
      const targetEdge = outgoingEdges[this.selectedTransitionIndex];
      if (targetEdge) {
        this.statusMessage = `Transitioning to '${targetEdge.to}'...`;
        this.supervisor
          .goto(targetEdge.to, this.activeRun.runId)
          .then((res) => {
            this.statusMessage = `Advanced to stage '${res.current}'.`;
            this.selectedTransitionIndex = 0;
            return this.refreshState();
          })
          .catch((err) => {
            this.statusMessage = `Transition Blocked: ${err.message}`;
            return this.refreshState();
          });
      }
      return true;
    }

    if (key === "s") {
      if (this.activeRun) {
        this.statusMessage = "Saving state checkpoint...";
        this.supervisor
          .save({ runId: this.activeRun.runId })
          .then((res) => {
            this.statusMessage = `State checkpoint committed for stage '${res.current}'.`;
            this.invalidate();
          })
          .catch((err) => {
            this.statusMessage = `Save failed: ${err.message}`;
            this.invalidate();
          });
      }
      return true;
    }

    return false;
  }

  render(width: number): string[] {
    return this.container.render(width);
  }
}
