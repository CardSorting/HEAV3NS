/**
 * session-archive.contracts.ts
 *
 * Core contracts for Multi-Format Session Export, Archive Packaging,
 * and Backup Storage (Phase 99 / ADR-053).
 */

export type SessionExportFormat = "markdown" | "html" | "jsonl" | "binary_archive";

export interface ExportedTurnItem {
  readonly role: string;
  readonly content: string;
  readonly toolCalls?: readonly Record<string, unknown>[];
  readonly reasoning?: string;
  readonly timestamp?: number;
}

export interface SessionArchiveManifest {
  readonly archiveId: string;
  readonly sessionId: string;
  readonly format: SessionExportFormat;
  readonly turnCount: number;
  readonly totalSizeBytes: number;
  readonly sha256Checksum: string;
  readonly createdAt: number;
}

export interface ExportOptions {
  readonly sanitizeHtml?: boolean;
  readonly includeReasoning?: boolean;
  readonly includeToolCalls?: boolean;
  readonly title?: string;
}

export interface ExportedDocumentResult {
  readonly archiveId: string;
  readonly format: SessionExportFormat;
  readonly content: string | Uint8Array;
  readonly sizeBytes: number;
  readonly sha256Checksum: string;
  readonly mimeType: string;
}

export interface ArchiveWorkspaceSnapshot {
  readonly totalArchives: number;
  readonly activeManifests: readonly SessionArchiveManifest[];
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface ArchiveManifestRow {
  readonly id: string;
  readonly archiveId: string;
  readonly sessionId: string;
  readonly format: string;
  readonly turnCount: number;
  readonly totalSizeBytes: number;
  readonly sha256Checksum: string;
  readonly createdAt: number;
  readonly [key: string]: unknown;
}

export interface ExportedDocumentRow {
  readonly id: string;
  readonly archiveId: string;
  readonly format: string;
  readonly sizeBytes: number;
  readonly sha256Checksum: string;
  readonly mimeType: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface ArchiveAuditRow {
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

export type SessionArchiveHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "unhealthy";

export interface SessionArchiveHealthAuditReport {
  readonly totalArchivesCount: number;
  readonly totalSizeBytes: number;
  readonly formatsDistribution: Record<SessionExportFormat, number>;
  readonly healthStatus: SessionArchiveHealthStatus;
  readonly recommendations: readonly string[];
}

export interface SessionArchiveMetricsReport {
  readonly totalExportsAttempted: number;
  readonly totalBytesArchived: number;
  readonly totalTurnsExported: number;
  readonly averageExportSizeBytes: number;
  readonly formatBreakdown: Record<SessionExportFormat, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type SessionArchiveGroupBy = "format" | "session" | "size_tier";

export type SessionArchiveSortBy = "createdAt" | "totalSizeBytes" | "turnCount";

export type SessionArchiveSortDirection = "asc" | "desc";

export interface SessionArchiveGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly totalSizeBytes: number;
  readonly manifests: readonly SessionArchiveManifest[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface SessionArchiveDslQueryFilter {
  readonly rawQuery: string;
  readonly format?: SessionExportFormat;
  readonly sessionId?: string;
  readonly minTurns?: number;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface SessionArchiveMutationUndoRecord {
  readonly mutationType: "record_archive" | "purge_archive" | "bulk_purge" | "clear";
  readonly previousSnapshot: ArchiveWorkspaceSnapshot;
  readonly nextSnapshot: ArchiveWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface SessionArchiveBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedArchiveIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliArchiveSubstrate {
  recordArchive(manifest: SessionArchiveManifest, document?: ExportedDocumentResult): void;
  getManifest(archiveId: string): SessionArchiveManifest | undefined;
  getDocument(archiveId: string): ExportedDocumentResult | undefined;
  listManifests(): readonly SessionArchiveManifest[];
  listBySession(sessionId: string): readonly SessionArchiveManifest[];
  purgeArchive(archiveId: string): boolean;
  auditHealth(): SessionArchiveHealthAuditReport;
  getMetrics(): SessionArchiveMetricsReport;
  getGroupedArchives(groupBy?: SessionArchiveGroupBy, sortBy?: SessionArchiveSortBy, direction?: SessionArchiveSortDirection): readonly SessionArchiveGroupedLane[];
  queryArchivesDsl(query: SessionArchiveDslQueryFilter | string): readonly SessionArchiveManifest[];
  bulkPurgeArchives(archiveIds: readonly string[]): SessionArchiveBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): ArchiveWorkspaceSnapshot;
  importSnapshot(snapshot: ArchiveWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
