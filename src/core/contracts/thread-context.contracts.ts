/**
 * thread-context.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Async Context Propagation,
 * Security Callback Inheritance & Fail-Closed Approval Lifecycle Subsystem
 * (Phase 133 / ADR-109 / Target #66).
 */

export type SecurityApprovalCallback = (command: string, reason: string) => Promise<boolean>;
export type SudoPasswordCallback = () => Promise<string | undefined>;

export interface AsyncTurnContextDescriptor {
  contextId: string;
  parentSessionId: string;
  platform: string;
  hasApprovalCallback: boolean;
  hasSudoCallback: boolean;
  isInteractive: boolean;
  createdAt: number;
  metadata: Record<string, string>;
}

export interface ContextPropagationConfig {
  failClosedOnMissingApproval: boolean;
  allowNonInteractiveAutoApprove: boolean;
  auditLogDispatches: boolean;
  maxActiveContexts: number;
}

export interface ExecutionDispatchEvent {
  id: string;
  timestamp: number;
  contextId: string;
  action: "context_spawned" | "dispatched" | "approval_invoked" | "approval_resolved" | "fail_closed_blocked" | "context_cleaned";
  commandOrTask?: string;
  approved?: boolean;
  details?: string;
}

export interface ContextPropagationMetrics {
  totalContextsSpawned: number;
  totalExecutionsWrapped: number;
  totalApprovalsInherited: number;
  totalFailClosedBlocks: number;
  activeContextCount: number;
}

export interface ThreadContextWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: ContextPropagationConfig;
  contexts: AsyncTurnContextDescriptor[];
  auditLogs: ExecutionDispatchEvent[];
  metrics: ContextPropagationMetrics;
}

export const DEFAULT_CONTEXT_PROPAGATION_CONFIG: ContextPropagationConfig = {
  failClosedOnMissingApproval: true,
  allowNonInteractiveAutoApprove: false,
  auditLogDispatches: true,
  maxActiveContexts: 100,
};
