/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 142: Zero-Dependency Broccoli Approval Policy Engine
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/orchestration/ApprovalPolicyEngine.ts).
 * Evaluates mutation plans against risk levels (low, medium, high) and approval policies
 * (readonly, production_locked, human_approval_required, ci_gate_only, autonomous_safe). Zero external npm dependencies.
 */

export type ApprovalPolicy =
  | "readonly"
  | "production_locked"
  | "human_approval_required"
  | "ci_gate_only"
  | "autonomous_safe";

export type RepairRiskLevel = "low" | "medium" | "high";

export interface PolicyDecision {
  allowed: boolean;
  policy: ApprovalPolicy;
  reasons: string[];
  requiredApprovals: string[];
}

export class PolicyBlockedError extends Error {
  readonly decision: PolicyDecision;

  constructor(message: string, decision: PolicyDecision) {
    super(message);
    this.name = "PolicyBlockedError";
    this.decision = decision;
  }
}

import { BroccoliAxiomVerifier } from "./broccolidb-axiom-verifier.js";

export class BroccoliApprovalPolicyEngine {
  private readonly RISK_ORDER: Record<RepairRiskLevel, number> = { low: 0, medium: 1, high: 2 };
  readonly axiomVerifier = new BroccoliAxiomVerifier();

  /**
   * Returns required policy level for an estimated risk.
   */
  public requiredPolicyForRisk(risk: RepairRiskLevel): ApprovalPolicy[] {
    if (risk === "high") {
      return ["human_approval_required", "production_locked"];
    }
    if (risk === "medium") {
      return ["ci_gate_only", "human_approval_required"];
    }
    return ["autonomous_safe"];
  }

  /**
   * Evaluates if a mutation plan is allowed under a target approval policy.
   */
  public evaluate(
    plan: { estimatedRisk: RepairRiskLevel; requiredApprovals: string[]; requiredVerificationCommands: string[] },
    policy: ApprovalPolicy,
    approvedBy?: string
  ): PolicyDecision {
    const reasons: string[] = [];
    const requiredApprovals = [...plan.requiredApprovals];

    switch (policy) {
      case "readonly":
        return {
          allowed: false,
          policy,
          reasons: ["readonly policy forbids all file mutations"],
          requiredApprovals,
        };

      case "production_locked":
        return {
          allowed: false,
          policy,
          reasons: ["production_locked policy forbids autonomous mutations"],
          requiredApprovals,
        };

      case "human_approval_required":
        if (!approvedBy) {
          return {
            allowed: false,
            policy,
            reasons: ["human approval required before executing mutations"],
            requiredApprovals: ["human_approval_required", ...requiredApprovals],
          };
        }
        break;

      case "ci_gate_only":
        if (!plan.requiredVerificationCommands.some((c) => c.includes("gate") || c.includes("check"))) {
          reasons.push("ci_gate_only requires gate verification commands in plan");
        }
        break;

      case "autonomous_safe":
        if (this.RISK_ORDER[plan.estimatedRisk] > this.RISK_ORDER.low) {
          reasons.push(`autonomous_safe forbids '${plan.estimatedRisk}' risk mutations without approval`);
        }
        break;
    }

    const allowed = reasons.length === 0;
    return {
      allowed,
      policy,
      reasons,
      requiredApprovals,
    };
  }

  /**
   * Asserts that a mutation plan is allowed, throwing PolicyBlockedError if blocked.
   */
  public assertAllowed(
    plan: { estimatedRisk: RepairRiskLevel; requiredApprovals: string[]; requiredVerificationCommands: string[] },
    policy: ApprovalPolicy,
    approvedBy?: string
  ): PolicyDecision {
    const decision = this.evaluate(plan, policy, approvedBy);
    if (!decision.allowed) {
      throw new PolicyBlockedError(`Mutation plan blocked by policy '${policy}': ${decision.reasons.join("; ")}`, decision);
    }
    return decision;
  }
}
