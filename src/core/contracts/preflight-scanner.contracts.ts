/**
 * preflight-scanner.contracts.ts
 *
 * Core contracts, interfaces, enums, and types for Pre-Exec Security Scanner,
 * Supply-Chain Provenance Verification & Pre-Flight Threat Gate (Phase 113 / ADR-089 / Target #46).
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
