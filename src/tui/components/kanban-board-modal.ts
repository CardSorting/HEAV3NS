/**
 * kanban-board-modal.ts
 *
 * Interactive TUI Kanban Board Modal with Keyboard Navigation,
 * Above-the-Fold Executive KPI Ribbon, Quick Filter Pills,
 * DAG Dependency Tree Visualizer, Desktop Notification Trigger, Task Inspector,
 * and Responsive Multi-Column Views (ADR-118).
 */

import type { Component, Focusable } from "../tui.js";
import { Box } from "./box.js";
import { VStack } from "./v-stack.js";
import { Text } from "./text.js";
import { Markdown, type MarkdownTheme } from "./markdown.js";
import { matchesKey } from "../keys.js";
import type {
  KanbanBoard,
  KanbanColumn,
  KanbanGroupBy,
  KanbanGroupedSwimlane,
  KanbanSortBy,
  KanbanSortDirection,
  KanbanTask,
} from "../../core/contracts/kanban.contracts.js";
import type { KanbanBoardSupervisor } from "../../agents/extensions/kanban/kanban-board-supervisor.js";

const KANBAN_MARKDOWN_THEME: MarkdownTheme = {
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

export class KanbanBoardModal implements Component, Focusable {
  focused: boolean = true;
  private readonly container: Box;
  private readonly vstack: VStack;
  private readonly supervisor: KanbanBoardSupervisor;
  private readonly boardId: string;
  private readonly onClose: () => void;

  private selectedColumnIndex: number = 0;
  private selectedTaskIndex: number = 0;
  private groupBy: KanbanGroupBy = "column";
  private sortBy: KanbanSortBy = "priority";
  private sortDir: KanbanSortDirection = "desc";
  private filterPreset: "all" | "urgent" | "blocked" | "in_progress" | "done" = "all";
  private searchQuery: string = "";
  private isInspecting: boolean = false;
  private isShowingHelp: boolean = false;
  private isShowingDag: boolean = false;
  private inspectedTask?: KanbanTask;
  private statusMessage: string = "";

  constructor(
    supervisor: KanbanBoardSupervisor,
    boardId: string = "default",
    onClose: () => void
  ) {
    this.supervisor = supervisor;
    this.boardId = boardId;
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

    const board = this.supervisor.getBoard(this.boardId);
    if (!board) {
      this.vstack.addChild(new Text(`\x1b[31mBoard '${this.boardId}' not found\x1b[0m`, 0, 0));
      return;
    }

    // Header
    const headerText = `\x1b[1;36m📋 LUMI KANBAN: ${board.title.toUpperCase()}\x1b[0m  \x1b[90m[Group: ${this.groupBy} | Sort: ${this.sortBy} (${this.sortDir}) | View: ${this.isShowingDag ? "DAG Graph" : "Swimlanes"}]\x1b[0m`;
    this.vstack.addChild(new Text(headerText, 0, 0));

    // Above-the-fold Executive KPI Ribbon
    const allTasks = board.tasks;
    const totalCount = allTasks.length;
    const doneCount = allTasks.filter((t) => t.column === "done").length;
    const blockedCount = allTasks.filter((t) => t.column === "blocked").length;
    const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const totalPoints = allTasks.reduce((acc, t) => acc + (t.estimatePoints || 0), 0);
    const filledBlocks = Math.round(progressPct / 10);
    const progressBar = "█".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);

    const kpiLine = `\x1b[1;32m⚡ Progress: [${progressBar}] ${progressPct}%\x1b[0m  \x1b[1;31m🛑 Blocked: ${blockedCount}\x1b[0m  \x1b[1;35m📊 Points: ${totalPoints}\x1b[0m  \x1b[90mTotal: ${totalCount}\x1b[0m`;
    this.vstack.addChild(new Text(kpiLine, 0, 0));

    // Above-the-fold Quick Filters Bar
    const p1 = this.filterPreset === "all" ? `\x1b[1;36m[1: All]\x1b[0m` : `\x1b[90m1: All\x1b[0m`;
    const p2 = this.filterPreset === "urgent" ? `\x1b[1;31m[2: 🔥 Urgent]\x1b[0m` : `\x1b[90m2: Urgent\x1b[0m`;
    const p3 = this.filterPreset === "blocked" ? `\x1b[1;31m[3: 🛑 Blocked]\x1b[0m` : `\x1b[90m3: Blocked\x1b[0m`;
    const p4 = this.filterPreset === "in_progress" ? `\x1b[1;33m[4: 🚀 In Progress]\x1b[0m` : `\x1b[90m4: In Progress\x1b[0m`;
    const p5 = this.filterPreset === "done" ? `\x1b[1;32m[5: ✓ Done]\x1b[0m` : `\x1b[90m5: Done\x1b[0m`;
    this.vstack.addChild(new Text(`\x1b[90mFilters:\x1b[0m ${p1}  ${p2}  ${p3}  ${p4}  ${p5}  \x1b[90m[v: Toggle DAG Graph]\x1b[0m`, 0, 0));

    if (this.statusMessage) {
      this.vstack.addChild(new Text(`\x1b[1;33mℹ ${this.statusMessage}\x1b[0m`, 0, 0));
    }

    if (this.isShowingHelp) {
      let helpMd = `## ⌨️ Keyboard Shortcuts & Familiar Navigation\n\n`;
      helpMd += `| Key | Action | Description |\n`;
      helpMd += `| :---: | :--- | :--- |\n`;
      helpMd += `| \`h\` / \`l\` / \`←\` / \`→\` | Select Swimlane | Navigate across columns horizontally |\n`;
      helpMd += `| \`j\` / \`k\` / \`↑\` / \`↓\` | Select Task | Navigate task cards vertically |\n`;
      helpMd += `| \`Enter\` | Inspect Task | Open full task details & comments |\n`;
      helpMd += `| \`m\` / \`Space\` | Advance Stage | Move task forward in workflow sequence |\n`;
      helpMd += `| \`v\` | Toggle View | Switch between Swimlanes and DAG Dependency Tree |\n`;
      helpMd += `| \`n\` / \`c\` | New Task | Quickly spawn a new task card |\n`;
      helpMd += `| \`b\` | Block Task | Mark task as blocked with input prompt |\n`;
      helpMd += `| \`u\` | Unblock Task | Unblock task and resume lifecycle |\n`;
      helpMd += `| \`d\` | Desktop Alert | Trigger test desktop notification |\n`;
      helpMd += `| \`g\` | Cycle Grouping | Switch grouping (Status, Priority, Assignee, Blocked) |\n`;
      helpMd += `| \`s\` | Cycle Sorting | Switch sorting (Priority, Due Date, Points, Recency) |\n`;
      helpMd += `| \`1\` - \`5\` | Filter Pills | Switch quick filter presets |\n`;
      helpMd += `| \`z\` | Undo Mutation | Undo the last board mutation |\n`;
      helpMd += `| \`q\` / \`Esc\` | Close / Back | Return to previous view or exit |\n\n`;
      helpMd += `\x1b[90mPress [Esc], [Enter], or [?] to dismiss help\x1b[0m`;
      this.vstack.addChild(new Markdown(helpMd, 0, 0, KANBAN_MARKDOWN_THEME));
      return;
    }

    if (this.isShowingDag) {
      // Visual ASCII DAG Dependency Graph
      const graph = this.supervisor.renderDagGraph(this.boardId);
      this.vstack.addChild(new Text(`\n${graph}\n\n\x1b[90m[v] Back to Swimlanes | [?] Help | [q/Esc] Close\x1b[0m`, 0, 0));
      return;
    }

    if (this.isInspecting && this.inspectedTask) {
      // Task Inspector Modal View
      const t = this.inspectedTask;
      const details = this.supervisor.getTaskDetails(t.id, this.boardId);
      let md = `## 🔍 Task Inspector: #${t.id} - ${t.title}\n\n`;
      md += `- **Column / State**: \`${t.column.toUpperCase()}\`\n`;
      md += `- **Priority**: \`${t.priority.toUpperCase()}\` (Weight: ${t.priorityWeight})\n`;
      md += `- **Assignee**: ${t.assignee ? `\`@${t.assignee}\`` : "_Unassigned_"}\n`;
      md += `- **Owner**: ${t.owner || "_System_"}\n`;
      if (t.tags && t.tags.length > 0) md += `- **Tags**: ${t.tags.map((tg) => `\`#${tg}\``).join(", ")}\n`;
      if (t.estimatePoints) md += `- **Estimate**: \`${t.estimatePoints} pts\`\n`;
      if (t.dueDateMs) md += `- **Due Date**: \`${new Date(t.dueDateMs).toLocaleString()}\`\n`;
      if (t.blockKind || t.blockReason) {
        md += `\n> 🛑 **BLOCKED (${t.blockKind || "custom"})**: ${t.blockReason || "None"}\n`;
      }
      if (t.subtaskChecklist && t.subtaskChecklist.length > 0) {
        md += `\n### Subtask Checklist\n`;
        for (const item of t.subtaskChecklist) {
          md += `- [${item.done ? "x" : " "}] ${item.text}\n`;
        }
      }
      if (t.description) md += `\n### Description\n${t.description}\n`;

      if (details && details.comments.length > 0) {
        md += `\n### Discussion Comments (${details.comments.length})\n`;
        for (const c of details.comments) {
          md += `- **@${c.author}** (${new Date(c.createdAtMs).toLocaleTimeString()}): ${c.content}\n`;
        }
      }

      md += `\n\x1b[90m[Esc/Enter/q] Back to Board | [m] Move | [b] Block | [u] Unblock | [c] Claim\x1b[0m`;
      this.vstack.addChild(new Markdown(md, 0, 0, KANBAN_MARKDOWN_THEME));
    } else {
      // Swimlanes Browser View
      const lanes = this.getVisibleLanes();

      // Clamp indices
      if (this.selectedColumnIndex >= lanes.length) {
        this.selectedColumnIndex = Math.max(0, lanes.length - 1);
      }
      const currentLane = lanes[this.selectedColumnIndex];
      if (currentLane && this.selectedTaskIndex >= currentLane.tasks.length) {
        this.selectedTaskIndex = Math.max(0, currentLane.tasks.length - 1);
      }

      let md = `\n`;
      lanes.forEach((lane, colIdx) => {
        const isColSelected = colIdx === this.selectedColumnIndex;
        const colPrefix = isColSelected ? `▶ ` : `  `;
        const colTitle = isColSelected
          ? `**\x1b[1;32m${colPrefix}${lane.title} (${lane.count})\x1b[0m**`
          : `\x1b[90m${colPrefix}${lane.title} (${lane.count})\x1b[0m`;

        md += `### ${colTitle}\n`;

        if (lane.tasks.length === 0) {
          md += `  \x1b[90m(No matching tasks in this lane)\x1b[0m\n`;
        } else {
          lane.tasks.forEach((task, taskIdx) => {
            const isTaskSelected = isColSelected && taskIdx === this.selectedTaskIndex;
            const taskPrefix = isTaskSelected ? `\x1b[1;36m➜\x1b[0m ` : `  • `;
            const badge = `\`[${task.priority.toUpperCase()}]\``;
            const blocked = task.column === "blocked" ? ` \x1b[1;31m[🛑 BLOCKED]\x1b[0m` : "";
            const assignee = task.assignee ? ` \x1b[90m(@${task.assignee})\x1b[0m` : "";
            const checklistProgress = task.subtaskChecklist && task.subtaskChecklist.length > 0
              ? ` \x1b[36m[✓ ${task.subtaskChecklist.filter((i) => i.done).length}/${task.subtaskChecklist.length}]\x1b[0m`
              : "";

            if (isTaskSelected) {
              md += `${taskPrefix}**\x1b[1;37m[#${task.id}] ${task.title}\x1b[0m** ${badge}${blocked}${checklistProgress}${assignee}\n`;
            } else {
              md += `${taskPrefix}[#${task.id}] ${task.title} ${badge}${blocked}${checklistProgress}${assignee}\n`;
            }
          });
        }
        md += `\n`;
      });

      md += `\x1b[90m[h/l] Lane | [j/k] Task | [Enter] Inspect | [m] Move | [v] DAG Graph | [n] New | [b] Block | [u] Unblock | [1-5] Filters | [?] Help | [q] Close\x1b[0m`;
      this.vstack.addChild(new Markdown(md, 0, 0, KANBAN_MARKDOWN_THEME));
    }
  }

  private getVisibleLanes(): readonly KanbanGroupedSwimlane[] {
    const rawLanes = this.supervisor.getGroupedTasks(
      this.boardId,
      this.groupBy,
      this.sortBy,
      this.sortDir,
      { query: this.searchQuery || undefined }
    );

    if (this.filterPreset === "all") return rawLanes;

    return rawLanes.map((lane) => {
      const filteredTasks = lane.tasks.filter((t) => {
        if (this.filterPreset === "urgent") return t.priority === "urgent" || t.priority === "critical";
        if (this.filterPreset === "blocked") return t.column === "blocked";
        if (this.filterPreset === "in_progress") return t.column === "in_progress";
        if (this.filterPreset === "done") return t.column === "done";
        return true;
      });
      return {
        ...lane,
        tasks: filteredTasks,
        count: filteredTasks.length,
      };
    });
  }

  handleInput(data: string): void {
    if (this.isShowingHelp) {
      if (matchesKey(data, "escape") || data === "q" || data === "Q" || matchesKey(data, "return") || data === "?") {
        this.isShowingHelp = false;
        this.invalidate();
        return;
      }
    }

    if (this.isShowingDag) {
      if (matchesKey(data, "escape") || data === "q" || data === "Q" || data === "v" || data === "V") {
        this.isShowingDag = false;
        this.invalidate();
        return;
      }
    }

    if (this.isInspecting) {
      if (matchesKey(data, "escape") || data === "q" || data === "Q" || matchesKey(data, "return")) {
        this.isInspecting = false;
        this.statusMessage = "";
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

    if (data === "v" || data === "V") {
      this.isShowingDag = !this.isShowingDag;
      this.statusMessage = this.isShowingDag ? "View: DAG Dependency Tree" : "View: Swimlanes";
      this.invalidate();
      return;
    }

    // Number keys for filter pills
    if (data === "1") { this.filterPreset = "all"; this.statusMessage = "Filter: All Tasks"; this.invalidate(); return; }
    if (data === "2") { this.filterPreset = "urgent"; this.statusMessage = "Filter: Urgent / Critical Tasks"; this.invalidate(); return; }
    if (data === "3") { this.filterPreset = "blocked"; this.statusMessage = "Filter: Blocked Tasks"; this.invalidate(); return; }
    if (data === "4") { this.filterPreset = "in_progress"; this.statusMessage = "Filter: In Progress Tasks"; this.invalidate(); return; }
    if (data === "5") { this.filterPreset = "done"; this.statusMessage = "Filter: Done Tasks"; this.invalidate(); return; }

    const lanes = this.getVisibleLanes();
    const currentLane = lanes[this.selectedColumnIndex];

    // Navigation
    if (matchesKey(data, "left") || data === "h" || data === "H") {
      if (this.selectedColumnIndex > 0) {
        this.selectedColumnIndex--;
        this.selectedTaskIndex = 0;
        this.statusMessage = "";
        this.invalidate();
      }
    } else if (matchesKey(data, "right") || data === "l" || data === "L" || matchesKey(data, "tab")) {
      if (this.selectedColumnIndex < lanes.length - 1) {
        this.selectedColumnIndex++;
        this.selectedTaskIndex = 0;
        this.statusMessage = "";
        this.invalidate();
      }
    } else if (matchesKey(data, "up") || data === "k" || data === "K") {
      if (this.selectedTaskIndex > 0) {
        this.selectedTaskIndex--;
        this.statusMessage = "";
        this.invalidate();
      }
    } else if (matchesKey(data, "down") || data === "j" || data === "J") {
      if (currentLane && this.selectedTaskIndex < currentLane.tasks.length - 1) {
        this.selectedTaskIndex++;
        this.statusMessage = "";
        this.invalidate();
      }
    } else if (matchesKey(data, "return")) {
      if (currentLane && currentLane.tasks[this.selectedTaskIndex]) {
        this.inspectedTask = currentLane.tasks[this.selectedTaskIndex];
        this.isInspecting = true;
        this.invalidate();
      }
    } else if (data === "m" || data === "M" || data === " ") {
      // Move task to next workflow stage
      if (currentLane && currentLane.tasks[this.selectedTaskIndex]) {
        const t = currentLane.tasks[this.selectedTaskIndex];
        const nextCol = this.getNextColumn(t.column);
        const res = this.supervisor.updateTask(this.boardId, t.id, { column: nextCol });
        if (res.success) {
          this.statusMessage = `Task #${t.id} moved to ${nextCol}`;
        } else {
          this.statusMessage = res.error || "Cannot move task";
        }
        this.invalidate();
      }
    } else if (data === "n" || data === "N" || data === "c" || data === "C") {
      // Quick create task
      const res = this.supervisor.createTask({
        boardId: this.boardId,
        title: `Quick Task #${Date.now().toString().slice(-4)}`,
        priority: "medium",
        column: "todo",
      });
      if (res.success) {
        this.statusMessage = `Created Task #${res.task?.id}`;
      }
      this.invalidate();
    } else if (data === "b" || data === "B") {
      // Quick block
      if (currentLane && currentLane.tasks[this.selectedTaskIndex]) {
        const t = currentLane.tasks[this.selectedTaskIndex];
        const res = this.supervisor.blockTask(this.boardId, t.id, "needs_input", "Waiting on review / inputs");
        if (res.success) {
          this.statusMessage = `Task #${t.id} marked as BLOCKED`;
        }
        this.invalidate();
      }
    } else if (data === "u" || data === "U") {
      // Quick unblock
      if (currentLane && currentLane.tasks[this.selectedTaskIndex]) {
        const t = currentLane.tasks[this.selectedTaskIndex];
        const res = this.supervisor.unblockTask(this.boardId, t.id, "Manually unblocked in TUI");
        if (res.success) {
          this.statusMessage = `Task #${t.id} unblocked`;
        }
        this.invalidate();
      }
    } else if (data === "d" || data === "D") {
      // Trigger desktop notification test
      this.supervisor.getSubstrate().getNotificationDispatcher().dispatch({
        boardId: this.boardId,
        title: "TUI Desktop Notification",
        message: "Interactive notification from LUMI Kanban TUI",
        urgency: "normal",
        trigger: "custom",
      }).catch(() => {});
      this.statusMessage = "Desktop Notification dispatched!";
      this.invalidate();
    } else if (data === "g" || data === "G") {
      // Cycle grouping
      const groups: KanbanGroupBy[] = ["column", "priority", "assignee", "category", "blocked"];
      const nextIdx = (groups.indexOf(this.groupBy) + 1) % groups.length;
      this.groupBy = groups[nextIdx];
      this.selectedColumnIndex = 0;
      this.selectedTaskIndex = 0;
      this.statusMessage = `Group by: ${this.groupBy}`;
      this.invalidate();
    } else if (data === "s" || data === "S") {
      // Cycle sorting
      const sorts: KanbanSortBy[] = ["priority", "dueDate", "estimate", "updated", "title"];
      const nextIdx = (sorts.indexOf(this.sortBy) + 1) % sorts.length;
      this.sortBy = sorts[nextIdx];
      this.statusMessage = `Sort by: ${this.sortBy}`;
      this.invalidate();
    } else if (data === "z" || data === "Z") {
      // Undo
      const res = this.supervisor.undo(this.boardId);
      if (res.success) {
        this.statusMessage = `Undid mutation on #${res.restoredTask?.id}`;
      } else {
        this.statusMessage = "Nothing to undo";
      }
      this.invalidate();
    }
  }

  private getNextColumn(current: KanbanColumn): KanbanColumn {
    const sequence: KanbanColumn[] = ["triage", "backlog", "todo", "ready", "in_progress", "review", "done"];
    const idx = sequence.indexOf(current);
    if (idx >= 0 && idx < sequence.length - 1) {
      return sequence[idx + 1];
    }
    return "done";
  }

  render(width: number): string[] {
    return this.container.render(width);
  }
}
