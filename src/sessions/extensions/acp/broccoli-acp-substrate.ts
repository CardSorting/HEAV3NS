/**
 * broccoli-acp-substrate.ts
 *
 * In-memory Zero-GC Broccolidb substrate for the Agent Client Protocol (ACP) Subsystem (Phase 99 / Phase 195 / ADR-133).
 * Manages connected editor sessions, pending multi-file changesets, edit approvals,
 * pre-commit risk audits, WAL ledger, and O(1) state snapshotting under the AKD-DSO Monolith architecture.
 */

import type {
  AcpEditApprovalDecision,
  AcpEditApprovalRequest,
  AcpMultiFileChangeset,
  AcpRiskAssessment,
  AcpServerConfig,
  AcpSession,
  AcpSessionInfo,
  AcpSessionMode,
  AcpSubstrateSnapshot,
  IBroccoliAcpSubstrate,
} from "../../../core/contracts/acp.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export interface AcpSessionRow extends Record<string, unknown> {
  readonly id: string;
  readonly sessionId: string;
  readonly mode: string;
  readonly clientName?: string;
  readonly workspaceRoot: string;
  readonly connectedAt: number;
}

export interface AcpChangesetRow extends Record<string, unknown> {
  readonly id: string;
  readonly changesetId: string;
  readonly sessionId: string;
  readonly title: string;
  readonly filesCount: number;
  readonly totalAdditions: number;
  readonly totalDeletions: number;
  readonly status: string;
  readonly riskLevel?: string;
  readonly createdAt: number;
}

export interface AcpApprovalRow extends Record<string, unknown> {
  readonly id: string;
  readonly approvalId: string;
  readonly sessionId?: string;
  readonly filePath: string;
  readonly isSensitive: boolean;
  readonly status: string;
  readonly riskLevel?: string;
  readonly timestamp: number;
}

export interface AcpRiskAuditRow extends Record<string, unknown> {
  readonly id: string;
  readonly assessmentId: string;
  readonly targetPath: string;
  readonly riskLevel: string;
  readonly score: number;
  readonly findingsCount: number;
  readonly recommendedAction: string;
  readonly timestamp: number;
}

export interface AcpWalRow extends Record<string, unknown> {
  readonly id: string;
  readonly action: string;
  readonly entityId: string;
  readonly summary: string;
  readonly timestamp: number;
}

const DEFAULT_ACP_CONFIG: AcpServerConfig = {
  enabled: true,
  port: 8765,
  transport: "stdio",
  autoApproveReadOnly: true,
  maxChangesetFiles: 50,
  enableAdversarialScrutiny: true,
};

export class BroccoliAcpSubstrate implements IBroccoliAcpSubstrate {
  private config: AcpServerConfig = { ...DEFAULT_ACP_CONFIG };
  private readonly sessions = new Map<string, AcpSession>();
  private readonly legacySessions = new Map<string, AcpSessionInfo>();
  private readonly changesets = new Map<string, AcpMultiFileChangeset>();
  private readonly pendingApprovals = new Map<string, AcpEditApprovalRequest>();
  private readonly riskAudits = new Map<string, AcpRiskAssessment>();
  private readonly walJournal: AcpWalRow[] = [];
  private rpcCallCount = 0;
  private totalChangesetsCreated = 0;

