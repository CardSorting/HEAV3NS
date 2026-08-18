/**
 * osv-scanner.contracts.ts
 *
 * Core contracts, interfaces, and invariants for
 * Open Source Vulnerability (OSV) Malware Scanner & Package Ecosystem Firewall
 * (Phase 128 / ADR-104 / Target #81).
 */

export type PackageEcosystem =
  | "npm"
  | "PyPI"
  | "Go"
  | "crates.io"
  | "Maven"
  | "NuGet"
  | "RubyGems"
  | "Packagist";

export interface ParsedPackageTarget {
  ecosystem: PackageEcosystem;
  name: string;
  version?: string;
  scope?: string;
  rawToken?: string;
}

export interface OsvAdvisory {
  id: string;
  summary: string;
  details?: string;
  aliases?: string[];
  isMalware: boolean;
  published?: string;
}

export interface OsvScanResult {
  allowed: boolean;
  package: ParsedPackageTarget;
  advisories: OsvAdvisory[];
  cached: boolean;
  reason?: string;
  scanDurationMs: number;
}

export interface OsvScannerConfig {
  osvEndpoint: string;
  cacheTtlMs: number;
  maxCacheEntries: number;
  blockMalwareOnly: boolean;
  failOpen: boolean;
  timeoutMs: number;
}

export interface OsvScannerMetrics {
  totalScans: number;
  cacheHits: number;
  malwareBlocked: number;
  cleanAllowed: number;
  networkFailures: number;
}

export interface OsvCachedEntry {
  key: string;
  result: OsvScanResult;
  expiresAt: number;
}

export interface OsvScannerWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: OsvScannerConfig;
  metrics: OsvScannerMetrics;
  cacheEntries: OsvCachedEntry[];
  customBlockedPackages: ParsedPackageTarget[];
  scans?: readonly OsvScanResultRow[];
}

export const DEFAULT_OSV_SCANNER_CONFIG: OsvScannerConfig = {
  osvEndpoint: "https://api.osv.dev/v1/query",
  cacheTtlMs: 3600000, // 1 hour
  maxCacheEntries: 256,
  blockMalwareOnly: true,
  failOpen: true,
  timeoutMs: 10000,
};

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Row Schemas
// ---------------------------------------------------------------------------

export interface OsvScanResultRow {
  scanId: string;
  ecosystem: PackageEcosystem;
  packageName: string;
  version?: string;
  allowed: boolean;
  cached: boolean;
  advisories: readonly OsvAdvisory[];
  reason?: string;
  scanDurationMs: number;
  timestamp: number;
  [key: string]: unknown;
}

export interface OsvAuditRow {
  auditId: string;
  totalScans: number;
  cacheHits: number;
  malwareBlocked: number;
  cleanAllowed: number;
  healthStatus: OsvHealthStatus;
  timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Health Matrix & Telemetry Reports
// ---------------------------------------------------------------------------

export type OsvHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface OsvHealthAuditReport {
  totalScans: number;
  cacheHits: number;
  malwareBlocked: number;
  cleanAllowed: number;
  networkFailures: number;
  cacheHitRatePercent: number;
  cacheHitRate?: number;
  healthStatus: OsvHealthStatus;
  status?: string;
  score?: number;
  recommendations: string[];
}

export interface OsvMetricsReport {
  totalScans: number;
  cacheHits: number;
  malwareBlocked: number;
  cleanAllowed: number;
  networkFailures: number;
  cacheHitRatePercent: number;
  cacheHitRate?: number;
  scansByEcosystem: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Swimlane Grouping
// ---------------------------------------------------------------------------

export type OsvGroupBy = "ecosystem" | "allowedStatus" | "isMalware" | "verdict";
export type OsvSortBy = "timestamp" | "scanDurationMs" | "packageName";
export type OsvSortDirection = "asc" | "desc";

export interface OsvGroupedLane {
  key: string;
  title: string;
  count: number;
  scans: readonly OsvScanResultRow[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search
// ---------------------------------------------------------------------------

export interface OsvDslQueryFilter {
  rawQuery?: string;
  ecosystem?: PackageEcosystem;
  allowed?: boolean;
  hasMalware?: boolean;
  textTerms?: string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Bulk Operations
// ---------------------------------------------------------------------------

export interface OsvMutationUndoRecord {
  mutationType: "add_scan" | "bulk_purge" | "clear" | "config_change" | "block_package";
  previousSnapshot: OsvScannerWorkspaceSnapshot;
  nextSnapshot: OsvScannerWorkspaceSnapshot;
  timestampMs: number;
}

export interface OsvBulkMutationResult {
  matchedCount: number;
  modifiedCount: number;
  affectedScanIds: readonly string[];
  affectedCount?: number;
}

// ---------------------------------------------------------------------------
// Substrate Core Interface
// ---------------------------------------------------------------------------

export interface IBroccoliOsvSubstrate {
  recordScan(scan: OsvScanResultRow): void;
  getScan(id: string): OsvScanResultRow | undefined;
  listScans(): readonly OsvScanResultRow[];
  removeScan(id: string): boolean;
  clear(): void;

  auditHealth(): OsvHealthAuditReport;
  getMetrics(): OsvScannerMetrics;
  getMetricsReport(): OsvMetricsReport;
  getGroupedScans(
    groupBy?: OsvGroupBy,
    sortBy?: OsvSortBy,
    direction?: OsvSortDirection
  ): readonly OsvGroupedLane[];
  queryScansDsl(query: OsvDslQueryFilter | string): readonly OsvScanResultRow[];

  bulkPurgeScans(ids: readonly string[]): OsvBulkMutationResult;

  undo(): boolean;
  redo(): boolean;

  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;

  exportSnapshot(): OsvScannerWorkspaceSnapshot;
  importSnapshot(snapshot: OsvScannerWorkspaceSnapshot): void;
}
