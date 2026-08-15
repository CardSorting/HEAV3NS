/**
 * broccoli-arbiter-substrate.ts
 *
 * In-memory zero-GC Broccolidb storage layer for pending approval queues,
 * write-staged artifacts (memory & skills), and security audit ledgers.
 */

import type {
  ApprovalAuditEntry,
  ArbiterSessionSnapshot,
  PendingApprovalRequest,
  StagedWriteArtifact,
} from "../../../core/contracts/arbiter.contracts.js";

export class BroccoliArbiterSubstrate {
  private readonly pendingRequests = new Map<string, PendingApprovalRequest>();
  private readonly hashIndex = new Map<string, string>(); // commandHash -> requestId
  private readonly stagedWrites = new Map<string, StagedWriteArtifact>();
  private readonly auditLedger: ApprovalAuditEntry[] = [];

  private isEstopped = false;
  private totalEvaluated = 0;
  private totalApproved = 0;
  private totalDenied = 0;
  private totalEstopped = 0;

  public addPendingRequest(request: PendingApprovalRequest): void {
    this.pendingRequests.set(request.id, request);
    this.hashIndex.set(request.commandHash, request.id);
    this.totalEvaluated++;
  }

  public getPendingRequest(idOrHash: string): PendingApprovalRequest | undefined {
    const id = this.hashIndex.get(idOrHash) || idOrHash;
    return this.pendingRequests.get(id);
  }

  public resolveRequest(
    idOrHash: string,
    verdict: string,
    resolvedBy = "user"
  ): PendingApprovalRequest | undefined {
    const id = this.hashIndex.get(idOrHash) || idOrHash;
    const req = this.pendingRequests.get(id);
    if (!req) return undefined;

    const updated: PendingApprovalRequest = {
      ...req,
      status: "resolved",
      resolvedVerdict: verdict as any,
      resolvedBy,
    };

    this.pendingRequests.delete(id);
    this.hashIndex.delete(req.commandHash);

    if (verdict === "approved" || verdict === "session_allowed" || verdict === "always_allowed" || verdict === "auto_approved") {
      this.totalApproved++;
    } else if (verdict === "estopped") {
      this.totalEstopped++;
    } else {
      this.totalDenied++;
    }

    return updated;
  }

  public listPending(): PendingApprovalRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  public addStagedWrite(artifact: StagedWriteArtifact): void {
    this.stagedWrites.set(artifact.id, artifact);
  }

  public getStagedWrite(id: string): StagedWriteArtifact | undefined {
    return this.stagedWrites.get(id);
  }

  public commitStagedWrite(id: string): StagedWriteArtifact | undefined {
    const artifact = this.stagedWrites.get(id);
    if (!artifact) return undefined;
    const updated: StagedWriteArtifact = { ...artifact, status: "committed" };
    this.stagedWrites.delete(id);
    return updated;
  }

  public rejectStagedWrite(id: string): StagedWriteArtifact | undefined {
    const artifact = this.stagedWrites.get(id);
    if (!artifact) return undefined;
    const updated: StagedWriteArtifact = { ...artifact, status: "rejected" };
    this.stagedWrites.delete(id);
    return updated;
  }

  public listStagedWrites(subsystem?: "memory" | "skills"): StagedWriteArtifact[] {
    const all = Array.from(this.stagedWrites.values());
    if (!subsystem) return all;
    return all.filter((s) => s.subsystem === subsystem);
  }

  public recordAudit(entry: ApprovalAuditEntry): void {
    this.auditLedger.push(entry);
    if (this.auditLedger.length > 1000) {
      this.auditLedger.shift();
    }
  }

  public getAuditLedger(): readonly ApprovalAuditEntry[] {
    return this.auditLedger;
  }

  public setEstop(estopped: boolean): void {
    this.isEstopped = estopped;
    if (estopped) {
      this.totalEstopped++;
    }
  }

  public getIsEstopped(): boolean {
    return this.isEstopped;
  }

  public captureSnapshot(sessionAllowlistHashes: readonly string[] = []): ArbiterSessionSnapshot {
    return {
      pendingRequests: this.listPending(),
      sessionAllowlistHashes: [...sessionAllowlistHashes],
      stagedWrites: Array.from(this.stagedWrites.values()),
      isEstopped: this.isEstopped,
      totalEvaluated: this.totalEvaluated,
      totalApproved: this.totalApproved,
      totalDenied: this.totalDenied,
      totalEstopped: this.totalEstopped,
      timestamp: Date.now(),
    };
  }

  public restoreSnapshot(snapshot: ArbiterSessionSnapshot): void {
    this.pendingRequests.clear();
    this.hashIndex.clear();
    this.stagedWrites.clear();

    for (const req of snapshot.pendingRequests) {
      this.pendingRequests.set(req.id, { ...req });
      this.hashIndex.set(req.commandHash, req.id);
    }

    for (const st of snapshot.stagedWrites) {
      this.stagedWrites.set(st.id, { ...st });
    }

    this.isEstopped = snapshot.isEstopped;
    this.totalEvaluated = snapshot.totalEvaluated;
    this.totalApproved = snapshot.totalApproved;
    this.totalDenied = snapshot.totalDenied;
    this.totalEstopped = snapshot.totalEstopped;
  }

  public clear(): void {
    this.pendingRequests.clear();
    this.hashIndex.clear();
    this.stagedWrites.clear();
    this.auditLedger.length = 0;
    this.isEstopped = false;
    this.totalEvaluated = 0;
    this.totalApproved = 0;
    this.totalDenied = 0;
    this.totalEstopped = 0;
  }
}
