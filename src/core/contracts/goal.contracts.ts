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

export type GoalHealthStatus = "on_track" | "at_risk" | "off_track" | "exceeded";

export interface GoalMilestoneChecklistItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
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
  checklist?: GoalMilestoneChecklistItem[];
  tags?: string[];
  targetDeadlineMs?: number;
  completedAtMs?: number;
}

export interface GoalHealthAuditReport {
  readonly sessionId: string;
  readonly goal: string;
  readonly healthStatus: GoalHealthStatus;
  readonly progressPercent: number;
  readonly turnsUsed: number;
  readonly maxTurns: number;
  readonly turnsRemaining: number;
  readonly turnConsumptionRate: number;
  readonly estimatedTurnsToCompletion: number;
  readonly isOverTurnsBudget: boolean;
  readonly isPastDeadline: boolean;
  readonly blockedMilestonesCount: number;
  readonly failedGatesCount: number;
  readonly recommendations: readonly string[];
}

export interface GoalRiskDiagnosis {
  readonly sessionId: string;
  readonly overallRiskLevel: "low" | "medium" | "high" | "critical";
  readonly riskFactors: readonly {
    readonly kind: "gate_failure" | "milestone_blocked" | "budget_exhaustion" | "deadline_passed";
    readonly title: string;
    readonly description: string;
    readonly blastRadiusAffectedMilestoneIds: readonly string[];
    readonly suggestedFixCommand?: string;
  }[];
  readonly immediateRemediationPlan: readonly string[];
}

export interface GoalSwarmBalanceResult {
  readonly parentSessionId: string;
  readonly assignedMilestonesCount: number;
  readonly unassignedMilestonesCount: number;
  readonly workerAssignments: Record<string, readonly string[]>;
}

export interface GoalArchiveResult {
  readonly archivedCount: number;
  readonly remainingActiveCount: number;
  readonly archivedSessionIds: readonly string[];
}

export interface GoalCloneOptions {
  readonly resetProgress?: boolean;
  readonly resetGates?: boolean;
  readonly newMaxTurns?: number;
  readonly newCategory?: GoalCategory;
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
  tags?: string[];
  targetDeadlineMs?: number;
  healthStatus?: GoalHealthStatus;
  estimatedRemainingTurns?: number;
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
  tags?: string[];
  healthStatus?: GoalHealthStatus;
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

// ---------------------------------------------------------------------------
// Goal Desktop & In-App Notification Contracts
// ---------------------------------------------------------------------------

export type GoalNotificationTrigger =
  | "milestone_completed"
  | "gate_failed"
  | "gate_passed"
  | "goal_completed"
  | "budget_exhausted"
  | "goal_paused"
  | "custom";

export type GoalNotificationUrgency = "low" | "normal" | "critical";

export interface GoalNotificationEvent {
  readonly sessionId?: string;
  readonly title: string;
  readonly message: string;
  readonly urgency: GoalNotificationUrgency;
  readonly trigger: GoalNotificationTrigger;
  readonly metadata?: Record<string, unknown>;
  readonly actionUrl?: string;
}

export interface GoalNotificationPreferences {
  readonly enabled: boolean;
  readonly soundEnabled: boolean;
  readonly dndEnabled: boolean;
  readonly minUrgency: GoalNotificationUrgency;
  readonly allowedTriggers: readonly GoalNotificationTrigger[];
}

export interface GoalNotificationRecord {
  readonly id: string;
  readonly event: GoalNotificationEvent;
  readonly timestampMs: number;
  readonly read: boolean;
  readonly channelsDispatched: readonly string[];
}

// ---------------------------------------------------------------------------
// Goal Grouping, Sorting & Multi-View Contracts
// ---------------------------------------------------------------------------

export type GoalGroupBy = "status" | "category" | "progress" | "turns";
export type GoalSortBy = "createdAt" | "progress" | "turns" | "milestones" | "gates";
export type GoalSortDirection = "asc" | "desc";
export type GoalExportFormat = "html" | "markdown" | "csv" | "json";

export interface GoalGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly goals: readonly GoalState[];
}

export interface GoalMutationUndoRecord {
  readonly undoId: string;
  readonly sessionId: string;
  readonly previousState: GoalState;
  readonly newState: GoalState;
  readonly timestampMs: number;
}

export interface GoalVelocityMetrics {
  readonly totalGoalsEvaluated: number;
  readonly completedGoalsCount: number;
  readonly averageTurnsToCompletion: number;
  readonly overallGatePassRatePercent: number;
  readonly totalRemediationsTriggered: number;
  readonly averageMilestonesPerGoal: number;
}

export interface GoalHierarchyReport {
  readonly goal: GoalState;
  readonly parent?: GoalState;
  readonly children: readonly GoalState[];
  readonly aggregateProgressPercent: number;
}

export interface GoalBulkMutationResult {
  readonly totalTargeted: number;
  readonly updatedCount: number;
  readonly failedCount: number;
  readonly updatedGoals: readonly GoalState[];
  readonly errors: readonly string[];
}

// ---------------------------------------------------------------------------
// BroccoliDB Table Row Record Contracts
// ---------------------------------------------------------------------------

export interface GoalSessionRow extends Record<string, unknown> {
  id: string;
  goal: string;
  category: string;
  status: string;
  turnsUsed: number;
  maxTurns: number;
  progressPercent: number;
  parentGoalSessionId?: string;
  contractJson: string;
  milestonesCount: number;
  gatesCount: number;
  createdAtMs: number;
  lastTurnAtMs: number;
}

export interface GoalMilestoneRow extends Record<string, unknown> {
  id: string;
  sessionId: string;
  title: string;
  status: string;
  progressPercent: number;
  dependsOnJson?: string;
  blockersJson?: string;
  completedAtMs?: number;
}

export interface GoalGateRow extends Record<string, unknown> {
  id: string;
  sessionId: string;
  name: string;
  command: string;
  policy: string;
  attempts: number;
  lastExitCode?: number;
  lastOutputTail: string;
}

export interface GoalEventRow extends Record<string, unknown> {
  id: string;
  sessionId: string;
  turnIndex: number;
  actionSummary: string;
  gatesPassed: number;
  verdict: string;
  timestampMs: number;
}

export interface GoalRetroRow extends Record<string, unknown> {
  id: string;
  sessionId: string;
  goal: string;
  status: string;
  turnsUsed: number;
  durationMs: number;
  finalVerdict?: string;
  contractAdherenceScore: number;
  completedAtMs: number;
}

export interface GoalNotificationRow extends Record<string, unknown> {
  id: string;
  sessionId?: string;
  title: string;
  message: string;
  urgency: string;
  trigger: string;
  read: boolean;
  timestampMs: number;
}
