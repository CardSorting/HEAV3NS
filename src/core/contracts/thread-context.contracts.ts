/**
 * thread-context.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Async Context Propagation,
 * Security Callback Inheritance & Fail-Closed Approval Lifecycle Subsystem
 * (Phase 133 / ADR-109 / Target #66).
 */

export type SecurityApprovalCallback = (command: string, reason: string) => Promise<boolean>;
export type SudoPasswordCallback = () => Promise<string | undefined>;

export interface AsyncTurnContextDescriptor {
  contextId: string;
  parentSessionId: string;
  platform: string;
  hasApprovalCallback: boolean;
  hasSudoCallback: boolean;
  isInteractive: boolean;
  createdAt: number;
  metadata: Record<string, string>;
}

export interface ContextPropagationConfig {
  failClosedOnMissingApproval: boolean;
  allowNonInteractiveAutoApprove: boolean;
  auditLogDispatches: boolean;
  maxActiveContexts: number;
}

export interface ExecutionDispatchEvent {
  id: string;
  timestamp: number;
  contextId: string;
  action: "context_spawned" | "dispatched" | "approval_invoked" | "approval_resolved" | "fail_closed_blocked" | "context_cleaned";
  commandOrTask?: string;
  approved?: boolean;
  details?: string;
}

export interface ContextPropagationMetrics {
  totalContextsSpawned: number;
  totalExecutionsWrapped: number;
  totalApprovalsInherited: number;
  totalFailClosedBlocks: number;
  activeContextCount: number;
}

export interface ThreadContextWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: ContextPropagationConfig;
  contexts: AsyncTurnContextDescriptor[];
  auditLogs: ExecutionDispatchEvent[];
  metrics: ContextPropagationMetrics;
}

export const DEFAULT_CONTEXT_PROPAGATION_CONFIG: ContextPropagationConfig = {
  failClosedOnMissingApproval: true,
  allowNonInteractiveAutoApprove: false,
  auditLogDispatches: true,
  maxActiveContexts: 100,
};

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface ThreadContextRow {
  readonly id: string;
  readonly contextId: string;
  readonly parentSessionId: string;
  readonly platform: string;
  readonly isInteractive: boolean;
  readonly hasApprovalCallback: boolean;
  readonly hasSudoCallback: boolean;
  readonly createdAt: number;
  readonly [key: string]: unknown;
}

export interface ExecutionDispatchRow {
  readonly id: string;
  readonly contextId: string;
  readonly action: string;
  readonly commandOrTask?: string;
  readonly approved?: boolean;
  readonly details?: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface ContextAuditRow {
  readonly id: string;
  readonly action: string;
  readonly operator: string;
  readonly details: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Metrics Telemetry
// ---------------------------------------------------------------------------

export type ThreadContextHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "critical_leak";

export interface ThreadContextHealthAuditReport {
  readonly totalContexts: number;
  readonly activeContexts: number;
  readonly totalDispatches: number;
  readonly totalBlocked: number;
  readonly hasOrphanedContexts: boolean;
  readonly healthStatus: ThreadContextHealthStatus;
  readonly recommendations: readonly string[];
}

export interface ThreadContextMetricsReport {
  readonly totalContextsSpawned: number;
  readonly activeContextCount: number;
  readonly totalExecutionsWrapped: number;
  readonly totalApprovalsInherited: number;
  readonly totalFailClosedBlocks: number;
  readonly averageLatencyMs: number;
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type ThreadContextGroupBy = "platform" | "interactive" | "security" | "parent";

export type ThreadContextSortBy = "createdAt" | "contextId" | "platform";

export type ThreadContextSortDirection = "asc" | "desc";

export interface ThreadContextGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly contexts: readonly AsyncTurnContextDescriptor[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface ThreadContextDslQueryFilter {
  readonly rawQuery: string;
  readonly platform?: string;
  readonly isInteractive?: boolean;
  readonly hasApprovalCallback?: boolean;
  readonly parentSessionId?: string;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface ThreadContextMutationUndoRecord {
  readonly mutationType: "spawn" | "clean" | "dispatch" | "configure" | "bulk";
  readonly previousSnapshot: ThreadContextWorkspaceSnapshot;
  readonly nextSnapshot: ThreadContextWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface ThreadContextBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedContextIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliThreadContextSubstrate {
  registerContext(descriptor: AsyncTurnContextDescriptor): void;
  getContext(contextId: string): AsyncTurnContextDescriptor | undefined;
  listContexts(): readonly AsyncTurnContextDescriptor[];
  removeContext(contextId: string): boolean;
  recordDispatch(event: ExecutionDispatchEvent): void;
  listDispatches(contextId?: string): readonly ExecutionDispatchEvent[];
  getConfig(): ContextPropagationConfig;
  setConfig(config: Partial<ContextPropagationConfig>): void;
  getMetrics(): ThreadContextMetricsReport;
  auditHealth(): ThreadContextHealthAuditReport;
  getGroupedContexts(groupBy?: ThreadContextGroupBy, sortBy?: ThreadContextSortBy, direction?: ThreadContextSortDirection): readonly ThreadContextGroupedLane[];
  queryContextsDsl(query: ThreadContextDslQueryFilter | string): readonly AsyncTurnContextDescriptor[];
  bulkPurgeContexts(contextIds: readonly string[]): ThreadContextBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): ThreadContextWorkspaceSnapshot;
  importSnapshot(snapshot: ThreadContextWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}

