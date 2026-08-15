/**
 * Agent Client Protocol (ACP) & IDE Bridge Contracts
 *
 * Defines typed schemas and interfaces for the Agent Client Protocol (ACP)
 * JSON-RPC 2.0 integration, permission gating, and streaming progress (K_acp).
 */

export type AcpSessionMode = "architect" | "code" | "ask";

export type AcpPermissionLevel = "allow" | "ask" | "deny";

export interface AcpRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly method: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface AcpRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly result?: unknown;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

export interface AcpRpcNotification {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface AcpSessionInfo {
  readonly sessionId: string;
  readonly mode: AcpSessionMode;
  readonly workingDirectory: string;
  readonly clientName?: string;
  readonly createdAt: number;
  readonly lastActiveAt: number;
  readonly messageCount: number;
}

export interface AcpEditApprovalRequest {
  readonly approvalId: string;
  readonly sessionId: string;
  readonly filePath: string;
  readonly diffSnippet: string;
  readonly isSensitivePath: boolean;
  readonly timestamp: number;
}

export interface AcpEditApprovalDecision {
  readonly approvalId: string;
  readonly approved: boolean;
  readonly reason?: string;
}

export interface AcpStateSnapshot {
  readonly sessions: readonly AcpSessionInfo[];
  readonly pendingApprovals: readonly AcpEditApprovalRequest[];
  readonly totalRpcCalls: number;
  readonly snapshotTick: number;
}

export interface IAcpProtocolCodec {
  encodeResponse(id: string | number, result: unknown): string;
  encodeError(id: string | number, code: number, message: string, data?: unknown): string;
  encodeNotification(method: string, params?: Record<string, unknown>): string;
  parseMessage(rawJson: string): AcpRpcRequest | AcpRpcNotification;
}

export interface IAcpPermissionGate {
  checkPathPermission(filePath: string): AcpPermissionLevel;
  requestEditApproval(req: Omit<AcpEditApprovalRequest, "approvalId" | "timestamp">): Promise<AcpEditApprovalDecision>;
  submitApprovalDecision(decision: AcpEditApprovalDecision): boolean;
}

export interface IBroccoliAcpSubstrate {
  createSession(sessionId: string, mode?: AcpSessionMode, cwd?: string, clientName?: string): AcpSessionInfo;
  getSession(sessionId: string): AcpSessionInfo | undefined;
  listSessions(): readonly AcpSessionInfo[];
  updateSessionMode(sessionId: string, mode: AcpSessionMode): boolean;
  deleteSession(sessionId: string): boolean;
  queueApproval(req: AcpEditApprovalRequest): void;
  resolveApproval(approvalId: string): AcpEditApprovalRequest | undefined;
  listPendingApprovals(): readonly AcpEditApprovalRequest[];
  getRpcCallCount(): number;
  incrementRpcCallCount(): number;
  clear(): void;
}

export interface IAcpSnapshotManager {
  createSnapshot(tick: number): AcpStateSnapshot;
  restoreSnapshot(snapshot: AcpStateSnapshot): void;
}

export interface IAcpBridgeServer {
  handleRpcMessage(rawJson: string): Promise<string | undefined>;
  sendNotification(method: string, params?: Record<string, unknown>): string;
  getActiveSessions(): readonly AcpSessionInfo[];
}
