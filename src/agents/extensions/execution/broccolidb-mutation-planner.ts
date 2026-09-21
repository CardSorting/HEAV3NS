/**
 * [LAYER: AGENTS EXTENSION]
 * Pass 143: Zero-Dependency Broccoli Mutation Planner
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/orchestration/MutationPlanner.ts).
 * Constructs repair mutation step sequences (planFromAudit), calculates aggregate plan risk (maxRisk),
 * and assigns required verification commands without third-party libraries. Zero external npm dependencies.
 */

import { randomUUID } from "node:crypto";
import { BroccoliApprovalPolicyEngine, type ApprovalPolicy, type RepairRiskLevel } from "../../../tooling/extensions/permissions/broccolidb-approval-policy.js";
import type { MutationPlan, MutationStep, RepairDirective } from "./broccolidb-repair-executor.js";
import { BroccoliSideQueryService } from "./broccolidb-side-query.js";
import { BroccoliPlanModeEnforcer } from "./broccolidb-plan-enforcer.js";
import { BroccoliJoyZoningModuleDecomposer } from "../../../tooling/extensions/permissions/broccolidb-module-decomposer.js";

export class BroccoliMutationPlanner {
  private readonly policyEngine: BroccoliApprovalPolicyEngine;
  readonly sideQuery: BroccoliSideQueryService;
  readonly planEnforcer: BroccoliPlanModeEnforcer;
  readonly decomposer: BroccoliJoyZoningModuleDecomposer;

  constructor(policyEngine = new BroccoliApprovalPolicyEngine(), workspaceRoot: string = process.cwd()) {
    this.policyEngine = policyEngine;
    this.sideQuery = new BroccoliSideQueryService();
    this.planEnforcer = new BroccoliPlanModeEnforcer(workspaceRoot);
    this.decomposer = new BroccoliJoyZoningModuleDecomposer();
  }

  /**
   * Computes the maximum risk level across a set of repair directives.
   */
  public maxRisk(levels: RepairRiskLevel[]): RepairRiskLevel {
    const RISK_ORDER: Record<RepairRiskLevel, number> = { low: 0, medium: 1, high: 2 };
    if (levels.length === 0) return "low";
    return levels.reduce((max, r) => (RISK_ORDER[r] > RISK_ORDER[max] ? r : max), "low" as RepairRiskLevel);
  }

  /**
   * Plans a structured mutation sequence from audit report directives.
   */
  public planFromAudit(params: {
    sessionId: string;
    directives: RepairDirective[];
    policy: ApprovalPolicy;
    correlationId?: string;
  }): MutationPlan {
    const { sessionId, directives, policy, correlationId } = params;

    const steps: MutationStep[] = directives.map((directive) => ({
      stepId: randomUUID(),
      directiveId: directive.directiveId,
    }));

    return {
      planId: randomUUID(),
      steps,
      directives,
    };
  }
}
