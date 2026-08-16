/**
 * Goal Supervisor coordinating Goal Lifecycle, Quality Gates & Ralph Loop
 * Subsystem: Target #74 / ADR-117
 */

import type {
  GoalContract,
  GoalEvaluationResult,
  GoalGate,
  GoalState,
} from "../../../core/contracts/goal.contracts.js";
import {
  DEFAULT_GATE_MAX_RETRIES,
  DEFAULT_GATE_TIMEOUT_SECONDS,
  DEFAULT_GOAL_MAX_TURNS,
} from "../../../core/contracts/goal.contracts.js";
import { BroccoliGoalSubstrate } from "../../../sessions/extensions/goals/broccoli-goal-substrate.js";
import { DeterministicGoalEngine } from "./deterministic-goal-engine.js";

export class GoalSupervisor {
  private readonly substrate: BroccoliGoalSubstrate;
  private readonly engine: DeterministicGoalEngine;

  constructor(
    substrate: BroccoliGoalSubstrate,
    engine: DeterministicGoalEngine
  ) {
    this.substrate = substrate;
    this.engine = engine;
  }

  setGoal(
    sessionId: string,
    rawText: string,
    options: {
      maxTurns?: number;
      contract?: GoalContract;
      gates?: GoalGate[];
    } = {}
  ): GoalState {
    this.substrate.recordInvocation();
    const { headline, contract } = this.engine.parseContract(rawText);
    const effectiveGoal = headline || rawText;
    const mergedContract = { ...contract, ...(options.contract || {}) };

    const state: GoalState = {
      sessionId,
      goal: effectiveGoal,
      status: "active",
      turnsUsed: 0,
      maxTurns: options.maxTurns || DEFAULT_GOAL_MAX_TURNS,
      createdAtMs: Date.now(),
      lastTurnAtMs: Date.now(),
      consecutiveParseFailures: 0,
      consecutiveTransportFailures: 0,
      subgoals: [],
      contract: mergedContract,
      gates: options.gates ? options.gates.map((g) => ({ ...g })) : [],
    };

    this.substrate.setGoal(state);
    return state;
  }

  getGoal(sessionId: string): GoalState | null {
    return this.substrate.getGoal(sessionId);
  }

  addSubgoal(sessionId: string, criterion: string): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;
    state.subgoals.push(criterion.trim());
    this.substrate.setGoal(state);
    return true;
  }

  addGate(
    sessionId: string,
    command: string,
    options: { timeoutSeconds?: number; maxRetries?: number } = {}
  ): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;

    const gate: GoalGate = {
      command: command.trim(),
      timeoutSeconds: options.timeoutSeconds || DEFAULT_GATE_TIMEOUT_SECONDS,
      maxRetries: options.maxRetries || DEFAULT_GATE_MAX_RETRIES,
      attempts: 0,
      lastOutputTail: "",
      lastFailedFingerprint: "",
    };

    state.gates.push(gate);
    this.substrate.setGoal(state);
    return true;
  }

  pauseGoal(sessionId: string, reason: string = "Paused by user"): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;
    state.status = "paused";
    state.pausedReason = reason;
    this.substrate.setGoal(state);
    return true;
  }

  resumeGoal(sessionId: string): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;
    state.status = "active";
    state.pausedReason = undefined;
    state.waitingOnPid = undefined;
    state.waitingOnSession = undefined;
    state.waitingUntil = undefined;
    state.waitingReason = undefined;
    this.substrate.setGoal(state);
    return true;
  }

  clearGoal(sessionId: string): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;
    state.status = "cleared";
    this.substrate.setGoal(state);
    return true;
  }

  async evaluateTurn(
    sessionId: string,
    lastResponse: string,
    options: {
      cwd?: string;
      currentFingerprint?: string;
      backgroundProcesses?: Array<{ pid: number; session?: string; command?: string }>;
      judgeFn?: (prompt: string) => Promise<{
        verdict: string;
        reason: string;
        wait_on_session?: string;
        wait_on_pid?: number;
        wait_for_seconds?: number;
      }>;
    } = {}
  ): Promise<GoalEvaluationResult> {
    const state = this.substrate.getGoal(sessionId);
    if (!state) {
      return {
        shouldContinue: false,
        verdict: "skipped",
        reason: "No active goal set for this session.",
      };
    }

    return this.engine.evaluateAfterTurn({
      state,
      lastResponse,
      cwd: options.cwd,
      currentFingerprint: options.currentFingerprint,
      backgroundProcesses: options.backgroundProcesses,
      judgeFn: options.judgeFn,
    });
  }

  getMetrics() {
    return this.substrate.getMetrics();
  }
}
