/**
 * osv-scanner.contracts.ts
 *
 * Core contracts, interfaces, and invariants for
 * Open Source Vulnerability (OSV) Malware Scanner & Package Ecosystem Firewall
 * (Phase 128 / ADR-104 / Target #61).
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
  rawToken: string;
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
}

export const DEFAULT_OSV_SCANNER_CONFIG: OsvScannerConfig = {
  osvEndpoint: "https://api.osv.dev/v1/query",
  cacheTtlMs: 3600000, // 1 hour
  maxCacheEntries: 256,
  blockMalwareOnly: true,
  failOpen: true,
  timeoutMs: 10000,
};
