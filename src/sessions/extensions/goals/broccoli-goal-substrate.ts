/**
 * In-Memory Broccolidb Substrate for Persistent Session Goals & Quality Gates
 * Subsystem: Target #74 / ADR-117
 */

import type { GoalState, GoalStateSnapshot } from "../../../core/contracts/goal.contracts.js";

export class BroccoliGoalSubstrate {
  private readonly goals: Map<string, GoalState> = new Map();
  private totalInvocations: number = 0;
  private totalCompletedGoals: number = 0;
  private totalGatesEvaluated: number = 0;
  private lastUpdatedMs: number = Date.now();

  setGoal(state: GoalState): void {
    this.goals.set(state.sessionId, {
      ...state,
      contract: { ...state.contract },
      subgoals: [...state.subgoals],
      gates: state.gates.map((g) => ({ ...g })),
    });
    this.lastUpdatedMs = Date.now();
  }

  getGoal(sessionId: string): GoalState | null {
    const found = this.goals.get(sessionId);
    if (!found) return null;
    return {
      ...found,
      contract: { ...found.contract },
      subgoals: [...found.subgoals],
      gates: found.gates.map((g) => ({ ...g })),
    };
  }

  deleteGoal(sessionId: string): boolean {
    const deleted = this.goals.delete(sessionId);
    if (deleted) {
      this.lastUpdatedMs = Date.now();
    }
    return deleted;
  }

  listActiveGoals(): GoalState[] {
    return Array.from(this.goals.values())
      .filter((g) => g.status === "active")
      .map((g) => ({
        ...g,
        contract: { ...g.contract },
        subgoals: [...g.subgoals],
        gates: g.gates.map((gate) => ({ ...gate })),
      }));
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
    lastUpdatedMs: number;
  } {
    return {
      totalInvocations: this.totalInvocations,
      totalCompletedGoals: this.totalCompletedGoals,
      totalGatesEvaluated: this.totalGatesEvaluated,
      activeGoalsCount: this.listActiveGoals().length,
      lastUpdatedMs: this.lastUpdatedMs,
    };
  }

  createStateSnapshot(): GoalStateSnapshot {
    const goalsObj: Record<string, GoalState> = {};
    for (const [sid, g] of this.goals.entries()) {
      goalsObj[sid] = {
        ...g,
        contract: { ...g.contract },
        subgoals: [...g.subgoals],
        gates: g.gates.map((gate) => ({ ...gate })),
      };
    }

    return {
      version: 1,
      goals: goalsObj,
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
        subgoals: [...g.subgoals],
        gates: g.gates.map((gate) => ({ ...gate })),
      });
    }
    this.totalInvocations = snapshot.totalInvocations;
    this.totalCompletedGoals = snapshot.totalCompletedGoals;
    this.totalGatesEvaluated = snapshot.totalGatesEvaluated;
    this.lastUpdatedMs = snapshot.lastUpdatedMs;
  }

  clear(): void {
    this.goals.clear();
    this.totalInvocations = 0;
    this.totalCompletedGoals = 0;
    this.totalGatesEvaluated = 0;
    this.lastUpdatedMs = Date.now();
  }
}
