/**
 * interactive-security-arbiter.ts
 *
 * Master Security Arbiter & Human-in-the-Loop Authorizer.
 * Coordinates multi-tier risk evaluation, SHA-256 allowlist ledgers,
 * interactive prompting callbacks, write-staging reviews, and emergency E-Stop.
 */

import type {
  ApprovalActionType,
  ApprovalVerdict,
  ArbiterOptions,
  PendingApprovalRequest,
  RiskAssessmentResult,
  StagedWriteArtifact,
} from "../../../core/contracts/arbiter.contracts.js";
import { BroccoliArbiterSubstrate } from "../../../sessions/extensions/arbiter/broccoli-arbiter-substrate.js";
import { ApprovalHashLedger } from "../../../tooling/extensions/arbiter/approval-hash-ledger.js";
import { SecurityRiskClassifier } from "../../../tooling/extensions/arbiter/security-risk-classifier.js";

export class InteractiveSecurityArbiter {
  private readonly substrate: BroccoliArbiterSubstrate;
  private readonly ledger: ApprovalHashLedger;
  private readonly classifier: SecurityRiskClassifier;
  private readonly options: ArbiterOptions;

  constructor(
    substrate: BroccoliArbiterSubstrate,
    ledger: ApprovalHashLedger,
    classifier: SecurityRiskClassifier,
    options: ArbiterOptions = {}
  ) {
    this.substrate = substrate;
    this.ledger = ledger;
    this.classifier = classifier;
    this.options = options;
  }

  /**
   * Primary entry point: Evaluates an action, checks allowlists, and requests approval if required.
   */
  public async evaluateAndAuthorize(
    actionType: ApprovalActionType,
    target: string,
    metadata: Record<string, unknown> = {}
  ): Promise<{
    readonly authorized: boolean;
    readonly verdict: ApprovalVerdict;
    readonly riskAssessment: RiskAssessmentResult;
    readonly commandHash: string;
    readonly requestId?: string;
  }> {
    if (this.substrate.getIsEstopped()) {
      return {
        authorized: false,
        verdict: "estopped",
        riskAssessment: {
          riskLevel: "critical",
          isDangerous: true,
          reason: "Emergency killswitch (E-Stop) is currently active",
          requiresHumanApproval: true,
        },
        commandHash: this.ledger.computeHash(target),
      };
    }

    const commandHash = this.ledger.computeHash(target);
    const riskAssessment = this.classifier.evaluate(actionType, target, metadata);

    // Check allowlist ledger
    if (this.ledger.isGranted(commandHash)) {
      this.substrate.recordAudit({
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        requestId: `req_cached_${commandHash.slice(0, 8)}`,
        commandHash,
        actionType,
        target,
        riskLevel: riskAssessment.riskLevel,
        verdict: "session_allowed",
        timestamp: Date.now(),
      });
      return {
        authorized: true,
        verdict: "session_allowed",
        riskAssessment,
        commandHash,
      };
    }

    // Auto-approve low-risk or safe actions
    if (!riskAssessment.requiresHumanApproval) {
      this.substrate.recordAudit({
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        requestId: `req_auto_${commandHash.slice(0, 8)}`,
        commandHash,
        actionType,
        target,
        riskLevel: riskAssessment.riskLevel,
        verdict: "auto_approved",
        timestamp: Date.now(),
      });
      return {
        authorized: true,
        verdict: "auto_approved",
        riskAssessment,
        commandHash,
      };
    }

    // Create pending approval request
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timeoutMs = this.options.defaultTimeoutMs || 30000;
    const request: PendingApprovalRequest = {
      id: requestId,
      actionType,
      target,
      commandHash,
      riskAssessment,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + timeoutMs,
      metadata,
    };

    this.substrate.addPendingRequest(request);

    // If interactive prompt callback is provided, invoke it
    if (this.options.interactivePromptCallback) {
      try {
        const verdict = await this.options.interactivePromptCallback(request);
        const resolved = this.resolveApproval(requestId, verdict);
        return {
          authorized:
            verdict === "approved" ||
            verdict === "session_allowed" ||
            verdict === "always_allowed" ||
            verdict === "auto_approved",
          verdict,
          riskAssessment,
          commandHash,
          requestId: resolved?.id || requestId,
        };
      } catch (err) {
        this.resolveApproval(requestId, "denied");
        return {
          authorized: false,
          verdict: "denied",
          riskAssessment,
          commandHash,
          requestId,
        };
      }
    }

    return {
      authorized: false,
      verdict: "denied",
      riskAssessment,
      commandHash,
      requestId,
    };
  }

  /**
   * Resolves a pending approval request.
   */
  public resolveApproval(
    idOrHash: string,
    verdict: ApprovalVerdict,
    resolvedBy = "user"
  ): PendingApprovalRequest | undefined {
    const resolved = this.substrate.resolveRequest(idOrHash, verdict, resolvedBy);
    if (!resolved) return undefined;

    if (verdict === "session_allowed") {
      this.ledger.grantSessionAllow(resolved.commandHash);
    } else if (verdict === "always_allowed") {
      this.ledger.grantPersistentAllow(resolved.commandHash);
    }

    this.substrate.recordAudit({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      requestId: resolved.id,
      commandHash: resolved.commandHash,
      actionType: resolved.actionType,
      target: resolved.target,
      riskLevel: resolved.riskAssessment.riskLevel,
      verdict,
      timestamp: Date.now(),
    });

    return resolved;
  }

  /**
   * Stages a memory or skill write for out-of-band human review.
   */
  public stageWrite(
    subsystem: "memory" | "skills",
    targetPath: string,
    content: string,
    diff?: string
  ): StagedWriteArtifact {
    const id = `stage_${subsystem}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const gist = content.slice(0, 120).replace(/\n/g, " ");

    const artifact: StagedWriteArtifact = {
      id,
      subsystem,
      targetPath,
      content,
      diff,
      gist,
      createdAt: Date.now(),
      status: "staged",
    };

    this.substrate.addStagedWrite(artifact);
    return artifact;
  }

  public commitStagedWrite(id: string): StagedWriteArtifact | undefined {
    return this.substrate.commitStagedWrite(id);
  }

  public rejectStagedWrite(id: string): StagedWriteArtifact | undefined {
    return this.substrate.rejectStagedWrite(id);
  }

  /**
   * Triggers emergency stop killswitch.
   */
  public triggerEstop(): void {
    this.substrate.setEstop(true);
  }

  /**
   * Clears emergency stop killswitch.
   */
  public clearEstop(): void {
    this.substrate.setEstop(false);
  }

  public isEstopped(): boolean {
    return this.substrate.getIsEstopped();
  }
}
