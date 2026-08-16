/**
 * Persistent Session Goals, Quality Gates & Deterministic Goal Loop Contracts
 * Reference: hermes-agent-main/hermes_cli/goals.py, hermes_cli/loops.py
 * Subsystem: Target #74 / ADR-117
 */

export const DEFAULT_GOAL_MAX_TURNS = 20;
export const DEFAULT_GOAL_JUDGE_TIMEOUT_MS = 30_000;
export const DEFAULT_GATE_TIMEOUT_SECONDS = 300;
export const DEFAULT_GATE_MAX_RETRIES = 3;
export const GATE_OUTPUT_TAIL_CHARS = 3000;
export const DEFAULT_MAX_CONSECUTIVE_PARSE_FAILURES = 3;
export const DEFAULT_MAX_CONSECUTIVE_TRANSPORT_FAILURES = 5;

export type GoalStatus = "active" | "paused" | "done" | "cleared";
export type GoalVerdict = "done" | "continue" | "wait" | "skipped";

export interface GoalContract {
  outcome?: string;
  verification?: string;
  constraints?: string;
  boundaries?: string;
  stopWhen?: string;
}

export interface GoalGate {
  command: string;
  timeoutSeconds: number;
  maxRetries: number;
  attempts: number;
  lastExitCode?: number;
  lastOutputTail: string;
  lastFailedFingerprint: string;
}

export interface GoalState {
  sessionId: string;
  goal: string;
  status: GoalStatus;
  turnsUsed: number;
  maxTurns: number;
  createdAtMs: number;
  lastTurnAtMs: number;
  lastVerdict?: GoalVerdict;
  lastReason?: string;
  pausedReason?: string;
  consecutiveParseFailures: number;
  consecutiveTransportFailures: number;
  subgoals: string[];
  waitingOnPid?: number;
  waitingOnSession?: string;
  waitingUntil?: number;
  waitingReason?: string;
  waitingSince?: number;
  contract: GoalContract;
  gates: GoalGate[];
}

export interface GoalEvaluationResult {
  shouldContinue: boolean;
  verdict: GoalVerdict;
  reason: string;
  continuationPrompt?: string;
  pausedReason?: string;
  waitOnPid?: number;
  waitOnSession?: string;
  waitForSeconds?: number;
  gateFailed?: boolean;
}

export interface GoalStateSnapshot {
  version: number;
  goals: Record<string, GoalState>;
  totalInvocations: number;
  totalCompletedGoals: number;
  totalGatesEvaluated: number;
  lastUpdatedMs: number;
}
