/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-view-renderer.ts
 *
 * Human-Centric Visual Views & Spreadsheet/Kanban Renderer (Phase 73 / ADR-122).
 *
 * Renders structured BroccoliDbTable records into beautiful CLI Spreadsheet tables,
 * responsive side-by-side & stacked Kanban swimlane layouts, and side-by-side Table Diffs for non-technical users
 * and LLM model inspection.
 */

import type {
  KanbanViewOptions,
  SpreadsheetViewOptions,
  TableDiffViewResult,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliViewRenderer {
  /**
   * Renders records into a rich CLI spreadsheet grid table.
   */
  static renderSpreadsheet<T extends object = Record<string, unknown>>(
    tableName: string,
    records: readonly T[],
    options: SpreadsheetViewOptions = {}
  ): string {
    if (records.length === 0) {
      return `┌────────────────────────────────────────────────────────┐\n│ Table '${tableName}' is empty (0 records)                 │\n└────────────────────────────────────────────────────────┘`;
    }

    const maxColWidth = options.maxColumnWidth ?? 30;
    const limit = options.limit !== undefined ? options.limit : records.length;
    const visibleRecords = records.slice(0, limit);

    // Determine columns
    let columns: string[];
    if (options.columns && options.columns.length > 0) {
      columns = [...options.columns];
    } else {
      const colSet = new Set<string>(["id"]);
      for (const r of visibleRecords) {
        for (const k of Object.keys(r)) colSet.add(k);
      }
      columns = Array.from(colSet);
    }

    // Calculate column widths
    const widths: Record<string, number> = {};
    for (const col of columns) {
      let maxLen = col.length;
      for (const r of visibleRecords) {
        const valStr = this.formatCell((r as Record<string, unknown>)[col]);
        if (valStr.length > maxLen) maxLen = valStr.length;
      }
      widths[col] = Math.min(maxColWidth, Math.max(6, maxLen));
    }

    // Draw header
    const sepLine = `+` + columns.map((c) => "-".repeat(widths[c] + 2)).join("+") + `+`;
    const headerLine =
      `|` +
      columns
        .map((c) => {
          const padded = c.slice(0, widths[c]).padEnd(widths[c], " ");
          return ` ${padded} `;
        })
        .join("|") +
      `|`;

    const rows: string[] = [sepLine, headerLine, sepLine];

    // Draw data rows
    for (const r of visibleRecords) {
      const rowLine =
        `|` +
        columns
          .map((c) => {
            const rawStr = this.formatCell((r as Record<string, unknown>)[c]);
            const truncated = rawStr.length > widths[c] ? rawStr.slice(0, widths[c] - 1) + "…" : rawStr;
            const padded = truncated.padEnd(widths[c], " ");
            return ` ${padded} `;
          })
          .join("|") +
        `|`;
      rows.push(rowLine);
    }

    rows.push(sepLine);

    // Footer stats if requested
    if (options.includeStatsFooter) {
      const footer = `| Total: ${records.length} records (showing ${visibleRecords.length})`.padEnd(
        sepLine.length - 1,
        " "
      ) + `|`;
      rows.push(footer);
      rows.push(sepLine);
    }

    return rows.join("\n");
  }

  /**
   * Renders records into a responsive multi-column or stacked Kanban board swimlane.
   */
  static renderKanban<T extends object = Record<string, unknown>>(
    tableName: string,
    records: readonly T[],
    options: KanbanViewOptions
  ): string {
    const groupCol = options.groupByColumn;
    const titleCol = options.titleColumn ?? "title";
    const cardLimit = options.cardLimitPerLane ?? 10;

    const lanes = new Map<string, (Record<string, unknown>)[]>();

    for (const r of records) {
      const rec = r as Record<string, unknown>;
      const laneKey = String(rec[groupCol] ?? "Unassigned");
      let laneList = lanes.get(laneKey);
      if (!laneList) {
        laneList = [];
        lanes.set(laneKey, laneList);
      }
      laneList.push(rec);
    }

    const termCols = (process.stdout && process.stdout.columns) ? process.stdout.columns : 100;
    const isWide = termCols >= 110 && lanes.size <= 4;

    const lines: string[] = [
      `================================================================================`,
      ` 📋 Kanban Board: ${tableName} (Grouped by '${groupCol}') - ${records.length} total tasks`,
      `================================================================================`,
    ];

    if (isWide && lanes.size > 1) {
      // Responsive multi-column side-by-side grid rendering
      const laneNames = Array.from(lanes.keys());
      const colWidth = Math.floor((termCols - (laneNames.length + 1)) / laneNames.length);

      const topBorder = `┌` + laneNames.map(() => "─".repeat(colWidth)).join("┬") + `┐`;
      const midBorder = `├` + laneNames.map(() => "─".repeat(colWidth)).join("┼") + `┤`;
      const botBorder = `└` + laneNames.map(() => "─".repeat(colWidth)).join("┴") + `┘`;

      const headerRow = `│` + laneNames.map((name) => {
        const count = lanes.get(name)?.length || 0;
        const text = `${name.toUpperCase()} (${count})`;
        return ` ${text.slice(0, colWidth - 2).padEnd(colWidth - 2, " ")} `;
      }).join("│") + `│`;

      lines.push(topBorder, headerRow, midBorder);

      // Determine max rows
      let maxCards = 0;
      for (const list of lanes.values()) {
        if (list.length > maxCards) maxCards = list.length;
      }
      const visibleRows = Math.min(maxCards, cardLimit);

      for (let r = 0; r < visibleRows; r++) {
        const rowLine = `│` + laneNames.map((name) => {
          const list = lanes.get(name) || [];
          const card = list[r];
          if (!card) return " ".repeat(colWidth);
          const id = card.id ?? card._id ?? card.key ?? "item";
          const title = card[titleCol] ?? "(untitled)";
          const p = card.priority ? `[${String(card.priority).charAt(0).toUpperCase()}] ` : "";
          const str = `${p}#${id}: ${title}`;
          const truncated = str.length > colWidth - 2 ? str.slice(0, colWidth - 3) + "…" : str;
          return ` ${truncated.padEnd(colWidth - 2, " ")} `;
        }).join("│") + `│`;
        lines.push(rowLine);
      }

      lines.push(botBorder);
    } else {
      // Stacked swimlane layout with rich badges
      for (const [laneName, cardList] of lanes.entries()) {
        lines.push(`\n[ ${laneName.toUpperCase()} ] (${cardList.length} cards)`);
        lines.push(`────────────────────────────────────────────────────────────────`);
        const visibleCards = cardList.slice(0, cardLimit);
        for (const card of visibleCards) {
          const id = card.id ?? card._id ?? card.key ?? "item";
          const title = card[titleCol] ?? "(untitled)";
          const p = card.priority ? `[${card.priority}] ` : "";
          const assignee = card.assignee ? ` @${card.assignee}` : "";
          const blocked = card.column === "blocked" || card.blockKind ? ` 🛑 BLOCKED` : "";
          lines.push(`  • [${id}] ${p}${title}${assignee}${blocked}`);
        }
        if (cardList.length > cardLimit) {
          lines.push(`    ↳ ... and ${cardList.length - cardLimit} more`);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Generates a side-by-side Table Diff between two snapshots.
   */
  static renderDiff<T extends object = Record<string, unknown>>(
    tableName: string,
    currentSnapshot: Map<string, T>,
    otherSnapshot: Map<string, T>
  ): TableDiffViewResult {
    let addedCount = 0;
    let modifiedCount = 0;
    let deletedCount = 0;
    const diffLines: string[] = [`--- Table Diff: ${tableName} ---`];

    // Check added and modified
    for (const [id, currentRec] of currentSnapshot.entries()) {
      const oldRec = otherSnapshot.get(id);
      if (!oldRec) {
        addedCount++;
        diffLines.push(`+ [INSERT] ${id}: ${JSON.stringify(currentRec)}`);
      } else {
        const currentStr = JSON.stringify(currentRec);
        const oldStr = JSON.stringify(oldRec);
        if (currentStr !== oldStr) {
          modifiedCount++;
          diffLines.push(`~ [UPDATE] ${id}:`);
          for (const k of new Set([...Object.keys(oldRec), ...Object.keys(currentRec)])) {
            const oldVal = (oldRec as Record<string, unknown>)[k];
            const currVal = (currentRec as Record<string, unknown>)[k];
            if (oldVal !== currVal) {
              diffLines.push(`    ${k}: ${JSON.stringify(oldVal)} -> ${JSON.stringify(currVal)}`);
            }
          }
        }
      }
    }

    // Check deleted
    for (const [id, oldRec] of otherSnapshot.entries()) {
      if (!currentSnapshot.has(id)) {
        deletedCount++;
        diffLines.push(`- [DELETE] ${id}: ${JSON.stringify(oldRec)}`);
      }
    }

    if (addedCount === 0 && modifiedCount === 0 && deletedCount === 0) {
      diffLines.push(`(No differences detected - tables are identical)`);
    }

    return {
      table: tableName,
      addedCount,
      modifiedCount,
      deletedCount,
      formattedDiff: diffLines.join("\n"),
    };
  }

  /**
   * Renders a clean visual ASCII / Unicode DAG dependency graph of tasks.
   */
  static renderDependencyGraph<T extends { id: string; title: string; column?: string; priority?: string; blockedBy?: readonly string[] }>(
    tableName: string,
    tasks: readonly T[]
  ): string {
    if (tasks.length === 0) {
      return `┌────────────────────────────────────────────────────────┐\n│ Dependency DAG for '${tableName}' is empty              │\n└────────────────────────────────────────────────────────┘`;
    }

    const lines: string[] = [
      `================================================================================`,
      ` 🌲 Task Dependency DAG & Blocker Graph: ${tableName} (${tasks.length} tasks)`,
      `================================================================================`,
    ];

    const taskMap = new Map<string, T>();
    for (const t of tasks) taskMap.set(t.id, t);

    // Find root tasks (tasks not blocked by anything)
    const roots = tasks.filter((t) => !t.blockedBy || t.blockedBy.length === 0);
    const dependentsMap = new Map<string, string[]>();

    for (const t of tasks) {
      if (t.blockedBy) {
        for (const bId of t.blockedBy) {
          const list = dependentsMap.get(bId) || [];
          list.push(t.id);
          dependentsMap.set(bId, list);
        }
      }
    }

    const visited = new Set<string>();

    const printNode = (taskId: string, prefix: string, isTail: boolean) => {
      visited.add(taskId);
      const t = taskMap.get(taskId);
      if (!t) {
        lines.push(`${prefix}${isTail ? "└── " : "├── "}❓ [#${taskId}] (External task)`);
        return;
      }

      const blockedBadge = t.column === "blocked" ? " [🛑 BLOCKED]" : "";
      const p = t.priority ? ` [${t.priority}]` : "";
      const col = t.column ? ` (${t.column})` : "";
      lines.push(`${prefix}${isTail ? "└── " : "├── "}📦 [#${t.id}] ${t.title}${p}${col}${blockedBadge}`);

      const children = dependentsMap.get(taskId) || [];
      for (let i = 0; i < children.length; i++) {
        const childId = children[i];
        const nextIsTail = i === children.length - 1;
        const nextPrefix = prefix + (isTail ? "    " : "│   ");
        printNode(childId, nextPrefix, nextIsTail);
      }
    };

    if (roots.length > 0) {
      for (let i = 0; i < roots.length; i++) {
        const isTail = i === roots.length - 1;
        printNode(roots[i].id, "", isTail);
      }
    }

    // Any unvisited cyclical or floating nodes
    for (const t of tasks) {
      if (!visited.has(t.id)) {
        lines.push(`\n⚠️ Cyclical / Detached Component:`);
        printNode(t.id, "", true);
      }
    }

    return lines.join("\n");
  }

  /**
   * Renders a responsive terminal ANSI CLI dashboard for a Goal session.
   */
  static renderGoalDashboard(goal: {
    sessionId: string;
    goal: string;
    status: string;
    progressPercent: number;
    turnsUsed: number;
    maxTurns: number;
    category?: string;
    healthStatus?: string;
    tags?: readonly string[];
    targetDeadlineMs?: number;
    milestones?: readonly { id: string; title: string; status: string; progressPercent: number; tags?: readonly string[] }[];
    gates?: readonly { name?: string; command: string; lastExitCode?: number; policy?: string }[];
  }): string {
    const filled = Math.round(goal.progressPercent / 5);
    const bar = "█".repeat(filled) + "░".repeat(20 - filled);
    const completedM = goal.milestones ? goal.milestones.filter((m) => m.status === "completed").length : 0;
    const totalM = goal.milestones ? goal.milestones.length : 0;
    const healthBadge = goal.healthStatus === "on_track" ? "🟢 ON TRACK" : goal.healthStatus === "at_risk" ? "🟡 AT RISK" : goal.healthStatus === "off_track" ? "🔴 OFF TRACK" : goal.healthStatus ? `[${goal.healthStatus.toUpperCase()}]` : "🟢 ON TRACK";
    const tagsStr = goal.tags && goal.tags.length > 0 ? ` [${goal.tags.map((t) => `#${t}`).join(" ")}]` : "";
    const deadlineStr = goal.targetDeadlineMs ? ` (Target: ${new Date(goal.targetDeadlineMs).toLocaleDateString()})` : "";

    const lines: string[] = [
      `================================================================================`,
      ` 🎯 LUMI Goal Dashboard: ${goal.sessionId} [${goal.status.toUpperCase()}]  ${healthBadge}`,
      `================================================================================`,
      `Objective : ${goal.goal}${tagsStr}`,
      `Category  : ${goal.category || "general"}${deadlineStr}`,
      `Progress  : [${bar}] ${goal.progressPercent}%`,
      `Turns     : ${goal.turnsUsed} / ${goal.maxTurns} turns allocated`,
      `Milestones: ${completedM} / ${totalM} completed`,
      ``,
    ];

    if (goal.milestones && goal.milestones.length > 0) {
      lines.push(`--- Milestones ---`);
      for (const m of goal.milestones) {
        const icon = m.status === "completed" ? "✓" : m.status === "blocked" ? "🛑" : "⏳";
        const mTags = m.tags && m.tags.length > 0 ? ` [${m.tags.map((t) => `#${t}`).join(" ")}]` : "";
        lines.push(`  ${icon} [#${m.id}] ${m.title}${mTags} (${m.status}, ${m.progressPercent}%)`);
      }
      lines.push(``);
    }

    if (goal.gates && goal.gates.length > 0) {
      lines.push(`--- Quality Gates ---`);
      for (const g of goal.gates) {
        const status = g.lastExitCode === 0 ? "PASS" : g.lastExitCode !== undefined ? `FAIL (${g.lastExitCode})` : "PENDING";
        lines.push(`  🛡️  ${g.name || g.command} [${status}] (${g.policy || "blocking"})`);
      }
      lines.push(``);
    }

    return lines.join("\n");
  }

  /**
   * Renders an ASCII / Unicode DAG dependency tree of goal milestones.
   */
  static renderGoalMilestoneGraph(goal: {
    sessionId: string;
    goal: string;
    milestones: readonly { id: string; title: string; status: string; dependsOn?: readonly string[]; blockers?: readonly string[] }[];
  }): string {
    if (!goal.milestones || goal.milestones.length === 0) {
      return `┌────────────────────────────────────────────────────────┐\n│ No milestones defined for goal session '${goal.sessionId}' │\n└────────────────────────────────────────────────────────┘`;
    }

    const tasks = goal.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      column: m.status,
      blockedBy: m.dependsOn,
    }));

    return BroccoliViewRenderer.renderDependencyGraph(`Milestone DAG: ${goal.sessionId}`, tasks);
  }

  private static formatCell(val: unknown): string {
    if (val === undefined || val === null) return "-";
    if (typeof val === "object") {
      if (Array.isArray(val)) return `[${val.length} items]`;
      return JSON.stringify(val);
    }
    return String(val);
  }
}
