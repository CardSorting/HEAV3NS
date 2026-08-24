/**
 * tool-safety-policy-manager.ts
 *
 * Multi-Tier Tool Safety Policy, Risk Scoring & Dry-Run Simulation Manager.
 * Evaluates tool operations for risk (SAFE, MUTATING, CRITICAL) and provides
 * dry-run simulation capabilities to preview modifications before touching disk.
 */

import * as path from "node:path";
import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";

export type ToolRiskTier = "SAFE" | "MUTATING" | "CRITICAL";

export interface ToolSafetyAssessment {
  readonly toolName: string;
  readonly riskTier: ToolRiskTier;
  readonly riskScore: number; // 0 to 100
  readonly requiresConfirmation: boolean;
  readonly warnings: readonly string[];
  readonly allowedInDryRun: boolean;
}

export interface DryRunSimulationResult {
  readonly isDryRun: true;
  readonly toolName: string;
  readonly simulatedDiff?: string;
  readonly targetPath?: string;
  readonly plannedAction: string;
  readonly safetyAssessment: ToolSafetyAssessment;
}

const CRITICAL_COMMAND_PATTERNS = [
  /rm\s+-rf\s+[\/~]/i,
  /git\s+reset\s+--hard/i,
  /git\s+clean\s+-fd/i,
  /drop\s+table/i,
  /drop\s+database/i,
  /truncate\s+table/i,
  /mkfs/i,
  /dd\s+if=/i,
  /:(){ :|:& };:/, // Fork bomb
];

const PROTECTED_SYSTEM_PATHS = [
  ".git/config",
  ".git/HEAD",
  ".env.production",
  "id_rsa",
  "id_ed25519",
  "/etc/passwd",
  "/etc/shadow",
];

export class ToolSafetyPolicyManager {
  /**
   * Evaluates the safety profile of a tool invocation.
   */
  public evaluateSafety(
    toolName: string,
    args: Record<string, unknown>,
    cwd: string,
    toolDef?: ToolDefinition
  ): ToolSafetyAssessment {
    const warnings: string[] = [];
    let riskTier: ToolRiskTier = "SAFE";
    let riskScore = 10;

    const canonicalName = toolName.toLowerCase();
    const cmd = typeof args.command === "string" ? args.command : (typeof args.cmd === "string" ? args.cmd : "");
    const targetPath = typeof args.path === "string" ? args.path : (typeof args.filePath === "string" ? args.filePath : "");

    // 1. Critical Command Checks
    if (canonicalName === "run_command" || canonicalName === "terminal" || canonicalName === "bash") {
      riskTier = "MUTATING";
      riskScore = 50;

      for (const pattern of CRITICAL_COMMAND_PATTERNS) {
        if (pattern.test(cmd)) {
          riskTier = "CRITICAL";
          riskScore = 95;
          warnings.push(`Command matches critical destructive pattern: '${pattern.source}'`);
        }
      }
    }

    // 2. Protected System Paths
    if (targetPath) {
      const normalized = path.normalize(targetPath);
      for (const prot of PROTECTED_SYSTEM_PATHS) {
        if (normalized.includes(prot)) {
          riskTier = "CRITICAL";
          riskScore = 90;
          warnings.push(`Tool targets protected system file: '${prot}'`);
        }
      }
    }

    // 3. Mutating tools classification
    if (
      toolDef?.isMutating ||
      canonicalName.includes("write") ||
      canonicalName.includes("replace") ||
      canonicalName.includes("delete") ||
      canonicalName.includes("remove")
    ) {
      if (riskTier !== "CRITICAL") {
        riskTier = "MUTATING";
        riskScore = Math.max(riskScore, 40);
      }
    }

    // 4. Critical Tool Suites
    if (canonicalName.includes("wallet_transfer") || canonicalName.includes("db_drop") || canonicalName.includes("cron_delete")) {
      riskTier = "CRITICAL";
      riskScore = 85;
      warnings.push(`High-privilege domain tool execution.`);
    }

    const requiresConfirmation = riskTier === "CRITICAL" || toolDef?.requiresConfirmation === true;

    return {
      toolName,
      riskTier,
      riskScore,
      requiresConfirmation,
      warnings,
      allowedInDryRun: true,
    };
  }

  /**
   * Simulates a tool execution in dry-run mode without modifying disk state.
   */
  public simulateDryRun(
    toolName: string,
    args: Record<string, unknown>,
    cwd: string,
    toolDef?: ToolDefinition
  ): DryRunSimulationResult {
    const safety = this.evaluateSafety(toolName, args, cwd, toolDef);
    const targetPath = typeof args.path === "string" ? args.path : (typeof args.filePath === "string" ? args.filePath : undefined);

    let simulatedDiff: string | undefined;
    let plannedAction = `Simulate ${toolName}`;

    if (toolName === "write_file") {
      plannedAction = `Write ${typeof args.content === "string" ? args.content.length : 0} characters to '${targetPath}'`;
      simulatedDiff = `+ [New File] ${targetPath}\n+ ${String(args.content || "").slice(0, 200)}...`;
    } else if (toolName === "replace_file_content") {
      plannedAction = `Replace targeted snippet in '${targetPath}'`;
      simulatedDiff = `- ${String(args.targetContent || "").slice(0, 100)}\n+ ${String(args.replacementContent || "").slice(0, 100)}`;
    } else if (toolName === "delete_file") {
      plannedAction = `Delete file at '${targetPath}'`;
      simulatedDiff = `- [Deleted File] ${targetPath}`;
    } else if (toolName === "run_command") {
      plannedAction = `Execute shell command: ${String(args.command || "")}`;
    }

    return {
      isDryRun: true,
      toolName,
      targetPath,
      simulatedDiff,
      plannedAction,
      safetyAssessment: safety,
    };
  }
}
