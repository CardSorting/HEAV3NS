/**
 * tool-disclosure.contracts.ts
 *
 * Core data contracts for Progressive Tool Disclosure, Dynamic Schema Gateway
 * & Deferred Tooling Subsystem (Phase 91 / ADR-043 / Target #83).
 */

export interface DeferredToolDefinition {
  readonly name: string;
  readonly namespace: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly isCore: boolean;
  readonly tags: readonly string[];
}

export type DisclosureTier = "eager" | "budgeted_listing" | "names_only" | "search_only";

export interface DisclosureManifest {
  readonly totalRegistered: number;
  readonly eagerCount: number;
  readonly deferredCount: number;
  readonly activeTier: DisclosureTier;
  readonly tokenBudget: number;
  readonly summary: string;
}

export interface ToolSearchResult {
  readonly query: string;
  readonly totalMatches: number;
  readonly tools: readonly DeferredToolDefinition[];
}

export interface ToolDisclosureConfig {
  readonly defaultTier: DisclosureTier;
  readonly eagerTokenBudget: number;
  readonly maxSearchResults: number;
  readonly autoActivateOnSearch: boolean;
}

export const DEFAULT_TOOL_DISCLOSURE_CONFIG: ToolDisclosureConfig = {
  defaultTier: "budgeted_listing",
  eagerTokenBudget: 8192,
  maxSearchResults: 10,
  autoActivateOnSearch: true,
};

export interface ToolDisclosureMetrics {
  readonly totalRegisteredTools: number;
  readonly totalActivatedTools: number;
  readonly totalSearchesPerformed: number;
  readonly totalSchemasEmitted: number;
  readonly estimatedTokensSaved: number;
}

export interface ToolDisclosureWorkspaceSnapshot {
  readonly snapshotId: string;
  readonly totalTools: number;
  readonly deferredToolsCount: number;
  readonly registeredTools: readonly DeferredToolDefinition[];
  readonly activatedTools: readonly string[];
  readonly activeTier: DisclosureTier;
  readonly metrics: ToolDisclosureMetrics;
  readonly config: ToolDisclosureConfig;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Row Schemas
// ---------------------------------------------------------------------------

export interface DeferredToolRow {
  readonly name: string;
  readonly namespace: string;
  readonly description: string;
  readonly parametersJson: string;
  readonly isCore: boolean;
  readonly tags: readonly string[];
  readonly isActivated: boolean;
  readonly registeredAt: number;
  [key: string]: unknown;
}

export interface ToolDisclosureAuditRow {
  readonly auditId: string;
  readonly totalRegistered: number;
  readonly eagerCount: number;
  readonly activeTier: DisclosureTier;
  readonly healthStatus: ToolDisclosureHealthStatus;
  readonly timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Health Matrix & Telemetry Reports
// ---------------------------------------------------------------------------

export type ToolDisclosureHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface ToolDisclosureHealthAuditReport {
  readonly totalRegistered: number;
  readonly eagerCount: number;
  readonly deferredCount: number;
  readonly activatedCount: number;
  readonly healthStatus: ToolDisclosureHealthStatus;
  readonly recommendations: readonly string[];
}

export interface ToolDisclosureMetricsReport {
  readonly totalRegisteredTools: number;
  readonly totalActivatedTools: number;
  readonly totalSearchesPerformed: number;
  readonly totalSchemasEmitted: number;
  readonly estimatedTokensSaved: number;
  readonly toolsByNamespace: Record<string, number>;
  readonly toolsByTag: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Swimlane Grouping
// ---------------------------------------------------------------------------

export type ToolDisclosureGroupBy = "namespace" | "tier" | "isCore";
export type ToolDisclosureSortBy = "name" | "namespace" | "registeredAt";
export type ToolDisclosureSortDirection = "asc" | "desc";

export interface ToolDisclosureGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly tools: readonly DeferredToolRow[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search
// ---------------------------------------------------------------------------

export interface ToolDisclosureDslQueryFilter {
  readonly rawQuery?: string;
  readonly namespace?: string;
  readonly isCore?: boolean;
  readonly isActivated?: boolean;
  readonly tag?: string;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Bulk Operations
// ---------------------------------------------------------------------------

export interface ToolDisclosureMutationUndoRecord {
  readonly mutationType: "register_tool" | "activate_tool" | "bulk_purge" | "clear" | "config_change";
  readonly previousSnapshot: ToolDisclosureWorkspaceSnapshot;
  readonly nextSnapshot: ToolDisclosureWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface ToolDisclosureBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedToolNames: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Core Interface
// ---------------------------------------------------------------------------

export interface IBroccoliToolDisclosureSubstrate {
  registerTool(tool: DeferredToolDefinition): void;
  getTool(name: string): DeferredToolDefinition | undefined;
  listTools(): readonly DeferredToolDefinition[];
  removeTool(name: string): boolean;
  clear(): void;

  activateTool(name: string): boolean;
  deactivateTool(name: string): boolean;
  getActivatedTools(): readonly string[];

  auditHealth(): ToolDisclosureHealthAuditReport;
  getMetrics(): ToolDisclosureMetrics;
  getMetricsReport(): ToolDisclosureMetricsReport;
  getGroupedTools(
    groupBy?: ToolDisclosureGroupBy,
    sortBy?: ToolDisclosureSortBy,
    direction?: ToolDisclosureSortDirection
  ): readonly ToolDisclosureGroupedLane[];
  queryToolsDsl(query: ToolDisclosureDslQueryFilter | string): readonly DeferredToolRow[];

  bulkPurgeTools(names: readonly string[]): ToolDisclosureBulkMutationResult;

  undo(): boolean;
  redo(): boolean;

  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;

  exportSnapshot(): ToolDisclosureWorkspaceSnapshot;
  importSnapshot(snapshot: ToolDisclosureWorkspaceSnapshot): void;
}
