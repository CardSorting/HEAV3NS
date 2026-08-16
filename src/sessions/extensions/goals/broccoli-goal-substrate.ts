/**
 * In-Memory Broccolidb Substrate for Persistent Session Goals, Quality Gates & Milestone Ledgers
 * Subsystem: Target #74 / ADR-117
 */

import type {
  GoalQueryFilter,
  GoalRetroSummary,
  GoalState,
  GoalStateSnapshot,
} from "../../../core/contracts/goal.contracts.js";

export class BroccoliGoalSubstrate {
  private readonly goals: Map<string, GoalState> = new Map();
  private readonly completedGoalsArchive: GoalRetroSummary[] = [];
  private totalInvocations: number = 0;
  private totalCompletedGoals: number = 0;
  private totalGatesEvaluated: number = 0;
  private lastUpdatedMs: number = Date.now();
  private static readonly MAX_ARCHIVE = 500;

  setGoal(state: GoalState): void {
    // Recalculate progress if milestones are present
    let progress = state.progressPercent;
    if (state.milestones && state.milestones.length > 0) {
      const completed = state.milestones.filter((m) => m.status === "completed").length;
      progress = Math.round((completed / state.milestones.length) * 100);
    }

    this.goals.set(state.sessionId, {
      ...state,
      progressPercent: progress,
      contract: { ...state.contract },
      subgoals: [...(state.subgoals || [])],
      milestones: state.milestones ? state.milestones.map((m) => ({ ...m })) : [],
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

  getMetrics(): {
    totalInvocations: number;
    totalCompletedGoals: number;
    totalGatesEvaluated: number;
    activeGoalsCount: number;
    archivedGoalsCount: number;
    lastUpdatedMs: number;
  } {
    return {
      totalInvocations: this.totalInvocations,
      totalCompletedGoals: this.totalCompletedGoals,
      totalGatesEvaluated: this.totalGatesEvaluated,
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
    this.lastUpdatedMs = snapshot.lastUpdatedMs;
  }

  clear(): void {
    this.goals.clear();
    this.completedGoalsArchive.length = 0;
    this.totalInvocations = 0;
    this.totalCompletedGoals = 0;
    this.totalGatesEvaluated = 0;
    this.lastUpdatedMs = Date.now();
  }
}
