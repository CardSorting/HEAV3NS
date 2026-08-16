/**
 * Persistent Session Goals, Quality Gates, Milestone DAGs & Swarm Coordination Contracts
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

export type GoalStatus = "active" | "paused" | "done" | "cleared" | "failed";
export type GoalVerdict = "done" | "continue" | "wait" | "skipped";
export type GoalGatePolicy = "blocking" | "advisory";
export type MilestoneStatus = "pending" | "in_progress" | "completed" | "blocked";

export type GoalCategory =
  | "bugfix"
  | "feature"
  | "refactor"
  | "audit"
  | "release"
  | "learning"
  | "general"
  | "custom";

export interface GoalContract {
  outcome?: string;
  verification?: string;
  constraints?: string;
  boundaries?: string;
  stopWhen?: string;
}

export interface GoalGate {
  id?: string;
  name?: string;
  command: string;
  policy?: GoalGatePolicy;
  timeoutSeconds: number;
  maxRetries: number;
  attempts: number;
  lastExitCode?: number;
  lastOutputTail: string;
  lastFailedFingerprint: string;
  autoRemediateCommand?: string;
  remediatedCount?: number;
}

export interface GoalMilestone {
  id: string;
  title: string;
  description?: string;
  status: MilestoneStatus;
  progressPercent: number;
  dependsOn?: string[];
  blockers?: string[];
  assignedSessionId?: string;
  completedAtMs?: number;
}

export interface GoalStepEvent {
  turnIndex: number;
  timestampMs: number;
  actionSummary: string;
  gatesEvaluated: number;
  gatesPassed: number;
  milestonesCompleted: string[];
  verdict: GoalVerdict;
}

export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  category: GoalCategory;
  icon: string;
  defaultContract: GoalContract;
  recommendedGates: {
    name: string;
    command: string;
    policy: GoalGatePolicy;
    timeoutSeconds?: number;
    autoRemediateCommand?: string;
  }[];
  defaultMilestones: {
    id: string;
    title: string;
    dependsOn?: string[];
  }[];
  maxTurns: number;
}

export interface GoalDiffResult {
  sessionIdA: string;
  sessionIdB: string;
  identical: boolean;
  differences: {
    field: string;
    valueA: unknown;
    valueB: unknown;
  }[];
  milestoneDelta: {
    onlyInA: string[];
    onlyInB: string[];
    shared: string[];
  };
  gateDelta: {
    onlyInA: string[];
    onlyInB: string[];
    shared: string[];
  };
}

export interface GoalRetroSummary {
  sessionId: string;
  goal: string;
  category: GoalCategory;
  status: GoalStatus;
  turnsUsed: number;
  maxTurns: number;
  totalMilestones: number;
  completedMilestones: number;
  totalGates: number;
  passedGates: number;
  durationMs: number;
  finalVerdict?: GoalVerdict;
  finalReason?: string;
  contractAdherenceScore: number;
  trajectoryEventsCount: number;
}

export interface GoalState {
  sessionId: string;
  goal: string;
  parentGoalSessionId?: string;
  childGoalSessionIds?: string[];
  templateId?: string;
  category?: GoalCategory;
  icon?: string;
  status: GoalStatus;
  turnsUsed: number;
  maxTurns: number;
  progressPercent: number;
  createdAtMs: number;
  lastTurnAtMs: number;
  lastVerdict?: GoalVerdict;
  lastReason?: string;
  pausedReason?: string;
  consecutiveParseFailures: number;
  consecutiveTransportFailures: number;
  subgoals: string[];
  milestones: GoalMilestone[];
  trajectory: GoalStepEvent[];
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
  milestonesUpdated?: boolean;
  remediationAttempted?: boolean;
}

export interface GoalQueryFilter {
  status?: GoalStatus;
  category?: GoalCategory;
  templateId?: string;
  parentSessionId?: string;
  text?: string;
  minProgress?: number;
  maxProgress?: number;
  sortBy?: "recent" | "progress" | "turns";
  limit?: number;
}

export interface GoalStateSnapshot {
  version: number;
  goals: Record<string, GoalState>;
  completedGoalsArchive: GoalRetroSummary[];
  totalInvocations: number;
  totalCompletedGoals: number;
  totalGatesEvaluated: number;
  totalRemediationsTriggered: number;
  lastUpdatedMs: number;
}
