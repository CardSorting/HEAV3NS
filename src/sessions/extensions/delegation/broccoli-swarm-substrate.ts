import type {
  DelegationOutcome,
  IBroccoliSwarmSubstrate,
  SwarmBulkMutationResult,
  SwarmDslQueryFilter,
  SwarmGroupBy,
  SwarmGroupedLane,
  SwarmHealthAuditReport,
  SwarmHealthStatus,
  SwarmMetricsReport,
  SwarmMutationUndoRecord,
  SwarmNotificationEvent,
  SwarmNotificationPreferences,
  SwarmNotificationRecord,
  SwarmNotificationRow,
  SwarmOutcomeRow,
  SwarmSortBy,
  SwarmSortDirection,
  SwarmStateSnapshot,
  SwarmTaskManifest,
  SwarmTaskRow,
  SwarmTaskStatus,
  SwarmWorktreeRow,
} from "../../../core/contracts/delegation.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";
import { SwarmDesktopNotificationDispatcher } from "../../../tooling/extensions/delegation/swarm-notification-dispatcher.js";

/**
 * BroccoliSwarmSubstrate.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 *
 * Coordinates in-memory caching, BroccoliDB typed tables, DAG resolution,
 * multi-agent performance telemetry, and Change Data Capture for Autonomous Swarms.
 */
export class BroccoliSwarmSubstrate implements IBroccoliSwarmSubstrate {
  private readonly tasks = new Map<string, SwarmTaskManifest>();
  private readonly outcomes: DelegationOutcome[] = [];
  private readonly notificationDispatcher: SwarmDesktopNotificationDispatcher;
  private readonly undoStack: SwarmMutationUndoRecord[] = [];
  private readonly redoStack: SwarmMutationUndoRecord[] = [];

  private static readonly MAX_OUTCOMES = 500;
  private static readonly MAX_UNDO_STACK = 100;

  // BroccoliDB Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private tasksTable?: IDbTable<SwarmTaskRow>;
  private outcomesTable?: IDbTable<SwarmOutcomeRow>;
  private notifsTable?: IDbTable<SwarmNotificationRow>;

  constructor(
    dbKernel?: IBroccoliDatabaseKernel,
    notificationPreferences?: Partial<SwarmNotificationPreferences>
  ) {
    this.dbKernel = dbKernel;
    this.notificationDispatcher = new SwarmDesktopNotificationDispatcher(notificationPreferences);

    if (this.dbKernel) {
      this.initBroccoliDbTables();
    }
  }

  private initBroccoliDbTables(): void {
    if (!this.dbKernel) return;

    this.tasksTable = this.dbKernel.getTable<SwarmTaskRow>("swarm_tasks");
    this.outcomesTable = this.dbKernel.getTable<SwarmOutcomeRow>("swarm_outcomes");
    this.notifsTable = this.dbKernel.getTable<SwarmNotificationRow>("swarm_notifications");

    try {
      this.tasksTable.createIndex("status");
      this.tasksTable.createIndex("depth");
      this.tasksTable.createIndex("parentTaskId");
      this.outcomesTable.createIndex("taskId");
    } catch {
      // Non-blocking
    }

    // CDC Subscription
    try {
      this.tasksTable.subscribe((change) => {
        if (change.operation === "UPDATE" && change.after) {
          const task = change.after;
          if (task.status === "failed") {
            this.notificationDispatcher.dispatch({
              taskId: task.id,
              parentTaskId: task.parentTaskId,
              title: `Swarm Subagent Failed`,
              message: `Subagent task '${task.id}' failed execution`,
              urgency: "critical",
              trigger: "task_failed",
            }).catch(() => {});
          }
        }
      });
    } catch {
      // Non-blocking
    }
  }

  // ---------------------------------------------------------------------------
  // Core Substrate Methods
  // ---------------------------------------------------------------------------

