/**
 * verification-evidence.contracts.ts
 *
 * Core data contracts for Deterministic Coding Verification Evidence Ledger,
 * Stop-Gate Policy & Session Insights Subsystem (Phase 92 / ADR-044).
 */

export type EvidenceKind = "test" | "build" | "typecheck" | "lint" | "manual";

export type EvidenceScope = "file" | "package" | "workspace";

export interface VerificationEvidenceRecord {
  readonly id: string;
  readonly frameIndex: number;
  readonly command: string;
  readonly kind: EvidenceKind;
  readonly scope: EvidenceScope;
  readonly passed: boolean;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly outputSummary: string;
  readonly verifiedPaths: readonly string[];
  readonly timestamp: number;
}

export interface VerificationStopGateEvaluation {
  readonly shouldNudge: boolean;
  readonly reason: string;
  readonly unverifiedModifiedFiles: readonly string[];
  readonly latestEvidence?: VerificationEvidenceRecord;
}

export interface SessionInsightsReport {
  readonly totalFrames: number;
  readonly totalEvidenceCount: number;
  readonly passedEvidenceCount: number;
  readonly failedEvidenceCount: number;
  readonly evidenceByKind: Record<EvidenceKind, number>;
  readonly unverifiedCodeFiles: readonly string[];
}

export interface VerificationEvidenceWorkspaceSnapshot {
  readonly totalRecords: number;
  readonly records: readonly VerificationEvidenceRecord[];
  readonly modifiedCodeFiles: readonly string[];
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface VerificationEvidenceRow {
  readonly id: string;
  readonly frameIndex: number;
  readonly command: string;
  readonly kind: string;
  readonly scope: string;
  readonly passed: boolean;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly outputSummary: string;
  readonly verifiedPathsJson: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface EvidenceAuditRow {
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

export type VerificationEvidenceHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface VerificationEvidenceHealthAuditReport {
  readonly totalEvidenceCount: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly passRatePercent: number;
  readonly unverifiedFilesCount: number;
  readonly healthStatus: VerificationEvidenceHealthStatus;
  readonly recommendations: readonly string[];
}

export interface VerificationEvidenceMetricsReport {
  readonly totalEvidenceCount: number;
  readonly passedEvidenceCount: number;
  readonly failedEvidenceCount: number;
  readonly passRatePercent: number;
  readonly totalUnverifiedFiles: number;
  readonly averageDurationMs: number;
  readonly evidenceByKind: Record<EvidenceKind, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type VerificationEvidenceGroupBy = "kind" | "scope" | "status";

export type VerificationEvidenceSortBy = "timestamp" | "durationMs" | "frameIndex";

export type VerificationEvidenceSortDirection = "asc" | "desc";

export interface VerificationEvidenceGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly records: readonly VerificationEvidenceRecord[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface VerificationEvidenceDslQueryFilter {
  readonly rawQuery: string;
  readonly kind?: EvidenceKind;
  readonly scope?: EvidenceScope;
  readonly passed?: boolean;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface VerificationEvidenceMutationUndoRecord {
  readonly mutationType: "record_evidence" | "track_file" | "bulk_purge" | "clear";
  readonly previousSnapshot: VerificationEvidenceWorkspaceSnapshot;
  readonly nextSnapshot: VerificationEvidenceWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface VerificationEvidenceBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedEvidenceIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliEvidenceSubstrate {
  recordEvidence(evidence: VerificationEvidenceRecord): void;
  getEvidence(id: string): VerificationEvidenceRecord | undefined;
  listEvidence(): readonly VerificationEvidenceRecord[];
  getLatestEvidence(): VerificationEvidenceRecord | undefined;
  deleteEvidence(id: string): boolean;
  
  trackModifiedFile(filePath: string): void;
  getModifiedFiles(): readonly string[];
  clearModifiedFiles(): void;
  
  auditHealth(): VerificationEvidenceHealthAuditReport;
  getMetrics(): VerificationEvidenceMetricsReport;
  getGroupedEvidence(groupBy?: VerificationEvidenceGroupBy, sortBy?: VerificationEvidenceSortBy, direction?: VerificationEvidenceSortDirection): readonly VerificationEvidenceGroupedLane[];
  queryEvidenceDsl(query: VerificationEvidenceDslQueryFilter | string): readonly VerificationEvidenceRecord[];
  bulkPurgeEvidence(evidenceIds: readonly string[]): VerificationEvidenceBulkMutationResult;
  
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): VerificationEvidenceWorkspaceSnapshot;
  importSnapshot(snapshot: VerificationEvidenceWorkspaceSnapshot): void;
  
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
