import type {
  AcpEditApprovalRequest,
  AcpSessionInfo,
  AcpSessionMode,
  IBroccoliAcpSubstrate,
} from "../../../core/contracts/acp.contracts.js";

/**
 * In-Memory Broccolidb ACP Substrate.
 *
 * Tracks active IDE client sessions, mode configurations, pending edit approval queues,
 * and RPC call metrics in zero-GC memory structures.
 */
export class BroccoliAcpSubstrate implements IBroccoliAcpSubstrate {
  private readonly sessions: Map<string, AcpSessionInfo> = new Map();
  private readonly pendingApprovals: Map<string, AcpEditApprovalRequest> = new Map();
  private rpcCallCount: number = 0;

  createSession(
    sessionId: string,
    mode: AcpSessionMode = "code",
    cwd: string = process.cwd(),
    clientName?: string
  ): AcpSessionInfo {
    const now = Date.now();
    const info: AcpSessionInfo = {
      sessionId,
      mode,
      workingDirectory: cwd,
      clientName,
      createdAt: now,
      lastActiveAt: now,
      messageCount: 0,
    };
    this.sessions.set(sessionId, info);
    return info;
  }

  getSession(sessionId: string): AcpSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): readonly AcpSessionInfo[] {
    return Array.from(this.sessions.values());
  }

  updateSessionMode(sessionId: string, mode: AcpSessionMode): boolean {
    const existing = this.sessions.get(sessionId);
    if (!existing) return false;

    this.sessions.set(sessionId, {
      ...existing,
      mode,
      lastActiveAt: Date.now(),
    });
    return true;
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  queueApproval(req: AcpEditApprovalRequest): void {
    this.pendingApprovals.set(req.approvalId, req);
  }

  resolveApproval(approvalId: string): AcpEditApprovalRequest | undefined {
    const item = this.pendingApprovals.get(approvalId);
    if (item) {
      this.pendingApprovals.delete(approvalId);
    }
    return item;
  }

  listPendingApprovals(): readonly AcpEditApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  getRpcCallCount(): number {
    return this.rpcCallCount;
  }

  incrementRpcCallCount(): number {
    this.rpcCallCount++;
    return this.rpcCallCount;
  }

  setRpcCallCount(count: number): void {
    this.rpcCallCount = count;
  }

  clear(): void {
    this.sessions.clear();
    this.pendingApprovals.clear();
    this.rpcCallCount = 0;
  }
}
