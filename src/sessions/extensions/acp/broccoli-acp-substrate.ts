/**
 * broccoli-acp-substrate.ts
 *
 * In-memory Zero-GC Broccolidb substrate for the Agent Client Protocol (ACP) Subsystem (Phase 99 / ADR-129).
 * Manages connected editor sessions, pending multi-file changesets, edit approvals,
 * and O(1) state snapshotting under the AKD-DSO Monolith architecture.
 */

import type {
  AcpEditApprovalDecision,
  AcpEditApprovalRequest,
  AcpMultiFileChangeset,
  AcpServerConfig,
  AcpSession,
  AcpSessionInfo,
  AcpSessionMode,
  AcpSubstrateSnapshot,
  IBroccoliAcpSubstrate,
} from "../../../core/contracts/acp.contracts.js";

const DEFAULT_ACP_CONFIG: AcpServerConfig = {
  enabled: false, // Fail-closed default
  port: 8765,
  transport: "stdio",
  autoApproveReadOnly: true,
  maxChangesetFiles: 50,
};

export class BroccoliAcpSubstrate implements IBroccoliAcpSubstrate {
  private config: AcpServerConfig = { ...DEFAULT_ACP_CONFIG };
  private readonly sessions = new Map<string, AcpSession>();
  private readonly legacySessions = new Map<string, AcpSessionInfo>();
  private readonly changesets = new Map<string, AcpMultiFileChangeset>();
  private readonly pendingApprovals = new Map<string, AcpEditApprovalRequest>();
  private rpcCallCount = 0;
  private totalChangesetsCreated = 0;

  public getConfig(): AcpServerConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<AcpServerConfig>): AcpServerConfig {
    this.config = { ...this.config, ...updates };
    return this.getConfig();
  }

  public incrementRpcCallCount(): void {
    this.rpcCallCount++;
  }

  public getRpcCallCount(): number {
    return this.rpcCallCount;
  }

  public registerSession(session: AcpSessionInfo): void {
    this.legacySessions.set(session.sessionId, session);
  }

  public createSession(
    sessionId: string,
    mode: AcpSessionMode = "code",
    workspaceRoot: string = process.cwd(),
    clientName?: string
  ): AcpSessionInfo {
    const info: AcpSessionInfo = {
      sessionId,
      mode,
      clientName,
      workspaceRoot,
      workingDirectory: workspaceRoot,
      connectedAt: Date.now(),
    };
    this.legacySessions.set(sessionId, info);
    return info;
  }

  public updateSessionMode(sessionId: string, mode: AcpSessionMode): boolean {
    const s = this.legacySessions.get(sessionId);
    if (!s) return false;
    this.legacySessions.set(sessionId, { ...s, mode });
    return true;
  }

  public upsertSession(session: AcpSession): AcpSession {
    this.sessions.set(session.sessionId, session);
    return session;
  }

  public getSession(sessionId: string): AcpSessionInfo | undefined {
    const legacy = this.legacySessions.get(sessionId);
    if (legacy) return legacy;

    const modern = this.sessions.get(sessionId);
    if (!modern) return undefined;

    return {
      sessionId: modern.sessionId,
      mode: "interactive",
      clientName: modern.clientType,
      clientVersion: modern.clientVersion,
      workspaceRoot: modern.workspaceRoot,
      workingDirectory: modern.workspaceRoot,
      connectedAt: modern.connectedAt,
      activeDocument: modern.activeDocument,
      cursorPosition: modern.cursorPosition,
    };
  }

  public getModernSession(sessionId: string): AcpSession | undefined {
    return this.sessions.get(sessionId);
  }

  public removeSession(sessionId: string): boolean {
    this.legacySessions.delete(sessionId);
    return this.sessions.delete(sessionId);
  }

  public listSessions(): readonly AcpSessionInfo[] {
    const combined: AcpSessionInfo[] = Array.from(this.legacySessions.values());
    for (const modern of this.sessions.values()) {
      if (!this.legacySessions.has(modern.sessionId)) {
        combined.push({
          sessionId: modern.sessionId,
          mode: "interactive",
          clientName: modern.clientType,
          clientVersion: modern.clientVersion,
          workspaceRoot: modern.workspaceRoot,
          workingDirectory: modern.workspaceRoot,
          connectedAt: modern.connectedAt,
          activeDocument: modern.activeDocument,
          cursorPosition: modern.cursorPosition,
        });
      }
    }
    return combined;
  }

  public listModernSessions(): readonly AcpSession[] {
    return Array.from(this.sessions.values());
  }

  public recordEditApproval(approval: AcpEditApprovalRequest): void {
    this.pendingApprovals.set(approval.approvalId, approval);
  }

  public queueApproval(approval: AcpEditApprovalRequest): void {
    this.pendingApprovals.set(approval.approvalId, approval);
  }

  public resolveEditApproval(approvalId: string, _decision: AcpEditApprovalDecision): boolean {
    return this.pendingApprovals.delete(approvalId);
  }

  public resolveApproval(approvalId: string, decision: AcpEditApprovalDecision): boolean {
    return this.resolveEditApproval(approvalId, decision);
  }

  public listPendingApprovals(): readonly AcpEditApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  public upsertChangeset(changeset: AcpMultiFileChangeset): AcpMultiFileChangeset {
    if (!this.changesets.has(changeset.changesetId)) {
      this.totalChangesetsCreated++;
    }
    this.changesets.set(changeset.changesetId, changeset);
    return changeset;
  }

  public getChangeset(changesetId: string): AcpMultiFileChangeset | undefined {
    return this.changesets.get(changesetId);
  }

  public listChangesets(): readonly AcpMultiFileChangeset[] {
    return Array.from(this.changesets.values());
  }

  public exportSnapshot(): AcpSubstrateSnapshot {
    const modernList = Array.from(this.sessions.values());
    for (const legacy of this.legacySessions.values()) {
      if (!this.sessions.has(legacy.sessionId)) {
        modernList.push({
          sessionId: legacy.sessionId,
          clientType: "custom",
          clientVersion: "1.0.0",
          workspaceRoot: legacy.workspaceRoot,
          capabilities: {
            streamingEdits: true,
            inlineDiffs: true,
            terminalIntegration: true,
            notificationActions: true,
            multiFileChangesets: true,
          },
          connectedAt: legacy.connectedAt,
          lastHeartbeatAt: legacy.connectedAt,
        });
      }
    }

    return {
      sessions: modernList,
      legacySessions: Array.from(this.legacySessions.values()),
      changesets: Array.from(this.changesets.values()),
      pendingApprovals: Array.from(this.pendingApprovals.values()),
      config: this.getConfig(),
      rpcCallCount: this.rpcCallCount,
      totalChangesetsCreated: this.totalChangesetsCreated,
    };
  }

  public importSnapshot(snapshot: AcpSubstrateSnapshot): void {
    this.sessions.clear();
    for (const s of snapshot.sessions) {
      this.sessions.set(s.sessionId, s);
    }
    this.legacySessions.clear();
    for (const ls of snapshot.legacySessions || []) {
      this.legacySessions.set(ls.sessionId, ls);
    }
    this.changesets.clear();
    for (const c of snapshot.changesets) {
      this.changesets.set(c.changesetId, c);
    }
    this.pendingApprovals.clear();
    for (const p of snapshot.pendingApprovals || []) {
      this.pendingApprovals.set(p.approvalId, p);
    }
    this.config = { ...snapshot.config };
    this.rpcCallCount = snapshot.rpcCallCount || 0;
    this.totalChangesetsCreated = snapshot.totalChangesetsCreated || 0;
  }
}
