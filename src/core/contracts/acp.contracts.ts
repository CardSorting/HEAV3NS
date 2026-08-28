/**
 * acp.contracts.ts
 *
 * Core contracts for the Agent Client Protocol (ACP) Universal Editor Bridge (Phase 99 / Phase 195 / ADR-133).
 * Defines JSON-RPC 2.0 protocol envelopes, editor session handshakes, multi-file changesets,
 * pre-commit adversarial risk assessments, LSP-compatible diagnostics, and permissions under the AKD-DSO Monolith architecture.
 */

import type { AdversarialFinding } from "./adversarial-scrutiny.contracts.js";

export type AcpClientType =
  | "vscode"
  | "jetbrains"
  | "cursor"
  | "zed"
  | "windsurf"
  | "neovim"
  | "custom";

export type AcpApprovalStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "MODIFIED";

export type AcpPermissionLevel = "allow" | "ask" | "deny";

export type AcpSessionMode = "interactive" | "headless" | "embedded" | "code" | "architect" | "ask" | "adversarial";

export type AcpRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AcpDiagnosticSeverity = "error" | "warning" | "info" | "hint";

export type AcpDashboardViewMode =
  | "sessions"
  | "approvals"
  | "changesets"
  | "diagnostics"
  | "audit-ledger"
  | "hunks";

export type AcpHunkLineType = "context" | "addition" | "deletion";

export interface AcpHunkLine {
  readonly type: AcpHunkLineType;
  readonly content: string;
  readonly oldLineNumber?: number;
  readonly newLineNumber?: number;
}

export type AcpHunkStatus = "PENDING" | "APPROVED" | "DISCARDED";

export interface AcpDiffHunk {
  readonly hunkId: string;
  readonly filePath: string;
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly header: string;
  readonly lines: readonly AcpHunkLine[];
  readonly additions: number;
  readonly deletions: number;
  readonly isSelected: boolean;
  readonly status: AcpHunkStatus;
}

export interface AcpClientToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters?: Record<string, unknown>;
}

