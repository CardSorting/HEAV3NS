/**
 * website-policy.contracts.ts
 *
 * Core contracts, data types, and invariants for
 * Website Access Policy Engine, Domain Wildcard Matching & URL Access Governance
 * (Phase 120 / ADR-096 / Target #53).
 */

export type WebsitePolicySource = "config" | "shared_file" | "runtime";

export interface WebsitePolicyRule {
  pattern: string;
  source: WebsitePolicySource;
  sourcePath?: string;
  enabled: boolean;
}

export interface WebsiteAccessCheckResult {
  allowed: boolean;
  host: string;
  matchedRule?: WebsitePolicyRule;
  message?: string;
}

export interface WebsitePolicyConfig {
  enabled: boolean;
  domains: readonly string[];
  sharedFiles: readonly string[];
  cacheTtlMs: number;
}

export interface WebsitePolicyMetrics {
  totalChecks: number;
  allowedCount: number;
  blockedCount: number;
  activeRulesCount: number;
}

export interface WebsitePolicyWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  rules: readonly WebsitePolicyRule[];
  history: readonly WebsiteAccessCheckResult[];
  metrics: WebsitePolicyMetrics;
}

export const DEFAULT_WEBSITE_POLICY_CONFIG: WebsitePolicyConfig = {
  enabled: true,
  domains: [],
  sharedFiles: [],
  cacheTtlMs: 30000,
};
