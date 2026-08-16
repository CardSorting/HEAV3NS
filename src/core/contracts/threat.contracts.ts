/**
 * threat.contracts.ts
 *
 * Core data contracts for the Deterministic Threat Pattern Scanner, Code Safety &
 * Security Firewall Subsystem (Phase 86 / ADR-038).
 */

export type ThreatSeverity = "info" | "warning" | "dangerous" | "critical";

export type ThreatCategory =
  | "prompt_injection"
  | "data_exfiltration"
  | "destructive_command"
  | "repo_skew"
  | "untrusted_import"
  | "c2_beacon";

export type ThreatTrustLevel = "builtin" | "trusted" | "community" | "agent";

export interface ThreatFinding {
  readonly id: string;
  readonly category: ThreatCategory;
  readonly severity: ThreatSeverity;
  readonly description: string;
  readonly matchedPattern: string;
  readonly location?: string;
}

export interface ThreatScanResult {
  readonly clean: boolean;
  readonly verdict: "allow" | "warn" | "block";
  readonly findings: readonly ThreatFinding[];
  readonly scanDurationMs: number;
  readonly bytesScanned: number;
  readonly timestamp: number;
}

export interface ThreatWorkspaceSnapshot {
  readonly totalScannedBytes: number;
  readonly totalScans: number;
  readonly threatCount: number;
  readonly blockedCount: number;
  readonly timestamp: number;
}
