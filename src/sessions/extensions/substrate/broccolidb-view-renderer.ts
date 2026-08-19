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

  /**
   * Renders a human-readable ANSI CLI dashboard for a scheduled Cron job.
   */
  static renderCronDashboard(job: {
    id: string;
    name: string;
    description?: string;
    category?: string;
    scheduleType: string;
    scheduleExpression?: string;
    intervalMs?: number;
    status: string;
    totalRuns: number;
    nextRunTimestampMs?: number;
    lastRunOutcome?: { success: boolean; durationMs: number; summary: string };
  }): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────┐`);
    lines.push(`│ ⏱️  CRON JOB: ${job.name.padEnd(39)} │`);
    lines.push(`├────────────────────────────────────────────────────────┤`);
    lines.push(`│ ID          : ${job.id.padEnd(41)} │`);
    lines.push(`│ Category    : ${(job.category || "general").padEnd(41)} │`);
    lines.push(`│ Type        : ${job.scheduleType.padEnd(41)} │`);

    const sched = job.scheduleExpression || (job.intervalMs ? `${job.intervalMs}ms` : "once");
    lines.push(`│ Schedule    : ${sched.padEnd(41)} │`);
    lines.push(`│ Status      : ${job.status.toUpperCase().padEnd(41)} │`);
    lines.push(`│ Total Runs  : ${String(job.totalRuns).padEnd(41)} │`);

    if (job.nextRunTimestampMs) {
      const remainingSec = Math.max(0, Math.round((job.nextRunTimestampMs - Date.now()) / 1000));
      lines.push(`│ Next Run In : ${`${remainingSec}s (${new Date(job.nextRunTimestampMs).toISOString()})`.slice(0, 41).padEnd(41)} │`);
    }

    if (job.lastRunOutcome) {
      const outcomeStr = `${job.lastRunOutcome.success ? "✓ PASS" : "✗ FAIL"} (${job.lastRunOutcome.durationMs.toFixed(1)}ms)`;
      lines.push(`│ Last Outcome: ${outcomeStr.padEnd(41)} │`);
    }

    lines.push(`└────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ASCII timeline schedule chart of registered cron jobs.
   */
  static renderCronScheduleTimeline(
    jobs: readonly { id: string; name: string; status: string; scheduleType: string; nextRunTimestampMs?: number }[]
  ): string {
    if (jobs.length === 0) {
      return `┌────────────────────────────────────────────────────────┐\n│ No cron jobs scheduled (0 jobs)                        │\n└────────────────────────────────────────────────────────┘`;
    }

    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────────────────────┐`);
    lines.push(`│ ⏱️  LUMI CRON SCHEDULE TIMELINE                                         │`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);

    for (const j of jobs) {
      const inSec = j.nextRunTimestampMs ? Math.max(0, Math.round((j.nextRunTimestampMs - Date.now()) / 1000)) : -1;
      const timeStr = inSec >= 0 ? `in ${inSec}s` : "inactive";
      const icon = j.status === "active" ? "●" : j.status === "paused" ? "⏸" : "✗";
      lines.push(`│ ${icon} [${j.status.padEnd(7)}] ${j.name.slice(0, 30).padEnd(30)} ── ${j.scheduleType.padEnd(8)} ── ${timeStr.padEnd(12)} │`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders a human-readable ANSI CLI dashboard for an autonomous swarm task.
   */
  static renderSwarmDashboard(task: {
    id: string;
    goal: string;
    depth: number;
    parentTaskId?: string;
    status: string;
    budget: { remainingTokens: number; remainingIterations: number };
    worktree?: { branchName: string; worktreePath: string };
  }): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────┐`);
    lines.push(`│ 🐝 SWARM TASK: ${task.id.slice(0, 38).padEnd(38)} │`);
    lines.push(`├────────────────────────────────────────────────────────┤`);
    lines.push(`│ Goal:    ${task.goal.slice(0, 44).padEnd(44)} │`);
    lines.push(`│ Depth:   ${String(task.depth).padEnd(44)} │`);
    lines.push(`│ Parent:  ${(task.parentTaskId || "root").slice(0, 44).padEnd(44)} │`);
    lines.push(`│ Status:  ${task.status.padEnd(44)} │`);
    lines.push(`│ Tokens:  ${String(task.budget.remainingTokens).padEnd(44)} │`);
    lines.push(`│ Turns:   ${String(task.budget.remainingIterations).padEnd(44)} │`);

    if (task.worktree) {
      lines.push(`│ Branch:  ${task.worktree.branchName.slice(0, 44).padEnd(44)} │`);
    }

    lines.push(`└────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders a visual Unicode DAG tree for a hierarchy of swarm subagent tasks.
   */
  static renderSwarmDagGraph(
    tasks: readonly { id: string; goal: string; depth: number; parentTaskId?: string; status: string }[]
  ): string {
    if (tasks.length === 0) {
      return `┌────────────────────────────────────────────────────────┐\n│ No subagent tasks in swarm (0 tasks)                   │\n└────────────────────────────────────────────────────────┘`;
    }

    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────────────────────┐`);
    lines.push(`│ 🐝 LUMI AUTONOMOUS SWARM HIERARCHY DAG (${tasks.length} subagents)                       │`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);

    const roots = tasks.filter((t) => !t.parentTaskId);
    const childrenMap = new Map<string, string[]>();

    for (const t of tasks) {
      if (t.parentTaskId) {
        const list = childrenMap.get(t.parentTaskId) || [];
        list.push(t.id);
        childrenMap.set(t.parentTaskId, list);
      }
    }

    const taskMap = new Map<string, (typeof tasks)[0]>();
    for (const t of tasks) taskMap.set(t.id, t);

    const visited = new Set<string>();

    const printTree = (taskId: string, prefix: string, isTail: boolean) => {
      visited.add(taskId);
      const t = taskMap.get(taskId);
      if (!t) return;

      const icon = t.status === "completed" ? "✓" : t.status === "running" ? "●" : t.status === "failed" ? "✗" : "○";
      lines.push(`│ ${prefix}${isTail ? "└── " : "├── "}${icon} [${t.status}] ${t.id} (D${t.depth}) ── ${t.goal.slice(0, 24)}`);

      const children = childrenMap.get(taskId) || [];
      for (let i = 0; i < children.length; i++) {
        printTree(children[i], prefix + (isTail ? "    " : "│   "), i === children.length - 1);
      }
    };

    if (roots.length > 0) {
      for (let i = 0; i < roots.length; i++) {
        printTree(roots[i].id, "", i === roots.length - 1);
      }
    }

    // Any unvisited nodes
    for (const t of tasks) {
      if (!visited.has(t.id)) {
        printTree(t.id, "", true);
      }
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders a human-readable ANSI CLI dashboard for an evolutionary skill node.
   */
  static renderSkillDashboard(node: {
    id: string;
    name: string;
    category: string;
    tier: string;
    masteryScore: number;
    fitnessScore: number;
    useCount: number;
    lifecycleState: string;
    pinned: boolean;
  }): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────┐`);
    lines.push(`│ 🌲 SKILL: ${node.name.slice(0, 43).padEnd(43)} │`);
    lines.push(`├────────────────────────────────────────────────────────┤`);
    lines.push(`│ ID:        ${node.id.slice(0, 43).padEnd(43)} │`);
    lines.push(`│ Category:  ${node.category.slice(0, 43).padEnd(43)} │`);
    lines.push(`│ Tier:      ${node.tier.toUpperCase().padEnd(43)} │`);
    lines.push(`│ Mastery:   ${`${node.masteryScore}%`.padEnd(43)} │`);
    lines.push(`│ Fitness:   ${String(node.fitnessScore).padEnd(43)} │`);
    lines.push(`│ Usage:     ${`${node.useCount} runs`.padEnd(43)} │`);
    lines.push(`│ Lifecycle: ${node.lifecycleState.padEnd(43)} │`);
    lines.push(`│ Pinned:    ${(node.pinned ? "YES" : "NO").padEnd(43)} │`);
    lines.push(`└────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders a visual Unicode DAG tree for an Evolutionary Skill Tree DAG.
   */
  static renderSkillTreeDag(dag: {
    nodes: ReadonlyMap<string, { id: string; name: string; tier: string; masteryScore: number }>;
    dependentsEdges: ReadonlyMap<string, readonly string[]>;
    prerequisiteEdges: ReadonlyMap<string, readonly string[]>;
    unlockedNodeIds: ReadonlySet<string>;
  }): string {
    const nodes = Array.from(dag.nodes.values());
    if (nodes.length === 0) {
      return `┌────────────────────────────────────────────────────────┐\n│ No skills in tree (0 nodes)                            │\n└────────────────────────────────────────────────────────┘`;
    }

    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────────────────────┐`);
    lines.push(`│ 🌲 LUMI EVOLUTIONARY SKILL TREE DAG (${nodes.length} skills)                       │`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);

    const roots = nodes.filter((n) => {
      const prereqs = dag.prerequisiteEdges.get(n.id);
      return !prereqs || prereqs.length === 0;
    });

    const visited = new Set<string>();

    const printNode = (skillId: string, prefix: string, isTail: boolean) => {
      visited.add(skillId);
      const node = dag.nodes.get(skillId);
      if (!node) return;

      const unlocked = dag.unlockedNodeIds.has(skillId);
      const icon = unlocked ? (node.masteryScore >= 90 ? "👑" : "●") : "🔒";
      lines.push(`│ ${prefix}${isTail ? "└── " : "├── "}${icon} [${node.tier}] ${node.name.slice(0, 24)} (${node.masteryScore}%)`);

      const children = dag.dependentsEdges.get(skillId) || [];
      for (let i = 0; i < children.length; i++) {
        printNode(children[i], prefix + (isTail ? "    " : "│   "), i === children.length - 1);
      }
    };

    if (roots.length > 0) {
      for (let i = 0; i < roots.length; i++) {
        printNode(roots[i].id, "", i === roots.length - 1);
      }
    }

    for (const n of nodes) {
      if (!visited.has(n.id)) {
        printNode(n.id, "", true);
      }
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders a human-readable ANSI CLI card for a Skill Strategy Plan.
   */
  static renderSkillStrategyPlan(plan: {
    strategyId: string;
    policy: string;
    confidenceScore: number;
    primarySkill: { name: string; tier: string; masteryScore: number };
    executionChain: readonly { stepIndex: number; skillName: string; tier: string; masteryScore: number; rationale: string }[];
    synergies: readonly { name: string; fitnessMultiplier: number }[];
  }): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────────────────────┐`);
    lines.push(`│ ⚡ LUMI SKILL STRATEGY PLAN: ${plan.strategyId.slice(0, 42).padEnd(42)} │`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ Policy:     ${plan.policy.toUpperCase().padEnd(58)} │`);
    lines.push(`│ Confidence: ${`${Math.round(plan.confidenceScore * 100)}%`.padEnd(58)} │`);
    lines.push(`│ Anchor:     ${`${plan.primarySkill.name} [${plan.primarySkill.tier.toUpperCase()}] (${plan.primarySkill.masteryScore}%)`.slice(0, 58).padEnd(58)} │`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ Pipeline Execution Stages:                                             │`);
    for (const step of plan.executionChain) {
      lines.push(`│  ${step.stepIndex}. [${step.tier.toUpperCase()}] ${step.skillName.padEnd(20)} │ ${step.rationale.slice(0, 38).padEnd(38)} │`);
    }
    if (plan.synergies.length > 0) {
      lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
      lines.push(`│ Active Combo Synergies:                                                │`);
      for (const syn of plan.synergies) {
        lines.push(`│  ⚡ ${syn.name.padEnd(35)} │ +${Math.round((syn.fitnessMultiplier - 1) * 100)}% Fitness Boost  │`);
      }
    }
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders a human-readable ANSI CLI dashboard for a SOUL persona manifest.
   */
  static renderSoulDashboard(manifest: {
    id: string;
    name: string;
    archetype: string;
    version: string;
    integrityHash: string;
    traits: readonly { name: string; weight: number; category: string }[];
    axioms: readonly { statement: string; priority: number }[];
  }): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────┐`);
    lines.push(`│ 🔮 SOUL: ${manifest.name.slice(0, 44).padEnd(44)} │`);
    lines.push(`├────────────────────────────────────────────────────────┤`);
    lines.push(`│ Archetype: ${manifest.archetype.padEnd(43)} │`);
    lines.push(`│ Version:   ${manifest.version.padEnd(43)} │`);
    lines.push(`│ Hash:      ${manifest.integrityHash.slice(0, 40).padEnd(43)} │`);
    lines.push(`│ Traits:    ${`${manifest.traits.length} traits loaded`.padEnd(43)} │`);
    lines.push(`│ Axioms:    ${`${manifest.axioms.length} operational axioms`.padEnd(43)} │`);
    lines.push(`└────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ANSI CLI trait matrix with weight meters.
   */
  static renderTraitMatrix(
    traits: readonly { id: string; name: string; weight: number; category: string; minWeight: number; maxWeight: number }[]
  ): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────────────────────┐`);
    lines.push(`│ 🧬 LUMI PERSONALITY TRAIT MATRIX (${traits.length} traits)                           │`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);

    for (const t of traits) {
      const bars = "■".repeat(Math.round(t.weight * 10)) + "□".repeat(10 - Math.round(t.weight * 10));
      lines.push(`│ [${t.category.slice(0, 4).toUpperCase()}] ${t.name.slice(0, 20).padEnd(20)} [${bars}] ${t.weight.toFixed(2)} ([${t.minWeight}, ${t.maxWeight}])`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ANSI CLI summary card for email inbox triage status.
   */
  static renderEmailDashboard(report: {
    totalProcessed: number;
    urgentCount: number;
    replyNeededCount: number;
    actionNeededCount: number;
    waitingCount: number;
    threatsNeutralizedCount: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────┐`);
    lines.push(`│ 📧 SUPERHUMAN INBOX TRIAGE (ADR-123)                   │`);
    lines.push(`├────────────────────────────────────────────────────────┤`);
    lines.push(`│ Total Processed: ${String(report.totalProcessed).padEnd(37)} │`);
    lines.push(`│ Urgent Inbound:  ${String(report.urgentCount).padEnd(37)} │`);
    lines.push(`│ Reply Needed:    ${String(report.replyNeededCount).padEnd(37)} │`);
    lines.push(`│ Action Needed:   ${String(report.actionNeededCount).padEnd(37)} │`);
    lines.push(`│ Waiting / Noise: ${String(report.waitingCount).padEnd(37)} │`);
    lines.push(`│ Threats Blocked: ${String(report.threatsNeutralizedCount).padEnd(37)} │`);
    lines.push(`└────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ANSI CLI email thread conversation view.
   */
  static renderEmailThread(
    thread: readonly { id: string; from: { email: string; name?: string }; subject: string; snippet: string; date: number; disposition: string }[]
  ): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────────────────────┐`);
    lines.push(`│ 🧵 EMAIL THREAD TIMELINE (${thread.length} messages)                                │`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);

    for (const m of thread) {
      const fromStr = m.from.name ? `${m.from.name} <${m.from.email}>` : m.from.email;
      lines.push(`│ [${m.disposition.toUpperCase()}] ${fromStr.slice(0, 30).padEnd(30)}: ${m.subject.slice(0, 25)}`);
      lines.push(`│   ↳ "${m.snippet.slice(0, 64)}"`);
      lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    }

    if (thread.length > 0) {
      lines.pop(); // Remove trailing separator
    }
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ANSI CLI summary card for Deadline & Execution Leases status.
   */
  static renderDeadlineDashboard(metrics: {
    totalExecutions: number;
    timeoutsEncountered: number;
    estopEngagements: number;
    estopRejections: number;
    activeLeases: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────┐`);
    lines.push(`│ ⏱️ UNIFIED DEADLINE & LEASE METRICS (ADR-101)          │`);
    lines.push(`├────────────────────────────────────────────────────────┤`);
    lines.push(`│ Total Executions:  ${String(metrics.totalExecutions).padEnd(35)} │`);
    lines.push(`│ Timeouts:          ${String(metrics.timeoutsEncountered).padEnd(35)} │`);
    lines.push(`│ Active Leases:     ${String(metrics.activeLeases).padEnd(35)} │`);
    lines.push(`│ ESTOP Engagements: ${String(metrics.estopEngagements).padEnd(35)} │`);
    lines.push(`│ ESTOP Rejections:  ${String(metrics.estopRejections).padEnd(35)} │`);
    lines.push(`└────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ANSI CLI ESTOP Emergency Stop status card.
   */
  static renderEstopStatus(state: {
    engaged: boolean;
    reason?: string;
    engagedBy?: string;
    engagedAt?: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────┐`);
    lines.push(`│ 🛑 EMERGENCY STOP (ESTOP) STATUS (ADR-101)             │`);
    lines.push(`├────────────────────────────────────────────────────────┤`);
    lines.push(`│ Status:     ${state.engaged ? "⛔ ENGAGED (Work Blocked)".padEnd(42) : "🟢 DISENGAGED (Work Allowed)".padEnd(42)} │`);
    if (state.engaged) {
      lines.push(`│ Reason:     ${String(state.reason || "Operator Stop").slice(0, 42).padEnd(42)} │`);
      lines.push(`│ Engaged By: ${String(state.engagedBy || "system").slice(0, 42).padEnd(42)} │`);
    }
    lines.push(`└────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ANSI CLI summary card for Persistent Knowledge Graph & Memory metrics.
   */
  static renderMemoryDashboard(metrics: {
    totalNodes: number;
    totalEdges: number;
    totalRecalls: number;
    totalRemembered: number;
    activeNodes: number;
    avgConfidence: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────┐`);
    lines.push(`│ 🧠 KNOWLEDGE GRAPH & MEMORY METRICS (ADR-028)          │`);
    lines.push(`├────────────────────────────────────────────────────────┤`);
    lines.push(`│ Active Nodes:     ${String(metrics.activeNodes).padEnd(36)} │`);
    lines.push(`│ Relations/Edges:  ${String(metrics.totalEdges).padEnd(36)} │`);
    lines.push(`│ Total Recalls:    ${String(metrics.totalRecalls).padEnd(36)} │`);
    lines.push(`│ Total Remembered: ${String(metrics.totalRemembered).padEnd(36)} │`);
    lines.push(`│ Avg Confidence:   ${String((metrics.avgConfidence * 100).toFixed(1) + "%").padEnd(36)} │`);
    lines.push(`└────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ANSI CLI visual knowledge graph topology.
   */
  static renderKnowledgeGraph(
    nodes: readonly { id: string; label: string; type: string; confidence: number }[],
    edges: readonly { source: string; target: string; relation: string }[]
  ): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────────────────────┐`);
    lines.push(`│ 🕸️ KNOWLEDGE GRAPH TOPOLOGY (${nodes.length} nodes, ${edges.length} edges)                     │`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);

    for (const n of nodes.slice(0, 10)) {
      const typeBadge = `[${n.type.slice(0, 4).toUpperCase()}]`;
      const rels = edges.filter((e) => e.source === n.id);
      const edgeSummary = rels.length > 0 ? ` ──(${rels.map((r) => r.relation).join(", ")})──>` : "";
      lines.push(`│ ${typeBadge} ${n.label.slice(0, 28).padEnd(28)} (${(n.confidence * 100).toFixed(0)}%)${edgeSummary}`);
    }

    if (nodes.length > 10) {
      lines.push(`│ ... and ${nodes.length - 10} more knowledge nodes`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ANSI CLI summary card for Cost Governance & Token Accounting metrics.
   */
  static renderCostDashboard(metrics: {
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCachedPromptTokens: number;
    formattedTotalCostLabel: string;
    totalTurns: number;
    hardCapBreached: boolean;
    burnRatePerTurnUsd: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────┐`);
    lines.push(`│ 💰 COST GOVERNANCE & TOKEN ACCOUNTING (ADR-042)        │`);
    lines.push(`├────────────────────────────────────────────────────────┤`);
    lines.push(`│ Total Cost:     ${metrics.formattedTotalCostLabel.padEnd(38)} │`);
    lines.push(`│ Total Tokens:   ${metrics.totalTokens.toLocaleString().padEnd(38)} │`);
    lines.push(`│ Prompt Tokens:  ${metrics.totalPromptTokens.toLocaleString().padEnd(38)} │`);
    lines.push(`│ Compl Tokens:   ${metrics.totalCompletionTokens.toLocaleString().padEnd(38)} │`);
    lines.push(`│ Cached Tokens:  ${metrics.totalCachedPromptTokens.toLocaleString().padEnd(38)} │`);
    lines.push(`│ Total Turns:    ${String(metrics.totalTurns).padEnd(38)} │`);
    lines.push(`│ Burn / Turn:    ${("$" + metrics.burnRatePerTurnUsd.toFixed(4)).padEnd(38)} │`);
    lines.push(`│ Hard Cap:       ${(metrics.hardCapBreached ? "⛔ BREACHED" : "🟢 OK").padEnd(38)} │`);
    lines.push(`└────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ANSI CLI model pricing catalog table.
   */
  static renderPricingCatalog(
    tiers: readonly { modelId: string; provider: string; promptCostPerMillion: number; completionCostPerMillion: number }[]
  ): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────────────────────┐`);
    lines.push(`│ 🏷️ MODEL PRICING CATALOG (ADR-042)                                      │`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);

    for (const t of tiers.slice(0, 10)) {
      const modelStr = t.modelId.slice(0, 24).padEnd(24);
      const provStr = `[${t.provider.slice(0, 8)}]`.padEnd(10);
      const promptStr = `$${t.promptCostPerMillion.toFixed(2)}/M in`.padEnd(14);
      const complStr = `$${t.completionCostPerMillion.toFixed(2)}/M out`;
      lines.push(`│ ${modelStr} ${provStr} ${promptStr} ${complStr.padEnd(18)} │`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ANSI CLI summary card for Checkpoint Kernel & Merkle Commit metrics.
   */
  static renderCheckpointDashboard(metrics: {
    totalCheckpoints: number;
    totalBlobs: number;
    totalBytes: number;
    deduplicationRatio: number;
    currentHeadId?: string;
  }): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────┐`);
    lines.push(`│ 📦 CHECKPOINT KERNEL & CAS STORE METRICS (ADR-039)     │`);
    lines.push(`├────────────────────────────────────────────────────────┤`);
    lines.push(`│ Total Commits:  ${String(metrics.totalCheckpoints).padEnd(38)} │`);
    lines.push(`│ Unique Blobs:   ${String(metrics.totalBlobs).padEnd(38)} │`);
    lines.push(`│ Stored Bytes:   ${(metrics.totalBytes.toLocaleString() + " B").padEnd(38)} │`);
    lines.push(`│ Dedup Ratio:    ${(metrics.deduplicationRatio + "x savings").padEnd(38)} │`);
    lines.push(`│ Active HEAD:    ${String(metrics.currentHeadId ? metrics.currentHeadId.slice(0, 12) : "none").padEnd(38)} │`);
    lines.push(`└────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ANSI CLI visual DAG representation of checkpoint commit history.
   */
  static renderCommitTree(
    checkpoints: readonly { id: string; frameIndex: number; message: string; stats: { fileCount: number; byteCount: number } }[]
  ): string {
    const lines: string[] = [];
    lines.push(`┌────────────────────────────────────────────────────────────────────────┐`);
    lines.push(`│ 🌲 CHECKPOINT COMMIT DAG & MERKLE HISTORY (${checkpoints.length} commits)                 │`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);

    for (const c of checkpoints.slice(-10)) {
      const commitTag = `[#${c.frameIndex}] \`${c.id.slice(0, 8)}\``;
      const fileTag = `(${c.stats.fileCount} files, ${(c.stats.byteCount / 1024).toFixed(1)} KB)`;
      const msg = c.message.slice(0, 24).padEnd(24);
      lines.push(`│ ──● ${commitTag.padEnd(20)} ${msg} ${fileTag.padEnd(20)} │`);
    }

    if (checkpoints.length > 10) {
      lines.push(`│ ... and ${checkpoints.length - 10} earlier checkpoint commits`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive ASCII commit DAG graph showing branch forks and merge points.
   */
  static renderAsciiCommitGraph(
    checkpoints: readonly {
      id: string;
      parentId?: string;
      message: string;
      frameIndex: number;
      branchName?: string;
    }[],
    branches: readonly { name: string; commitId: string }[] = []
  ): string {
    const lines: string[] = [];
    lines.push(`┌── 🌿 MERKLE COMMIT DAG GRAPH ──────────────────────────────────────────┐`);

    const branchHeadMap = new Map<string, string[]>();
    for (const b of branches) {
      if (!branchHeadMap.has(b.commitId)) branchHeadMap.set(b.commitId, []);
      branchHeadMap.get(b.commitId)!.push(b.name);
    }

    const visibleCommits = [...checkpoints].reverse().slice(0, 15);
    for (let i = 0; i < visibleCommits.length; i++) {
      const c = visibleCommits[i];
      const branchLabels = branchHeadMap.get(c.id);
      const branchTag = branchLabels ? ` (${branchLabels.map((b) => `\x1b[36m${b}\x1b[0m`).join(", ")})` : "";
      const prefix = i === 0 ? "● " : "├──● ";
      const commitTag = `#${c.frameIndex} [${c.id.slice(0, 7)}]`;
      const msg = c.message.slice(0, 30);
      lines.push(`│ ${prefix}${commitTag.padEnd(16)} ${msg}${branchTag}`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders git status-style working tree and virtual staging area status.
   */
  static renderWorkingTreeStatus(status: {
    staged: readonly string[];
    unstaged: readonly string[];
    untracked: readonly string[];
    deleted: readonly string[];
    clean: boolean;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 📋 WORKING TREE & STAGING STATUS ────────────────────────────────────┐`);

    if (status.clean) {
      lines.push(`│  Nothing to commit, working tree clean                                 │`);
      lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
      return lines.join("\n");
    }

    if (status.staged.length > 0) {
      lines.push(`│  Changes to be committed (${status.staged.length} staged):`);
      for (const s of status.staged.slice(0, 5)) {
        lines.push(`│    \x1b[32m+ staged:   ${s}\x1b[0m`);
      }
    }

    if (status.unstaged.length > 0) {
      lines.push(`│  Changes not staged for commit (${status.unstaged.length} modified):`);
      for (const u of status.unstaged.slice(0, 5)) {
        lines.push(`│    \x1b[33m~ modified: ${u}\x1b[0m`);
      }
    }

    if (status.untracked.length > 0) {
      lines.push(`│  Untracked files (${status.untracked.length} files):`);
      for (const t of status.untracked.slice(0, 5)) {
        lines.push(`│    \x1b[31m? untracked: ${t}\x1b[0m`);
      }
    }

    if (status.deleted.length > 0) {
      lines.push(`│  Deleted files (${status.deleted.length} files):`);
      for (const d of status.deleted.slice(0, 5)) {
        lines.push(`│    \x1b[31m- deleted:  ${d}\x1b[0m`);
      }
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders a git blame-style line-by-line file history report.
   */
  static renderBlameView(report: {
    path: string;
    commitId: string;
    totalLines: number;
    lines: readonly {
      lineNumber: number;
      content: string;
      commitId: string;
      frameIndex: number;
      timestamp: number;
      message: string;
    }[];
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🔍 BLAME HISTORY: ${report.path} [commit: ${report.commitId.slice(0, 8)}] ────────────────────┐`);

    for (const l of report.lines.slice(0, 20)) {
      const commitTag = `#${l.frameIndex} [${l.commitId.slice(0, 7)}]`;
      const dateStr = new Date(l.timestamp).toISOString().slice(11, 19);
      const lineNumStr = String(l.lineNumber).padStart(3, " ");
      lines.push(`│ ${commitTag.padEnd(14)} ${dateStr} │ ${lineNumStr} │ ${l.content.slice(0, 40)}`);
    }

    if (report.lines.length > 20) {
      lines.push(`│ ... and ${report.lines.length - 20} more lines`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive bisect binary search progress status box.
   */
  static renderBisectStatus(state: {
    goodCommitId: string;
    badCommitId: string;
    currentCandidateId?: string;
    remainingCandidates: readonly string[];
    isResolved: boolean;
    culpritCommitId?: string;
    stepCount: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🎯 BISECT REGRESSION LOCATOR ────────────────────────────────────────┐`);
    lines.push(`│  Step: #${state.stepCount} │ Remaining Candidates: ${state.remainingCandidates.length}`);
    lines.push(`│  Good Commit: \x1b[32m${state.goodCommitId.slice(0, 8)}\x1b[0m  Bad Commit: \x1b[31m${state.badCommitId.slice(0, 8)}\x1b[0m`);

    if (state.isResolved && state.culpritCommitId) {
      lines.push(`│  \x1b[31;1m🚨 FIRST BAD COMMIT IDENTIFIED: ${state.culpritCommitId}\x1b[0m`);
    } else if (state.currentCandidateId) {
      lines.push(`│  Testing Candidate: \x1b[36m${state.currentCandidateId.slice(0, 8)}\x1b[0m`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive repository Operation Log (OpLog) timeline.
   */
  static renderOpLogView(
    entries: readonly {
      opId: string;
      opType: string;
      description: string;
      timestamp: number;
    }[]
  ): string {
    const lines: string[] = [];
    lines.push(`┌── ⏱️ REPOSITORY OPERATION LOG (OPLOG) ──────────────────────────────────┐`);

    for (const e of entries.slice(-15).reverse()) {
      const timeStr = new Date(e.timestamp).toISOString().slice(11, 19);
      const tag = `[${e.opType.toUpperCase()}]`.padEnd(14);
      const desc = e.description.slice(0, 42);
      lines.push(`│ ${timeStr} │ ${tag} │ ${desc}`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an asynchronous conflict manifest report.
   */
  static renderConflictReport(conflicts: readonly {
    path: string;
    oursHash: string;
    theirsHash: string;
    conflictType: string;
  }[]): string {
    const lines: string[] = [];
    lines.push(`┌── ⚠️ ASYNCHRONOUS MERGE CONFLICT REPORT ───────────────────────────────┐`);
    lines.push(`│  Conflicts pending resolution: ${conflicts.length}`);

    for (const c of conflicts.slice(0, 10)) {
      lines.push(`│  - \x1b[31m${c.path}\x1b[0m (ours: ${c.oursHash.slice(0, 7)}, theirs: ${c.theirsHash.slice(0, 7)}, type: ${c.conflictType})`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Clarify & Intent Disambiguation ANSI Dashboard.
   */
  static renderClarifyDashboard(metrics: {
    totalInquiries: number;
    pendingInquiries: number;
    resolvedInquiries: number;
    autoResolvedInquiries: number;
    timedOutInquiries: number;
    blockerInquiries: number;
    decisionTreeCount: number;
    avgResolutionLatencyMs: number;
    resolutionSuccessRate: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🔍 CLARIFY & INTENT DISAMBIGUATION DASHBOARD ────────────────────────┐`);
    lines.push(`│  Total Inquiries: ${String(metrics.totalInquiries).padEnd(6)} │ Pending: \x1b[33m${String(metrics.pendingInquiries).padEnd(6)}\x1b[0m │ Resolved: \x1b[32m${String(metrics.resolvedInquiries).padEnd(6)}\x1b[0m`);
    lines.push(`│  Auto-Resolved:   ${String(metrics.autoResolvedInquiries).padEnd(6)} │ Timed Out: \x1b[31m${String(metrics.timedOutInquiries).padEnd(4)}\x1b[0m │ Blockers: \x1b[31;1m${String(metrics.blockerInquiries).padEnd(6)}\x1b[0m`);
    lines.push(`│  Decision Trees:  ${String(metrics.decisionTreeCount).padEnd(6)} │ Success:  ${(metrics.resolutionSuccessRate * 100).toFixed(0)}%    │ Avg Latency: ${metrics.avgResolutionLatencyMs} ms`);

    const barWidth = 40;
    const resolvedBars = metrics.totalInquiries > 0 ? Math.round((metrics.resolvedInquiries / metrics.totalInquiries) * barWidth) : 0;
    const pendingBars = barWidth - resolvedBars;
    const barStr = `\x1b[32m${"█".repeat(resolvedBars)}\x1b[33m${"░".repeat(pendingBars)}\x1b[0m`;
    lines.push(`│  Progress: [${barStr}]`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive question inquiry card.
   */
  static renderClarifyInquiryCard(inquiry: {
    id: string;
    question: string;
    category: string;
    priority: string;
    mode: string;
    choices: readonly { id: string; label: string; isRecommended?: boolean }[];
  }): string {
    const lines: string[] = [];
    lines.push(`┌── ❓ INQUIRY [${inquiry.id}] ───────────────────────────────────────────┐`);
    lines.push(`│  Category: \x1b[36m${inquiry.category.toUpperCase()}\x1b[0m │ Priority: \x1b[33m${inquiry.priority.toUpperCase()}\x1b[0m │ Mode: ${inquiry.mode}`);
    lines.push(`│  \x1b[1m${inquiry.question}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);

    for (let i = 0; i < inquiry.choices.length; i++) {
      const c = inquiry.choices[i];
      const recBadge = c.isRecommended ? " \x1b[32m[Recommended]\x1b[0m" : "";
      lines.push(`│  [${i + 1}] (${c.id}) ${c.label}${recBadge}`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an ASCII decision tree structure.
   */
  static renderClarifyDecisionTree(tree: {
    treeId: string;
    title: string;
    activePath: readonly string[];
    isComplete: boolean;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🌲 DECISION TREE: ${tree.title} [${tree.treeId}] ────────────────────┐`);
    lines.push(`│  Status: ${tree.isComplete ? "\x1b[32mCOMPLETE\x1b[0m" : "\x1b[33mIN PROGRESS\x1b[0m"}`);

    for (let i = 0; i < tree.activePath.length; i++) {
      const p = tree.activePath[i];
      const isLast = i === tree.activePath.length - 1;
      const prefix = isLast ? "└── " : "├── ";
      lines.push(`│  ${prefix}\x1b[36m${p}\x1b[0m`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the SWE Benchmark & Batch Evaluation ANSI Dashboard.
   */
  static renderBatchDashboard(metrics: {
    totalRuns: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    overallPassRate: number;
    meanScore: number;
    avgTaskDurationMs: number;
    p95DurationMs: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 📊 SWE BENCHMARK & BATCH EVALUATION DASHBOARD ──────────────────────┐`);
    lines.push(`│  Runs: ${String(metrics.totalRuns).padEnd(6)} │ Tasks: ${String(metrics.totalTasks).padEnd(6)} │ Passed: \x1b[32m${String(metrics.completedTasks).padEnd(6)}\x1b[0m │ Failed: \x1b[31m${String(metrics.failedTasks).padEnd(6)}\x1b[0m`);
    lines.push(`│  Pass Rate: \x1b[1;32m${(metrics.overallPassRate * 100).toFixed(0)}%\x1b[0m   │ Mean Score: ${(metrics.meanScore * 100).toFixed(0)}% │ Avg Latency: ${metrics.avgTaskDurationMs} ms (p95: ${metrics.p95DurationMs} ms)`);

    const barWidth = 40;
    const passedBars = metrics.totalTasks > 0 ? Math.round((metrics.completedTasks / metrics.totalTasks) * barWidth) : 0;
    const failedBars = barWidth - passedBars;
    const barStr = `\x1b[32m${"█".repeat(passedBars)}\x1b[31m${"░".repeat(failedBars)}\x1b[0m`;
    lines.push(`│  Pass Meter: [${barStr}]`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive batch task execution card.
   */
  static renderBatchTaskCard(task: {
    id: string;
    benchmarkType: string;
    priority: string;
    prompt: string;
    expectedCriteria?: readonly string[];
  }, result?: {
    status: string;
    score: number;
    passed: boolean;
    durationMs: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 📋 BATCH TASK [${task.id}] ──────────────────────────────────────────┐`);
    lines.push(`│  Type: \x1b[36m${task.benchmarkType.toUpperCase()}\x1b[0m │ Priority: \x1b[33m${task.priority.toUpperCase()}\x1b[0m │ Status: ${result ? (result.passed ? "\x1b[32mPASSED\x1b[0m" : "\x1b[31mFAILED\x1b[0m") : "\x1b[33mPENDING\x1b[0m"}`);
    lines.push(`│  \x1b[1m${task.prompt.slice(0, 70)}\x1b[0m`);

    if (task.expectedCriteria && task.expectedCriteria.length > 0) {
      lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
      lines.push(`│  Expected Criteria:`);
      for (const c of task.expectedCriteria) {
        lines.push(`│    - ${c.slice(0, 60)}`);
      }
    }

    if (result) {
      lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
      lines.push(`│  Score: ${(result.score * 100).toFixed(0)}% │ Duration: ${result.durationMs} ms`);
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Turn Retry State Machine ANSI Dashboard.
   */
  static renderTurnRetryDashboard(metrics: {
    totalStates: number;
    activeStates: number;
    recoveredCount: number;
    exhaustedCount: number;
    recoverySuccessRate: number;
    totalGuardsTriggered: number;
    totalSignalsEmitted: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🔄 TURN RETRY & ONE-SHOT RECOVERY DASHBOARD ─────────────────────────┐`);
    lines.push(`│  States: ${String(metrics.totalStates).padEnd(5)} │ Recovered: \x1b[32m${String(metrics.recoveredCount).padEnd(5)}\x1b[0m │ Exhausted: \x1b[31m${String(metrics.exhaustedCount).padEnd(5)}\x1b[0m │ Active: ${String(metrics.activeStates).padEnd(5)}`);
    lines.push(`│  Recovery Rate: \x1b[1;32m${(metrics.recoverySuccessRate * 100).toFixed(0)}%\x1b[0m │ Guards Tripped: ${metrics.totalGuardsTriggered} │ Signals: ${metrics.totalSignalsEmitted}`);

    const barWidth = 40;
    const passedBars = metrics.totalStates > 0 ? Math.round((metrics.recoveredCount / metrics.totalStates) * barWidth) : 0;
    const failedBars = barWidth - passedBars;
    const barStr = `\x1b[32m${"█".repeat(passedBars)}\x1b[33m${"░".repeat(failedBars)}\x1b[0m`;
    lines.push(`│  Recovery Meter: [${barStr}]`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive turn retry state card.
   */
  static renderTurnRetryCard(state: {
    stateId: string;
    turnIndex: number;
    attemptIndex: number;
    status: string;
    errorCategory?: string;
    guards: any;
    restartSignals: any;
  }): string {
    const lines: string[] = [];
    const statusColor = state.status === "recovered" ? "\x1b[32m" : (state.status === "exhausted" ? "\x1b[31m" : "\x1b[33m");
    lines.push(`┌── 🔄 RETRY STATE [${state.stateId}] ───────────────────────────────────┐`);
    lines.push(`│  Turn: #${state.turnIndex} │ Attempt: #${state.attemptIndex} │ Status: ${statusColor}${state.status.toUpperCase()}\x1b[0m │ Category: ${state.errorCategory ?? "general"}`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Active Guards:`);

    const activeGuards = Object.entries(state.guards).filter(([_, v]) => v).map(([k]) => k);
    if (activeGuards.length === 0) {
      lines.push(`│    (none tripped)`);
    } else {
      for (const g of activeGuards) {
        lines.push(`│    \x1b[33m▶ [Tripped]\x1b[0m ${g}`);
      }
    }

    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Restart Signals:`);
    const activeSignals = Object.entries(state.restartSignals).filter(([_, v]) => v).map(([k]) => k);
    if (activeSignals.length === 0) {
      lines.push(`│    (none emitted)`);
    } else {
      for (const s of activeSignals) {
        lines.push(`│    \x1b[36m▶ [Signal]\x1b[0m ${s}`);
      }
    }

    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Code Execution Sandbox ANSI Dashboard.
   */
  static renderExecutionDashboard(metrics: {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    timedOutCount: number;
    securityBlockedCount: number;
    totalToolCalls: number;
    overallSuccessRate: number;
    avgExecutionTimeMs: number;
    p95ExecutionTimeMs: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── ⚡ CODE EXECUTION & TOOL CALLING DASHBOARD ──────────────────────────┐`);
    lines.push(`│  Executions: ${String(metrics.totalExecutions).padEnd(5)} │ Passed: \x1b[32m${String(metrics.successCount).padEnd(5)}\x1b[0m │ Failed: \x1b[31m${String(metrics.failureCount).padEnd(5)}\x1b[0m │ Tool Calls: ${String(metrics.totalToolCalls).padEnd(5)}`);
    lines.push(`│  Success Rate: \x1b[1;32m${(metrics.overallSuccessRate * 100).toFixed(0)}%\x1b[0m  │ Avg Latency: ${metrics.avgExecutionTimeMs} ms (p95: ${metrics.p95ExecutionTimeMs} ms) │ Blocked: ${metrics.securityBlockedCount}`);

    const barWidth = 40;
    const passedBars = metrics.totalExecutions > 0 ? Math.round((metrics.successCount / metrics.totalExecutions) * barWidth) : 0;
    const failedBars = barWidth - passedBars;
    const barStr = `\x1b[32m${"█".repeat(passedBars)}\x1b[31m${"░".repeat(failedBars)}\x1b[0m`;
    lines.push(`│  Success Meter: [${barStr}]`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive code execution trace card.
   */
  static renderExecutionCard(record: {
    id: string;
    language: string;
    code: string;
    result: {
      status: string;
      success: boolean;
      executionTimeMs: number;
      toolCallsExecuted: number;
      output: string;
    };
  }): string {
    const lines: string[] = [];
    const statusColor = record.result.success ? "\x1b[32m" : "\x1b[31m";
    lines.push(`┌── ⚡ EXECUTION RECORD [${record.id}] ──────────────────────────────────┐`);
    lines.push(`│  Language: \x1b[36m${record.language.toUpperCase()}\x1b[0m │ Status: ${statusColor}${record.result.status.toUpperCase()}\x1b[0m │ Duration: ${record.result.executionTimeMs} ms │ Tools: ${record.result.toolCallsExecuted}`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Code:`);
    const codeLines = record.code.split("\n").slice(0, 3);
    for (const cl of codeLines) {
      lines.push(`│    \x1b[90m${cl.slice(0, 68)}\x1b[0m`);
    }
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Output: ${record.result.output.slice(0, 65)}`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Virtual Display & Computer Use ANSI Dashboard.
   */
  static renderComputerUseDashboard(metrics: {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    overallSuccessRate: number;
    avgActionLatencyMs: number;
    p95ActionLatencyMs: number;
    displayResolution: string;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🖥️ VIRTUAL DISPLAY & OS AUTOMATION DASHBOARD ────────────────────────┐`);
    lines.push(`│  Actions: ${String(metrics.totalActions).padEnd(5)} │ Passed: \x1b[32m${String(metrics.successfulActions).padEnd(5)}\x1b[0m │ Failed: \x1b[31m${String(metrics.failedActions).padEnd(5)}\x1b[0m │ Resolution: ${metrics.displayResolution}`);
    lines.push(`│  Success Rate: \x1b[1;32m${(metrics.overallSuccessRate * 100).toFixed(0)}%\x1b[0m  │ Avg Latency: ${metrics.avgActionLatencyMs} ms (p95: ${metrics.p95ActionLatencyMs} ms)`);

    const barWidth = 40;
    const passedBars = metrics.totalActions > 0 ? Math.round((metrics.successfulActions / metrics.totalActions) * barWidth) : 0;
    const failedBars = barWidth - passedBars;
    const barStr = `\x1b[32m${"█".repeat(passedBars)}\x1b[31m${"░".repeat(failedBars)}\x1b[0m`;
    lines.push(`│  Action Meter:  [${barStr}]`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive computer action frame card.
   */
  static renderComputerUseCard(action: {
    actionId?: string;
    action: string;
    success: boolean;
    durationMs: number;
    frame: {
      frameIndex: number;
      cursor: { x: number; y: number; pressed: boolean };
      activeWindowId?: string;
      elements: readonly { id: number; label: string; role: string }[];
    };
  }): string {
    const lines: string[] = [];
    const statusColor = action.success ? "\x1b[32m" : "\x1b[31m";
    lines.push(`┌── 🖥️ COMPUTER ACTION [${action.actionId ?? "act_unknown"}] ─────────────────────────────┐`);
    lines.push(`│  Action: \x1b[36m${action.action.toUpperCase()}\x1b[0m │ Status: ${statusColor}${action.success ? "SUCCESS" : "FAILURE"}\x1b[0m │ Frame: #${action.frame.frameIndex} │ Latency: ${action.durationMs} ms`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Cursor: (${action.frame.cursor.x}, ${action.frame.cursor.y}) pressed=${action.frame.cursor.pressed} │ Active Window: ${action.frame.activeWindowId ?? "none"}`);
    lines.push(`│  Elements Visible: ${action.frame.elements.length}`);
    const previewElems = action.frame.elements.slice(0, 3);
    for (const el of previewElems) {
      lines.push(`│    \x1b[33m[#${el.id}]\x1b[0m ${el.role.padEnd(8)}: ${el.label}`);
    }
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Context Compression & Compactor ANSI Dashboard.
   */
  static renderCompressionDashboard(metrics: {
    totalSummaries: number;
    totalCompactedTurns: number;
    totalTokensSaved: number;
    overallSavingsPercentage: number;
    avgOriginalTokens: number;
    avgCompressedTokens: number;
    p95TokensSaved: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 📦 SEMANTIC CONTEXT COMPRESSION & COMPACTOR DASHBOARD ──────────────┐`);
    lines.push(`│  Summaries: ${String(metrics.totalSummaries).padEnd(5)} │ Compacted Turns: ${String(metrics.totalCompactedTurns).padEnd(5)} │ Tokens Saved: \x1b[32m${metrics.totalTokensSaved.toLocaleString()}\x1b[0m`);
    lines.push(`│  Savings Rate: \x1b[1;32m${metrics.overallSavingsPercentage}%\x1b[0m  │ Avg Original: ${metrics.avgOriginalTokens} t  │ Avg Compressed: ${metrics.avgCompressedTokens} t`);

    const barWidth = 40;
    const savedBars = Math.min(barWidth, Math.round((metrics.overallSavingsPercentage / 100) * barWidth));
    const remBars = barWidth - savedBars;
    const barStr = `\x1b[32m${"█".repeat(savedBars)}\x1b[90m${"░".repeat(remBars)}\x1b[0m`;
    lines.push(`│  Savings Meter: [${barStr}]`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive compressed turn summary card.
   */
  static renderCompressionCard(summary: {
    id: string;
    sourceTurnStart: number;
    sourceTurnEnd: number;
    originalTokens: number;
    compressedTokens: number;
    resolvedGoals: readonly string[];
    pendingGoals: readonly string[];
    summaryText: string;
  }): string {
    const lines: string[] = [];
    const saved = Math.max(0, summary.originalTokens - summary.compressedTokens);
    lines.push(`┌── 📦 COMPRESSED BLOCK [${summary.id}] ─────────────────────────────────┐`);
    lines.push(`│  Turns: #${summary.sourceTurnStart} to #${summary.sourceTurnEnd} │ Original: ${summary.originalTokens} t │ Compressed: ${summary.compressedTokens} t │ Saved: \x1b[32m+${saved} t\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Summary Preview:`);
    const preview = summary.summaryText.split("\n").slice(0, 3);
    for (const pl of preview) {
      lines.push(`│    \x1b[90m${pl.slice(0, 68)}\x1b[0m`);
    }
    if (summary.resolvedGoals.length > 0) {
      lines.push(`│  Resolved: ${summary.resolvedGoals.slice(0, 2).join(", ")}`);
    }
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Agent Wallet ANSI Dashboard.
   */
  static renderWalletDashboard(metrics: {
    totalTrackedWallets: number;
    totalPortfolioValueUsd: number;
    chainDistribution: Readonly<Record<string, number>>;
    totalSimulations: number;
    totalQuotes: number;
    totalDeFiPositions: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 👛 AUTONOMOUS AGENT WALLET & DEFI DASHBOARD ────────────────────────┐`);
    lines.push(`│  Wallets: ${String(metrics.totalTrackedWallets).padEnd(5)} │ Portfolio Value: \x1b[1;32m$${metrics.totalPortfolioValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}\x1b[0m │ Simulations: ${metrics.totalSimulations}`);
    lines.push(`│  DeFi Positions: ${metrics.totalDeFiPositions} │ Swap Quotes: ${metrics.totalQuotes}`);

    const chainEntries = Object.entries(metrics.chainDistribution).map(([c, n]) => `${c.toUpperCase()}: ${n}`).join(" │ ");
    if (chainEntries.length > 0) {
      lines.push(`│  Chains: \x1b[36m${chainEntries.slice(0, 64)}\x1b[0m`);
    }
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive wallet portfolio card.
   */
  static renderWalletCard(portfolio: {
    address: string;
    chain: string;
    ensName?: string;
    nativeBalance: number;
    nativeSymbol: string;
    totalPortfolioValueUsd: number;
    tokens: readonly { symbol: string; balance: number; totalValueUsd: number }[];
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 👛 PORTFOLIO [${portfolio.chain.toUpperCase()}] ──────────────────────────────────────┐`);
    lines.push(`│  Address: \x1b[33m${portfolio.address.slice(0, 20)}...\x1b[0m ${portfolio.ensName ? `(${portfolio.ensName})` : ""} │ Total: \x1b[32m$${portfolio.totalPortfolioValueUsd.toFixed(2)}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Native: ${portfolio.nativeBalance} ${portfolio.nativeSymbol}`);
    lines.push(`│  Tokens (${portfolio.tokens.length} assets):`);
    for (const t of portfolio.tokens.slice(0, 3)) {
      lines.push(`│    • ${t.symbol.padEnd(8)}: ${t.balance} ($${t.totalValueUsd.toFixed(2)})`);
    }
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Agent Profile ANSI Dashboard.
   */
  static renderProfileDashboard(metrics: {
    totalProfiles: number;
    activeProfiles: number;
    suspendedProfiles: number;
    archivedProfiles: number;
    totalBoundSessions: number;
    categoryDistribution: Readonly<Record<string, number>>;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 👤 PERSISTENT MULTI-PROFILE ORCHESTRATOR ───────────────────────────┐`);
    lines.push(`│  Profiles: ${String(metrics.totalProfiles).padEnd(4)} │ Active: \x1b[1;32m${String(metrics.activeProfiles).padEnd(4)}\x1b[0m │ Bound Sessions: ${metrics.totalBoundSessions}`);
    lines.push(`│  Suspended: ${metrics.suspendedProfiles} │ Archived: ${metrics.archivedProfiles}`);

    const catEntries = Object.entries(metrics.categoryDistribution).map(([c, n]) => `${c.toUpperCase()}: ${n}`).join(" │ ");
    if (catEntries.length > 0) {
      lines.push(`│  Categories: \x1b[36m${catEntries.slice(0, 60)}\x1b[0m`);
    }
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive profile descriptor card.
   */
  static renderProfileCard(profile: {
    id: string;
    name: string;
    description: string;
    category?: string;
    icon?: string;
    status: string;
    modelPreference?: string;
    soulPrompt: string;
    customAxioms?: readonly string[];
  }): string {
    const lines: string[] = [];
    lines.push(`┌── ${profile.icon || "👤"} PROFILE: [${profile.id.toUpperCase()}] ───────────────────────────────────┐`);
    lines.push(`│  Name: \x1b[1;36m${profile.name.slice(0, 24).padEnd(24)}\x1b[0m │ Category: ${(profile.category || "general").toUpperCase()} │ Status: \x1b[32m${profile.status.toUpperCase()}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Model: ${profile.modelPreference || "default"}`);
    lines.push(`│  Soul Prompt: \x1b[90m${profile.soulPrompt.slice(0, 60)}...\x1b[0m`);
    if (profile.customAxioms && profile.customAxioms.length > 0) {
      lines.push(`│  Axioms: ${profile.customAxioms.slice(0, 2).join(" • ")}`);
    }
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Title & Epistemic Insights ANSI Dashboard.
   */
  static renderTitleInsightsDashboard(metrics: {
    totalTitles: number;
    userCustomTitles: number;
    llmUpgradedTitles: number;
    instantDerivedTitles: number;
    totalActivityEvents: number;
    totalCostUsd: number;
    averageLatencyMs: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🏷️ CONVERSATION TITLE & EPISTEMIC INSIGHTS ─────────────────────────┐`);
    lines.push(`│  Titles: ${String(metrics.totalTitles).padEnd(4)} │ LLM: \x1b[1;32m${String(metrics.llmUpgradedTitles).padEnd(4)}\x1b[0m │ Derived: ${String(metrics.instantDerivedTitles).padEnd(4)} │ User: ${metrics.userCustomTitles}`);
    lines.push(`│  Events: ${String(metrics.totalActivityEvents).padEnd(6)} │ Cost: \x1b[32m$${metrics.totalCostUsd.toFixed(4)}\x1b[0m │ Latency: ${metrics.averageLatencyMs} ms`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive session title card.
   */
  static renderSessionTitleCard(record: {
    sessionId: string;
    title: string;
    provenance: string;
    costUsd: number;
    latencyMs: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🏷️ SESSION TITLE: [${record.sessionId.slice(0, 16)}...] ────────────────────────────┐`);
    lines.push(`│  Title: \x1b[1;36m${record.title.slice(0, 48).padEnd(48)}\x1b[0m │ Provenance: \x1b[32m${record.provenance.toUpperCase()}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Cost: $${record.costUsd.toFixed(4)} │ Latency: ${record.latencyMs} ms`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Dollar-Denominated Billing & Dual Token Bar ANSI Dashboard.
   */
  static renderBillingUsageDashboard(model: {
    status: string;
    totalSpendableUsd: number;
    planRemainingUsd: number;
    planAllowanceUsd: number;
    topupRemainingUsd: number;
    planBar?: { pctUsed?: number; fillFraction: number };
    topupBar?: { fillFraction: number };
  }): string {
    const lines: string[] = [];
    const statusColor = model.status === "exhausted" ? "\x1b[31m" : model.status === "low_balance" ? "\x1b[33m" : "\x1b[32m";
    lines.push(`┌── 💳 BILLING USAGE & DUAL-TIER CREDIT METER ─────────────────────────┐`);
    lines.push(`│  Status: ${statusColor}${model.status.toUpperCase()}\x1b[0m │ Total Spendable: \x1b[1;36m$${model.totalSpendableUsd.toFixed(2)}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    if (model.planBar) {
      const bar = "█".repeat(Math.round(model.planBar.fillFraction * 16)).padEnd(16, "░");
      lines.push(`│  Plan:  $${model.planRemainingUsd.toFixed(2)} / $${model.planAllowanceUsd.toFixed(2)} [${bar}] (${model.planBar.pctUsed || 0}% used)`);
    }
    if (model.topupBar) {
      const bar = "█".repeat(Math.round(model.topupBar.fillFraction * 16)).padEnd(16, "░");
      lines.push(`│  Topup: $${model.topupRemainingUsd.toFixed(2)} [${bar}] (Rolls over)`);
    }
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive billing transaction card.
   */
  static renderBillingTransactionCard(tx: {
    id: string;
    type: string;
    amountUsd: number;
    planDebitedUsd: number;
    topupDebitedUsd: number;
    reason?: string;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 💳 TRANSACTION: [${tx.id}] ───────────────────────────────────────┐`);
    lines.push(`│  Type: \x1b[1;36m${tx.type.toUpperCase()}\x1b[0m │ Amount: \x1b[32m$${tx.amountUsd.toFixed(4)}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Plan Debit: $${tx.planDebitedUsd.toFixed(4)} │ Topup Debit: $${tx.topupDebitedUsd.toFixed(4)}`);
    if (tx.reason) {
      lines.push(`│  Reason: ${tx.reason.slice(0, 60)}`);
    }
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Async Context & Security Governance ANSI Dashboard.
   */
  static renderThreadContextDashboard(metrics: {
    totalContextsSpawned: number;
    activeContextCount: number;
    totalExecutionsWrapped: number;
    totalApprovalsInherited: number;
    totalFailClosedBlocks: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🧵 ASYNC CONTEXT PROPAGATION & SECURITY GOVERNANCE ─────────────────┐`);
    lines.push(`│  Active: \x1b[1;32m${String(metrics.activeContextCount).padEnd(4)}\x1b[0m │ Spawned: ${String(metrics.totalContextsSpawned).padEnd(5)} │ Wrapped: ${metrics.totalExecutionsWrapped}`);
    lines.push(`│  Approvals Inherited: \x1b[36m${metrics.totalApprovalsInherited}\x1b[0m │ Fail-Closed Blocks: \x1b[31m${metrics.totalFailClosedBlocks}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive thread context descriptor card.
   */
  static renderThreadContextCard(desc: {
    contextId: string;
    parentSessionId: string;
    platform: string;
    isInteractive: boolean;
    hasApprovalCallback: boolean;
    hasSudoCallback: boolean;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🧵 THREAD CONTEXT: [${desc.contextId}] ───────────────────────────────┐`);
    lines.push(`│  Parent: ${desc.parentSessionId.slice(0, 24).padEnd(24)} │ Platform: \x1b[1;36m${desc.platform.toUpperCase()}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Interactive: ${desc.isInteractive ? "YES" : "NO"} │ Approvals: ${desc.hasApprovalCallback ? "\x1b[32mINHERITED\x1b[0m" : "\x1b[31mNONE\x1b[0m"} │ Sudo: ${desc.hasSudoCallback ? "\x1b[32mYES\x1b[0m" : "NO"}`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Background Review & Post-Turn Self-Improvement ANSI Dashboard.
   */
  static renderBackgroundReviewDashboard(summary: {
    totalReviews: number;
    totalCandidateFacts: number;
    totalCandidateSkills: number;
    healthStatus: string;
    latestTurnIndex: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🔍 BACKGROUND REVIEW & POST-TURN SELF-IMPROVEMENT ─────────────────┐`);
    lines.push(`│  Total Reviews: \x1b[1;32m${String(summary.totalReviews).padEnd(4)}\x1b[0m │ Latest Turn: #${String(summary.latestTurnIndex).padEnd(3)} │ Health: \x1b[36m${summary.healthStatus.toUpperCase()}\x1b[0m`);
    lines.push(`│  Candidate Facts: \x1b[1;33m${String(summary.totalCandidateFacts).padEnd(4)}\x1b[0m │ Candidate Skills: \x1b[1;35m${summary.totalCandidateSkills}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive turn review descriptor card.
   */
  static renderTurnReviewCard(review: {
    reviewId: string;
    turnIndex: number;
    userGoal: string;
    assistantActionSummary: string;
    factsCount: number;
    skillsCount: number;
    durationMs: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🔍 TURN REVIEW: [Turn #${review.turnIndex}] ─────────────────────────────┐`);
    lines.push(`│  Review ID: ${review.reviewId.slice(0, 24).padEnd(24)} │ Latency: ${review.durationMs}ms`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  User Goal: ${review.userGoal.slice(0, 56)}`);
    lines.push(`│  Assistant: ${review.assistantActionSummary.slice(0, 56)}`);
    lines.push(`│  Extracted: \x1b[33m${review.factsCount} facts\x1b[0m │ \x1b[35m${review.skillsCount} skills\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Diagnostic Doctor & Live Health Probing ANSI Dashboard.
   */
  static renderDiagnosticDoctorDashboard(report: {
    reportId: string;
    overallHealth: string;
    totalChecks: number;
    healthyCount: number;
    warningCount: number;
    criticalCount: number;
    durationMs: number;
  }): string {
    const lines: string[] = [];
    const healthColor = report.overallHealth === "healthy" ? "\x1b[1;32m" : report.overallHealth === "warning" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 🩺 DIAGNOSTIC DOCTOR & SYSTEM HEALTH PROBING ───────────────────────┐`);
    lines.push(`│  Report ID: ${report.reportId.slice(0, 20).padEnd(20)} │ Health: ${healthColor}${report.overallHealth.toUpperCase()}\x1b[0m │ Time: ${report.durationMs}ms`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Total Checks: ${String(report.totalChecks).padEnd(3)} │ Healthy: \x1b[32m${report.healthyCount}\x1b[0m │ Warning: \x1b[33m${report.warningCount}\x1b[0m │ Critical: \x1b[31m${report.criticalCount}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive diagnostic check descriptor card.
   */
  static renderDiagnosticCheckCard(check: {
    checkId: string;
    category: string;
    severity: string;
    message: string;
  }): string {
    const lines: string[] = [];
    const sevColor = check.severity === "healthy" ? "\x1b[32m" : check.severity === "warning" ? "\x1b[33m" : "\x1b[31m";
    lines.push(`┌── 🩺 CHECK: [${check.checkId}] ──────────────────────────────────────┐`);
    lines.push(`│  Category: \x1b[1;36m${check.category.toUpperCase()}\x1b[0m │ Severity: ${sevColor}${check.severity.toUpperCase()}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Message: ${check.message.slice(0, 60)}`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Identity Federation & Token Lease Vault ANSI Dashboard.
   */
  static renderIdentityFederationDashboard(summary: {
    activeLeases: number;
    pendingAuths: number;
    expiredLeases: number;
    healthStatus: string;
    providers: readonly string[];
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 🔐 IDENTITY FEDERATION & TOKEN LEASE VAULT ──────────────────────────┐`);
    lines.push(`│  Active Leases: \x1b[1;36m${String(summary.activeLeases).padEnd(4)}\x1b[0m │ Pending Logins: \x1b[33m${String(summary.pendingAuths).padEnd(3)}\x1b[0m │ Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Expired: \x1b[31m${summary.expiredLeases}\x1b[0m │ Providers: ${summary.providers.slice(0, 4).join(", ") || "None"}`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive token lease descriptor card.
   */
  static renderTokenLeaseCard(lease: {
    leaseId: string;
    providerId: string;
    tier: string;
    scope: string;
    expiresAt: number;
  }): string {
    const lines: string[] = [];
    const isExpired = lease.expiresAt <= Date.now();
    const statusColor = isExpired ? "\x1b[31m" : "\x1b[32m";
    lines.push(`┌── 🔐 TOKEN LEASE: [${lease.leaseId}] ─────────────────────────────────┐`);
    lines.push(`│  Provider: \x1b[1;36m${lease.providerId.toUpperCase()}\x1b[0m │ Tier: \x1b[35m${lease.tier.toUpperCase()}\x1b[0m │ Status: ${statusColor}${isExpired ? "EXPIRED" : "ACTIVE"}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Scope: ${lease.scope.slice(0, 60)}`);
    lines.push(`│  Expires: ${new Date(lease.expiresAt).toISOString()}`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Session Archive & Cold Storage Vault ANSI Dashboard.
   */
  static renderSessionArchiveDashboard(summary: {
    totalArchives: number;
    totalSizeBytes: number;
    healthStatus: string;
    markdownCount: number;
    htmlCount: number;
    jsonlCount: number;
    binaryCount: number;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 📦 SESSION ARCHIVE & COLD STORAGE VAULT ────────────────────────────┐`);
    lines.push(`│  Total Archives: \x1b[1;36m${String(summary.totalArchives).padEnd(4)}\x1b[0m │ Size: \x1b[35m${(summary.totalSizeBytes / 1024).toFixed(1)} KB\x1b[0m │ Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  MD: \x1b[32m${summary.markdownCount}\x1b[0m │ HTML: \x1b[36m${summary.htmlCount}\x1b[0m │ JSONL: \x1b[33m${summary.jsonlCount}\x1b[0m │ BIN: \x1b[35m${summary.binaryCount}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive archive manifest descriptor card.
   */
  static renderArchiveManifestCard(manifest: {
    archiveId: string;
    sessionId: string;
    format: string;
    turnCount: number;
    totalSizeBytes: number;
    sha256Checksum: string;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 📦 ARCHIVE MANIFEST: [${manifest.archiveId}] ───────────────────────┐`);
    lines.push(`│  Session: \x1b[1;36m${manifest.sessionId}\x1b[0m │ Format: \x1b[35m${manifest.format.toUpperCase()}\x1b[0m │ Turns: ${manifest.turnCount}`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Size: ${manifest.totalSizeBytes} bytes │ SHA: \x1b[33m${manifest.sha256Checksum.slice(0, 16)}...\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Enterprise Integrations Hub ANSI Dashboard.
   */
  static renderIntegrationsDashboard(summary: {
    totalConnections: number;
    activeConnections: number;
    totalRecipes: number;
    totalRequests: number;
    overallStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.overallStatus === "optimal" || summary.overallStatus === "HEALTHY" ? "\x1b[1;32m" : summary.overallStatus === "degraded" || summary.overallStatus === "DEGRADED" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 🔌 ENTERPRISE INTEGRATIONS HUB ─────────────────────────────────────┐`);
    lines.push(`│  Connections: \x1b[1;36m${summary.activeConnections}/${summary.totalConnections}\x1b[0m │ Recipes: \x1b[35m${summary.totalRecipes}\x1b[0m │ Health: ${healthColor}${summary.overallStatus.toUpperCase()}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Total Requests: \x1b[32m${summary.totalRequests}\x1b[0m │ Providers: \x1b[36mGitHub, Linear, Stripe, Sentry, Notion\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive integration recipe descriptor card.
   */
  static renderIntegrationRecipeCard(recipe: {
    recipeId: string;
    title: string;
    category: string;
    triggerEvent: string;
    stepsCount: number;
    executionCount: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── ⚡ WORKFLOW RECIPE: [${recipe.recipeId}] ─────────────────────────┐`);
    lines.push(`│  Title: \x1b[1;36m${recipe.title}\x1b[0m │ Category: \x1b[35m${recipe.category}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Trigger: \x1b[33m${recipe.triggerEvent}\x1b[0m │ Steps: ${recipe.stepsCount} │ Runs: ${recipe.executionCount}`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Verification Evidence & Quality Gates ANSI Dashboard.
   */
  static renderVerificationEvidenceDashboard(summary: {
    totalEvidence: number;
    passedCount: number;
    failedCount: number;
    passRatePercent: number;
    unverifiedFilesCount: number;
    healthStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 🛡️ VERIFICATION EVIDENCE & QUALITY GATES ───────────────────────────┐`);
    lines.push(`│  Total Evidence: \x1b[1;36m${summary.totalEvidence}\x1b[0m │ Pass Rate: \x1b[1;32m${summary.passRatePercent}%\x1b[0m │ Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Passed: \x1b[32m${summary.passedCount}\x1b[0m │ Failed: \x1b[31m${summary.failedCount}\x1b[0m │ Unverified Files: \x1b[33m${summary.unverifiedFilesCount}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive verification evidence descriptor card.
   */
  static renderVerificationEvidenceCard(record: {
    id: string;
    kind: string;
    scope: string;
    command: string;
    passed: boolean;
    durationMs: number;
    exitCode: number;
  }): string {
    const lines: string[] = [];
    const statusColor = record.passed ? "\x1b[1;32mPASSED\x1b[0m" : "\x1b[1;31mFAILED\x1b[0m";
    lines.push(`┌── 🛡️ EVIDENCE: [${record.id}] ────────────────────────────────────────┐`);
    lines.push(`│  Kind: \x1b[1;36m${record.kind.toUpperCase()}\x1b[0m │ Scope: ${record.scope} │ Status: ${statusColor}`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Command: \x1b[33m${record.command.slice(0, 60)}\x1b[0m`);
    lines.push(`│  Duration: ${record.durationMs} ms │ Exit Code: ${record.exitCode}`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Patch Mutation & Staged Files ANSI Dashboard.
   */
  static renderPatchMutationDashboard(summary: {
    totalStaged: number;
    totalCommitted: number;
    totalReverted: number;
    totalBytesStaged: number;
    healthStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 📝 ATOMIC PATCH & FILE MUTATION LEDGER ─────────────────────────────┐`);
    lines.push(`│  Active Staged: \x1b[1;36m${summary.totalStaged}\x1b[0m │ Staged Bytes: \x1b[1;33m${summary.totalBytesStaged}\x1b[0m │ Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Committed: \x1b[32m${summary.totalCommitted}\x1b[0m │ Reverted: \x1b[31m${summary.totalReverted}\x1b[0m │ Mode: \x1b[35mTRANSACTIONAL\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive patch operation descriptor card.
   */
  static renderPatchOperationCard(op: {
    filePath: string;
    type: string;
    hunksCount: number;
    newPath?: string;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 📝 PATCH OPERATION: [${op.type.toUpperCase()}] ─────────────────────────┐`);
    lines.push(`│  Target: \x1b[1;36m${op.filePath}\x1b[0m`);
    if (op.newPath) lines.push(`│  New Path: \x1b[33m${op.newPath}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Hunks: \x1b[35m${op.hunksCount}\x1b[0m │ Strategy: \x1b[32mZERO-DRIFT FUZZY\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Skill Tree Linter ANSI Dashboard.
   */
  static renderSkillLinterDashboard(summary: {
    totalSkills: number;
    cleanSkills: number;
    totalErrors: number;
    totalWarnings: number;
    complianceRate: number;
    healthStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 🧬 SKILL TREE LINTER & CONVENTIONS LEDGER ──────────────────────────┐`);
    lines.push(`│  Audited Skills: \x1b[1;36m${summary.totalSkills}\x1b[0m │ Clean Skills: \x1b[1;32m${summary.cleanSkills}\x1b[0m │ Compliance: \x1b[1;35m${summary.complianceRate}%\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Errors: \x1b[31m${summary.totalErrors}\x1b[0m │ Warnings: \x1b[33m${summary.totalWarnings}\x1b[0m │ Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive skill lint finding descriptor card.
   */
  static renderSkillLintFindingCard(finding: {
    ruleCode: string;
    severity: string;
    message: string;
    file?: string;
    suggestedFix?: string;
  }): string {
    const lines: string[] = [];
    const sevColor = finding.severity === "error" ? "\x1b[1;31mERROR\x1b[0m" : "\x1b[1;33mWARNING\x1b[0m";
    lines.push(`┌── 🧬 SKILL LINT FINDING: [${finding.ruleCode}] ────────────────────────┐`);
    lines.push(`│  Severity: ${sevColor} │ File: ${finding.file || "SKILL.md"}`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Message: \x1b[37m${finding.message.slice(0, 60)}\x1b[0m`);
    if (finding.suggestedFix) {
      lines.push(`│  💡 Fix: \x1b[32m${finding.suggestedFix.slice(0, 60)}\x1b[0m`);
    }
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Terminal Output Cleaner ANSI Dashboard.
   */
  static renderTerminalCleanerDashboard(summary: {
    totalCleaned: number;
    ansiStripped: number;
    controlFiltered: number;
    blockedWrites: number;
    healthStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 🧹 TERMINAL OUTPUT CLEANER & ANSI SANITIZER ────────────────────────┐`);
    lines.push(`│  Strings Cleaned: \x1b[1;36m${summary.totalCleaned}\x1b[0m │ ANSI Stripped: \x1b[1;32m${summary.ansiStripped}\x1b[0m │ Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Control Filtered: \x1b[33m${summary.controlFiltered}\x1b[0m │ Blocked Writes: \x1b[31m${summary.blockedWrites}\x1b[0m │ Mode: \x1b[35mZERO-GC ECMA-48\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive terminal clean event card.
   */
  static renderTerminalCleanEventCard(event: {
    id: string;
    mode: string;
    originalLength: number;
    cleanedLength: number;
    ansiCodesCount: number;
  }): string {
    const lines: string[] = [];
    const ratio = event.originalLength > 0 ? ((event.cleanedLength / event.originalLength) * 100).toFixed(1) : "100.0";
    lines.push(`┌── 🧹 TERMINAL CLEAN EVENT: [${event.id}] ──────────────────────────────┐`);
    lines.push(`│  Mode: \x1b[1;36m${event.mode.toUpperCase()}\x1b[0m │ Retained: \x1b[32m${ratio}%\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Size: ${event.originalLength}B -> ${event.cleanedLength}B │ ANSI Codes Stripped: \x1b[33m${event.ansiCodesCount}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Streaming Scrubber ANSI Dashboard.
   */
  static renderStreamingScrubberDashboard(summary: {
    totalDeltas: number;
    suppressedChunks: number;
    blocksEncountered: number;
    activeSessions: number;
    healthStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 🧬 STREAMING REASONING TAG SCRUBBER ────────────────────────────────┐`);
    lines.push(`│  Deltas: \x1b[1;36m${summary.totalDeltas}\x1b[0m │ Suppressed: \x1b[1;31m${summary.suppressedChunks}\x1b[0m │ Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Blocks: \x1b[32m${summary.blocksEncountered}\x1b[0m │ Active Sessions: \x1b[33m${summary.activeSessions}\x1b[0m │ Mode: \x1b[35mZERO-GC BUFFER\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive streaming scrubber event card.
   */
  static renderStreamingScrubberEventCard(event: {
    id: string;
    sessionId: string;
    turnIndex: number;
    deltaSize: number;
    emittedSize: number;
    inBlock: boolean;
  }): string {
    const lines: string[] = [];
    const blockColor = event.inBlock ? "\x1b[1;31mIN_BLOCK\x1b[0m" : "\x1b[1;32mOUTSIDE_BLOCK\x1b[0m";
    lines.push(`┌── 🧬 STREAM SCRUB EVENT: [${event.id}] ──────────────────────────────┐`);
    lines.push(`│  Session: \x1b[1;36m${event.sessionId}\x1b[0m (Turn #${event.turnIndex}) │ Status: ${blockColor}`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Delta: ${event.deltaSize}B -> Emitted: \x1b[32m${event.emittedSize}B\x1b[0m │ Discarded: \x1b[31m${Math.max(0, event.deltaSize - event.emittedSize)}B\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Self-Repository Mutation Guard ANSI Dashboard.
   */
  static renderSelfRepoGuardDashboard(summary: {
    totalInspected: number;
    blockedMutations: number;
    safePassed: number;
    foreignAllowed: number;
    healthStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 🛡️ SELF-REPOSITORY MUTATION GUARD ─────────────────────────────────┐`);
    lines.push(`│  Commands: \x1b[1;36m${summary.totalInspected}\x1b[0m │ Blocked: \x1b[1;31m${summary.blockedMutations}\x1b[0m │ Safe: \x1b[1;32m${summary.safePassed}\x1b[0m │ Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Foreign Repos: \x1b[33m${summary.foreignAllowed}\x1b[0m │ Sandbox Mode: \x1b[35mWORKTREE ISOLATED\x1b[0m │ Zero-GC AST`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive self-repo guard incident card.
   */
  static renderSelfRepoGuardIncidentCard(incident: {
    incidentId: string;
    operation: string;
    command: string;
    targetPath: string;
    reason: string;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🛡️ BLOCKED MUTATION INCIDENT: [${incident.incidentId}] ─────────────┐`);
    lines.push(`│  Operation: \x1b[1;31m${incident.operation.toUpperCase()}\x1b[0m │ Target: ${incident.targetPath.slice(0, 45)}`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Command: \x1b[37m${incident.command.slice(0, 60)}\x1b[0m`);
    lines.push(`│  Reason: \x1b[33m${incident.reason.slice(0, 60)}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Preflight Threat Gate ANSI Dashboard.
   */
  static renderPreflightDashboard(summary: {
    totalScans: number;
    totalBlocked: number;
    totalWarned: number;
    totalAllowed: number;
    breakerTripped: boolean;
    healthStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    const breakerColor = summary.breakerTripped ? "\x1b[1;31mTRIPPED\x1b[0m" : "\x1b[1;32mCLOSED\x1b[0m";
    lines.push(`┌── 🔍 PREFLIGHT SECURITY THREAT GATE ─────────────────────────────────┐`);
    lines.push(`│  Scans: \x1b[1;36m${summary.totalScans}\x1b[0m │ Blocked: \x1b[1;31m${summary.totalBlocked}\x1b[0m │ Warned: \x1b[1;33m${summary.totalWarned}\x1b[0m │ Allowed: \x1b[1;32m${summary.totalAllowed}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m │ Breaker: ${breakerColor} │ Cosign Provenance: \x1b[32mVERIFIED\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive preflight threat card.
   */
  static renderPreflightThreatCard(finding: {
    category: string;
    severity: string;
    description: string;
    matchedPattern: string;
    remediation: string;
  }): string {
    const lines: string[] = [];
    const sevColor = finding.severity === "critical" ? "\x1b[1;31m" : finding.severity === "high" ? "\x1b[1;35m" : "\x1b[1;33m";
    lines.push(`┌── ⚠️ PREFLIGHT THREAT FINDING: [${finding.category.toUpperCase()}] ─────────┐`);
    lines.push(`│  Severity: ${sevColor}${finding.severity.toUpperCase()}\x1b[0m │ Pattern: ${finding.matchedPattern.slice(0, 40)}`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Description: \x1b[37m${finding.description.slice(0, 60)}\x1b[0m`);
    lines.push(`│  Remediation: \x1b[32m${finding.remediation.slice(0, 60)}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Schema Sanitizer ANSI Dashboard.
   */
  static renderSchemaSanitizerDashboard(summary: {
    totalSchemas: number;
    renamedKeys: number;
    collapsedUnions: number;
    strippedSiblings: number;
    cleanedCombinators: number;
    healthStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 🧬 JSON SCHEMA SANITIZER & GBNF FIREWALL ──────────────────────────┐`);
    lines.push(`│  Schemas: \x1b[1;36m${summary.totalSchemas}\x1b[0m │ Renamed: \x1b[1;31m${summary.renamedKeys}\x1b[0m │ Unions Collapsed: \x1b[1;32m${summary.collapsedUnions}\x1b[0m │ Sibling Stripped: \x1b[1;33m${summary.strippedSiblings}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m │ Top-Level Combinators Cleaned: \x1b[35m${summary.cleanedCombinators}\x1b[0m │ Zero-GC AST`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive schema sanitization event card.
   */
  static renderSchemaSanitizationEventCard(event: {
    eventId: string;
    schemaName: string;
    renamedKeyCount: number;
    mutationsApplied: readonly string[];
    warnings: readonly string[];
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🧬 SCHEMA SANITIZATION EVENT: [${event.eventId}] ────────────────────┐`);
    lines.push(`│  Tool/Schema: \x1b[1;36m${event.schemaName}\x1b[0m │ Renamed Keys: \x1b[33m${event.renamedKeyCount}\x1b[0m │ Mutations: \x1b[32m${event.mutationsApplied.length}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Mutations: \x1b[37m${(event.mutationsApplied.join(", ") || "none").slice(0, 58)}\x1b[0m`);
    lines.push(`│  Warnings: \x1b[31m${(event.warnings.join(", ") || "none").slice(0, 59)}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the OSV Vulnerability Scanner ANSI Dashboard.
   */
  static renderOsvDashboard(summaryOrSubstrate: any): string {
    const isSubstrate = typeof summaryOrSubstrate?.getMetrics === "function";
    const metrics = isSubstrate ? summaryOrSubstrate.getMetrics() : summaryOrSubstrate;
    const health = isSubstrate && typeof summaryOrSubstrate.auditHealth === "function" ? summaryOrSubstrate.auditHealth() : summaryOrSubstrate;
    const totalScans = metrics?.totalScans || 0;
    const malwareBlocked = metrics?.malwareBlocked || 0;
    const cleanAllowed = metrics?.cleanAllowed || 0;
    const cacheHits = metrics?.cacheHits || 0;
    const hitRate = summaryOrSubstrate?.hitRate ?? (totalScans === 0 ? 0 : Number(((cacheHits / totalScans) * 100).toFixed(1)));
    const healthStatus = health?.healthStatus || summaryOrSubstrate?.healthStatus || "optimal";

    const lines: string[] = [];
    const healthColor = healthStatus === "optimal" ? "\x1b[1;32m" : healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 🛡️ OSV MALWARE SCANNER & PACKAGE FIREWALL ──────────────────────────┐`);
    lines.push(`│  Scans: \x1b[1;36m${totalScans}\x1b[0m │ Blocked: \x1b[1;31m${malwareBlocked}\x1b[0m │ Allowed: \x1b[1;32m${cleanAllowed}\x1b[0m │ Cache Hits: \x1b[1;33m${cacheHits} (${hitRate}%)\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Health: ${healthColor}${String(healthStatus).toUpperCase()}\x1b[0m │ OSV.dev Advisory Sync: \x1b[32mACTIVE\x1b[0m │ Fail-Open: \x1b[36mREADY\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive OSV advisory finding card.
   */
  static renderOsvAdvisoryCard(advisory: {
    id: string;
    summary: string;
    isMalware: boolean;
    published?: string;
  }): string {
    const lines: string[] = [];
    const malColor = advisory.isMalware ? "\x1b[1;31mMALWARE\x1b[0m" : "\x1b[1;33mVULNERABILITY\x1b[0m";
    lines.push(`┌── ⚠️ OSV SECURITY ADVISORY: [${advisory.id}] ──────────────────────────┐`);
    lines.push(`│  Severity Type: ${malColor} │ Published: \x1b[37m${(advisory.published || "N/A").slice(0, 30)}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Summary: \x1b[37m${advisory.summary.slice(0, 60)}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Prompt Cache Optimizer ANSI Dashboard.
   */
  static renderPromptCacheDashboard(summary: {
    totalEnvelopes: number;
    totalBreakpoints: number;
    totalTokensCached: number;
    sanitizedReasonings: number;
    coveragePercent: number;
    healthStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── ⚡ PROMPT CACHE OPTIMIZER & BOUNDARY CALCULATOR ────────────────────┐`);
    lines.push(`│  Envelopes: \x1b[1;36m${summary.totalEnvelopes}\x1b[0m │ Breakpoints: \x1b[1;32m${summary.totalBreakpoints}\x1b[0m │ Cached Tokens: \x1b[1;33m~${summary.totalTokensCached}\x1b[0m │ Cleaned: \x1b[1;35m${summary.sanitizedReasonings}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m │ Static Prefix Coverage: \x1b[32m${summary.coveragePercent}%\x1b[0m │ Byte Stability: \x1b[36m100%\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive prompt cache breakpoint card.
   */
  static renderPromptCacheBreakpointCard(breakpoint: {
    breakpointIndex: number;
    target: string;
    breakpointType: string;
    byteOffset: number;
    tokenEstimate: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 📍 PROMPT CACHE BREAKPOINT [#${breakpoint.breakpointIndex}] ───────────────────────┐`);
    lines.push(`│  Target: \x1b[1;36m${breakpoint.target}\x1b[0m │ Type: \x1b[33m${breakpoint.breakpointType}\x1b[0m │ Byte Offset: \x1b[32m${breakpoint.byteOffset}B\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Token Estimate: \x1b[1;37m~${breakpoint.tokenEstimate} tokens\x1b[0m │ Alignment: \x1b[32mEXACT-MATCH\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Progressive Tool Disclosure ANSI Dashboard.
   */
  static renderToolDisclosureDashboard(summary: {
    totalRegistered: number;
    eagerCount: number;
    deferredCount: number;
    activatedCount: number;
    activeTier: string;
    healthStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 🔍 PROGRESSIVE TOOL DISCLOSURE & DYNAMIC SCHEMA GATEWAY ────────────┐`);
    lines.push(`│  Registered: \x1b[1;36m${summary.totalRegistered}\x1b[0m │ Eager: \x1b[1;32m${summary.eagerCount}\x1b[0m │ Deferred: \x1b[1;33m${summary.deferredCount}\x1b[0m │ Activated: \x1b[1;35m${summary.activatedCount}\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m │ Active Tier: \x1b[1;36m${summary.activeTier.toUpperCase()}\x1b[0m │ Saved Tokens: \x1b[32m~${summary.deferredCount * 30}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive tool descriptor card.
   */
  static renderToolDisclosureCard(tool: {
    name: string;
    namespace: string;
    description: string;
    isCore: boolean;
    isActivated: boolean;
    tags: readonly string[];
  }): string {
    const lines: string[] = [];
    const coreBadge = tool.isCore ? "\x1b[1;32m[CORE]\x1b[0m" : "\x1b[1;33m[DEFERRED]\x1b[0m";
    const statusBadge = tool.isActivated ? "\x1b[1;32mACTIVATED\x1b[0m" : "\x1b[90mDORMANT\x1b[0m";
    lines.push(`┌── 🔧 TOOL DEFINITION: [${tool.name}] ───────────────────────────────┐`);
    lines.push(`│  Namespace: \x1b[1;36m${tool.namespace}\x1b[0m │ Type: ${coreBadge} │ State: ${statusBadge}`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Description: \x1b[37m${tool.description.slice(0, 56)}\x1b[0m`);
    lines.push(`│  Tags: \x1b[35m${tool.tags.join(", ").slice(0, 60)}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Subdirectory Hints ANSI Dashboard.
   */
  static renderSubdirHintsDashboard(summary: {
    totalHints: number;
    totalLoadedDirectories: number;
    totalBytesInjected: number;
    healthStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor = summary.healthStatus === "optimal" ? "\x1b[1;32m" : summary.healthStatus === "degraded" ? "\x1b[1;33m" : "\x1b[1;31m";
    lines.push(`┌── 📁 PROGRESSIVE SUBDIRECTORY CONTEXT HINTS DASHBOARD ────────────────┐`);
    lines.push(`│  Discovered Hints: \x1b[1;36m${summary.totalHints}\x1b[0m │ Loaded Dirs: \x1b[1;32m${summary.totalLoadedDirectories}\x1b[0m │ Injected: \x1b[1;35m${summary.totalBytesInjected} B\x1b[0m`);
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m │ Prefixes: \x1b[32mCACHE-PRESERVED\x1b[0m │ Deduplication: \x1b[36mSHA-256\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive subdirectory hint card.
   */
  static renderSubdirHintCard(hint: {
    filename: string;
    relativeDirectory: string;
    charCount: number;
    contentDigest: string;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 📄 HINT RULE: [${hint.filename}] ────────────────────────────────────┐`);
    lines.push(`│  Directory: \x1b[1;36m${hint.relativeDirectory || "."}\x1b[0m │ Chars: \x1b[33m${hint.charCount}\x1b[0m │ Digest: \x1b[32m${hint.contentDigest.slice(0, 10)}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Heredoc Terminal ANSI Dashboard.
   */
  static renderHeredocTerminalDashboard(summary: {
    totalSanitizations: number;
    totalMaskedBodies: number;
    totalDangerousCommandsBlocked: number;
    healthStatus: string;
  }): string {
    const lines: string[] = [];
    const healthColor =
      summary.healthStatus === "optimal"
        ? "\x1b[1;32m"
        : summary.healthStatus === "degraded"
        ? "\x1b[1;33m"
        : "\x1b[1;31m";
    lines.push(`┌── 💻 HEREDOC TERMINAL & SHELL SANITIZATION DASHBOARD ──────────────────┐`);
    lines.push(
      `│  Sanitizations: \x1b[1;36m${summary.totalSanitizations}\x1b[0m │ Masked Spans: \x1b[1;32m${summary.totalMaskedBodies}\x1b[0m │ Blocked: \x1b[1;31m${summary.totalDangerousCommandsBlocked}\x1b[0m`
    );
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(
      `│  Health: ${healthColor}${summary.healthStatus.toUpperCase()}\x1b[0m │ Fork Bomb Guard: \x1b[32mACTIVE\x1b[0m │ Line-Count: \x1b[36mPRESERVED\x1b[0m`
    );
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive heredoc sanitization card.
   */
  static renderHeredocSanitizationCard(card: {
    recordId: string;
    riskLevel: string;
    hasHeredocs: boolean;
    maskedBodiesCount: number;
    originalCommandPreview: string;
  }): string {
    const lines: string[] = [];
    const riskColor =
      card.riskLevel === "clean"
        ? "\x1b[1;32m"
        : card.riskLevel === "low"
        ? "\x1b[32m"
        : card.riskLevel === "medium"
        ? "\x1b[33m"
        : "\x1b[1;31m";
    lines.push(`┌── 🛡️ COMMAND RECORD: [${card.recordId}] ────────────────────────────────┐`);
    lines.push(
      `│  Risk: ${riskColor}${card.riskLevel.toUpperCase()}\x1b[0m │ Heredocs: \x1b[1;36m${card.hasHeredocs ? "YES" : "NO"}\x1b[0m │ Masked: \x1b[33m${card.maskedBodiesCount}\x1b[0m`
    );
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Command: \x1b[35m${card.originalCommandPreview.slice(0, 60)}\x1b[0m`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the SSRF Defense Firewall & URL Safety ANSI Dashboard.
   */
  static renderUrlSafetyDashboard(metrics: {
    totalChecks: number;
    allowedCount: number;
    blockedMetadataCount: number;
    blockedPrivateCount: number;
    blockedLoopbackCount: number;
    blockedCustomCount: number;
    status?: string;
  }): string {
    const lines: string[] = [];
    const statusColor =
      metrics.status === "critical"
        ? "\x1b[1;31m"
        : metrics.status === "degraded"
        ? "\x1b[1;33m"
        : "\x1b[1;32m";
    const statusStr = metrics.status ? ` │ Status: ${statusColor}${metrics.status.toUpperCase()}\x1b[0m` : "";

    lines.push(`┌── 🛡️ SSRF DEFENSE FIREWALL & URL SAFETY ───────────────────────────────┐`);
    lines.push(
      `│  Checks: ${String(metrics.totalChecks).padEnd(5)} │ Allowed: \x1b[1;32m${String(metrics.allowedCount).padEnd(5)}\x1b[0m │ Metadata: \x1b[1;31m${String(metrics.blockedMetadataCount).padEnd(4)}\x1b[0m${statusStr}`
    );
    lines.push(
      `│  Private IP: \x1b[33m${String(metrics.blockedPrivateCount).padEnd(4)}\x1b[0m │ Loopback: \x1b[35m${String(metrics.blockedLoopbackCount).padEnd(4)}\x1b[0m │ Custom: \x1b[36m${metrics.blockedCustomCount}\x1b[0m`
    );
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive URL safety check card.
   */
  static renderUrlSafetyCard(card: {
    checkId: string;
    normalizedUrl: string;
    hostname: string;
    verdict: string;
    isSafe: boolean;
    category?: string;
    resolvedIps?: string[];
    reason?: string;
  }): string {
    const lines: string[] = [];
    const verdictColor = card.isSafe ? "\x1b[1;32m" : "\x1b[1;31m";
    lines.push(`┌── 🌐 URL CHECK: [${card.checkId}] ────────────────────────────────────┐`);
    lines.push(
      `│  Verdict: ${verdictColor}${card.verdict.toUpperCase()}\x1b[0m │ Safe: \x1b[1;36m${card.isSafe ? "YES" : "NO"}\x1b[0m │ Category: \x1b[33m${card.category || "unknown"}\x1b[0m`
    );
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  URL: \x1b[35m${card.normalizedUrl.slice(0, 64)}\x1b[0m`);
    lines.push(`│  Host: ${card.hostname} │ IPs: ${card.resolvedIps?.join(", ") || "none"}`);
    if (card.reason) {
      lines.push(`│  Reason: \x1b[90m${card.reason.slice(0, 60)}\x1b[0m`);
    }
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders the Tool Execution Segmenter & Loop Guardrail ANSI Dashboard.
   */
  static renderToolExecutionGuardDashboard(metrics: {
    totalPlansPlanned: number;
    totalSegmentsExecuted: number;
    totalViolationsDetected: number;
    parallelBatchesCreated: number;
    sequentialBarriersEnforced: number;
    blockedInvocations: number;
    abortedTurns: number;
  }): string {
    const lines: string[] = [];
    lines.push(`┌── 🛡️ TOOL EXECUTION GUARD & LOOP FIREWALL DASHBOARD ──────────────────┐`);
    lines.push(
      `│  Plans: \x1b[1;36m${String(metrics.totalPlansPlanned).padEnd(5)}\x1b[0m │ Segments: \x1b[1;32m${String(metrics.totalSegmentsExecuted).padEnd(5)}\x1b[0m │ Parallel: \x1b[1;35m${String(metrics.parallelBatchesCreated).padEnd(5)}\x1b[0m │ Barriers: \x1b[33m${String(metrics.sequentialBarriersEnforced).padEnd(5)}\x1b[0m`
    );
    lines.push(
      `│  Violations: \x1b[1;31m${String(metrics.totalViolationsDetected).padEnd(5)}\x1b[0m │ Blocked: \x1b[1;33m${String(metrics.blockedInvocations).padEnd(5)}\x1b[0m │ Aborted: \x1b[1;31m${String(metrics.abortedTurns).padEnd(5)}\x1b[0m`
    );
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive Tool Execution Batch Segment card.
   */
  static renderToolExecutionSegmentCard(card: {
    segmentIndex: number;
    mode: string;
    toolCalls: readonly { toolName: string }[];
    isMutating: boolean;
  }): string {
    const lines: string[] = [];
    const modeColor = card.mode === "parallel" ? "\x1b[1;35m" : "\x1b[1;36m";
    const mutColor = card.isMutating ? "\x1b[1;31m" : "\x1b[1;32m";
    lines.push(`┌── ⚙️ BATCH SEGMENT [Index #${card.segmentIndex}] ─────────────────────────┐`);
    lines.push(
      `│  Mode: ${modeColor}${card.mode.toUpperCase()}\x1b[0m │ Calls: \x1b[1;33m${card.toolCalls.length}\x1b[0m │ Mutating: ${mutColor}${card.isMutating ? "YES" : "NO"}\x1b[0m`
    );
    lines.push(`├────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Tools: ${card.toolCalls.map((c) => c.toolName).join(", ").slice(0, 65)}`);
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  /**
   * Renders an interactive Tool Loop Violation card.
   */
  static renderToolExecutionViolationCard(card: {
    toolName: string;
    frameIndex: number;
    repetitionCount: number;
    actionTaken: string;
  }): string {
    const lines: string[] = [];
    const actColor = card.actionTaken === "abort" ? "\x1b[1;31m" : card.actionTaken === "block" ? "\x1b[1;33m" : "\x1b[1;32m";
    lines.push(`┌── 🚨 LOOP VIOLATION [Frame #${card.frameIndex}] ─────────────────────────┐`);
    lines.push(
      `│  Tool: \x1b[1;31m${card.toolName}\x1b[0m │ Reps: \x1b[1;33m${card.repetitionCount}\x1b[0m │ Action: ${actColor}${card.actionTaken.toUpperCase()}\x1b[0m`
    );
    lines.push(`└────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
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
