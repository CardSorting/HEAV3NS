/**
 * arbiter.contracts.ts
 *
 * Core contracts and data models for the Deterministic Human-in-the-Loop
 * Approval & Interactive Security Arbiter (Phase 75 / ADR-027).
 */

export type ApprovalRiskLevel = "critical" | "high" | "medium" | "low" | "safe";

export type ApprovalActionType =
  | "shell_execution"
  | "file_mutation"
  | "skill_mutation"
  | "memory_mutation"
  | "credential_access"
  | "network_egress";

export type ApprovalVerdict =
  | "approved"
  | "denied"
  | "session_allowed"
  | "always_allowed"
  | "auto_approved"
  | "timed_out"
  | "estopped";

export interface RiskAssessmentResult {
  readonly riskLevel: ApprovalRiskLevel;
  readonly isDangerous: boolean;
  readonly matchedPattern?: string;
  readonly reason?: string;
  readonly requiresHumanApproval: boolean;
}

export interface PendingApprovalRequest {
  readonly id: string;
  readonly actionType: ApprovalActionType;
  readonly target: string;
  readonly commandHash: string;
  readonly riskAssessment: RiskAssessmentResult;
  readonly status: "pending" | "resolved" | "expired";
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly resolvedVerdict?: ApprovalVerdict;
  readonly resolvedBy?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface StagedWriteArtifact {
  readonly id: string;
  readonly subsystem: "memory" | "skills";
  readonly targetPath: string;
  readonly content: string;
  readonly diff?: string;
  readonly gist: string;
  readonly createdAt: number;
  readonly status: "staged" | "committed" | "rejected";
}

export interface ApprovalAuditEntry {
  readonly id: string;
  readonly requestId: string;
  readonly commandHash: string;
  readonly actionType: ApprovalActionType;
  readonly target: string;
  readonly riskLevel: ApprovalRiskLevel;
  readonly verdict: ApprovalVerdict;
  readonly timestamp: number;
}

export interface ArbiterSessionSnapshot {
  readonly pendingRequests: readonly PendingApprovalRequest[];
  readonly sessionAllowlistHashes: readonly string[];
  readonly stagedWrites: readonly StagedWriteArtifact[];
  readonly isEstopped: boolean;
  readonly totalEvaluated: number;
  readonly totalApproved: number;
  readonly totalDenied: number;
  readonly totalEstopped: number;
  readonly timestamp: number;
}

export interface ArbiterOptions {
  readonly autoApproveThreshold?: ApprovalRiskLevel; // Default "low"
  readonly defaultTimeoutMs?: number; // Default 30000ms
  readonly interactivePromptCallback?: (
    request: PendingApprovalRequest
  ) => Promise<ApprovalVerdict>;
  readonly writeApprovalEnabled?: {
    readonly memory?: boolean;
    readonly skills?: boolean;
  };
}