export interface AcpClientToolCallRequest {
  readonly callId: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface AcpClientToolCallResult {
  readonly callId: string;
  readonly success: boolean;
  readonly result?: unknown;
  readonly error?: string;
}

export interface IAcpFineGrainedHunkPatcher {
  splitDiffIntoHunks(filePath: string, originalContent: string, diffText: string): readonly AcpDiffHunk[];
  applySelectedHunks(
    originalContent: string,
    hunks: readonly AcpDiffHunk[],
    selectedHunkIds?: readonly string[]
  ): { success: boolean; patchedContent: string; appliedCount: number; discardedCount: number };
  discardHunk(hunks: readonly AcpDiffHunk[], hunkId: string): readonly AcpDiffHunk[];
}

export interface AcpDiagnosticItem {
  readonly range: {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  };
  readonly severity: AcpDiagnosticSeverity;
  readonly code?: string | number;
  readonly source: string;
  readonly message: string;
  readonly quickFixes?: readonly {
    readonly title: string;
    readonly replacementText: string;
  }[];
}

export interface AcpRiskAssessment {
  readonly assessmentId: string;
  readonly targetPath: string;
  readonly riskLevel: AcpRiskLevel;
  readonly score: number; // 0 (catastrophic) - 100 (exemplary)
  readonly findings: readonly AdversarialFinding[];
  readonly rollbackSafeguardPresent: boolean;
  readonly ungroundedSymbolCount: number;
  readonly cognitiveFluffRatio: number;
  readonly summary: string;
  readonly recommendedAction: "APPROVE_SAFE" | "REQUIRE_MANUAL_REVIEW" | "REJECT_HARMFUL";
  readonly timestamp: number;
}

export interface AcpClientCapabilities {
  readonly streamingEdits: boolean;
  readonly inlineDiffs: boolean;
  readonly terminalIntegration: boolean;
  readonly notificationActions: boolean;
  readonly multiFileChangesets: boolean;
  readonly adversarialScrutiny?: boolean;
  readonly diagnosticStreaming?: boolean;
}

export interface AcpSessionInfo {
  readonly sessionId: string;
  readonly mode: AcpSessionMode;
  readonly clientName?: string;
  readonly clientVersion?: string;
  readonly workspaceRoot: string;
  readonly workingDirectory?: string;
  readonly connectedAt: number;
  readonly activeDocument?: string;
  readonly cursorPosition?: { readonly line: number; readonly character: number };
}

export interface AcpSession {
  readonly sessionId: string;
  readonly clientType: AcpClientType;
  readonly clientVersion: string;
  readonly workspaceRoot: string;
  readonly capabilities: AcpClientCapabilities;
  readonly activeDocument?: string;
  readonly cursorPosition?: { readonly line: number; readonly character: number };
  readonly connectedAt: number;
  readonly lastHeartbeatAt: number;
}

export interface AcpFileChange {
  readonly filePath: string;
  readonly changeType: "CREATE" | "MODIFY" | "DELETE";
  readonly originalContent?: string;
  readonly modifiedContent: string;
  readonly additionsCount: number;
  readonly deletionsCount: number;
}

export interface AcpMultiFileChangeset {
  readonly changesetId: string;
  readonly sessionId: string;
  readonly title: string;
  readonly description?: string;
  readonly files: readonly AcpFileChange[];
  readonly totalAdditions: number;
  readonly totalDeletions: number;
  readonly status: AcpApprovalStatus;
  readonly riskAssessment?: AcpRiskAssessment;
  readonly createdAt: number;
  readonly resolvedAt?: number;
}

export interface AcpDiffCard {
  readonly changesetId: string;
  readonly summaryText: string;
  readonly filesListText: string;
  readonly formattedDiffText: string;
  readonly riskText?: string;
  readonly actionButtons: readonly {
    readonly actionId: string;
    readonly label: string;
    readonly style: "primary" | "secondary" | "danger";
  }[];
}

export interface AcpEditApprovalRequest {
  readonly approvalId: string;
  readonly sessionId?: string;
  readonly filePath: string;
  readonly originalContent?: string;
  readonly newContent?: string;
  readonly proposedContent?: string;
  readonly diffPreview?: string;
  readonly diffSnippet?: string;
  readonly isSensitivePath?: boolean;
  readonly reason?: string;
  readonly riskAssessment?: AcpRiskAssessment;
  readonly diagnosticShield?: string;
  readonly timestamp: number;
}

export interface AcpEditApprovalDecision {
  readonly approvalId: string;
  readonly approved: boolean;
  readonly reason?: string;
  readonly modifiedContent?: string;
}

export interface AcpTurnStepRequest {
  readonly sessionId: string;
  readonly prompt: string;
  readonly contextFiles?: readonly string[];
  readonly autoApproveSafeEdits?: boolean;
}

export interface AcpTurnStepNotification {
  readonly sessionId: string;
  readonly stepIndex: number;
  readonly phase: "PLANNING" | "SCRUTINIZING" | "EXECUTING" | "VERIFYING" | "COMPLETED";
  readonly streamDelta?: string;
  readonly thoughtDelta?: string;
  readonly toolCall?: {
    readonly tool: string;
    readonly args: Record<string, unknown>;
  };
  readonly timestamp: number;
}

export interface AcpRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly method: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface AcpRpcNotification {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface AcpRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly result?: Readonly<Record<string, unknown>>;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

export type AcpTransactionStatus = "PREPARED" | "COMMITTED" | "ABORTED";

export interface AcpStagedFile {
  readonly filePath: string;
  readonly changeType: "CREATE" | "MODIFY" | "DELETE";
  readonly preImageHash: string;
  readonly postImageHash: string;
  readonly originalContent?: string;
  readonly stagedContent: string;
  readonly additionsCount: number;
  readonly deletionsCount: number;
}

export interface AcpRollbackToken {
  readonly transactionId: string;
  readonly createdAt: number;
  readonly touchedFiles: readonly {
    readonly filePath: string;
    readonly originalContent?: string;
    readonly existedBefore: boolean;
  }[];
}

export interface AcpSpeculativeTransaction {
  readonly transactionId: string;
  readonly sessionId: string;
  readonly title: string;
  readonly description?: string;
  readonly status: AcpTransactionStatus;
  readonly files: readonly AcpStagedFile[];
  readonly totalAdditions: number;
  readonly totalDeletions: number;
  readonly riskAssessment?: AcpRiskAssessment;
  readonly rollbackToken?: AcpRollbackToken;
  readonly preparedAt: number;
  readonly committedAt?: number;
}

export interface AcpStreamChunkNotification {
  readonly sessionId: string;
  readonly delta: string;
  readonly turnIndex?: number;
  readonly isComplete: boolean;
  readonly timestamp: number;
}

export interface AcpThoughtDeltaNotification {
  readonly sessionId: string;
  readonly thoughtDelta: string;
  readonly stage?: string;
  readonly timestamp: number;
}

export interface AcpToolExecutionNotification {
  readonly sessionId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly result?: unknown;
  readonly isError?: boolean;
  readonly timestamp: number;
}

export interface AcpTurnCompletionReport {
  readonly sessionId: string;
  readonly stopReason: "end_turn" | "cancelled" | "max_tokens" | "error";
  readonly totalTokens: number;
  readonly latencyMs: number;
  readonly costEstimateDollars?: number;
  readonly timestamp: number;
}

export interface AcpWorkspaceFolder {
  readonly uri: string;
  readonly name: string;
}

export interface AcpWorkspaceFolderChangeEvent {
  readonly added: readonly AcpWorkspaceFolder[];
  readonly removed: readonly AcpWorkspaceFolder[];
}

export interface IAcpSpeculativeChangesetStager {
  prepareTransaction(
    sessionId: string,
    title: string,
    changes: readonly { filePath: string; modifiedContent: string; changeType?: "CREATE" | "MODIFY" | "DELETE" }[],
    description?: string
  ): Promise<{ success: boolean; transaction?: AcpSpeculativeTransaction; error?: string }>;
  commitTransaction(transactionId: string): Promise<{ success: boolean; rollbackToken?: AcpRollbackToken; error?: string }>;
  rollbackTransaction(rollbackToken: AcpRollbackToken): Promise<{ success: boolean; error?: string }>;
  abortTransaction(transactionId: string): boolean;
  getTransaction(transactionId: string): AcpSpeculativeTransaction | undefined;
  listTransactions(): readonly AcpSpeculativeTransaction[];
}

export interface AcpServerConfig {
  readonly enabled: boolean;
  readonly port: number;
  readonly transport: "stdio" | "websocket" | "ipc";
  readonly authToken?: string;
  readonly autoApproveReadOnly: boolean;
  readonly maxChangesetFiles: number;
  readonly enableAdversarialScrutiny: boolean;
}

export interface IAcpProtocolCodec {
  encodeResponse(id: string | number, result: unknown): string;
  encodeError(id: string | number, code: number, message: string, data?: unknown): string;
  encodeNotification(method: string, params?: Record<string, unknown>): string;
  encodeLspMessage(jsonPayload: string): string;
  parseMessage(rawJson: string): AcpRpcRequest | AcpRpcNotification;
  parseStreamBuffer(buffer: string): { messages: readonly (AcpRpcRequest | AcpRpcNotification)[]; remainder: string };
}

export interface IAcpPermissionGate {
  checkPathPermission(filePath: string): AcpPermissionLevel;
  requestEditApproval(req: Omit<AcpEditApprovalRequest, "approvalId" | "timestamp"> & { isSensitivePath?: boolean }): Promise<AcpEditApprovalDecision>;
  scrutinizeEdit(req: Partial<AcpEditApprovalRequest>): Promise<AcpRiskAssessment>;
  scrutinizeChangeset(changeset: AcpMultiFileChangeset): Promise<AcpRiskAssessment>;
  resolveApproval(decision: AcpEditApprovalDecision): boolean;
  submitApprovalDecision(decision: AcpEditApprovalDecision): boolean;
  listPendingApprovals(): readonly AcpEditApprovalRequest[];
}

export interface IBroccoliAcpSubstrate {
  incrementRpcCallCount(): void;
  getRpcCallCount(): number;
  registerSession(session: AcpSessionInfo): void;
  createSession(sessionId: string, mode?: AcpSessionMode, workspaceRoot?: string, clientName?: string): AcpSessionInfo;
  updateSessionMode(sessionId: string, mode: AcpSessionMode): boolean;
  getSession(sessionId: string): AcpSessionInfo | undefined;
  listSessions(): readonly AcpSessionInfo[];
  recordEditApproval(approval: AcpEditApprovalRequest): void;
  queueApproval(approval: AcpEditApprovalRequest): void;
  resolveEditApproval(approvalId: string, decision: AcpEditApprovalDecision): boolean;
  resolveApproval(approvalId: string, decision: AcpEditApprovalDecision): boolean;
  listPendingApprovals(): readonly AcpEditApprovalRequest[];
  upsertChangeset(changeset: AcpMultiFileChangeset): AcpMultiFileChangeset;
  getChangeset(changesetId: string): AcpMultiFileChangeset | undefined;
  listChangesets(): readonly AcpMultiFileChangeset[];
  recordRiskAudit(audit: AcpRiskAssessment): void;
  listRiskAudits(): readonly AcpRiskAssessment[];
}

export interface IAcpBridgeServer {
  handleRpcMessage(rawJson: string): Promise<string | undefined>;
  sendNotification(method: string, params?: Record<string, unknown>): string;
  publishDiagnostics(uri: string, diagnostics: readonly AcpDiagnosticItem[]): string;
}

export interface AcpSubstrateSnapshot {
  readonly sessions: readonly AcpSession[];
  readonly legacySessions: readonly AcpSessionInfo[];
  readonly changesets: readonly AcpMultiFileChangeset[];
  readonly pendingApprovals: readonly AcpEditApprovalRequest[];
  readonly riskAudits: readonly AcpRiskAssessment[];
  readonly config: AcpServerConfig;
  readonly rpcCallCount: number;
  readonly totalChangesetsCreated: number;
}
