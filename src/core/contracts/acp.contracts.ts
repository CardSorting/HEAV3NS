/**
 * acp.contracts.ts
 *
 * Core contracts for the Agent Client Protocol (ACP) Universal Editor Bridge (Phase 99 / ADR-129).
 * Defines JSON-RPC 2.0 protocol envelopes, editor session handshakes, multi-file changesets,
 * interactive diff review cards, and permissions under the AKD-DSO Monolith architecture.
 */

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

export type AcpSessionMode = "interactive" | "headless" | "embedded" | "code" | "architect" | "ask";

export interface AcpClientCapabilities {
  readonly streamingEdits: boolean;
  readonly inlineDiffs: boolean;
  readonly terminalIntegration: boolean;
  readonly notificationActions: boolean;
  readonly multiFileChangesets: boolean;
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
  readonly createdAt: number;
  readonly resolvedAt?: number;
}

export interface AcpDiffCard {
  readonly changesetId: string;
  readonly summaryText: string;
  readonly filesListText: string;
  readonly formattedDiffText: string;
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
  readonly isSensitivePath?: boolean;
  readonly reason?: string;
  readonly timestamp: number;
}

export interface AcpEditApprovalDecision {
  readonly approvalId: string;
  readonly approved: boolean;
  readonly reason?: string;
  readonly modifiedContent?: string;
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

export interface AcpServerConfig {
  readonly enabled: boolean;
  readonly port: number;
  readonly transport: "stdio" | "websocket" | "ipc";
  readonly authToken?: string;
  readonly autoApproveReadOnly: boolean;
  readonly maxChangesetFiles: number;
}

export interface IAcpProtocolCodec {
  encodeResponse(id: string | number, result: unknown): string;
  encodeError(id: string | number, code: number, message: string, data?: unknown): string;
  encodeNotification(method: string, params?: Record<string, unknown>): string;
  parseMessage(rawJson: string): AcpRpcRequest | AcpRpcNotification;
}

export interface IAcpPermissionGate {
  checkPathPermission(filePath: string): AcpPermissionLevel;
  requestEditApproval(req: Omit<AcpEditApprovalRequest, "approvalId" | "timestamp"> & { isSensitivePath?: boolean }): Promise<AcpEditApprovalDecision>;
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
}

export interface IAcpBridgeServer {
  handleRpcMessage(rawJson: string): Promise<string | undefined>;
}

export interface AcpSubstrateSnapshot {
  readonly sessions: readonly AcpSession[];
  readonly legacySessions: readonly AcpSessionInfo[];
  readonly changesets: readonly AcpMultiFileChangeset[];
  readonly pendingApprovals: readonly AcpEditApprovalRequest[];
  readonly config: AcpServerConfig;
  readonly rpcCallCount: number;
  readonly totalChangesetsCreated: number;
}
