/**
 * In-Memory Broccolidb Substrate for Persistent Session Goals, Milestone DAGs, Trajectories & Swarm Ledgers
 * Subsystem: Target #74 / ADR-117
 */

import type {
  GoalMilestone,
  GoalQueryFilter,
  GoalRetroSummary,
  GoalState,
  GoalStateSnapshot,
  GoalStepEvent,
} from "../../../core/contracts/goal.contracts.js";

export class BroccoliGoalSubstrate {
  private readonly goals: Map<string, GoalState> = new Map();
  private readonly completedGoalsArchive: GoalRetroSummary[] = [];
  private totalInvocations: number = 0;
  private totalCompletedGoals: number = 0;
  private totalGatesEvaluated: number = 0;
  private totalRemediationsTriggered: number = 0;
  private lastUpdatedMs: number = Date.now();
  private static readonly MAX_ARCHIVE = 500;
  private static readonly MAX_TRAJECTORY = 100;

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

    this.goals.set(state.sessionId, {
      ...state,
      progressPercent: progress,
      contract: { ...state.contract },
      subgoals: [...(state.subgoals || [])],
      milestones: state.milestones ? state.milestones.map((m) => ({ ...m })) : [],
      trajectory: state.trajectory ? state.trajectory.map((t) => ({ ...t })) : [],
      childGoalSessionIds: state.childGoalSessionIds ? [...state.childGoalSessionIds] : undefined,
      gates: state.gates ? state.gates.map((g) => ({ ...g })) : [],
    });
    this.lastUpdatedMs = Date.now();
  }

  getGoal(sessionId: string): GoalState | null {
    const found = this.goals.get(sessionId);
    if (!found) return null;
    return {
      ...found,
      contract: { ...found.contract },
      subgoals: [...(found.subgoals || [])],
      milestones: found.milestones ? found.milestones.map((m) => ({ ...m })) : [],
      trajectory: found.trajectory ? found.trajectory.map((t) => ({ ...t })) : [],
      childGoalSessionIds: found.childGoalSessionIds ? [...found.childGoalSessionIds] : undefined,
      gates: found.gates ? found.gates.map((g) => ({ ...g })) : [],
    };
  }

  deleteGoal(sessionId: string): boolean {
    const deleted = this.goals.delete(sessionId);
    if (deleted) {
      this.lastUpdatedMs = Date.now();
    }
    return deleted;
  }

  listGoals(filter: GoalQueryFilter = {}): GoalState[] {
    let result = Array.from(this.goals.values()).map((g) => ({
      ...g,
      contract: { ...g.contract },
      subgoals: [...(g.subgoals || [])],
      milestones: g.milestones ? g.milestones.map((m) => ({ ...m })) : [],
      trajectory: g.trajectory ? g.trajectory.map((t) => ({ ...t })) : [],
      childGoalSessionIds: g.childGoalSessionIds ? [...g.childGoalSessionIds] : undefined,
      gates: g.gates ? g.gates.map((gate) => ({ ...gate })) : [],
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
}
