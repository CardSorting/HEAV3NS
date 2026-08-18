/**
 * broccoli-goal-substrate.ts
 *
 * In-Memory & BroccoliDB Table-backed substrate for Persistent Session Goals,
 * Milestone DAGs, Quality Gates, Trajectories, Notifications, and Multi-Agent Swarm Coordination (ADR-117).
 */

import type {
  GoalArchiveResult,
  GoalBulkMutationResult,
  GoalCategory,
  GoalCloneOptions,
  GoalEvaluationResult,
  GoalGate,
  GoalGateRow,
  GoalGroupBy,
  GoalGroupedLane,
  GoalHealthAuditReport,
  GoalHealthStatus,
  GoalHierarchyReport,
  GoalMilestone,
  GoalMilestoneChecklistItem,
  GoalMilestoneRow,
  GoalMutationUndoRecord,
  GoalNotificationEvent,
  GoalNotificationPreferences,
  GoalNotificationRecord,
  GoalNotificationRow,
  GoalQueryFilter,
  GoalRetroRow,
  GoalRetroSummary,
  GoalRiskDiagnosis,
  GoalSessionRow,
  GoalSortBy,
  GoalSortDirection,
  GoalState,
  GoalStateSnapshot,
  GoalStepEvent,
  GoalSwarmBalanceResult,
  GoalVelocityMetrics,
} from "../../../core/contracts/goal.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";
import { GoalDesktopNotificationDispatcher } from "../../../tooling/extensions/goals/goal-notification-dispatcher.js";

export class BroccoliGoalSubstrate {
  private readonly goals: Map<string, GoalState> = new Map();
  private readonly completedGoalsArchive: GoalRetroSummary[] = [];
  private readonly notificationDispatcher: GoalDesktopNotificationDispatcher;
  private readonly undoStack: GoalMutationUndoRecord[] = [];
  private readonly redoStack: GoalMutationUndoRecord[] = [];

  private totalInvocations: number = 0;
  private totalCompletedGoals: number = 0;
  private totalGatesEvaluated: number = 0;
  private totalRemediationsTriggered: number = 0;
  private lastUpdatedMs: number = Date.now();

  private static readonly MAX_ARCHIVE = 500;
  private static readonly MAX_TRAJECTORY = 100;
  private static readonly MAX_UNDO_STACK = 100;

