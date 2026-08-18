/**
 * url-safety.contracts.ts
 *
 * Core contracts, data types, and invariants for
 * SSRF Defense Firewall, Cloud Metadata & Private IP Blocker, and URL Normalizer
 * (Phase 118 / ADR-094 / Target #87).
 */

export type IpAddressCategory =
  | "public"
  | "private"
  | "loopback"
  | "link_local"
  | "cloud_metadata"
  | "carrier_grade_nat"
  | "multicast"
  | "reserved"
  | "invalid";

export type UrlSafetyVerdict =
  | "allowed"
  | "blocked_cloud_metadata"
  | "blocked_private_ip"
  | "blocked_loopback"
  | "blocked_custom_rule"
  | "invalid_url";

export interface UrlSafetyCheckResult {
  isSafe: boolean;
  verdict: UrlSafetyVerdict;
  normalizedUrl: string;
  hostname: string;
  resolvedIps: readonly string[];
  reason?: string;
  category?: IpAddressCategory;
  latencyMs?: number;
}

export interface UrlSafetyConfig {
  allowPrivateUrls: boolean;
  allowLocalhost: boolean;
  customBlockedHosts: readonly string[];
  customAllowedHosts: readonly string[];
  maxRedirects?: number;
  enforceTls?: boolean;
}

export interface UrlSafetyMetrics {
  totalChecks: number;
  allowedCount: number;
  blockedMetadataCount: number;
  blockedPrivateCount: number;
  blockedLoopbackCount: number;
  blockedCustomCount: number;
  invalidUrlCount: number;
  lastCheckTimestamp?: number;
}

export interface UrlSafetyWorkspaceSnapshot {
  snapshotId: string;
  frameNumber?: number;
  timestamp: number;
  blockedLedger: readonly UrlSafetyCheckResult[];
  metrics: UrlSafetyMetrics;
}

export const CLOUD_METADATA_IPS: readonly string[] = [
  "169.254.169.254", // AWS, GCP, Azure metadata
  "169.254.170.2",   // AWS ECS task metadata
  "100.100.100.200", // Alibaba Cloud metadata
];

export const CLOUD_METADATA_HOSTS: readonly string[] = [
  "metadata.google.internal",
  "metadata.local",
  "instance-data",
];

export const DEFAULT_URL_SAFETY_CONFIG: UrlSafetyConfig = {
  allowPrivateUrls: false,
  allowLocalhost: false,
  customBlockedHosts: [],
  customAllowedHosts: [],
  maxRedirects: 5,
  enforceTls: false,
};

// ---------------------------------------------------------------------------
// Hybrid BroccoliDB Row Schemas
// ---------------------------------------------------------------------------

export interface UrlSafetyCheckRow {
  checkId: string;
  rawUrl: string;
  normalizedUrl: string;
  hostname: string;
  verdict: UrlSafetyVerdict;
  isSafe: boolean;
  category: IpAddressCategory;
  resolvedIps: string[];
  reason: string;
  timestamp: number;
  latencyMs: number;
}

export interface UrlSafetyAuditRow {
  auditId: string;
  timestamp: number;
  status: UrlSafetyHealthStatus;
  totalChecks: number;
  allowedCount: number;
  blockedCount: number;
  slaViolation: boolean;
  details: string;
}

// ---------------------------------------------------------------------------
// Health & Telemetry Contracts
// ---------------------------------------------------------------------------

export type UrlSafetyHealthStatus = "optimal" | "degraded" | "critical";

export interface UrlSafetyHealthAuditReport {
  status: UrlSafetyHealthStatus;
  timestamp: number;
  totalChecks: number;
  allowedCount: number;
  blockedCount: number;
  blockedMetadataCount: number;
  blockedPrivateCount: number;
  blockedLoopbackCount: number;
  blockedCustomCount: number;
  safeRatioPercent: number;
  avgLatencyMs: number;
  slaViolations: string[];
}

export interface UrlSafetyMetricsReport {
  timestamp: number;
  metrics: UrlSafetyMetrics;
  config: UrlSafetyConfig;
  recentChecksCount: number;
  activeBlockedHostsCount: number;
  activeAllowedHostsCount: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Swimlane & DSL Contracts
// ---------------------------------------------------------------------------

export type UrlSafetyGroupBy = "verdict" | "category" | "hostname" | "isSafe";
export type UrlSafetySortBy = "timestamp" | "normalizedUrl" | "hostname" | "verdict" | "latencyMs";
export type UrlSafetySortDirection = "asc" | "desc";

export interface UrlSafetyGroupedLane {
  laneId: string;
  title: string;
  count: number;
  checks: UrlSafetyCheckRow[];
}

export interface UrlSafetyDslQueryFilter {
  verdict?: UrlSafetyVerdict;
  category?: IpAddressCategory;
  isSafe?: boolean;
  hostContains?: string;
  ipContains?: string;
  urlContains?: string;
  minTimestamp?: number;
  maxTimestamp?: number;
}

// ---------------------------------------------------------------------------
// Mutation Undo & Bulk Mutation Contracts
// ---------------------------------------------------------------------------

export interface UrlSafetyMutationUndoRecord {
  mutationId: string;
  timestamp: number;
  action: "add_check" | "bulk_purge" | "update_config" | "clear";
  previousRows: UrlSafetyCheckRow[];
  previousConfig?: UrlSafetyConfig;
}

export interface UrlSafetyBulkMutationResult {
  success: boolean;
  matchedCount: number;
  affectedCheckIds: string[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliUrlSafetySubstrate {
  recordCheck(row: Omit<UrlSafetyCheckRow, "checkId">): UrlSafetyCheckRow;
  getCheck(checkId: string): UrlSafetyCheckRow | null;
  getRecentChecks(limit?: number): UrlSafetyCheckRow[];
  getAllChecks(): UrlSafetyCheckRow[];
  clear(): void;
  getConfig(): UrlSafetyConfig;
  updateConfig(updates: Partial<UrlSafetyConfig>): UrlSafetyConfig;
  getMetrics(): UrlSafetyMetrics;
  getMetricsReport(): UrlSafetyMetricsReport;
  auditHealth(): UrlSafetyHealthAuditReport;
  getGroupedChecks(
    groupBy: UrlSafetyGroupBy,
    sortBy?: UrlSafetySortBy,
    sortDirection?: UrlSafetySortDirection
  ): UrlSafetyGroupedLane[];
  queryChecksDsl(dslQuery: string | UrlSafetyDslQueryFilter): UrlSafetyCheckRow[];
  bulkPurgeChecks(checkIds: string[]): UrlSafetyBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportHtml(): string;
  exportMarkdown(): string;
  exportCsv(): string;
}
