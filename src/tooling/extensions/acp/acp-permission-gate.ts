import type {
  AcpEditApprovalDecision,
  AcpEditApprovalRequest,
  AcpPermissionLevel,
  IAcpPermissionGate,
  IBroccoliAcpSubstrate,
} from "../../../core/contracts/acp.contracts.js";

/**
 * Deterministic ACP Permission Gate.
 *
 * Enforces file safety policies, sensitive path protection, and interactive
 * edit approval queues for IDE client connections.
 */
export class AcpPermissionGate implements IAcpPermissionGate {
  private readonly substrate: IBroccoliAcpSubstrate;
  private readonly pendingResolvers: Map<string, (decision: AcpEditApprovalDecision) => void> = new Map();

  private static readonly HARD_DENY_PATTERNS = [
    /^\/etc\/(passwd|shadow|sudoers)/i,
    /\.ssh\/(authorized_keys|id_rsa|id_ed25519)$/i,
  ];

  private static readonly SENSITIVE_ASK_PATTERNS = [
    /\.env(\..+)?$/i,
    /\.npmrc$/i,
    /\.pypirc$/i,
    /\.git-credentials$/i,
    /\.aws\/credentials$/i,
    /\.ssh\/config$/i,
  ];

  constructor(substrate: IBroccoliAcpSubstrate) {
    this.substrate = substrate;
  }

  checkPathPermission(filePath: string): AcpPermissionLevel {
    const normalized = filePath.replace(/\\/g, "/");

    for (const pattern of AcpPermissionGate.HARD_DENY_PATTERNS) {
      if (pattern.test(normalized)) {
        return "deny";
      }
    }

    for (const pattern of AcpPermissionGate.SENSITIVE_ASK_PATTERNS) {
      if (pattern.test(normalized)) {
        return "ask";
      }
    }

    return "allow";
  }

  async requestEditApproval(req: Omit<AcpEditApprovalRequest, "approvalId" | "timestamp">): Promise<AcpEditApprovalDecision> {
    const permission = this.checkPathPermission(req.filePath);
    if (permission === "deny") {
      return {
        approvalId: `denied-${Date.now()}`,
        approved: false,
        reason: `Write forbidden: Path '${req.filePath}' is protected by safety invariants.`,
      };
    }

    if (permission === "allow") {
      return {
        approvalId: `auto-${Date.now()}`,
        approved: true,
      };
    }

    // Interactive 'ask' level
    const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fullRequest: AcpEditApprovalRequest = {
      ...req,
      approvalId,
      isSensitivePath: true,
      timestamp: Date.now(),
    };

    this.substrate.queueApproval(fullRequest);

    return new Promise<AcpEditApprovalDecision>((resolve) => {
      this.pendingResolvers.set(approvalId, resolve);
    });
  }

  submitApprovalDecision(decision: AcpEditApprovalDecision): boolean {
    const resolver = this.pendingResolvers.get(decision.approvalId);
    if (!resolver) {
      return false;
    }

    this.substrate.resolveApproval(decision.approvalId, decision);
    this.pendingResolvers.delete(decision.approvalId);
    resolver(decision);
    return true;
  }

  resolveApproval(decision: AcpEditApprovalDecision): boolean {
    return this.submitApprovalDecision(decision);
  }

  listPendingApprovals(): readonly AcpEditApprovalRequest[] {
    return this.substrate.listPendingApprovals();
  }
}
