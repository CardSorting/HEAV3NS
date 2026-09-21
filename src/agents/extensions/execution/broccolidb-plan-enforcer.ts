/**
 * [LAYER: AGENTS EXTENSION]
 * Pass 161: Zero-Dependency Broccoli Plan Mode Enforcer
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/PlanModeEnforcer.ts.
 * Enforces strategic architectural drafting workflows, validating scratchpad templates,
 * Triad Audits (Architect, Critic, SRE), and sovereign bypass markers. Zero external npm dependencies.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { BroccoliIntegrityProtocol } from "../../../tooling/extensions/permissions/broccolidb-integrity-protocol.js";
import { BroccoliStabilityForensics } from "../../../tooling/extensions/permissions/broccolidb-stability-forensics.js";
import { BroccoliSimulationEngine } from "../../../tooling/extensions/permissions/broccolidb-simulation-engine.js";

export interface PlanReviewResult {
  allowed: boolean;
  reason?: string;
  isSovereignBypass: boolean;
  hasTriadAudit: boolean;
}

export class BroccoliPlanModeEnforcer {
  private readonly scratchpadPath: string;
  readonly integrityProtocol = new BroccoliIntegrityProtocol();
  readonly forensics: BroccoliStabilityForensics;
  readonly simulation: BroccoliSimulationEngine;

  constructor(workspaceRoot: string = process.cwd()) {
    this.scratchpadPath = path.resolve(workspaceRoot, "scratchpad.md");
    this.forensics = new BroccoliStabilityForensics(workspaceRoot);
    this.simulation = new BroccoliSimulationEngine(workspaceRoot);
  }

  /**
   * Reads scratchpad file content safely.
   */
  private async readScratchpad(): Promise<string | null> {
    try {
      return await fs.readFile(this.scratchpadPath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Evaluates strategic review compliance before entering plan mode execution.
   */
  public async enforceStrategicReview(): Promise<PlanReviewResult> {
    const content = await this.readScratchpad();
    const isSovereignBypass = Boolean(content?.includes("#SOVEREIGN_MODE") || content?.includes("#BYPASS"));

    if (isSovereignBypass) {
      return {
        allowed: true,
        isSovereignBypass: true,
        hasTriadAudit: false,
      };
    }

    const hasArchitect = Boolean(content?.includes("The Architect"));
    const hasCritic = Boolean(content?.includes("The Critic"));
    const hasSRE = Boolean(content?.includes("The SRE"));
    const hasTriadAudit = hasArchitect && hasCritic && hasSRE;

    if (!content || content.trim().length === 0) {
      return {
        allowed: true,
        reason:
          "📍 [STRATEGIC ADVISORY]: Plan Mode active. Consider populating `scratchpad.md` with an Architectural Triad Audit.",
        isSovereignBypass: false,
        hasTriadAudit: false,
      };
    }

    return {
      allowed: true,
      isSovereignBypass: false,
      hasTriadAudit,
    };
  }
}
