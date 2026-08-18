/**
 * tool-execution-segment.contracts.ts
 *
 * Core data contracts for Deterministic Tool Execution Segmenter,
 * Batch Parallelism Scheduler & Loop-Guardrail Subsystem (Phase 94 / ADR-046 / Phase 130 / ADR-106 / Target #85).
 */

export type ToolExecutionMode = "sequential" | "parallel" | "barrier";

export interface ToolCallItem {
  readonly callId: string;
  readonly toolName: string;
  readonly parameters: Record<string, unknown>;
}

export interface ToolExecutionBatchSegment {
  readonly segmentIndex: number;
  readonly mode: ToolExecutionMode;
  readonly toolCalls: readonly ToolCallItem[];
  readonly isMutating: boolean;
}

export interface LoopGuardrailDecision {
  readonly action: "allow" | "warn" | "block_synthetic" | "abort_turn";
  readonly reason?: string;
  readonly repetitionCount: number;
  readonly duplicateCallHash?: string;
}

export interface ToolLoopViolationRecord {
  readonly frameIndex: number;
  readonly toolName: string;
  readonly argsHash: string;
  readonly repetitionCount: number;
  readonly actionTaken: string;
  readonly timestamp: number;
}

export interface ToolExecutionGuardConfig {
  maxConsecutiveIdenticalCalls: number;
  abortThreshold: number;
  warnThreshold: number;
  enableParallelBatching: boolean;
  maxParallelBatchSize: number;
  failSafeMutatingDefault: boolean;
  maxDuplicateExecutions?: number;
  actionOnLimit?: "warn" | "block_synthetic" | "abort_turn" | string;
  defaultMutating?: boolean;
}

export const DEFAULT_TOOL_EXECUTION_GUARD_CONFIG: ToolExecutionGuardConfig = {
  maxConsecutiveIdenticalCalls: 3,
  abortThreshold: 5,
  warnThreshold: 2,
  enableParallelBatching: true,
  maxParallelBatchSize: 16,
  failSafeMutatingDefault: true,
};

export interface ToolExecutionGuardMetrics {
  readonly totalPlansPlanned: number;
  readonly totalSegmentsExecuted: number;
  readonly totalViolationsDetected: number;
  readonly parallelBatchesCreated: number;
  readonly sequentialBarriersEnforced: number;
  readonly blockedInvocations: number;
  readonly abortedTurns: number;
}

