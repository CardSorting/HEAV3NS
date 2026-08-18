/**
 * subdirectory-hints.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Progressive Subdirectory Context
 * Discovery & Dynamic Instruction Hints (Phase 129 / ADR-105 / Target #84).
 */

export interface DiscoveredSubdirHint {
  readonly directoryPath: string;
  readonly relativeDirectory: string;
  readonly filename: string;
  readonly content: string;
  readonly contentDigest: string;
  readonly charCount: number;
  readonly discoveredAt: number;
}

export interface SubdirHintDiscoveryResult {
  readonly hintsFound: readonly DiscoveredSubdirHint[];
  readonly formattedAttachment?: string;
  readonly inspectedPaths: readonly string[];
  readonly durationMs: number;
}

export interface SubdirectoryHintsConfig {
  readonly workingDir: string;
  readonly maxHintChars: number;
  readonly maxAncestorWalk: number;
  readonly hintFilenames: readonly string[];
  readonly excludedDirNames: readonly string[];
}

export interface SubdirectoryHintsMetrics {
  readonly totalToolChecks: number;
  readonly pathsEvaluated: number;
  readonly hintsDiscovered: number;
  readonly duplicatesSkipped: number;
  readonly bytesInjected: number;
}

export interface SubdirectoryHintsWorkspaceSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly config: SubdirectoryHintsConfig;
  readonly metrics: SubdirectoryHintsMetrics;
  readonly loadedDirectories: readonly string[];
  readonly loadedDigests: readonly string[];
  readonly discoveredHints: readonly DiscoveredSubdirHint[];
  readonly virtualHints: ReadonlyArray<{ directoryPath: string; filename: string; content: string }>;
}

export const DEFAULT_SUBDIRECTORY_HINTS_CONFIG: SubdirectoryHintsConfig = {
  workingDir: process.cwd(),
  maxHintChars: 8000,
  maxAncestorWalk: 5,
  hintFilenames: [
    "AGENTS.md",
    "agents.md",
    "CLAUDE.md",
    "claude.md",
    ".cursorrules",
    ".windsurfrules",
  ],
  excludedDirNames: [
    "node_modules",
    "venv",
    ".venv",
    "__pycache__",
    ".git",
    ".hg",
    ".svn",
    ".Trash",
    ".cache",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    "site-packages",
    "dist-packages",
    "backups",
    "backup",
    ".backups",
    "vendor",
    "third_party",
    "dist",
    "build",
  ],
};

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Row Schemas
// ---------------------------------------------------------------------------

export interface SubdirectoryHintRow {
  readonly hintKey: string;
  readonly directoryPath: string;
  readonly relativeDirectory: string;
  readonly filename: string;
  readonly contentPreview: string;
  readonly contentDigest: string;
  readonly charCount: number;
  readonly discoveredAt: number;
  [key: string]: unknown;
}

export interface SubdirectoryHintAuditRow {
  readonly auditId: string;
  readonly totalHints: number;
  readonly totalChars: number;
  readonly healthStatus: SubdirectoryHintsHealthStatus;
  readonly timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Health Matrix & Telemetry Reports
// ---------------------------------------------------------------------------

export type SubdirectoryHintsHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface SubdirectoryHintsHealthAuditReport {
  readonly totalHints: number;
  readonly totalLoadedDirectories: number;
  readonly totalVirtualHints: number;
  readonly totalBytesInjected: number;
  readonly maxCharsAllowed: number;
  readonly budgetUtilizationPercent: number;
  readonly healthStatus: SubdirectoryHintsHealthStatus;
  readonly recommendations: readonly string[];
}

export interface SubdirectoryHintsMetricsReport {
  readonly totalToolChecks: number;
  readonly pathsEvaluated: number;
  readonly hintsDiscovered: number;
  readonly duplicatesSkipped: number;
  readonly bytesInjected: number;
  readonly hintsByFilename: Record<string, number>;
  readonly hintsByDirectory: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Swimlane Grouping
// ---------------------------------------------------------------------------

export type SubdirectoryHintsGroupBy = "directory" | "filename";
export type SubdirectoryHintsSortBy = "filename" | "charCount" | "discoveredAt";
export type SubdirectoryHintsSortDirection = "asc" | "desc";

export interface SubdirectoryHintsGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly hints: readonly SubdirectoryHintRow[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search
// ---------------------------------------------------------------------------

export interface SubdirectoryHintsDslQueryFilter {
  readonly rawQuery?: string;
  readonly directory?: string;
  readonly filename?: string;
  readonly minChars?: number;
  readonly maxChars?: number;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Bulk Operations
// ---------------------------------------------------------------------------

export interface SubdirectoryHintsMutationUndoRecord {
  readonly mutationType: "add_hint" | "add_virtual_hint" | "bulk_purge" | "clear" | "config_change";
  readonly previousSnapshot: SubdirectoryHintsWorkspaceSnapshot;
  readonly nextSnapshot: SubdirectoryHintsWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface SubdirectoryHintsBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedHintKeys: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Core Interface
// ---------------------------------------------------------------------------

export interface IBroccoliSubdirectoryHintsSubstrate {
  addDiscoveredHint(hint: DiscoveredSubdirHint): void;
  getDiscoveredHints(): readonly DiscoveredSubdirHint[];
  hasDigest(digest: string): boolean;
  hasDirectory(dir: string): boolean;
  addLoadedDirectory(dir: string): void;
  getLoadedDirectories(): readonly string[];

  registerVirtualHint(directoryPath: string, filename: string, content: string): void;
  getVirtualHints(): ReadonlyArray<{ directoryPath: string; filename: string; content: string }>;

  auditHealth(): SubdirectoryHintsHealthAuditReport;
  getMetrics(): SubdirectoryHintsMetrics;
  getMetricsReport(): SubdirectoryHintsMetricsReport;
  getGroupedHints(
    groupBy?: SubdirectoryHintsGroupBy,
    sortBy?: SubdirectoryHintsSortBy,
    direction?: SubdirectoryHintsSortDirection
  ): readonly SubdirectoryHintsGroupedLane[];
  queryHintsDsl(query: SubdirectoryHintsDslQueryFilter | string): readonly SubdirectoryHintRow[];

  bulkPurgeHints(hintKeys: readonly string[]): SubdirectoryHintsBulkMutationResult;

  undo(): boolean;
  redo(): boolean;

  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;

  exportSnapshot(): SubdirectoryHintsWorkspaceSnapshot;
  importSnapshot(snapshot: SubdirectoryHintsWorkspaceSnapshot): void;
  clear(): void;
}