  private readonly sessionTable?: IDbTable<AcpSessionRow>;
  private readonly changesetTable?: IDbTable<AcpChangesetRow>;
  private readonly approvalTable?: IDbTable<AcpApprovalRow>;
  private readonly riskTable?: IDbTable<AcpRiskAuditRow>;
  private readonly walTable?: IDbTable<AcpWalRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.sessionTable = dbKernel.getTable<AcpSessionRow>("acp_sessions");
      this.changesetTable = dbKernel.getTable<AcpChangesetRow>("acp_changesets");
      this.approvalTable = dbKernel.getTable<AcpApprovalRow>("acp_approvals");
      this.riskTable = dbKernel.getTable<AcpRiskAuditRow>("acp_risk_audits");
      this.walTable = dbKernel.getTable<AcpWalRow>("acp_wal");
    }
  }

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
    this.recordWal("SESSION_REGISTERED", session.sessionId, `Registered session ${session.sessionId} (${session.mode})`);
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

    if (this.sessionTable) {
      this.sessionTable.put(sessionId, {
        id: sessionId,
        sessionId,
        mode,
        clientName,
        workspaceRoot,
        connectedAt: info.connectedAt,
      });
    }

    this.recordWal("SESSION_CREATED", sessionId, `Created ACP session ${sessionId} [mode: ${mode}]`);
    return info;
  }

  public updateSessionMode(sessionId: string, mode: AcpSessionMode): boolean {
    const s = this.legacySessions.get(sessionId);
    if (!s) return false;
    this.legacySessions.set(sessionId, { ...s, mode });

    if (this.sessionTable) {
      this.sessionTable.put(sessionId, {
        id: sessionId,
        sessionId,
        mode,
        clientName: s.clientName,
        workspaceRoot: s.workspaceRoot,
        connectedAt: s.connectedAt,
      });
    }

    this.recordWal("SESSION_MODE_CHANGED", sessionId, `Changed session ${sessionId} mode to ${mode}`);
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
    this.recordWal("SESSION_REMOVED", sessionId, `Removed session ${sessionId}`);
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
    if (this.approvalTable) {
      this.approvalTable.put(approval.approvalId, {
        id: approval.approvalId,
        approvalId: approval.approvalId,
        sessionId: approval.sessionId,
        filePath: approval.filePath,
        isSensitive: Boolean(approval.isSensitivePath),
        status: "PENDING",
        riskLevel: approval.riskAssessment?.riskLevel,
        timestamp: approval.timestamp,
      });
    }
    this.recordWal("APPROVAL_QUEUED", approval.approvalId, `Queued approval for ${approval.filePath} (Risk: ${approval.riskAssessment?.riskLevel ?? "UNKNOWN"})`);
  }

  public queueApproval(approval: AcpEditApprovalRequest): void {
    this.recordEditApproval(approval);
  }

  public resolveEditApproval(approvalId: string, decision: AcpEditApprovalDecision): boolean {
    const deleted = this.pendingApprovals.delete(approvalId);
    if (this.approvalTable) {
      const existing = this.approvalTable.get(approvalId);
      if (existing) {
        this.approvalTable.put(approvalId, {
          ...existing,
          status: decision.approved ? "ACCEPTED" : "REJECTED",
        });
      }
    }
    this.recordWal("APPROVAL_RESOLVED", approvalId, `Resolved approval ${approvalId} (Decision: ${decision.approved ? "ACCEPTED" : "REJECTED"})`);
    return deleted;
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

    if (this.changesetTable) {
      this.changesetTable.put(changeset.changesetId, {
        id: changeset.changesetId,
        changesetId: changeset.changesetId,
        sessionId: changeset.sessionId,
        title: changeset.title,
        filesCount: changeset.files.length,
        totalAdditions: changeset.totalAdditions,
        totalDeletions: changeset.totalDeletions,
        status: changeset.status,
        riskLevel: changeset.riskAssessment?.riskLevel,
        createdAt: changeset.createdAt,
      });
    }

    this.recordWal("CHANGESET_UPSERTED", changeset.changesetId, `Changeset ${changeset.changesetId} (${changeset.files.length} files, status: ${changeset.status})`);
    return changeset;
  }

  public getChangeset(changesetId: string): AcpMultiFileChangeset | undefined {
    return this.changesets.get(changesetId);
  }

  public listChangesets(): readonly AcpMultiFileChangeset[] {
    return Array.from(this.changesets.values());
  }

  public recordRiskAudit(audit: AcpRiskAssessment): void {
    this.riskAudits.set(audit.assessmentId, audit);

    if (this.riskTable) {
      this.riskTable.put(audit.assessmentId, {
        id: audit.assessmentId,
        assessmentId: audit.assessmentId,
        targetPath: audit.targetPath,
        riskLevel: audit.riskLevel,
        score: audit.score,
        findingsCount: audit.findings.length,
        recommendedAction: audit.recommendedAction,
        timestamp: audit.timestamp,
      });
    }

    this.recordWal("RISK_AUDIT_RECORDED", audit.assessmentId, `Audited ${audit.targetPath} (Risk: ${audit.riskLevel}, Score: ${audit.score}/100)`);
  }

  public listRiskAudits(): readonly AcpRiskAssessment[] {
    return Array.from(this.riskAudits.values());
  }

  public getWalJournal(): readonly AcpWalRow[] {
    return [...this.walJournal];
  }

  private recordWal(action: string, entityId: string, summary: string): void {
    const row: AcpWalRow = {
      id: `wal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action,
      entityId,
      summary,
      timestamp: Date.now(),
    };
    this.walJournal.push(row);
    if (this.walTable) {
      this.walTable.put(row.id, row);
    }
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
            adversarialScrutiny: true,
            diagnosticStreaming: true,
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
      riskAudits: Array.from(this.riskAudits.values()),
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
    this.riskAudits.clear();
    for (const ra of snapshot.riskAudits || []) {
      this.riskAudits.set(ra.assessmentId, ra);
    }
    this.config = { ...snapshot.config };
    this.rpcCallCount = snapshot.rpcCallCount || 0;
    this.totalChangesetsCreated = snapshot.totalChangesetsCreated || 0;
  }
}