  public storeTask(task: SwarmTaskManifest): void {
    const prev = this.tasks.get(task.id);
    this.tasks.set(task.id, Object.freeze({ ...task }));

    if (this.tasksTable) {
      const row: SwarmTaskRow = {
        id: task.id,
        parentTaskId: task.parentTaskId,
        depth: task.depth,
        goal: task.goal,
        status: task.status,
        remainingIterations: task.budget.remainingIterations,
        remainingTokens: task.budget.remainingTokens,
        worktreePath: task.worktree?.worktreePath,
        tags: (task.tags || []).join(","),
        updatedAtMs: Date.now(),
      };
      this.tasksTable.put(task.id, row);
    }

    this.recordUndo({
      mutationType: prev ? "update" : "create",
      previousManifest: prev,
      nextManifest: task,
      timestampMs: Date.now(),
    });
  }

  public getTask(taskId: string): SwarmTaskManifest | undefined {
    return this.tasks.get(taskId);
  }

  public deleteTask(taskId: string): boolean {
    const prev = this.tasks.get(taskId);
    const deleted = this.tasks.delete(taskId);

    if (deleted && this.tasksTable) {
      this.tasksTable.delete(taskId);
    }

    if (deleted && prev) {
      this.recordUndo({
        mutationType: "delete",
        previousManifest: prev,
        timestampMs: Date.now(),
      });
    }

    return deleted;
  }

  public listTasks(statusFilter?: SwarmTaskStatus): readonly SwarmTaskManifest[] {
    const all = Array.from(this.tasks.values());
    if (statusFilter) {
      return Object.freeze(all.filter((t) => t.status === statusFilter));
    }
    return Object.freeze(all);
  }

  public recordOutcome(outcome: DelegationOutcome): void {
    const enrichedOutcome = {
      ...outcome,
      timestampMs: outcome.timestampMs ?? Date.now(),
    };

    this.outcomes.unshift(Object.freeze(enrichedOutcome));
    if (this.outcomes.length > BroccoliSwarmSubstrate.MAX_OUTCOMES) {
      this.outcomes.pop();
    }

    if (this.outcomesTable) {
      const row: SwarmOutcomeRow = {
        id: `outcome-${Date.now()}-${outcome.taskId}`,
        taskId: outcome.taskId,
        success: outcome.success,
        toolCallsCount: outcome.toolCallsCount,
        tokenUsage: outcome.tokenUsage,
        durationMs: outcome.durationMs,
        summary: outcome.summary,
        auditedBy: outcome.auditedBy,
      };
      this.outcomesTable.put(row.id, row);
    }
  }

  public getOutcomes(taskId?: string, limit: number = 50): readonly DelegationOutcome[] {
    if (taskId) {
      return Object.freeze(this.outcomes.filter((o) => o.taskId === taskId).slice(0, limit));
    }
    return Object.freeze(this.outcomes.slice(0, limit));
  }

