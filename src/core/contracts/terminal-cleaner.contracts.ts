/**
 * terminal-cleaner.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Deterministic Terminal ANSI Sanitizer,
 * Display Control Byte Filter & Binary Asset Guard Subsystem (Phase 136 / ADR-112 / Target #76).
 */

export type AnsiCleanMode = "strip_all" | "sanitize_display" | "preserve_safe";

export type BinaryAssetClassification = "text" | "binary" | "opaque_document" | "pdf";

export interface TerminalCleanResult {
  cleanedText: string;
  originalLength: number;
  cleanedLength: number;
  ansiCodesCount: number;
  controlCharsCount: number;
  carriageReturnsNormalized: number;
  reductionRatio: number;
  durationMs: number;
}

export interface TerminalCleanerConfig {
  enabled: boolean;
  stripAnsiSequences: boolean;
  normalizeCarriageReturns: boolean;
  stripControlChars: boolean;
  guardOpaqueDocuments: boolean;
}

export interface TerminalCleanerMetrics {
  totalStringsCleaned: number;
  ansiSequencesStripped: number;
  controlCharsFiltered: number;
  opaqueDocumentWritesBlocked: number;
  fastPathPasses: number;
}

export interface TerminalCleanerWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: TerminalCleanerConfig;
  metrics: TerminalCleanerMetrics;
  events?: readonly TerminalCleanEventRow[];
}

export const DEFAULT_TERMINAL_CLEANER_CONFIG: TerminalCleanerConfig = {
  enabled: true,
  stripAnsiSequences: true,
  normalizeCarriageReturns: true,
  stripControlChars: true,
  guardOpaqueDocuments: true,
};

export const TERMINAL_KNOWN_BINARY_EXTENSIONS = new Set<string>([
  // Images
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".tiff", ".tif",
  // Videos
  ".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv", ".m4v", ".mpeg", ".mpg",
  // Audio
  ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".wma", ".aiff", ".opus",
  // Archives
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz", ".z", ".tgz", ".iso",
  // Executables / Binaries
  ".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".a", ".obj", ".lib",
  ".app", ".msi", ".deb", ".rpm",
  // Documents
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".odt", ".ods", ".odp",
  // Fonts
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
  // Bytecode / VM Artifacts
  ".pyc", ".pyo", ".class", ".jar", ".war", ".ear", ".node", ".wasm", ".rlib",
  // Database files
  ".sqlite", ".sqlite3", ".db", ".mdb", ".idx",
  // Design / 3D
  ".psd", ".ai", ".eps", ".sketch", ".fig", ".xd", ".blend", ".3ds", ".max",
  // Flash
  ".swf", ".fla",
  // Lock / binary profiling
  ".lockb", ".dat", ".data",
]);

export const TERMINAL_OPAQUE_DOCUMENT_EXTENSIONS = new Set<string>([
  ".doc", ".docx", ".docm",
  ".xls", ".xlsx", ".xlsm", ".xlsb",
  ".ppt", ".pps", ".pot", ".pptx", ".pptm", ".ppsx", ".ppsm",
  ".odt", ".ods", ".odp",
  ".rtf", ".epub",
]);

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Row Schemas
// ---------------------------------------------------------------------------

export interface TerminalCleanEventRow {
  id: string;
  mode: AnsiCleanMode;
  originalLength: number;
  cleanedLength: number;
  ansiCodesCount: number;
  controlCharsCount: number;
  durationMs: number;
  timestamp: number;
  [key: string]: unknown;
}

export interface TerminalCleanerAuditRow {
  auditId: string;
  totalEvents: number;
  totalAnsiStripped: number;
  totalControlBytesStripped: number;
  healthStatus: TerminalCleanerHealthStatus;
  timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Health Matrix & Telemetry Reports
// ---------------------------------------------------------------------------

export type TerminalCleanerHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface TerminalCleanerHealthAuditReport {
  totalStringsCleaned: number;
  ansiSequencesStripped: number;
  controlCharsFiltered: number;
  opaqueDocumentWritesBlocked: number;
  fastPathRatio: number;
  healthStatus: TerminalCleanerHealthStatus;
  recommendations: string[];
}

export interface TerminalCleanerMetricsReport {
  totalStringsCleaned: number;
  ansiSequencesStripped: number;
  controlCharsFiltered: number;
  opaqueDocumentWritesBlocked: number;
  fastPathPasses: number;
  avgDurationMs: number;
  eventsByMode: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Swimlane Grouping
// ---------------------------------------------------------------------------

export type TerminalCleanerGroupBy = "mode" | "status" | "reductionTier";
export type TerminalCleanerSortBy = "timestamp" | "originalLength" | "durationMs" | "ansiCount";
export type TerminalCleanerSortDirection = "asc" | "desc";

export interface TerminalCleanerGroupedLane {
  key: string;
  title: string;
  count: number;
  events: readonly TerminalCleanEventRow[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search
// ---------------------------------------------------------------------------

export interface TerminalCleanerDslQueryFilter {
  rawQuery?: string;
  mode?: AnsiCleanMode;
  minAnsiCount?: number;
  minDurationMs?: number;
  textTerms?: string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Bulk Operations
// ---------------------------------------------------------------------------

export interface TerminalCleanerMutationUndoRecord {
  mutationType: "add_event" | "bulk_purge" | "clear" | "config_change";
  previousSnapshot: TerminalCleanerWorkspaceSnapshot;
  nextSnapshot: TerminalCleanerWorkspaceSnapshot;
  timestampMs: number;
}

export interface TerminalCleanerBulkMutationResult {
  matchedCount: number;
  modifiedCount: number;
  affectedEventIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Core Interface
// ---------------------------------------------------------------------------

export interface IBroccoliTerminalCleanerSubstrate {
  recordEvent(event: TerminalCleanEventRow): void;
  getEvent(id: string): TerminalCleanEventRow | undefined;
  listEvents(): readonly TerminalCleanEventRow[];
  removeEvent(id: string): boolean;
  clear(): void;

  auditHealth(): TerminalCleanerHealthAuditReport;
  getMetrics(): TerminalCleanerMetricsReport;
  getGroupedEvents(
    groupBy?: TerminalCleanerGroupBy,
    sortBy?: TerminalCleanerSortBy,
    direction?: TerminalCleanerSortDirection
  ): readonly TerminalCleanerGroupedLane[];
  queryEventsDsl(query: TerminalCleanerDslQueryFilter | string): readonly TerminalCleanEventRow[];

  bulkPurgeEvents(ids: readonly string[]): TerminalCleanerBulkMutationResult;

  undo(): boolean;
  redo(): boolean;

  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;

  exportSnapshot(): TerminalCleanerWorkspaceSnapshot;
  importSnapshot(snapshot: TerminalCleanerWorkspaceSnapshot): void;
}