export interface ToolExecutionWorkspaceSnapshot {
  readonly totalViolations: number;
  readonly activeViolations: readonly ToolLoopViolationRecord[];
  readonly lastRepetitionHash?: string;
  readonly metrics: ToolExecutionGuardMetrics;
  readonly config: ToolExecutionGuardConfig;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Row Schemas
// ---------------------------------------------------------------------------

export interface ToolLoopViolationRow {
  readonly id: string;
  readonly frameIndex: number;
  readonly toolName: string;
  readonly argsHash: string;
  readonly repetitionCount: number;
  readonly actionTaken: string;
  readonly timestamp: number;
  [key: string]: unknown;
}

export interface ToolExecutionSegmentRow {
  readonly id: string;
  readonly planId: string;
  readonly segmentIndex: number;
  readonly mode: ToolExecutionMode;
  readonly toolCount: number;
  readonly toolNames: readonly string[];
  readonly isMutating: boolean;
  readonly timestamp: number;
  [key: string]: unknown;
}

export interface ToolExecutionAuditRow {
  readonly auditId: string;
  readonly planId: string;
  readonly totalSegments: number;
  readonly totalViolations: number;
  readonly healthStatus: ToolExecutionGuardHealthStatus;
  readonly timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Health Matrix & Telemetry Reports
// ---------------------------------------------------------------------------

export type ToolExecutionGuardHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface ToolExecutionGuardHealthAuditReport {
  readonly totalPlans: number;
  readonly totalSegments: number;
  readonly totalViolations: number;
  readonly blockedViolations: number;
  readonly abortViolations: number;
  readonly parallelRatioPercent: number;
  readonly healthStatus: ToolExecutionGuardHealthStatus;
  readonly recommendations: readonly string[];
}

export interface ToolExecutionGuardMetricsReport {
  readonly totalPlansPlanned: number;
  readonly totalSegmentsExecuted: number;
  readonly totalViolationsDetected: number;
  readonly parallelBatchesCreated: number;
  readonly sequentialBarriersEnforced: number;
  readonly blockedInvocations: number;
  readonly abortedTurns: number;
  readonly violationsByTool: Record<string, number>;
  readonly violationsByAction: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Swimlane Grouping
// ---------------------------------------------------------------------------

export type ToolExecutionGuardGroupBy = "toolName" | "actionTaken" | "frameIndex";
export type ToolExecutionGuardSortBy = "timestamp" | "repetitionCount" | "frameIndex";
export type ToolExecutionGuardSortDirection = "asc" | "desc";

export type ToolExecutionPlanGroupBy = ToolExecutionGuardGroupBy | string;
export type ToolExecutionPlanSortBy = ToolExecutionGuardSortBy | string;
export type ToolExecutionPlanSortDirection = ToolExecutionGuardSortDirection;

export interface ToolExecutionGuardGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly violations: readonly ToolLoopViolationRow[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search
// ---------------------------------------------------------------------------

export interface ToolExecutionGuardDslQueryFilter {
  rawQuery?: string;
  queryText?: string;
  toolName?: string;
  action?: string;
  minRepetitions?: number;
  textTerms?: readonly string[];
  hasParallel?: boolean;
  minCalls?: number;
  maxCalls?: number;
}

export type ToolExecutionPlanDslQueryFilter = ToolExecutionGuardDslQueryFilter;

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Bulk Operations
// ---------------------------------------------------------------------------

export interface ToolExecutionGuardMutationUndoRecord {
  readonly mutationType: "record_violation" | "bulk_purge" | "clear" | "config_change";
  readonly previousSnapshot: ToolExecutionWorkspaceSnapshot;
  readonly nextSnapshot: ToolExecutionWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface ToolExecutionGuardBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedViolationIds: readonly string[];
  readonly purgedCount: number;
}

// ---------------------------------------------------------------------------
// Substrate Core Interface
// ---------------------------------------------------------------------------

export interface IBroccoliExecutionGuardSubstrate {
  recordViolation(record: ToolLoopViolationRecord): void;
  getViolations(): readonly ToolLoopViolationRecord[];
  getViolationRows(): readonly ToolLoopViolationRow[];
  getViolation(id: string): ToolLoopViolationRow | undefined;
  removeViolation(id: string): boolean;
  setLatestSegments(segments: readonly ToolExecutionBatchSegment[]): void;
  getLatestSegments(): readonly ToolExecutionBatchSegment[];
  getPlans(): readonly ToolExecutionBatchSegment[];
  getPlanById(planId: string): ToolExecutionBatchSegment | ToolExecutionSegmentRow | undefined;
  getGroupedPlans(
    groupBy?: ToolExecutionGuardGroupBy | string,
    sortBy?: ToolExecutionGuardSortBy | string,
    direction?: ToolExecutionGuardSortDirection
  ): readonly ToolExecutionGuardGroupedLane[];
  queryPlansDsl(filter: ToolExecutionGuardDslQueryFilter | string): readonly ToolExecutionBatchSegment[];
  bulkPurgePlans(options?: { olderThanMs?: number } | readonly string[]): ToolExecutionGuardBulkMutationResult;
  clear(): void;

  auditHealth(): ToolExecutionGuardHealthAuditReport;
  getMetrics(): ToolExecutionGuardMetrics;
  getMetricsReport(): ToolExecutionGuardMetricsReport;
  getGroupedViolations(
    groupBy?: ToolExecutionGuardGroupBy,
    sortBy?: ToolExecutionGuardSortBy,
    direction?: ToolExecutionGuardSortDirection
  ): readonly ToolExecutionGuardGroupedLane[];
  queryViolationsDsl(query: ToolExecutionGuardDslQueryFilter | string): readonly ToolLoopViolationRow[];

  bulkPurgeViolations(target?: readonly string[] | { olderThanMs?: number }): ToolExecutionGuardBulkMutationResult;

  undo(): boolean;
  redo(): boolean;
  getUndoStackDepth(): number;
  getRedoStackDepth(): number;

  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  exportPlansMarkdown(): string;
  exportPlansHtml(): string;
  exportPlansCsv(): string;

  exportSnapshot(): ToolExecutionWorkspaceSnapshot;
  importSnapshot(snapshot: ToolExecutionWorkspaceSnapshot): void;
}
