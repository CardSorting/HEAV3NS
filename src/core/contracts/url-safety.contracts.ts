/**
 * url-safety.contracts.ts
 *
 * Core contracts, data types, and invariants for
 * SSRF Defense Firewall, Cloud Metadata & Private IP Blocker, and URL Normalizer
 * (Phase 118 / ADR-094 / Target #51).
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
}

export interface UrlSafetyConfig {
  allowPrivateUrls: boolean;
  allowLocalhost: boolean;
  customBlockedHosts: readonly string[];
  customAllowedHosts: readonly string[];
}

export interface UrlSafetyMetrics {
  totalChecks: number;
  allowedCount: number;
  blockedMetadataCount: number;
  blockedPrivateCount: number;
  blockedLoopbackCount: number;
  blockedCustomCount: number;
}

export interface UrlSafetyWorkspaceSnapshot {
  snapshotId: string;
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
};
