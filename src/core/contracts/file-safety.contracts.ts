/**
 * file-safety.contracts.ts
 *
 * Core contracts, interfaces, and invariants for
 * File Safety Mutation Guards, Sensitive Path Firewall & Safe Root Governance
 * (Phase 126 / ADR-102 / Target #59).
 */

export type FileSafetyVerdict =
  | "allowed"
  | "denied_hard"
  | "approval_required"
  | "outside_safe_root";

export interface FileSafetyEvaluation {
  allowed: boolean;
  verdict: FileSafetyVerdict;
  path: string;
  normalizedPath: string;
  reason?: string;
  isSensitive: boolean;
}

export interface FileSafetyPolicyConfig {
  enforceSafeRoots: boolean;
  safeRoots: string[];
  allowHiddenDotfiles: boolean;
  customDeniedPaths: string[];
  customDeniedPrefixes: string[];
}

export interface FileSafetyMetrics {
  totalEvaluations: number;
  writesAllowed: number;
  writesDenied: number;
  readsEvaluated: number;
  approvalsRequired: number;
}

export interface FileSafetyWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: FileSafetyPolicyConfig;
  metrics: FileSafetyMetrics;
}

export const DEFAULT_FILE_SAFETY_CONFIG: FileSafetyPolicyConfig = {
  enforceSafeRoots: false,
  safeRoots: [],
  allowHiddenDotfiles: true,
  customDeniedPaths: [],
  customDeniedPrefixes: [],
};
