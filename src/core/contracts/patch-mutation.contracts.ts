/**
 * patch-mutation.contracts.ts
 *
 * Core data contracts for the Unified Patch Engine, Atomic Mutation Substrate & VFS (Phase 77 / ADR-029).
 */

export type PatchOperationType = "add" | "update" | "delete" | "move" | "replace_range";

export interface PatchHunkLine {
  readonly prefix: " " | "-" | "+";
  readonly content: string;
}

export interface PatchHunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly lines: readonly PatchHunkLine[];
  readonly contextHint?: string;
}

export interface PatchOperation {
  readonly type: PatchOperationType;
  readonly filePath: string;
  readonly newPath?: string;
  readonly hunks: readonly PatchHunk[];
  readonly content?: string;
}

export interface PatchApplyResult {
  readonly success: boolean;
  readonly modifiedFiles: readonly string[];
  readonly errors: readonly string[];
  readonly dryRun: boolean;
}

export interface FileMutationEntry {
  readonly path: string;
  readonly previousContent: string | null;
  readonly stagedContent: string | null;
  readonly status: "staged" | "committed" | "reverted";
  readonly timestamp: number;
}

export interface FileMutationSnapshot {
  readonly stagedFiles: readonly FileMutationEntry[];
  readonly totalStaged: number;
  readonly timestamp: number;
}

export interface FilePaginationOptions {
  readonly filePath: string;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly maxChars?: number;
  readonly offsetBytes?: number;
}

export interface FilePaginatedReadResult {
  readonly filePath: string;
  readonly content: string;
  readonly totalLines: number;
  readonly startLine: number;
  readonly endLine: number;
  readonly truncated: boolean;
  readonly isBinary: boolean;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface FileMutationRow {
  readonly path: string;
  readonly status: string;
  readonly previousContentLength: number;
  readonly stagedContentLength: number;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface PatchOperationRow {
  readonly id: string;
  readonly filePath: string;
  readonly type: string;
  readonly hunksCount: number;
  readonly dryRun: boolean;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface PatchAuditRow {
  readonly id: string;
  readonly action: string;
  readonly filePath: string;
  readonly status: string;
  readonly details: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Metrics Telemetry
// ---------------------------------------------------------------------------

export type PatchMutationHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface PatchMutationHealthAuditReport {
  readonly totalStaged: number;
  readonly totalCommitted: number;
  readonly totalReverted: number;
  readonly conflictCount: number;
  readonly healthStatus: PatchMutationHealthStatus;
  readonly recommendations: readonly string[];
}

export interface PatchMutationMetricsReport {
  readonly totalStaged: number;
  readonly totalCommitted: number;
  readonly totalReverted: number;
  readonly totalLinesModified: number;
  readonly totalBytesStaged: number;
  readonly stagedByStatus: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type PatchMutationGroupBy = "status" | "extension" | "directory";

export type PatchMutationSortBy = "timestamp" | "path" | "size";

export type PatchMutationSortDirection = "asc" | "desc";

export interface PatchMutationGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly entries: readonly FileMutationEntry[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface PatchMutationDslQueryFilter {
  readonly rawQuery: string;
  readonly status?: "staged" | "committed" | "reverted";
  readonly extension?: string;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface PatchMutationUndoRecord {
  readonly mutationType: "stage_file" | "commit" | "revert" | "bulk_purge" | "clear";
  readonly previousSnapshot: FileMutationSnapshot;
  readonly nextSnapshot: FileMutationSnapshot;
  readonly timestampMs: number;
}

export interface PatchBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedPaths: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliPatchSubstrate {
  stageFile(path: string, stagedContent: string, previousContent?: string | null): FileMutationEntry;
  getEntry(path: string): FileMutationEntry | undefined;
  listStaged(): readonly FileMutationEntry[];
  unstageFile(path: string): boolean;
  commitFile(path: string): boolean;
  revertFile(path: string): boolean;
  
  auditHealth(): PatchMutationHealthAuditReport;
  getMetrics(): PatchMutationMetricsReport;
  getGroupedMutations(groupBy?: PatchMutationGroupBy, sortBy?: PatchMutationSortBy, direction?: PatchMutationSortDirection): readonly PatchMutationGroupedLane[];
  queryMutationsDsl(query: PatchMutationDslQueryFilter | string): readonly FileMutationEntry[];
  bulkPurgeStaged(paths: readonly string[]): PatchBulkMutationResult;
  bulkCommitStaged(): PatchBulkMutationResult;
  
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): FileMutationSnapshot;
  importSnapshot(snapshot: FileMutationSnapshot): void;
  
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