  public clear(): void {
    this.tasks.clear();
    this.outcomes.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  public getNotificationDispatcher(): SwarmDesktopNotificationDispatcher {
    return this.notificationDispatcher;
  }

  // ---------------------------------------------------------------------------
  // SLA Health Audits & Swarm Telemetry
  // ---------------------------------------------------------------------------

  public auditSwarmHealth(parentTaskId?: string): SwarmHealthAuditReport {
    const tasks = parentTaskId
      ? Array.from(this.tasks.values()).filter((t) => t.id === parentTaskId || t.parentTaskId === parentTaskId)
      : Array.from(this.tasks.values());

    const totalTasks = tasks.length;
    const activeTasks = tasks.filter((t) => t.status === "running" || t.status === "pending").length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const failedTasks = tasks.filter((t) => t.status === "failed").length;
    const abortedTasks = tasks.filter((t) => t.status === "aborted").length;
    const exhaustedBudget = tasks.filter((t) => t.budget.remainingTokens <= 0 || t.budget.remainingIterations <= 0).length;

    const maxDepthReached = tasks.reduce((max, t) => Math.max(max, t.depth), 0);
    const finishedCount = completedTasks + failedTasks + abortedTasks;
    const successRate = finishedCount > 0 ? Math.round((completedTasks / finishedCount) * 100) : 100;

    let healthStatus: SwarmHealthStatus = "healthy";
    if (failedTasks > 0 || successRate < 60) {
      healthStatus = "failed";
    } else if (exhaustedBudget > 0) {
      healthStatus = "budget_exhausted";
    } else if (activeTasks >= 10 || maxDepthReached >= 4) {
      healthStatus = "congested";
    }

    const recommendations: string[] = [];
    if (exhaustedBudget > 0) {
      recommendations.push(`Detected ${exhaustedBudget} tasks with exhausted budgets. Increase maxTokens / maxIterations.`);
    }
    if (maxDepthReached >= 3) {
      recommendations.push(`Swarm delegation depth is high (${maxDepthReached}). Consider flattening task hierarchies.`);
    }
    if (failedTasks > 0) {
      recommendations.push(`Encountered ${failedTasks} subagent failures. Inspect outcome logs and tool call traces.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("Swarm health is optimal. Subagents executing within budget and SLA limits.");
    }

    return {
      parentTaskId,
      totalTasks,
      activeTasks,
      healthStatus,
      overallSuccessRatePercent: successRate,
      budgetExhaustedTasks: exhaustedBudget,
      maxDepthReached,
      recommendations,
    };
  }

  public getSwarmMetrics(): SwarmMetricsReport {
    const tasks = Array.from(this.tasks.values());
    const outcomes = this.outcomes;

    const activeTasks = tasks.filter((t) => t.status === "running" || t.status === "pending").length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const failedTasks = tasks.filter((t) => t.status === "failed").length;
    const abortedTasks = tasks.filter((t) => t.status === "aborted").length;

    const totalTokensUsed = outcomes.reduce((sum, o) => sum + (o.tokenUsage || 0), 0);
    const totalToolCalls = outcomes.reduce((sum, o) => sum + (o.toolCallsCount || 0), 0);

    const finished = completedTasks + failedTasks + abortedTasks;
    const overallSuccessRate = finished > 0 ? Math.round((completedTasks / finished) * 100) : 100;

    const durations = outcomes.map((o) => o.durationMs).sort((a, b) => a - b);
    const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
    const p99 = durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0;

    const activeWorktrees = tasks.filter((t) => t.worktree && (t.status === "running" || t.status === "pending")).length;

    return {
      totalTasks: tasks.length,
      activeTasks,
      completedTasks,
      failedTasks,
      abortedTasks,
      totalTokensUsed,
      totalToolCalls,
      overallSuccessRatePercent: overallSuccessRate,
      p50DurationMs: Number(p50.toFixed(2)),
      p95DurationMs: Number(p95.toFixed(2)),
      p99DurationMs: Number(p99.toFixed(2)),
      activeWorktreesCount: activeWorktrees,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedTasks(
    groupBy: SwarmGroupBy = "status",
    sortBy: SwarmSortBy = "recent",
    direction: SwarmSortDirection = "asc"
  ): readonly SwarmGroupedLane[] {
    const all = Array.from(this.tasks.values());
    const laneMap = new Map<string, { title: string; tasks: SwarmTaskManifest[] }>();

    for (const task of all) {
      let key = "default";
      let title = "Default";

      switch (groupBy) {
        case "status":
          key = task.status;
          title = task.status.toUpperCase();
          break;
        case "depth":
          key = `depth-${task.depth}`;
          title = `DEPTH ${task.depth}`;
          break;
        case "parentTaskId":
          key = task.parentTaskId || "root";
          title = task.parentTaskId ? `PARENT: ${task.parentTaskId}` : "ROOT TASKS";
          break;
        case "health": {
          const audit = this.auditSwarmHealth(task.id);
          key = audit.healthStatus;
          title = `${audit.healthStatus.toUpperCase()} HEALTH`;
          break;
        }
      }

      if (!laneMap.has(key)) {
        laneMap.set(key, { title, tasks: [] });
      }
      laneMap.get(key)!.tasks.push(task);
    }

    const lanes: SwarmGroupedLane[] = [];
    for (const [key, group] of laneMap.entries()) {
      group.tasks.sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case "recent":
            cmp = (b.updatedAtMs || b.createdAtMs || 0) - (a.updatedAtMs || a.createdAtMs || 0);
            break;
          case "depth":
            cmp = a.depth - b.depth;
            break;
          case "goal":
            cmp = a.goal.localeCompare(b.goal);
            break;
          case "tokens":
            cmp = a.budget.remainingTokens - b.budget.remainingTokens;
            break;
        }
        return direction === "asc" ? cmp : -cmp;
      });

      lanes.push({
        key,
        title: group.title,
        count: group.tasks.length,
        tasks: group.tasks,
      });
    }

    return lanes;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search
  // ---------------------------------------------------------------------------

  public parseDslQuery(rawQuery: string): SwarmDslQueryFilter {
    const tokens = rawQuery.trim().split(/\s+/);
    let status: SwarmTaskStatus | undefined;
    let depth: number | undefined;
    let parentTaskId: string | undefined;
    let healthStatus: SwarmHealthStatus | undefined;
    const tags: string[] = [];
    let hasWorktree: boolean | undefined;
    const textTerms: string[] = [];

    for (const token of tokens) {
      if (!token) continue;
      const lower = token.toLowerCase();

      if (lower.startsWith("status:")) {
        const val = lower.split(":")[1] as SwarmTaskStatus;
        if (["pending", "running", "completed", "failed", "aborted"].includes(val)) {
          status = val;
        }
      } else if (lower.startsWith("depth:")) {
        const d = parseInt(lower.split(":")[1], 10);
        if (!isNaN(d)) depth = d;
      } else if (lower.startsWith("parent:")) {
        parentTaskId = lower.split(":")[1];
      } else if (lower.startsWith("health:")) {
        const val = lower.split(":")[1] as SwarmHealthStatus;
        if (["healthy", "congested", "budget_exhausted", "failed"].includes(val)) {
          healthStatus = val;
        }
      } else if (lower.startsWith("tag:") || lower.startsWith("#")) {
        const t = lower.startsWith("#") ? lower.slice(1) : lower.split(":")[1];
        if (t) tags.push(t);
      } else if (lower === "is:worktree" || lower === "has:worktree") {
        hasWorktree = true;
      } else {
        textTerms.push(lower);
      }
    }

    return {
      rawQuery,
      status,
      depth,
      parentTaskId,
      healthStatus,
      tags: tags.length > 0 ? tags : undefined,
      hasWorktree,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  public queryTasksDsl(dslFilterOrQuery: SwarmDslQueryFilter | string): readonly SwarmTaskManifest[] {
    const filter = typeof dslFilterOrQuery === "string" ? this.parseDslQuery(dslFilterOrQuery) : dslFilterOrQuery;
    let result = Array.from(this.tasks.values());

    if (filter.status) {
      result = result.filter((t) => t.status === filter.status);
    }
    if (filter.depth !== undefined) {
      result = result.filter((t) => t.depth === filter.depth);
    }
    if (filter.parentTaskId) {
      result = result.filter((t) => t.parentTaskId === filter.parentTaskId);
    }
    if (filter.hasWorktree) {
      result = result.filter((t) => Boolean(t.worktree));
    }
    if (filter.tags && filter.tags.length > 0) {
      result = result.filter((t) => {
        const taskTags = (t.tags || []).map((x) => x.toLowerCase());
        return filter.tags!.every((tag) => taskTags.includes(tag.toLowerCase()));
      });
    }
    if (filter.textTerms && filter.textTerms.length > 0) {
      result = result.filter((t) => {
        const haystack = `${t.id} ${t.goal} ${t.context}`.toLowerCase();
        return filter.textTerms!.every((term) => haystack.includes(term));
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Bulk Mutations & Undo / Redo
  // ---------------------------------------------------------------------------

  public bulkUpdateTasks(
    taskIds: readonly string[],
    updates: Partial<Pick<SwarmTaskManifest, "status" | "tags">>
  ): SwarmBulkMutationResult {
    const updatedIds: string[] = [];
    const prevManifests: SwarmTaskManifest[] = [];
    const nextManifests: SwarmTaskManifest[] = [];

    for (const id of taskIds) {
      const task = this.tasks.get(id);
      if (!task) continue;

      prevManifests.push(task);
      const updated: SwarmTaskManifest = {
        ...task,
        status: updates.status ?? task.status,
        tags: updates.tags ?? task.tags,
        updatedAtMs: Date.now(),
      };

      this.tasks.set(id, updated);
      nextManifests.push(updated);
      updatedIds.push(id);
    }

    if (updatedIds.length > 0) {
      this.recordUndo({
        mutationType: "bulk",
        previousManifests: prevManifests,
        nextManifests,
        timestampMs: Date.now(),
      });
    }

    return {
      matchedCount: taskIds.length,
      modifiedCount: updatedIds.length,
      updatedTaskIds: updatedIds,
    };
  }

  private recordUndo(record: SwarmMutationUndoRecord): void {
    this.undoStack.push(record);
    if (this.undoStack.length > BroccoliSwarmSubstrate.MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  public undo(): boolean {
    const rec = this.undoStack.pop();
    if (!rec) return false;

    if (rec.mutationType === "create" && rec.nextManifest) {
      this.tasks.delete(rec.nextManifest.id);
    } else if (rec.mutationType === "delete" && rec.previousManifest) {
      this.tasks.set(rec.previousManifest.id, rec.previousManifest);
    } else if (rec.mutationType === "update" && rec.previousManifest) {
      this.tasks.set(rec.previousManifest.id, rec.previousManifest);
    } else if (rec.mutationType === "bulk" && rec.previousManifests) {
      for (const m of rec.previousManifests) {
        this.tasks.set(m.id, m);
      }
    }

    this.redoStack.push(rec);
    return true;
  }

  public redo(): boolean {
    const rec = this.redoStack.pop();
    if (!rec) return false;

    if (rec.mutationType === "create" && rec.nextManifest) {
      this.tasks.set(rec.nextManifest.id, rec.nextManifest);
    } else if (rec.mutationType === "delete" && rec.previousManifest) {
      this.tasks.delete(rec.previousManifest.id);
    } else if (rec.mutationType === "update" && rec.nextManifest) {
      this.tasks.set(rec.nextManifest.id, rec.nextManifest);
    } else if (rec.mutationType === "bulk" && rec.nextManifests) {
      for (const m of rec.nextManifests) {
        this.tasks.set(m.id, m);
      }
    }

    this.undoStack.push(rec);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Export Renderers (HTML, Markdown, CSV)
  // ---------------------------------------------------------------------------

  public exportMarkdownReport(): string {
    const tasks = Array.from(this.tasks.values());
    const metrics = this.getSwarmMetrics();

    let md = `# 🐝 LUMI Autonomous Swarm Delegation Report\n\n`;
    md += `**Total Tasks**: ${metrics.totalTasks} | **Active**: ${metrics.activeTasks} | **Success Rate**: ${metrics.overallSuccessRatePercent}% | **Tokens Used**: ${metrics.totalTokensUsed}\n\n`;
    md += `| Task ID | Depth | Parent | Status | Goal | Worktree |\n`;
    md += `|---|---|---|---|---|---|\n`;

    for (const t of tasks) {
      const wt = t.worktree ? `\`${t.worktree.branchName}\`` : "None";
      md += `| **${t.id}** | ${t.depth} | ${t.parentTaskId || "root"} | \`${t.status}\` | ${t.goal} | ${wt} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const tasks = Array.from(this.tasks.values());
    const lines = ["id,parentTaskId,depth,status,goal,remainingTokens,remainingIterations,worktreeBranch"];

    for (const t of tasks) {
      const cleanGoal = `"${t.goal.replace(/"/g, '""')}"`;
      lines.push(`${t.id},${t.parentTaskId || ""},${t.depth},${t.status},${cleanGoal},${t.budget.remainingTokens},${t.budget.remainingIterations},${t.worktree?.branchName || ""}`);
    }

    return lines.join("\n");
  }

  public exportInteractiveHtmlView(parentTaskId?: string): string {
    const tasks = Array.from(this.tasks.values());
    const metrics = this.getSwarmMetrics();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Swarm Delegation & Subagent Hub (ADR-015)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg-base: #030712;
      --bg-surface: #0f172a;
      --bg-card: #1e293b;
      --card-border: #334155;
      --text-primary: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #f59e0b;
      --success: #10b981;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg-base);
      color: var(--text-primary);
      padding: 1.5rem;
      min-height: 100vh;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--card-border);
    }
    .brand { font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 0.6rem; }
    .kpi-ribbon {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .kpi-card {
      background: var(--bg-surface);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .kpi-val { font-size: 1.5rem; font-weight: 700; }
    .kpi-label { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; }
    .tasks-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--bg-surface);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--card-border);
    }
    .tasks-table th, .tasks-table td { padding: 0.9rem 1.2rem; text-align: left; font-size: 0.9rem; }
    .tasks-table th { background: #1e293b; color: var(--text-muted); text-transform: uppercase; font-size: 0.75rem; }
    .tasks-table tr:hover td { background: rgba(245, 158, 11, 0.05); }
    .badge { padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .badge-running { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .badge-completed { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .badge-failed { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .badge-pending { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🐝 LUMI AUTONOMOUS SWARM HUB</span>
      <span style="font-size: 0.75rem; color: var(--text-muted); background: #1e293b; padding: 0.15rem 0.5rem; border-radius: 99px;">ADR-015</span>
    </div>
    <div style="font-size: 0.85rem; color: var(--text-muted);">
      Active Subagents: <strong>${metrics.activeTasks}/${metrics.totalTasks}</strong>
    </div>
  </header>

  <div class="kpi-ribbon">
    <div class="kpi-card">
      <div class="kpi-val" style="color: #f59e0b;">${metrics.totalTasks}</div>
      <div><div class="kpi-label">Total Delegations</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #10b981;">${metrics.overallSuccessRatePercent}%</div>
      <div><div class="kpi-label">Success Rate</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #38bdf8;">${metrics.totalTokensUsed}</div>
      <div><div class="kpi-label">Tokens Consumed</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #818cf8;">${metrics.activeWorktreesCount}</div>
      <div><div class="kpi-label">Isolated Worktrees</div></div>
    </div>
  </div>

  <table class="tasks-table">
    <thead>
      <tr>
        <th>Task ID</th>
        <th>Depth</th>
        <th>Parent</th>
        <th>Goal</th>
        <th>Status</th>
        <th>Worktree</th>
      </tr>
    </thead>
    <tbody>
      ${tasks
        .map(
          (t) => `
        <tr>
          <td><strong>${t.id}</strong></td>
          <td><code>Depth ${t.depth}</code></td>
          <td>${t.parentTaskId || "root"}</td>
          <td>${t.goal}</td>
          <td><span class="badge badge-${t.status}">${t.status}</span></td>
          <td>${t.worktree ? `<code>${t.worktree.branchName}</code>` : "None"}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;
  }
}
