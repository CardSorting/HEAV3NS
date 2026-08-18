/**
 * execution.contracts.ts
 *
 * Core data contracts for the Deterministic Programmatic Tool Execution, Sandboxed Scripting &
 * Runbook Orchestration Subsystem (Phase 82 / ADR-034).
 */

export type CodeExecutionLanguage =
  | "javascript"
  | "typescript"
  | "json"
  | "python"
  | "bash"
  | "sql";

export type ExecutionStatus =
  | "pending"
  | "running"
  | "success"
  | "failure"
  | "timed_out"
  | "aborted"
  | "security_blocked";

export type SandboxSecurityPolicy =
  | "strict_isolated"
  | "standard_ephemeral"
  | "read_only"
  | "unrestricted";

export interface ProgrammaticToolCall {
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly result: unknown;
  readonly executionTimeMs: number;
  readonly timestamp: number;
  readonly success: boolean;
}

export interface CodeExecutionResult {
  readonly success: boolean;
  readonly output: string;
  readonly logs: readonly string[];
  readonly error?: string;
  readonly executionTimeMs: number;
  readonly toolCallsExecuted: number;
  readonly toolCalls: readonly ProgrammaticToolCall[];
  readonly status: ExecutionStatus;
  readonly memoryUsageBytes?: number;
}

export interface SandboxContext {
  readonly timeoutMs: number;
  readonly maxToolCalls: number;
  readonly allowAsync: boolean;
  readonly securityPolicy?: SandboxSecurityPolicy;
  readonly env?: Record<string, string>;
  readonly allowedGlobals?: readonly string[];
  readonly workingDirectory?: string;
}

export interface ExecutionRecord {
  readonly id: string;
  readonly code: string;
  readonly language: CodeExecutionLanguage;
  readonly context: SandboxContext;
  readonly result: CodeExecutionResult;
  readonly createdFrame: number;
  readonly tags?: readonly string[];
  readonly timestamp: number;
}

export interface ExecutionWorkspaceSnapshot {
  readonly totalExecutions: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly totalToolCalls: number;
  readonly records: readonly ExecutionRecord[];
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface ExecutionRecordRow {
  readonly id: string;
  readonly language: string;
  readonly status: string;
  readonly executionTimeMs: number;
  readonly toolCallsExecuted: number;
  readonly success: boolean;
  readonly createdFrame: number;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface ToolCallRow {
  readonly id: string;
  readonly executionId: string;
  readonly toolName: string;
  readonly executionTimeMs: number;
  readonly success: boolean;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface ExecutionAuditRow {
  readonly id: string;
  readonly executionId: string;
  readonly action: string;
  readonly operator: string;
  readonly details: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Metrics Telemetry
// ---------------------------------------------------------------------------

export type ExecutionHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "security_alert";

export interface ExecutionHealthAuditReport {
  readonly totalExecutions: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly timedOutCount: number;
  readonly securityBlockedCount: number;
  readonly overallSuccessRate: number; // 0.0 - 1.0
  readonly avgExecutionTimeMs: number;
  readonly healthStatus: ExecutionHealthStatus;
  readonly recommendations: readonly string[];
}

export interface ExecutionMetricsReport {
  readonly totalExecutions: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly timedOutCount: number;
  readonly securityBlockedCount: number;
  readonly totalToolCalls: number;
  readonly overallSuccessRate: number;
  readonly avgExecutionTimeMs: number;
  readonly p50ExecutionTimeMs: number;
  readonly p95ExecutionTimeMs: number;
  readonly topInvokedTools: readonly { toolName: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type ExecutionGroupBy = "language" | "status" | "createdFrame";

export type ExecutionSortBy = "timestamp" | "executionTimeMs" | "toolCallsExecuted";

export type ExecutionSortDirection = "asc" | "desc";

export interface ExecutionGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly successRate: number;
  readonly records: readonly ExecutionRecord[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface ExecutionDslQueryFilter {
  readonly rawQuery: string;
  readonly language?: CodeExecutionLanguage;
  readonly status?: ExecutionStatus;
  readonly minExecutionTimeMs?: number;
  readonly maxExecutionTimeMs?: number;
  readonly hasToolCalls?: boolean;
  readonly toolName?: string;
  readonly tags?: readonly string[];
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface ExecutionMutationUndoRecord {
  readonly mutationType: "record_execution" | "purge_records" | "abort_execution" | "bulk";
  readonly previousSnapshot: ExecutionWorkspaceSnapshot;
  readonly nextSnapshot: ExecutionWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface ExecutionBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedExecutionIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliExecutionSubstrate {
  recordExecution(record: ExecutionRecord): void;
  getExecution(executionId: string): ExecutionRecord | undefined;
  listExecutions(limit?: number): readonly ExecutionRecord[];
  recordToolCall(executionId: string, call: ProgrammaticToolCall): void;
  listToolCalls(executionId?: string, limit?: number): readonly ProgrammaticToolCall[];
  getExecutionMetrics(): ExecutionMetricsReport;
  auditExecutionHealth(): ExecutionHealthAuditReport;
  getGroupedExecutions(groupBy?: ExecutionGroupBy, sortBy?: ExecutionSortBy, direction?: ExecutionSortDirection): readonly ExecutionGroupedLane[];
  queryExecutionsDsl(query: ExecutionDslQueryFilter | string): readonly ExecutionRecord[];
  bulkPurgeRecords(executionIds: readonly string[]): ExecutionBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): ExecutionWorkspaceSnapshot;
  importSnapshot(snapshot: ExecutionWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