  // BroccoliDB Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private sessionsTable?: IDbTable<GoalSessionRow>;
  private milestonesTable?: IDbTable<GoalMilestoneRow>;
  private gatesTable?: IDbTable<GoalGateRow>;
  private retrosTable?: IDbTable<GoalRetroRow>;
  private notifsTable?: IDbTable<GoalNotificationRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel, notificationPreferences?: Partial<GoalNotificationPreferences>) {
    this.dbKernel = dbKernel;
    this.notificationDispatcher = new GoalDesktopNotificationDispatcher(notificationPreferences);

    if (this.dbKernel) {
      this.initBroccoliDbTables();
    }
  }

  private initBroccoliDbTables(): void {
    if (!this.dbKernel) return;

    this.sessionsTable = this.dbKernel.getTable<GoalSessionRow>("goal_sessions");
    this.milestonesTable = this.dbKernel.getTable<GoalMilestoneRow>("goal_milestones");
    this.gatesTable = this.dbKernel.getTable<GoalGateRow>("goal_gates");
    this.retrosTable = this.dbKernel.getTable<GoalRetroRow>("goal_retros");
    this.notifsTable = this.dbKernel.getTable<GoalNotificationRow>("goal_notifications");

    try {
      this.sessionsTable.createIndex("status");
      this.sessionsTable.createIndex("category");
      this.sessionsTable.createIndex("parentGoalSessionId");
      this.sessionsTable.createSortedIndex("progressPercent");
      this.sessionsTable.createSortedIndex("createdAtMs");
      this.milestonesTable.createIndex("sessionId");
      this.milestonesTable.createIndex("status");
      this.gatesTable.createIndex("sessionId");
      this.gatesTable.createIndex("policy");
    } catch {
      // Non-blocking in mocks or repeated initializations
    }

    // CDC Subscription
    try {
      this.sessionsTable.subscribe((change) => {
        if (change.operation === "INSERT" || change.operation === "UPDATE") {
          const row = change.after;
          if (row && row.progressPercent === 100 && row.status === "done") {
            this.notificationDispatcher.dispatch({
              sessionId: row.id,
              title: `Goal Accomplished (100%)`,
              message: `Session '${row.id}' completed: "${row.goal}"`,
              urgency: "normal",
              trigger: "goal_completed",
            }).catch(() => {});
          }
        }
      });
    } catch {
      // Non-blocking
    }
  }

  public getNotificationDispatcher(): GoalDesktopNotificationDispatcher {
    return this.notificationDispatcher;
  }

  /**
   * Evaluates milestone dependency DAG and updates blocked/pending statuses.
   */
  public resolveMilestoneDAG(milestones: GoalMilestone[]): void {
    if (!milestones || milestones.length === 0) return;

    const completedIds = new Set(
      milestones.filter((m) => m.status === "completed").map((m) => m.id)
    );

    for (const m of milestones) {
      if (m.status === "completed") {
        m.blockers = [];
        continue;
      }

      if (m.dependsOn && m.dependsOn.length > 0) {
        const unmet = m.dependsOn.filter((depId) => !completedIds.has(depId));
        if (unmet.length > 0) {
          m.status = "blocked";
          m.blockers = unmet;
        } else if (m.status === "blocked") {
          m.status = "pending";
          m.blockers = [];
        }
      } else {
        m.blockers = [];
      }
    }
  }

  setGoal(state: GoalState): void {
    const previous = this.goals.get(state.sessionId);

    // Resolve milestone dependencies
    if (state.milestones && state.milestones.length > 0) {
      this.resolveMilestoneDAG(state.milestones);
    }

    // Recalculate progress
    let progress = state.progressPercent;
    if (state.milestones && state.milestones.length > 0) {
      const completed = state.milestones.filter((m) => m.status === "completed").length;
      progress = Math.round((completed / state.milestones.length) * 100);
    }

    // Blend child session goals progress if present
    if (state.childGoalSessionIds && state.childGoalSessionIds.length > 0) {
      const childGoals = state.childGoalSessionIds
        .map((cid) => this.goals.get(cid))
        .filter((g): g is GoalState => g !== undefined);

      if (childGoals.length > 0) {
        const childAvg = childGoals.reduce((sum, g) => sum + g.progressPercent, 0) / childGoals.length;
        progress = Math.round((progress + childAvg) / 2);
      }
    }

    const updatedState: GoalState = {
      ...state,
      progressPercent: progress,
      contract: { ...state.contract },
      subgoals: [...(state.subgoals || [])],
      milestones: state.milestones ? state.milestones.map((m) => ({ ...m })) : [],
      trajectory: state.trajectory ? state.trajectory.map((t) => ({ ...t })) : [],
      childGoalSessionIds: state.childGoalSessionIds ? [...state.childGoalSessionIds] : undefined,
      gates: state.gates ? state.gates.map((g) => ({ ...g })) : [],
    };

    if (previous) {
      this.undoStack.push({
        undoId: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionId: state.sessionId,
        previousState: previous,
        newState: updatedState,
        timestampMs: Date.now(),
      });
      if (this.undoStack.length > BroccoliGoalSubstrate.MAX_UNDO_STACK) {
        this.undoStack.shift();
      }
      this.redoStack.length = 0;
    }

    this.goals.set(state.sessionId, updatedState);
    this.lastUpdatedMs = Date.now();

    // Persist to BroccoliDB Tables
    if (this.sessionsTable) {
      this.sessionsTable.put(state.sessionId, {
        id: state.sessionId,
        goal: state.goal,
        category: state.category || "general",
        status: state.status,
        turnsUsed: state.turnsUsed,
        maxTurns: state.maxTurns,
        progressPercent: progress,
        parentGoalSessionId: state.parentGoalSessionId,
        contractJson: JSON.stringify(state.contract),
        milestonesCount: state.milestones.length,
        gatesCount: state.gates.length,
        createdAtMs: state.createdAtMs,
        lastTurnAtMs: state.lastTurnAtMs,
      });
    }

    if (this.milestonesTable && state.milestones) {
      for (const m of state.milestones) {
        this.milestonesTable.put(`${state.sessionId}:${m.id}`, {
          id: `${state.sessionId}:${m.id}`,
          sessionId: state.sessionId,
          title: m.title,
          status: m.status,
          progressPercent: m.progressPercent,
          dependsOnJson: m.dependsOn ? JSON.stringify(m.dependsOn) : undefined,
          blockersJson: m.blockers ? JSON.stringify(m.blockers) : undefined,
          completedAtMs: m.completedAtMs,
        });
      }
    }
  }

  getGoal(sessionId: string): GoalState | null {
    const found = this.goals.get(sessionId);
    if (!found) return null;
    return {
      ...found,
      contract: { ...found.contract },
      subgoals: [...(found.subgoals || [])],
      milestones: found.milestones ? found.milestones.map((m) => ({ ...m, tags: m.tags ? [...m.tags] : undefined, checklist: m.checklist ? [...m.checklist] : undefined, dependsOn: m.dependsOn ? [...m.dependsOn] : undefined, blockers: m.blockers ? [...m.blockers] : undefined })) : [],
      trajectory: found.trajectory ? found.trajectory.map((t) => ({ ...t })) : [],
      childGoalSessionIds: found.childGoalSessionIds ? [...found.childGoalSessionIds] : undefined,
      gates: found.gates ? found.gates.map((g) => ({ ...g })) : [],
      tags: found.tags ? [...found.tags] : undefined,
    };
  }

  deleteGoal(sessionId: string): boolean {
    const deleted = this.goals.delete(sessionId);
    if (deleted) {
      this.lastUpdatedMs = Date.now();
      if (this.sessionsTable) {
        this.sessionsTable.delete(sessionId);
      }
    }
    return deleted;
  }

  listGoals(filter: GoalQueryFilter = {}): GoalState[] {
    let result = Array.from(this.goals.values()).map((g) => ({
      ...g,
      contract: { ...g.contract },
      subgoals: [...(g.subgoals || [])],
      milestones: g.milestones ? g.milestones.map((m) => ({ ...m, tags: m.tags ? [...m.tags] : undefined, checklist: m.checklist ? [...m.checklist] : undefined, dependsOn: m.dependsOn ? [...m.dependsOn] : undefined, blockers: m.blockers ? [...m.blockers] : undefined })) : [],
      trajectory: g.trajectory ? g.trajectory.map((t) => ({ ...t })) : [],
      childGoalSessionIds: g.childGoalSessionIds ? [...g.childGoalSessionIds] : undefined,
      gates: g.gates ? g.gates.map((gate) => ({ ...gate })) : [],
      tags: g.tags ? [...g.tags] : undefined,
    }));

    if (filter.status) {
      result = result.filter((g) => g.status === filter.status);
    }

    if (filter.category) {
      result = result.filter((g) => g.category === filter.category);
    }

    if (filter.templateId) {
      result = result.filter((g) => g.templateId === filter.templateId);
    }

    if (filter.parentSessionId) {
      result = result.filter((g) => g.parentGoalSessionId === filter.parentSessionId);
    }

    if (filter.healthStatus) {
      result = result.filter((g) => g.healthStatus === filter.healthStatus);
    }

    if (filter.tags && filter.tags.length > 0) {
      result = result.filter((g) => g.tags && filter.tags!.some((t) => g.tags!.includes(t)));
    }

    if (filter.minProgress !== undefined) {
      result = result.filter((g) => g.progressPercent >= filter.minProgress!);
    }

    if (filter.maxProgress !== undefined) {
      result = result.filter((g) => g.progressPercent <= filter.maxProgress!);
    }

    if (filter.text) {
      const q = filter.text.toLowerCase().trim();
      result = result.filter(
        (g) =>
          g.goal.toLowerCase().includes(q) ||
          g.sessionId.toLowerCase().includes(q) ||
          g.milestones.some((m) => m.title.toLowerCase().includes(q))
      );
    }

    // Sort
    const sortBy = filter.sortBy || "recent";
    result.sort((a, b) => {
      if (sortBy === "progress") {
        return b.progressPercent - a.progressPercent;
      }
      if (sortBy === "turns") {
        return b.turnsUsed - a.turnsUsed;
      }
      return b.lastTurnAtMs - a.lastTurnAtMs;
    });

    if (filter.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  listActiveGoals(): GoalState[] {
    return this.listGoals({ status: "active" });
  }

  /**
   * Groups goals into structured lanes for Kanban-style or multi-column inspection.
   */
  getGroupedGoals(
    groupBy: GoalGroupBy = "status",
    sortBy: GoalSortBy = "createdAt",
    sortDir: GoalSortDirection = "desc",
    filter: GoalQueryFilter = {}
  ): readonly GoalGroupedLane[] {
    const all = this.listGoals(filter);
    const lanesMap = new Map<string, GoalState[]>();

    const getLaneKey = (g: GoalState): { key: string; title: string } => {
      switch (groupBy) {
        case "status":
          return { key: g.status, title: g.status.toUpperCase() };
        case "category":
          return { key: g.category || "general", title: (g.category || "general").toUpperCase() };
        case "progress": {
          if (g.progressPercent === 100) return { key: "completed", title: "100% DONE" };
          if (g.progressPercent >= 50) return { key: "in_progress", title: "50-99% PROGRESS" };
          if (g.progressPercent > 0) return { key: "started", title: "1-49% STARTED" };
          return { key: "not_started", title: "0% NOT STARTED" };
        }
        case "turns": {
          const ratio = g.turnsUsed / Math.max(1, g.maxTurns);
          if (ratio >= 0.8) return { key: "budget_critical", title: "⚡ >80% TURNS USED" };
          if (ratio >= 0.5) return { key: "budget_mid", title: "⏱️ 50-80% TURNS USED" };
          return { key: "budget_healthy", title: "🟢 <50% TURNS USED" };
        }
      }
    };

    for (const g of all) {
      const { key } = getLaneKey(g);
      const lane = lanesMap.get(key) || [];
      lane.push(g);
      lanesMap.set(key, lane);
    }

    const sortFn = (a: GoalState, b: GoalState) => {
      let cmp = 0;
      switch (sortBy) {
        case "progress": cmp = a.progressPercent - b.progressPercent; break;
        case "turns": cmp = a.turnsUsed - b.turnsUsed; break;
        case "milestones": cmp = a.milestones.length - b.milestones.length; break;
        case "gates": cmp = a.gates.length - b.gates.length; break;
        case "createdAt": cmp = a.createdAtMs - b.createdAtMs; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    };

    const keys = Array.from(lanesMap.keys());
    return keys.map((k) => {
      const goals = (lanesMap.get(k) || []).sort(sortFn);
      const sample = goals[0];
      const title = sample ? getLaneKey(sample).title : k.toUpperCase();
      return {
        key: k,
        title,
        count: goals.length,
        goals,
      };
    });
  }

  /**
   * Resolves parent-child goal hierarchy tree.
   */
  getGoalWithHierarchy(sessionId: string): GoalHierarchyReport | null {
    const goal = this.getGoal(sessionId);
    if (!goal) return null;

    const parent = goal.parentGoalSessionId ? this.getGoal(goal.parentGoalSessionId) ?? undefined : undefined;
    const children: GoalState[] = [];
    if (goal.childGoalSessionIds) {
      for (const cid of goal.childGoalSessionIds) {
        const c = this.getGoal(cid);
        if (c) children.push(c);
      }
    }

    const allInTree = [goal, ...children];
    const avgProgress = Math.round(allInTree.reduce((acc, g) => acc + g.progressPercent, 0) / allInTree.length);

    return {
      goal,
      parent,
      children,
      aggregateProgressPercent: avgProgress,
    };
  }

  /**
   * Evaluates overall goal velocity, turn utilization, and quality gate pass rates.
   */
  getVelocityMetrics(): GoalVelocityMetrics {
    const all = Array.from(this.goals.values());
    const completed = all.filter((g) => g.status === "done" || g.progressPercent === 100);

    const totalTurns = completed.reduce((acc, g) => acc + g.turnsUsed, 0);
    const avgTurns = completed.length > 0 ? Math.round((totalTurns / completed.length) * 10) / 10 : 0;

    let totalGatesCount = 0;
    let totalPassedCount = 0;
    for (const g of all) {
      for (const gate of g.gates) {
        totalGatesCount++;
        if (gate.lastExitCode === 0) totalPassedCount++;
      }
    }
    const gatePassRate = totalGatesCount > 0 ? Math.round((totalPassedCount / totalGatesCount) * 100) : 100;
    const totalMilestones = all.reduce((acc, g) => acc + g.milestones.length, 0);
    const avgMilestones = all.length > 0 ? Math.round((totalMilestones / all.length) * 10) / 10 : 0;

    return {
      totalGoalsEvaluated: all.length,
      completedGoalsCount: completed.length,
      averageTurnsToCompletion: avgTurns,
      overallGatePassRatePercent: gatePassRate,
      totalRemediationsTriggered: this.totalRemediationsTriggered,
      averageMilestonesPerGoal: avgMilestones,
    };
  }

  /**
   * Bulk updates multiple goal sessions atomically.
   */
  bulkUpdateGoals(sessionIds: readonly string[], mutation: Partial<GoalState>): GoalBulkMutationResult {
    const updatedGoals: GoalState[] = [];
    const errors: string[] = [];

    for (const sid of sessionIds) {
      const g = this.getGoal(sid);
      if (!g) {
        errors.push(`Goal session '${sid}' not found`);
        continue;
      }
      const updated: GoalState = {
        ...g,
        status: mutation.status ?? g.status,
        category: mutation.category ?? g.category,
        maxTurns: mutation.maxTurns ?? g.maxTurns,
        icon: mutation.icon ?? g.icon,
      };
      this.setGoal(updated);
      updatedGoals.push(updated);
    }

    return {
      totalTargeted: sessionIds.length,
      updatedCount: updatedGoals.length,
      failedCount: sessionIds.length - updatedGoals.length,
      updatedGoals,
      errors,
    };
  }

  /**
   * Undoes the last mutation on a goal session.
   */
  undo(sessionId: string): { success: boolean; restoredGoal?: GoalState; error?: string } {
    const idx = this.undoStack.map((u) => u.sessionId).lastIndexOf(sessionId);
    if (idx < 0) return { success: false, error: "No undo records for this goal" };

    const record = this.undoStack.splice(idx, 1)[0];
    this.redoStack.push(record);
    this.goals.set(sessionId, record.previousState);
    this.lastUpdatedMs = Date.now();
    return { success: true, restoredGoal: record.previousState };
  }

  /**
   * Redoes the last undone mutation on a goal session.
   */
  redo(sessionId: string): { success: boolean; restoredGoal?: GoalState; error?: string } {
    const idx = this.redoStack.map((u) => u.sessionId).lastIndexOf(sessionId);
    if (idx < 0) return { success: false, error: "No redo records for this goal" };

    const record = this.redoStack.splice(idx, 1)[0];
    this.undoStack.push(record);
    this.goals.set(sessionId, record.newState);
    this.lastUpdatedMs = Date.now();
    return { success: true, restoredGoal: record.newState };
  }

  /**
   * Toggles completion status of a checklist subtask within a milestone.
   */
  toggleMilestoneChecklist(
    sessionId: string,
    milestoneId: string,
    checkId: string,
    done?: boolean
  ): boolean {
    const goal = this.goals.get(sessionId);
    if (!goal) return false;

    const milestone = goal.milestones.find((m) => m.id === milestoneId || m.title.toLowerCase() === milestoneId.toLowerCase());
    if (!milestone) return false;

    if (!milestone.checklist) {
      milestone.checklist = [];
    }

    const item = milestone.checklist.find((c) => c.id === checkId);
    if (item) {
      const nextDone = done !== undefined ? done : !item.done;
      (item as { done: boolean }).done = nextDone;
    } else {
      milestone.checklist.push({
        id: checkId,
        text: checkId,
        done: done !== undefined ? done : true,
      });
    }

    // Recalculate milestone progress from checklist
    if (milestone.checklist.length > 0) {
      const doneCount = milestone.checklist.filter((c) => c.done).length;
      milestone.progressPercent = Math.round((doneCount / milestone.checklist.length) * 100);
      if (milestone.progressPercent === 100) {
        milestone.status = "completed";
        milestone.completedAtMs = Date.now();
      } else if (milestone.status === "completed") {
        milestone.status = "in_progress";
      }
    }

    this.setGoal(goal);
    return true;
  }

  /**
   * Adjusts milestone progress percent by delta (+/- percent).
   */
  adjustMilestoneProgress(sessionId: string, milestoneId: string, deltaPercent: number): boolean {
    const goal = this.goals.get(sessionId);
    if (!goal) return false;

    const milestone = goal.milestones.find((m) => m.id === milestoneId || m.title.toLowerCase() === milestoneId.toLowerCase());
    if (!milestone) return false;

    const nextPercent = Math.max(0, Math.min(100, milestone.progressPercent + deltaPercent));
    milestone.progressPercent = nextPercent;

    if (nextPercent === 100) {
      milestone.status = "completed";
      milestone.completedAtMs = Date.now();
    } else if (nextPercent === 0) {
      milestone.status = "pending";
      milestone.completedAtMs = undefined;
    } else {
      milestone.status = "in_progress";
      milestone.completedAtMs = undefined;
    }

    this.setGoal(goal);
    return true;
  }

  /**
   * Toggles or sets blocked status of a milestone.
   */
  setMilestoneBlocked(sessionId: string, milestoneId: string, blocked: boolean, reason?: string): boolean {
    const goal = this.goals.get(sessionId);
    if (!goal) return false;

    const milestone = goal.milestones.find((m) => m.id === milestoneId || m.title.toLowerCase() === milestoneId.toLowerCase());
    if (!milestone) return false;

    if (blocked) {
      milestone.status = "blocked";
      if (reason) {
        if (!milestone.blockers) milestone.blockers = [];
        if (!milestone.blockers.includes(reason)) milestone.blockers.push(reason);
      }
    } else {
      milestone.status = milestone.progressPercent === 100 ? "completed" : milestone.progressPercent > 0 ? "in_progress" : "pending";
      milestone.blockers = [];
    }

    this.setGoal(goal);
    return true;
  }

  /**
   * Distributes uncompleted milestones across worker session IDs evenly.
   */
  autoAssignSwarm(
    parentSessionId: string,
    workerSessionIds: readonly string[]
  ): GoalSwarmBalanceResult {
    const parent = this.goals.get(parentSessionId);
    if (!parent || workerSessionIds.length === 0) {
      return {
        parentSessionId,
        assignedMilestonesCount: 0,
        unassignedMilestonesCount: 0,
        workerAssignments: {},
      };
    }

    const workerAssignments: Record<string, string[]> = {};
    for (const w of workerSessionIds) {
      workerAssignments[w] = [];
    }

    let assigned = 0;
    let workerIdx = 0;

    for (const m of parent.milestones) {
      if (m.status !== "completed") {
        const workerId = workerSessionIds[workerIdx % workerSessionIds.length];
        m.assignedSessionId = workerId;
        workerAssignments[workerId].push(m.id);
        assigned++;
        workerIdx++;
      }
    }

    this.setGoal(parent);

    return {
      parentSessionId,
      assignedMilestonesCount: assigned,
      unassignedMilestonesCount: parent.milestones.length - assigned,
      workerAssignments,
    };
  }

  /**
   * Archives all completed goals older than cutoffMs.
   */
  archiveCompletedGoals(cutoffMs: number = 0): GoalArchiveResult {
    const archivedIds: string[] = [];
    const now = Date.now();

    for (const [sid, g] of this.goals.entries()) {
      if ((g.status === "done" || g.progressPercent === 100) && (!cutoffMs || now - g.lastTurnAtMs >= cutoffMs)) {
        const retro: GoalRetroSummary = {
          sessionId: g.sessionId,
          goal: g.goal,
          category: g.category || "general",
          status: "done",
          turnsUsed: g.turnsUsed,
          maxTurns: g.maxTurns,
          totalMilestones: g.milestones.length,
          completedMilestones: g.milestones.filter((m) => m.status === "completed").length,
          totalGates: g.gates.length,
          passedGates: g.gates.filter((gate) => gate.lastExitCode === 0).length,
          durationMs: Math.max(0, g.lastTurnAtMs - g.createdAtMs),
          finalVerdict: g.lastVerdict,
          finalReason: g.lastReason,
          contractAdherenceScore: 100,
          trajectoryEventsCount: g.trajectory ? g.trajectory.length : 0,
        };
        this.archiveGoal(retro);
        this.goals.delete(sid);
        archivedIds.push(sid);
      }
    }

    if (archivedIds.length > 0) {
      this.lastUpdatedMs = Date.now();
    }

    return {
      archivedCount: archivedIds.length,
      remainingActiveCount: this.listActiveGoals().length,
      archivedSessionIds: archivedIds,
    };
  }

  /**
   * Clones a goal session into a target session ID.
   */
  cloneGoal(
    sourceSessionId: string,
    targetSessionId: string,
    options: GoalCloneOptions = {}
  ): GoalState | null {
    const src = this.getGoal(sourceSessionId);
    if (!src) return null;

    const cloned: GoalState = {
      sessionId: targetSessionId,
      goal: src.goal,
      category: options.newCategory || src.category,
      icon: src.icon,
      status: "active",
      turnsUsed: 0,
      maxTurns: options.newMaxTurns || src.maxTurns,
      progressPercent: options.resetProgress ? 0 : src.progressPercent,
      createdAtMs: Date.now(),
      lastTurnAtMs: Date.now(),
      consecutiveParseFailures: 0,
      consecutiveTransportFailures: 0,
      subgoals: [...src.subgoals],
      milestones: src.milestones.map((m) => ({
        ...m,
        status: options.resetProgress ? "pending" : m.status,
        progressPercent: options.resetProgress ? 0 : m.progressPercent,
        completedAtMs: options.resetProgress ? undefined : m.completedAtMs,
        checklist: m.checklist ? m.checklist.map((c) => ({ ...c, done: options.resetProgress ? false : c.done })) : undefined,
      })),
      trajectory: [],
      contract: { ...src.contract },
      gates: src.gates.map((g) => ({
        ...g,
        attempts: options.resetGates ? 0 : g.attempts,
        lastExitCode: options.resetGates ? undefined : g.lastExitCode,
        lastOutputTail: options.resetGates ? "" : g.lastOutputTail,
      })),
    };

    this.setGoal(cloned);
    return cloned;
  }

  /**
   * Evaluates turn velocity, pacing against maxTurns budget, quality gate pass rates, and computes SLA health status.
   */
  auditGoalHealth(sessionId: string): GoalHealthAuditReport | null {
    const goal = this.goals.get(sessionId);
    if (!goal) return null;

    const turnsUsed = goal.turnsUsed || 0;
    const maxTurns = goal.maxTurns || 20;
    const turnsRemaining = Math.max(0, maxTurns - turnsUsed);
    const progress = goal.progressPercent || 0;

    const progressPerTurn = turnsUsed > 0 ? progress / turnsUsed : progress > 0 ? progress : 10;
    const remainingProgress = Math.max(0, 100 - progress);
    const estimatedTurnsToCompletion = progressPerTurn > 0 ? Math.ceil(remainingProgress / progressPerTurn) : 10;

    const blockedMCount = goal.milestones.filter((m) => m.status === "blocked").length;
    const failedGatesCount = goal.gates.filter((g) => g.lastExitCode !== undefined && g.lastExitCode !== 0).length;
    const isOverTurnsBudget = turnsUsed >= maxTurns && progress < 100;
    const isPastDeadline = goal.targetDeadlineMs ? Date.now() > goal.targetDeadlineMs && progress < 100 : false;

    let healthStatus: GoalHealthStatus = "on_track";
    const recs: string[] = [];

    if (progress >= 100) {
      healthStatus = "on_track";
      recs.push("Goal objectives and quality gates 100% fulfilled.");
    } else if (isOverTurnsBudget) {
      healthStatus = "exceeded";
      recs.push("Turns budget exhausted. Increase maxTurns or decompose remaining milestones.");
    } else if (isPastDeadline) {
      healthStatus = "off_track";
      recs.push("Target deadline has passed. Reprioritize pending milestones.");
    } else if (blockedMCount > 0) {
      healthStatus = "at_risk";
      recs.push(`Unblock ${blockedMCount} blocked milestone(s) to restore progression.`);
    } else if (failedGatesCount > 0) {
      healthStatus = "at_risk";
      recs.push(`Remediate ${failedGatesCount} failing quality gate(s).`);
    } else if (turnsRemaining < estimatedTurnsToCompletion) {
      healthStatus = "off_track";
      recs.push(`Estimated ${estimatedTurnsToCompletion} turns needed, but only ${turnsRemaining} remaining in budget.`);
    } else {
      healthStatus = "on_track";
      recs.push("Pacing on track with turns budget and quality gates.");
    }

    goal.healthStatus = healthStatus;
    goal.estimatedRemainingTurns = estimatedTurnsToCompletion;
    this.setGoal(goal);

    return {
      sessionId,
      goal: goal.goal,
      healthStatus,
      progressPercent: progress,
      turnsUsed,
      maxTurns,
      turnsRemaining,
      turnConsumptionRate: Math.round(progressPerTurn * 10) / 10,
      estimatedTurnsToCompletion,
      isOverTurnsBudget,
      isPastDeadline,
      blockedMilestonesCount: blockedMCount,
      failedGatesCount,
      recommendations: recs,
    };
  }

  /**
   * Diagnoses root-cause failure risks, blast radius in DAG, and outputs immediate remediation actions.
   */
  diagnoseGoalRisks(sessionId: string): GoalRiskDiagnosis | null {
    const goal = this.goals.get(sessionId);
    if (!goal) return null;

    const riskFactors: {
      kind: "gate_failure" | "milestone_blocked" | "budget_exhaustion" | "deadline_passed";
      title: string;
      description: string;
      blastRadiusAffectedMilestoneIds: string[];
      suggestedFixCommand?: string;
    }[] = [];

    // Check failed gates
    for (const gate of goal.gates) {
      if (gate.lastExitCode !== undefined && gate.lastExitCode !== 0) {
        riskFactors.push({
          kind: "gate_failure",
          title: `Quality Gate Failed: ${gate.name || gate.command}`,
          description: `Command returned exit code ${gate.lastExitCode}. Attempts: ${gate.attempts}/${gate.maxRetries}.`,
          blastRadiusAffectedMilestoneIds: goal.milestones.map((m) => m.id),
          suggestedFixCommand: gate.autoRemediateCommand || gate.command,
        });
      }
    }

    // Check blocked milestones
    for (const m of goal.milestones) {
      if (m.status === "blocked") {
        const downstream = goal.milestones.filter((dep) => dep.dependsOn?.includes(m.id)).map((d) => d.id);
        riskFactors.push({
          kind: "milestone_blocked",
          title: `Milestone Blocked: #${m.id} ${m.title}`,
          description: m.blockers && m.blockers.length > 0 ? `Blockers: ${m.blockers.join(", ")}` : "Explicitly blocked by dependency failure",
          blastRadiusAffectedMilestoneIds: downstream,
        });
      }
    }

    // Check turns budget
    if (goal.turnsUsed >= goal.maxTurns && goal.progressPercent < 100) {
      riskFactors.push({
        kind: "budget_exhaustion",
        title: "Turns Budget Exhausted",
        description: `Used ${goal.turnsUsed} of ${goal.maxTurns} turns allocated.`,
        blastRadiusAffectedMilestoneIds: goal.milestones.filter((m) => m.status !== "completed").map((m) => m.id),
      });
    }

    // Check deadline
    if (goal.targetDeadlineMs && Date.now() > goal.targetDeadlineMs && goal.progressPercent < 100) {
      riskFactors.push({
        kind: "deadline_passed",
        title: "Target Delivery Deadline Missed",
        description: `Target deadline ${new Date(goal.targetDeadlineMs).toISOString()} has passed.`,
        blastRadiusAffectedMilestoneIds: goal.milestones.filter((m) => m.status !== "completed").map((m) => m.id),
      });
    }

    const overallRiskLevel: "low" | "medium" | "high" | "critical" =
      riskFactors.some((r) => r.kind === "gate_failure" && (r.blastRadiusAffectedMilestoneIds.length > 0)) || riskFactors.some((r) => r.kind === "budget_exhaustion")
        ? "critical"
        : riskFactors.length > 1
        ? "high"
        : riskFactors.length === 1
        ? "medium"
        : "low";

    const immediatePlan = riskFactors.map((r) => r.suggestedFixCommand ? `Execute: ${r.suggestedFixCommand}` : `Resolve: ${r.title}`);

    return {
      sessionId,
      overallRiskLevel,
      riskFactors,
      immediateRemediationPlan: immediatePlan.length > 0 ? immediatePlan : ["All quality metrics and milestones are healthy."],
    };
  }

  /**
   * Attaches or updates tags on a goal or specific milestone.
   */
  tagGoalOrMilestone(sessionId: string, tags: string[], milestoneId?: string): boolean {
    const goal = this.goals.get(sessionId);
    if (!goal) return false;

    if (milestoneId) {
      const m = goal.milestones.find((item) => item.id === milestoneId || item.title.toLowerCase() === milestoneId.toLowerCase());
      if (!m) return false;
      if (!m.tags) m.tags = [];
      for (const t of tags) {
        if (!m.tags.includes(t)) m.tags.push(t);
      }
    } else {
      if (!goal.tags) goal.tags = [];
      for (const t of tags) {
        if (!goal.tags.includes(t)) goal.tags.push(t);
      }
    }

    this.setGoal(goal);
    return true;
  }

  /**
   * Sets target completion deadline timestamp for goal or milestone.
   */
  setGoalDeadline(sessionId: string, deadlineMs: number, milestoneId?: string): boolean {
    const goal = this.goals.get(sessionId);
    if (!goal) return false;

    if (milestoneId) {
      const m = goal.milestones.find((item) => item.id === milestoneId || item.title.toLowerCase() === milestoneId.toLowerCase());
      if (!m) return false;
      m.targetDeadlineMs = deadlineMs;
    } else {
      goal.targetDeadlineMs = deadlineMs;
    }

    this.setGoal(goal);
    return true;
  }

  recordStepEvent(sessionId: string, event: GoalStepEvent): void {
    const goal = this.goals.get(sessionId);
    if (!goal) return;

    if (!goal.trajectory) {
      goal.trajectory = [];
    }

    goal.trajectory.push({ ...event });
    if (goal.trajectory.length > BroccoliGoalSubstrate.MAX_TRAJECTORY) {
      goal.trajectory.shift();
    }
    this.lastUpdatedMs = Date.now();
  }

  linkChildGoal(parentSessionId: string, childSessionId: string): void {
    const parent = this.goals.get(parentSessionId);
    const child = this.goals.get(childSessionId);

    if (parent) {
      if (!parent.childGoalSessionIds) parent.childGoalSessionIds = [];
      if (!parent.childGoalSessionIds.includes(childSessionId)) {
        parent.childGoalSessionIds.push(childSessionId);
      }
    }

    if (child) {
      child.parentGoalSessionId = parentSessionId;
    }

    this.lastUpdatedMs = Date.now();
  }

  archiveGoal(summary: GoalRetroSummary): void {
    this.completedGoalsArchive.unshift({ ...summary });
    if (this.completedGoalsArchive.length > BroccoliGoalSubstrate.MAX_ARCHIVE) {
      this.completedGoalsArchive.pop();
    }
    this.lastUpdatedMs = Date.now();
  }

  getArchive(): readonly GoalRetroSummary[] {
    return [...this.completedGoalsArchive];
  }

  recordInvocation(): void {
    this.totalInvocations += 1;
    this.lastUpdatedMs = Date.now();
  }

  recordCompletion(): void {
    this.totalCompletedGoals += 1;
    this.lastUpdatedMs = Date.now();
  }

  recordGateEvaluation(): void {
    this.totalGatesEvaluated += 1;
    this.lastUpdatedMs = Date.now();
  }

  recordRemediation(): void {
    this.totalRemediationsTriggered += 1;
    this.lastUpdatedMs = Date.now();
  }

  getMetrics(): {
    totalInvocations: number;
    totalCompletedGoals: number;
    totalGatesEvaluated: number;
    totalRemediationsTriggered: number;
    activeGoalsCount: number;
    archivedGoalsCount: number;
    lastUpdatedMs: number;
  } {
    return {
      totalInvocations: this.totalInvocations,
      totalCompletedGoals: this.totalCompletedGoals,
      totalGatesEvaluated: this.totalGatesEvaluated,
      totalRemediationsTriggered: this.totalRemediationsTriggered,
      activeGoalsCount: this.listActiveGoals().length,
      archivedGoalsCount: this.completedGoalsArchive.length,
      lastUpdatedMs: this.lastUpdatedMs,
    };
  }

  createStateSnapshot(): GoalStateSnapshot {
    const goalsObj: Record<string, GoalState> = {};
    for (const [sid, g] of this.goals.entries()) {
      goalsObj[sid] = {
        ...g,
        contract: { ...g.contract },
        subgoals: [...(g.subgoals || [])],
        milestones: g.milestones ? g.milestones.map((m) => ({ ...m })) : [],
        trajectory: g.trajectory ? g.trajectory.map((t) => ({ ...t })) : [],
        childGoalSessionIds: g.childGoalSessionIds ? [...g.childGoalSessionIds] : undefined,
        gates: g.gates ? g.gates.map((gate) => ({ ...gate })) : [],
      };
    }

    return {
      version: 1,
      goals: goalsObj,
      completedGoalsArchive: [...this.completedGoalsArchive],
      totalInvocations: this.totalInvocations,
      totalCompletedGoals: this.totalCompletedGoals,
      totalGatesEvaluated: this.totalGatesEvaluated,
      totalRemediationsTriggered: this.totalRemediationsTriggered,
      lastUpdatedMs: this.lastUpdatedMs,
    };
  }

  restoreStateSnapshot(snapshot: GoalStateSnapshot): void {
    this.goals.clear();
    for (const [sid, g] of Object.entries(snapshot.goals)) {
      this.goals.set(sid, {
        ...g,
        contract: { ...g.contract },
        subgoals: [...(g.subgoals || [])],
        milestones: g.milestones ? g.milestones.map((m) => ({ ...m })) : [],
        trajectory: g.trajectory ? g.trajectory.map((t) => ({ ...t })) : [],
        childGoalSessionIds: g.childGoalSessionIds ? [...g.childGoalSessionIds] : undefined,
        gates: g.gates ? g.gates.map((gate) => ({ ...gate })) : [],
      });
    }
    this.completedGoalsArchive.length = 0;
    if (snapshot.completedGoalsArchive) {
      this.completedGoalsArchive.push(...snapshot.completedGoalsArchive);
    }
    this.totalInvocations = snapshot.totalInvocations;
    this.totalCompletedGoals = snapshot.totalCompletedGoals;
    this.totalGatesEvaluated = snapshot.totalGatesEvaluated;
    this.totalRemediationsTriggered = snapshot.totalRemediationsTriggered || 0;
    this.lastUpdatedMs = snapshot.lastUpdatedMs;
  }

  clear(): void {
    this.goals.clear();
    this.completedGoalsArchive.length = 0;
    this.totalInvocations = 0;
    this.totalCompletedGoals = 0;
    this.totalGatesEvaluated = 0;
    this.totalRemediationsTriggered = 0;
    this.lastUpdatedMs = Date.now();
  }

  /**
   * Exports a single goal session into GitHub-flavored Markdown.
   */
  exportMarkdown(sessionId: string = "default"): string {
    const goal = this.getGoal(sessionId);
    if (!goal) return `# Goal '${sessionId}' not found\n`;

    let md = `# 🎯 Goal: ${goal.icon || "🎯"} ${goal.goal}\n\n`;
    md += `- **Session ID**: \`${goal.sessionId}\`\n`;
    md += `- **Status**: \`${goal.status.toUpperCase()}\` (Progress: **${goal.progressPercent}%**)\n`;
    md += `- **Turns Used**: \`${goal.turnsUsed} / ${goal.maxTurns}\`\n`;
    md += `- **Category**: \`${goal.category || "general"}\`\n\n`;

    if (goal.contract.outcome) md += `### Intended Outcome\n${goal.contract.outcome}\n\n`;
    if (goal.contract.verification) md += `### Verification Strategy\n${goal.contract.verification}\n\n`;

    if (goal.milestones.length > 0) {
      md += `### Milestone DAG Checkpoints (${goal.milestones.length})\n\n`;
      md += `| Milestone | Status | Progress | Blockers |\n`;
      md += `| :--- | :---: | :---: | :--- |\n`;
      for (const m of goal.milestones) {
        const b = m.blockers && m.blockers.length > 0 ? m.blockers.join(", ") : "-";
        md += `| **${m.title}** | \`${m.status}\` | ${m.progressPercent}% | ${b} |\n`;
      }
      md += `\n`;
    }

    if (goal.gates.length > 0) {
      md += `### Quality Gates (${goal.gates.length})\n\n`;
      md += `| Gate Name | Policy | Last Exit | Command |\n`;
      md += `| :--- | :---: | :---: | :--- |\n`;
      for (const g of goal.gates) {
        const exit = g.lastExitCode === 0 ? "✓ 0 (PASS)" : g.lastExitCode !== undefined ? `❌ ${g.lastExitCode}` : "Not run";
        md += `| **${g.name || g.command}** | \`${g.policy || "blocking"}\` | \`${exit}\` | \`${g.command}\` |\n`;
      }
      md += `\n`;
    }

    return md;
  }

  /**
   * Exports all active goals to CSV format.
   */
  exportCsv(): string {
    const lines = ["sessionId,goal,category,status,progressPercent,turnsUsed,maxTurns,milestonesCount,gatesCount"];
    for (const g of this.goals.values()) {
      const cleanGoal = `"${g.goal.replace(/"/g, '""')}"`;
      lines.push(`${g.sessionId},${cleanGoal},${g.category || "general"},${g.status},${g.progressPercent},${g.turnsUsed},${g.maxTurns},${g.milestones.length},${g.gates.length}`);
    }
    return lines.join("\n");
  }

  /**
   * Exports structured JSON snapshot of a goal.
   */
  exportJson(sessionId: string = "default"): string {
    const goal = this.getGoal(sessionId);
    if (!goal) return JSON.stringify({ error: `Goal '${sessionId}' not found` }, null, 2);
    return JSON.stringify(goal, null, 2);
  }

  /**
   * Exports an interactive Single-Page Linear/Notion-inspired HTML Web Application for Goals (ADR-117).
   */
  exportInteractiveHtmlView(sessionId: string = "default"): string {
    const goal = this.getGoal(sessionId) || {
      sessionId,
      goal: "LUMI Standing Objective",
      status: "active" as const,
      progressPercent: 0,
      turnsUsed: 0,
      maxTurns: 20,
      createdAtMs: Date.now(),
      lastTurnAtMs: Date.now(),
      consecutiveParseFailures: 0,
      consecutiveTransportFailures: 0,
      subgoals: [],
      milestones: [],
      trajectory: [],
      contract: {},
      gates: [],
    };

    const allGoals = this.listGoals();
    const metrics = this.getVelocityMetrics();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎯 LUMI Goal Intelligence Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #030712;
      --bg-surface: #0f172a;
      --card-bg: #1e293b;
      --card-border: rgba(148, 163, 184, 0.15);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --primary-glow: rgba(99, 102, 241, 0.35);
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg-base);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--card-border);
      padding: 0.85rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand { display: flex; align-items: center; gap: 0.75rem; font-weight: 700; font-size: 1.15rem; }
    .brand span { background: linear-gradient(135deg, #6366f1, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .omnibar-btn {
      background: #0b1120; border: 1px solid var(--card-border); color: var(--text-muted);
      padding: 0.45rem 1rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer;
      display: flex; align-items: center; gap: 0.6rem; width: 340px; transition: border-color 0.15s;
    }
    .omnibar-btn:hover { border-color: var(--primary); color: var(--text); }
    .kbd-chip {
      background: #1e293b; color: #94a3b8; font-size: 0.7rem;
      padding: 0.15rem 0.4rem; border-radius: 4px; font-family: monospace; margin-left: auto;
    }

    /* Above-the-fold Executive KPI Ribbon */
    .kpi-ribbon {
      background: linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.3) 100%);
      border-bottom: 1px solid var(--card-border);
      padding: 0.85rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .kpi-metrics { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
    .kpi-card { display: flex; align-items: center; gap: 0.65rem; }
    .kpi-icon {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; font-size: 0.95rem;
    }
    .kpi-val { font-size: 1.1rem; font-weight: 700; }
    .kpi-label { font-size: 0.75rem; color: var(--text-muted); }
    .progress-bar-wrap { width: 160px; height: 8px; background: #1e293b; border-radius: 99px; overflow: hidden; }
    .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #10b981, #6366f1); border-radius: 99px; transition: width 0.3s; }

    /* Controls Bar */
    .controls-bar {
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      border-bottom: 1px solid rgba(30, 41, 59, 0.6);
    }
    .view-switcher {
      display: inline-flex;
      background: #0b1120;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 2px;
    }
    .view-btn {
      background: transparent; border: none; color: var(--text-muted);
      padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.8rem;
      cursor: pointer; font-weight: 500; transition: all 0.15s;
    }
    .view-btn.active { background: var(--primary); color: #fff; }
    .filter-pills { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
    .pill {
      background: rgba(30, 41, 59, 0.6); border: 1px solid var(--card-border);
      color: var(--text-muted); padding: 0.3rem 0.65rem; border-radius: 99px;
      font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all 0.15s;
    }
    .pill:hover { border-color: var(--primary); color: var(--text); }
    .pill.active { background: var(--primary-glow); border-color: var(--primary); color: #fff; }

    /* Main Content Containers */
    .main-container { flex: 1; padding: 1.5rem; overflow-y: auto; }
    .milestone-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }
    .milestone-card {
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: 10px; padding: 1rem; cursor: pointer; transition: transform 0.15s, border-color 0.15s;
    }
    .milestone-card:hover { transform: translateY(-2px); border-color: #38bdf8; }
    .badge {
      display: inline-flex; align-items: center; padding: 0.15rem 0.45rem;
      border-radius: 5px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
    }
    .badge-completed { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .badge-blocked { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .badge-pending { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }
    .badge-in_progress { background: rgba(99, 102, 241, 0.2); color: #818cf8; }

    /* Quality Gates Table */
    .gates-table {
      width: 100%; border-collapse: collapse; background: var(--bg-surface);
      border-radius: 8px; overflow: hidden; border: 1px solid var(--card-border);
    }
    .gates-table th, .gates-table td { padding: 0.75rem 1rem; font-size: 0.85rem; text-align: left; }
    .gates-table th { background: #1e293b; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; }
    .gates-table tr:hover td { background: rgba(99, 102, 241, 0.05); }

    /* Timeline Tracks */
    .timeline-track {
      background: #0b1120; border-radius: 6px; height: 28px;
      position: relative; overflow: hidden; display: flex; align-items: center;
    }
    .timeline-bar {
      height: 20px; border-radius: 4px; padding: 0 0.5rem; font-size: 0.72rem;
      font-weight: 600; color: #fff; display: flex; align-items: center; position: absolute;
    }

    /* Modal / Inspector */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
      display: none; align-items: center; justify-content: center; z-index: 100;
    }
    .modal-box {
      background: var(--bg-surface); border: 1px solid var(--card-border);
      border-radius: 14px; width: 620px; max-width: 95vw; max-height: 85vh;
      overflow-y: auto; padding: 1.5rem; box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .modal-title { font-size: 1.2rem; font-weight: 700; }
    .modal-close { background: transparent; border: none; color: var(--text-muted); font-size: 1.25rem; cursor: pointer; }
  </style>
</head>
<body>
  <!-- Header -->
  <header>
    <div class="brand">
      <span>🎯 LUMI GOAL INTELLIGENCE</span>
      <span style="font-size: 0.75rem; color: var(--text-muted); background: #1e293b; padding: 0.15rem 0.5rem; border-radius: 99px;">ADR-117</span>
    </div>
    <button class="omnibar-btn" onclick="openCommandPalette()">
      <span>🔍 Search goals, gates, milestones...</span>
      <span class="kbd-chip">⌘K</span>
    </button>
    <div style="display: flex; gap: 0.5rem;">
      <button class="pill" onclick="requestNotificationPermission()">🔔 Enable Desktop Alerts</button>
    </div>
  </header>

  <!-- Above-the-fold Executive KPI Ribbon -->
  <div class="kpi-ribbon">
    <div class="kpi-metrics">
      <div class="kpi-card">
        <div class="kpi-icon" style="background: rgba(16,185,129,0.15); color: #10b981;">⚡</div>
        <div>
          <div class="kpi-val" id="kpiProgress">${goal.progressPercent}%</div>
          <div class="kpi-label">Goal Progress</div>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" id="kpiProgressBar" style="width: ${goal.progressPercent}%;"></div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background: rgba(99,102,241,0.15); color: #818cf8;">🎯</div>
        <div>
          <div class="kpi-val" id="kpiMilestones">${goal.milestones.filter((m) => m.status === "completed").length}/${goal.milestones.length}</div>
          <div class="kpi-label">Milestones Done</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background: rgba(245,158,11,0.15); color: #f59e0b;">⏱️</div>
        <div>
          <div class="kpi-val" id="kpiTurns">${goal.turnsUsed}/${goal.maxTurns}</div>
          <div class="kpi-label">Turns Budget SLA</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background: rgba(16,185,129,0.15); color: #10b981;">🛡️</div>
        <div>
          <div class="kpi-val" id="kpiGatesPass">${metrics.overallGatePassRatePercent}%</div>
          <div class="kpi-label">Gates Pass Rate</div>
        </div>
      </div>
    </div>
    <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem;">
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981;"></span>
      <span>Session: <strong>${goal.sessionId}</strong> (${goal.status.toUpperCase()})</span>
    </div>
  </div>

  <!-- Controls & Filter Bar -->
  <div class="controls-bar">
    <div style="display: flex; align-items: center; gap: 0.85rem;">
      <div class="view-switcher">
        <button class="view-btn active" id="btnViewMilestones" onclick="switchView('milestones')">🎯 Milestone DAG</button>
        <button class="view-btn" id="btnViewGates" onclick="switchView('gates')">🛡️ Quality Gates</button>
        <button class="view-btn" id="btnViewTimeline" onclick="switchView('timeline')">📈 Trajectory Timeline</button>
      </div>
      <div class="filter-pills">
        <button class="pill active" onclick="setFilter('all', this)">All</button>
        <button class="pill" onclick="setFilter('completed', this)">✓ Completed</button>
        <button class="pill" onclick="setFilter('blocked', this)">🛑 Blocked</button>
        <button class="pill" onclick="setFilter('pending', this)">⏳ Pending</button>
      </div>
    </div>
  </div>

  <!-- Main Views Container -->
  <main class="main-container">
    <!-- Milestones View -->
    <div id="milestonesView">
      <div class="milestone-grid" id="milestonesGrid"></div>
    </div>

    <!-- Quality Gates View -->
    <div id="gatesView" style="display: none;">
      <table class="gates-table">
        <thead>
          <tr>
            <th>Gate Name</th>
            <th>Policy</th>
            <th>Timeout</th>
            <th>Attempts</th>
            <th>Last Exit</th>
            <th>Command</th>
          </tr>
        </thead>
        <tbody id="gatesTableBody"></tbody>
      </table>
    </div>

    <!-- Timeline View -->
    <div id="timelineView" style="display: none;">
      <div style="font-weight: 700; margin-bottom: 1rem; color: #fff;">📈 Goal Execution Trajectory</div>
      <div id="timelineBody"></div>
    </div>
  </main>

  <!-- Command Palette Modal -->
  <div class="modal-overlay" id="paletteModal" onclick="if(event.target===this)closeCommandPalette()">
    <div class="modal-box" style="width: 560px;">
      <input type="text" id="paletteInput" placeholder="Type a command or milestone..." oninput="filterPalette()" style="width:100%; background:#0b1120; border:1px solid var(--card-border); color:#fff; padding:0.8rem; border-radius:8px; margin-bottom:1rem; outline:none;">
      <div id="paletteList"></div>
    </div>
  </div>

  <!-- Detail Modal -->
  <div class="modal-overlay" id="detailModal" onclick="if(event.target===this)closeDetailModal()">
    <div class="modal-box">
      <div class="modal-header">
        <div class="modal-title" id="modalTitle">Milestone Details</div>
        <button class="modal-close" onclick="closeDetailModal()">&times;</button>
      </div>
      <div id="modalContent" style="color:var(--text-muted); font-size:0.9rem; line-height:1.6;"></div>
    </div>
  </div>

  <script>
    const INITIAL_GOAL = ${JSON.stringify(goal)};
    const ALL_GOALS = ${JSON.stringify(allGoals)};
    let currentView = 'milestones';
    let currentFilter = 'all';

    const audioCtx = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ? new (window.AudioContext || window.webkitAudioContext)() : null;
    function playChime(freq = 660) {
      if (!audioCtx) return;
      try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch(e) {}
    }

    function requestNotificationPermission() {
      if ('Notification' in window) {
        Notification.requestPermission().then(p => {
          if (p === 'granted') {
            new Notification('LUMI Goal Alerts Enabled', { body: 'Desktop notifications active for milestone & gate events' });
          }
        });
      }
    }

    function switchView(view) {
      currentView = view;
      document.getElementById('btnViewMilestones').className = 'view-btn ' + (view === 'milestones' ? 'active' : '');
      document.getElementById('btnViewGates').className = 'view-btn ' + (view === 'gates' ? 'active' : '');
      document.getElementById('btnViewTimeline').className = 'view-btn ' + (view === 'timeline' ? 'active' : '');
      document.getElementById('milestonesView').style.display = view === 'milestones' ? 'block' : 'none';
      document.getElementById('gatesView').style.display = view === 'gates' ? 'block' : 'none';
      document.getElementById('timelineView').style.display = view === 'timeline' ? 'block' : 'none';
      render();
    }

    function setFilter(f, el) {
      currentFilter = f;
      document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
      if (el) el.classList.add('active');
      render();
    }

    function render() {
      if (currentView === 'milestones') renderMilestones();
      else if (currentView === 'gates') renderGates();
      else if (currentView === 'timeline') renderTimeline();
    }

    function renderMilestones() {
      const grid = document.getElementById('milestonesGrid');
      grid.innerHTML = '';
      const list = INITIAL_GOAL.milestones.filter(m => {
        if (currentFilter === 'all') return true;
        return m.status === currentFilter;
      });

      if (list.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-muted);">No milestones matching active filter.</div>';
        return;
      }

      list.forEach(m => {
        const card = document.createElement('div');
        card.className = 'milestone-card';
        card.onclick = () => openDetailModal(m.title, \`
          <p><strong>Status:</strong> \${m.status.toUpperCase()}</p>
          <p><strong>Progress:</strong> \${m.progressPercent}%</p>
          <p><strong>Depends On:</strong> \${(m.dependsOn || []).join(', ') || 'None'}</p>
          <p><strong>Blockers:</strong> \${(m.blockers || []).join(', ') || 'None'}</p>
        \`);
        card.innerHTML = \`
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <span style="font-family:monospace; color:var(--text-muted); font-size:0.75rem;">#\${m.id}</span>
            <span class="badge badge-\${m.status}">\${m.status}</span>
          </div>
          <div style="font-weight:600; font-size:0.95rem; margin-bottom:0.5rem;">\${m.title}</div>
          <div class="progress-bar-wrap" style="width:100%; height:6px;">
            <div class="progress-bar-fill" style="width:\${m.progressPercent}%;"></div>
          </div>
        \`;
        grid.appendChild(card);
      });
    }

    function renderGates() {
      const tbody = document.getElementById('gatesTableBody');
      tbody.innerHTML = '';
      if (INITIAL_GOAL.gates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);">No quality gates configured for this goal.</td></tr>';
        return;
      }
      INITIAL_GOAL.gates.forEach(g => {
        const tr = document.createElement('tr');
        const pass = g.lastExitCode === 0;
        tr.innerHTML = \`
          <td style="font-weight:600;">\${g.name || g.command}</td>
          <td><span class="badge" style="background:#1e293b;">\${g.policy || 'blocking'}</span></td>
          <td>\${g.timeoutSeconds}s</td>
          <td>\${g.attempts}/\${g.maxRetries}</td>
          <td><span class="badge badge-\${pass ? 'completed' : 'blocked'}">\${pass ? 'PASS (0)' : (g.lastExitCode !== undefined ? 'FAIL (' + g.lastExitCode + ')' : 'PENDING')}</span></td>
          <td style="font-family:monospace; color:var(--text-muted); font-size:0.8rem;">\${g.command}</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function renderTimeline() {
      const body = document.getElementById('timelineBody');
      body.innerHTML = '';
      if (INITIAL_GOAL.trajectory.length === 0) {
        body.innerHTML = '<div style="color:var(--text-muted);">No trajectory events recorded yet.</div>';
        return;
      }
      INITIAL_GOAL.trajectory.forEach((t, idx) => {
        const row = document.createElement('div');
        row.style.marginBottom = '0.75rem';
        row.innerHTML = \`
          <div style="font-size:0.85rem; font-weight:600;">Turn #\${t.turnIndex} - \${t.actionSummary}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">Verdict: \${t.verdict} | Gates: \${t.gatesPassed}/\${t.gatesEvaluated} passed</div>
        \`;
        body.appendChild(row);
      });
    }

    function openDetailModal(title, content) {
      document.getElementById('modalTitle').innerText = title;
      document.getElementById('modalContent').innerHTML = content;
      document.getElementById('detailModal').style.display = 'flex';
    }
    function closeDetailModal() { document.getElementById('detailModal').style.display = 'none'; }

    function openCommandPalette() { document.getElementById('paletteModal').style.display = 'flex'; document.getElementById('paletteInput').focus(); filterPalette(); }
    function closeCommandPalette() { document.getElementById('paletteModal').style.display = 'none'; }

    function filterPalette() {
      const q = document.getElementById('paletteInput').value.toLowerCase();
      const list = document.getElementById('paletteList');
      list.innerHTML = '';
      INITIAL_GOAL.milestones.filter(m => m.title.toLowerCase().includes(q)).forEach(m => {
        const item = document.createElement('div');
        item.style.padding = '0.65rem';
        item.style.cursor = 'pointer';
        item.style.borderRadius = '6px';
        item.style.background = '#0b1120';
        item.style.marginBottom = '0.4rem';
        item.innerHTML = \`🎯 <strong>\${m.title}</strong> <span style="float:right; color:var(--text-muted); font-size:0.8rem;">\${m.status}</span>\`;
        item.onclick = () => { closeCommandPalette(); openDetailModal(m.title, \`Milestone #\${m.id}\`); };
        list.appendChild(item);
      });
    }

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openCommandPalette(); }
      if (e.key === 'Escape') { closeCommandPalette(); closeDetailModal(); }
    });

    render();
  </script>
</body>
</html>`;
  }
}
