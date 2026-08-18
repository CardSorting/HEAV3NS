/**
 * diagnostic-doctor.contracts.ts
 *
 * Core contracts for Diagnostic Doctor, Live Health Probing, Orphaned Session Salvage,
 * and State Integrity Substrate (Phase 97 / ADR-049).
 */

export type DiagnosticSeverity = "healthy" | "warning" | "critical" | "fatal";

export type DiagnosticCheckCategory = "memory" | "vfs" | "tools" | "providers" | "snapshots" | "integrity";

export interface DiagnosticCheckResult {
  readonly checkId: string;
  readonly category: DiagnosticCheckCategory;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export interface SystemDiagnosticReport {
  readonly reportId: string;
  readonly overallHealth: DiagnosticSeverity;
  readonly totalChecks: number;
  readonly healthyCount: number;
  readonly warningCount: number;
  readonly criticalCount: number;
  readonly fatalCount: number;
  readonly checks: readonly DiagnosticCheckResult[];
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface OrphanedTurnRepairItem {
  readonly turnIndex: number;
  readonly issue: "missing_assistant_response" | "dangling_tool_call" | "corrupt_payload";
  readonly repairedContent: string;
  readonly actionTaken: string;
}

export interface SessionSalvageReport {
  readonly sessionId: string;
  readonly totalTurnsExamined: number;
  readonly repairedTurnsCount: number;
  readonly repairs: readonly OrphanedTurnRepairItem[];
  readonly salvagedTranscript: readonly Record<string, unknown>[];
  readonly success: boolean;
  readonly timestamp: number;
}

export interface DoctorWorkspaceSnapshot {
  readonly totalReports: number;
  readonly latestReport?: SystemDiagnosticReport;
  readonly totalSalvages: number;
  readonly activeSalvages: readonly SessionSalvageReport[];
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface DiagnosticReportRow {
  readonly id: string;
  readonly reportId: string;
  readonly overallHealth: string;
  readonly totalChecks: number;
  readonly healthyCount: number;
  readonly warningCount: number;
  readonly criticalCount: number;
  readonly fatalCount: number;
  readonly durationMs: number;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface DiagnosticCheckRow {
  readonly id: string;
  readonly checkId: string;
  readonly reportId: string;
  readonly category: string;
  readonly severity: string;
  readonly message: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface SessionSalvageRow {
  readonly id: string;
  readonly sessionId: string;
  readonly totalTurnsExamined: number;
  readonly repairedTurnsCount: number;
  readonly success: boolean;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface DoctorAuditRow {
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

export type DiagnosticDoctorHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "unhealthy";

export interface DiagnosticDoctorHealthAuditReport {
  readonly totalReports: number;
  readonly latestHealthSeverity: DiagnosticSeverity;
  readonly totalSalvages: number;
  readonly totalRepairedTurns: number;
  readonly healthStatus: DiagnosticDoctorHealthStatus;
  readonly recommendations: readonly string[];
}

export interface DiagnosticDoctorMetricsReport {
  readonly totalReportsGenerated: number;
  readonly totalChecksExecuted: number;
  readonly totalSalvagesAttempted: number;
  readonly totalTurnsRepaired: number;
  readonly averageProbeDurationMs: number;
  readonly p50DurationMs: number;
  readonly p95DurationMs: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type DiagnosticDoctorGroupBy = "severity" | "category" | "salvage_status";

export type DiagnosticDoctorSortBy = "timestamp" | "severity" | "durationMs";

export type DiagnosticDoctorSortDirection = "asc" | "desc";

export interface DiagnosticDoctorGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly reports: readonly SystemDiagnosticReport[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface DiagnosticDoctorDslQueryFilter {
  readonly rawQuery: string;
  readonly severity?: DiagnosticSeverity;
  readonly category?: DiagnosticCheckCategory;
  readonly minChecks?: number;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface DiagnosticDoctorMutationUndoRecord {
  readonly mutationType: "record_report" | "record_salvage" | "bulk_purge" | "clear";
  readonly previousSnapshot: DoctorWorkspaceSnapshot;
  readonly nextSnapshot: DoctorWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface DiagnosticDoctorBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedReportIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliDoctorSubstrate {
  recordReport(report: SystemDiagnosticReport): void;
  getReport(reportId: string): SystemDiagnosticReport | undefined;
  listReports(): readonly SystemDiagnosticReport[];
  getLatestReport(): SystemDiagnosticReport | undefined;
  recordSalvage(salvage: SessionSalvageReport): void;
  listSalvages(): readonly SessionSalvageReport[];
  getSalvage(sessionId: string): SessionSalvageReport | undefined;
  auditHealth(): DiagnosticDoctorHealthAuditReport;
  getMetrics(): DiagnosticDoctorMetricsReport;
  getGroupedReports(groupBy?: DiagnosticDoctorGroupBy, sortBy?: DiagnosticDoctorSortBy, direction?: DiagnosticDoctorSortDirection): readonly DiagnosticDoctorGroupedLane[];
  queryReportsDsl(query: DiagnosticDoctorDslQueryFilter | string): readonly SystemDiagnosticReport[];
  bulkPurgeReports(reportIds: readonly string[]): DiagnosticDoctorBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): DoctorWorkspaceSnapshot;
  importSnapshot(snapshot: DoctorWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
