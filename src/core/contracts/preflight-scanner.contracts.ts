/**
 * preflight-scanner.contracts.ts
 *
 * Core contracts, interfaces, enums, and types for Pre-Exec Security Scanner,
 * Supply-Chain Provenance Verification & Pre-Flight Threat Gate (Phase 113 / ADR-089 / Target #79).
 */

export type PreflightVerdict = "allow" | "warn" | "block";

export type PreflightThreatCategory =
  | "pipe_to_interpreter"
  | "homograph_url"
  | "base64_execution"
  | "dangerous_permission"
  | "terminal_injection"
  | "credential_scraping"
  | "suspicious_downloader";

export type PreflightThreatSeverity = "low" | "medium" | "high" | "critical";

export interface PreflightThreatFinding {
  readonly category: PreflightThreatCategory;
  readonly severity: PreflightThreatSeverity;
  readonly description: string;
  readonly matchedPattern: string;
  readonly remediation: string;
}

export interface PreflightScanResult {
  readonly command: string;
  readonly verdict: PreflightVerdict;
  readonly exitCode: 0 | 1 | 2; // 0 = allow, 1 = block, 2 = warn
  readonly findings: readonly PreflightThreatFinding[];
  readonly scanDurationMs: number;
  readonly policyDecision: "allowed" | "blocked" | "warned_and_passed" | "fail_open_fallback";
}

export interface SupplyChainVerificationResult {
  readonly binaryPath: string;
  readonly verified: boolean;
  readonly issuer?: string;
  readonly identity?: string;
  readonly sha256Checksum: string;
  readonly error?: string;
}

export interface PreflightSecurityPolicy {
  readonly enabled: boolean;
  readonly failOpen: boolean;
  readonly timeoutMs: number;
  readonly circuitBreakerLimit: number;
  readonly blockedCategories: readonly PreflightThreatCategory[];
}

export interface PreflightWorkspaceSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly policy: PreflightSecurityPolicy;
  readonly scanHistory: readonly PreflightScanResult[];
  readonly breakerTripped: boolean;
  readonly consecutiveFailures: number;
}

export const DEFAULT_PREFLIGHT_SECURITY_POLICY: PreflightSecurityPolicy = {
  enabled: true,
  failOpen: false,
  timeoutMs: 250,
  circuitBreakerLimit: 5,
  blockedCategories: [
    "pipe_to_interpreter",
    "base64_execution",
    "dangerous_permission",
    "terminal_injection",
    "credential_scraping",
    "suspicious_downloader",
    "homograph_url",
  ],
};

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Row Schemas
// ---------------------------------------------------------------------------

export interface PreflightScanResultRow {
  scanId: string;
  command: string;
  verdict: PreflightVerdict;
  exitCode: 0 | 1 | 2;
  policyDecision: "allowed" | "blocked" | "warned_and_passed" | "fail_open_fallback";
  findings: readonly PreflightThreatFinding[];
  scanDurationMs: number;
  timestamp: number;
  [key: string]: unknown;
}

export interface PreflightAuditRow {
  auditId: string;
  totalScans: number;
  totalBlocked: number;
  totalWarned: number;
  totalAllowed: number;
  healthStatus: PreflightHealthStatus;
  timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Health Matrix & Telemetry Reports
// ---------------------------------------------------------------------------

export type PreflightHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface PreflightMetrics {
  totalScans: number;
  totalAllowed: number;
  totalBlocked: number;
  totalWarned: number;
  circuitBreakerTripped: boolean;
  consecutiveFailures: number;
}

export interface PreflightHealthAuditReport {
  totalScans: number;
  totalBlocked: number;
  totalWarned: number;
  totalAllowed: number;
  breakerTripped: boolean;
  healthStatus: PreflightHealthStatus;
  recommendations: string[];
}

export interface PreflightMetricsReport {
  totalScans: number;
  totalAllowed: number;
  totalBlocked: number;
  totalWarned: number;
  blockRatePercent: number;
  threatsByCategory: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Swimlane Grouping
// ---------------------------------------------------------------------------

export type PreflightGroupBy = "verdict" | "policyDecision" | "severity";
export type PreflightSortBy = "timestamp" | "scanDurationMs" | "command";
export type PreflightSortDirection = "asc" | "desc";

export interface PreflightGroupedLane {
  key: string;
  title: string;
  count: number;
  scans: readonly PreflightScanResultRow[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search
// ---------------------------------------------------------------------------

export interface PreflightDslQueryFilter {
  rawQuery?: string;
  verdict?: PreflightVerdict;
  category?: PreflightThreatCategory;
  textTerms?: string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Bulk Operations
// ---------------------------------------------------------------------------

export interface PreflightMutationUndoRecord {
  mutationType: "add_scan" | "bulk_purge" | "clear" | "policy_change";
  previousSnapshot: PreflightWorkspaceSnapshot;
  nextSnapshot: PreflightWorkspaceSnapshot;
  timestampMs: number;
}

export interface PreflightBulkMutationResult {
  matchedCount: number;
  modifiedCount: number;
  affectedScanIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Core Interface
// ---------------------------------------------------------------------------

export interface IBroccoliPreflightSubstrate {
  recordScan(scan: PreflightScanResultRow): void;
  getScan(id: string): PreflightScanResultRow | undefined;
  listScans(): readonly PreflightScanResultRow[];
  removeScan(id: string): boolean;
  clear(): void;

  auditHealth(): PreflightHealthAuditReport;
  getMetrics(): PreflightMetrics;
  getMetricsReport(): PreflightMetricsReport;
  getGroupedScans(
    groupBy?: PreflightGroupBy,
    sortBy?: PreflightSortBy,
    direction?: PreflightSortDirection
  ): readonly PreflightGroupedLane[];
  queryScansDsl(query: PreflightDslQueryFilter | string): readonly PreflightScanResultRow[];

  bulkPurgeScans(ids: readonly string[]): PreflightBulkMutationResult;

  undo(): boolean;
  redo(): boolean;

  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;

  exportSnapshot(): PreflightWorkspaceSnapshot;
  importSnapshot(snapshot: PreflightWorkspaceSnapshot): void;
}
