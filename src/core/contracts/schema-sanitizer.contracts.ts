/**
 * schema-sanitizer.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Deterministic Tool Parameter Schema Sanitizer,
 * Non-Conforming Key Bidirectional Rewriter & LLM GBNF Grammar Firewall Subsystem (Phase 139 / ADR-115 / Target #80).
 */

export interface SchemaSanitizerConfig {
  enabled: boolean;
  enforceConformingKeys: boolean;
  collapseNullableUnions: boolean;
  stripRefSiblings: boolean;
  stripTopLevelCombinators: boolean;
  maxPropertyKeyLength: number;
}

export interface SchemaSanitizationResult {
  sanitizedSchema: Record<string, unknown>;
  renamedKeys: Record<string, string>;
  mutationsApplied: readonly string[];
  warnings: readonly string[];
}

export interface SchemaSanitizerMetrics {
  totalSchemasSanitized: number;
  invalidPropertyKeysRenamed: number;
  nullableUnionsCollapsed: number;
  refSiblingsStripped: number;
  topLevelCombinatorsCleaned: number;
  argumentsUnrenamed: number;
}

export interface SchemaSanitizerWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: SchemaSanitizerConfig;
  metrics: SchemaSanitizerMetrics;
  events?: readonly SchemaSanitizationEventRow[];
}

export const PROPERTY_KEY_REGEX = /^[a-zA-Z0-9_.-]{1,64}$/;
export const PROPERTY_KEY_INVALID_CHARS_REGEX = /[^a-zA-Z0-9_.-]/g;
export const FORBIDDEN_REF_SIBLING_KEYWORDS = new Set<string>(["default"]);
export const TOP_LEVEL_FORBIDDEN_COMBINATORS = new Set<string>([
  "allOf",
  "anyOf",
  "oneOf",
  "enum",
  "not",
]);

export const DEFAULT_SCHEMA_SANITIZER_CONFIG: SchemaSanitizerConfig = {
  enabled: true,
  enforceConformingKeys: true,
  collapseNullableUnions: true,
  stripRefSiblings: true,
  stripTopLevelCombinators: true,
  maxPropertyKeyLength: 64,
};

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Row Schemas
// ---------------------------------------------------------------------------

export interface SchemaSanitizationEventRow {
  eventId: string;
  schemaName: string;
  mutationsApplied: readonly string[];
  renamedKeyCount: number;
  warnings: readonly string[];
  timestamp: number;
  [key: string]: unknown;
}

export interface SchemaSanitizerAuditRow {
  auditId: string;
  totalSchemas: number;
  totalRenamedKeys: number;
  totalCollapsedUnions: number;
  totalStrippedSiblings: number;
  healthStatus: SchemaSanitizerHealthStatus;
  timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Health Matrix & Telemetry Reports
// ---------------------------------------------------------------------------

export type SchemaSanitizerHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface SchemaSanitizerHealthAuditReport {
  totalSchemasSanitized: number;
  invalidPropertyKeysRenamed: number;
  nullableUnionsCollapsed: number;
  refSiblingsStripped: number;
  topLevelCombinatorsCleaned: number;
  argumentsUnrenamed: number;
  healthStatus: SchemaSanitizerHealthStatus;
  recommendations: string[];
}

export interface SchemaSanitizerMetricsReport {
  totalSchemasSanitized: number;
  invalidPropertyKeysRenamed: number;
  nullableUnionsCollapsed: number;
  refSiblingsStripped: number;
  topLevelCombinatorsCleaned: number;
  argumentsUnrenamed: number;
  mutationRatePercent: number;
  mutationsBreakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Swimlane Grouping
// ---------------------------------------------------------------------------

export type SchemaSanitizerGroupBy = "schemaName" | "mutationType";
export type SchemaSanitizerSortBy = "timestamp" | "renamedKeyCount" | "schemaName";
export type SchemaSanitizerSortDirection = "asc" | "desc";

export interface SchemaSanitizerGroupedLane {
  key: string;
  title: string;
  count: number;
  events: readonly SchemaSanitizationEventRow[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search
// ---------------------------------------------------------------------------

export interface SchemaSanitizerDslQueryFilter {
  rawQuery?: string;
  schemaName?: string;
  mutationType?: string;
  textTerms?: string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Bulk Operations
// ---------------------------------------------------------------------------

export interface SchemaSanitizerMutationUndoRecord {
  mutationType: "add_event" | "bulk_purge" | "clear" | "config_change";
  previousSnapshot: SchemaSanitizerWorkspaceSnapshot;
  nextSnapshot: SchemaSanitizerWorkspaceSnapshot;
  timestampMs: number;
}

export interface SchemaSanitizerBulkMutationResult {
  matchedCount: number;
  modifiedCount: number;
  affectedEventIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Core Interface
// ---------------------------------------------------------------------------

export interface IBroccoliSchemaSanitizerSubstrate {
  recordEvent(event: SchemaSanitizationEventRow): void;
  getEvent(id: string): SchemaSanitizationEventRow | undefined;
  listEvents(): readonly SchemaSanitizationEventRow[];
  removeEvent(id: string): boolean;
  clear(): void;

  auditHealth(): SchemaSanitizerHealthAuditReport;
  getMetrics(): SchemaSanitizerMetrics;
  getMetricsReport(): SchemaSanitizerMetricsReport;
  getGroupedEvents(
    groupBy?: SchemaSanitizerGroupBy,
    sortBy?: SchemaSanitizerSortBy,
    direction?: SchemaSanitizerSortDirection
  ): readonly SchemaSanitizerGroupedLane[];
  queryEventsDsl(query: SchemaSanitizerDslQueryFilter | string): readonly SchemaSanitizationEventRow[];

  bulkPurgeEvents(ids: readonly string[]): SchemaSanitizerBulkMutationResult;

  undo(): boolean;
  redo(): boolean;

  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;

  exportSnapshot(): SchemaSanitizerWorkspaceSnapshot;
  importSnapshot(snapshot: SchemaSanitizerWorkspaceSnapshot): void;
}
