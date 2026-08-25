import * as path from "node:path";
import type { ExecutionAuthorityLevel, ToolDefinition } from "../../../core/contracts/tooling.contracts.js";

export type ToolRiskTier = "SAFE" | "MUTATING" | "CRITICAL";

export interface ToolSafetyAssessment {
  readonly toolName: string;
  readonly riskTier: ToolRiskTier;
  readonly riskScore: number; // 0 to 100
  readonly requiresConfirmation: boolean;
  readonly warnings: readonly string[];
  readonly allowedInDryRun: boolean;
  readonly authorityLevel?: ExecutionAuthorityLevel;
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
   * Extracts affected target resource keys/paths (e.g. file paths, keys) for conflict analysis.
   */
  public extractResourceTargets(
    toolName: string,
    args: Record<string, unknown>,
    cwd: string
  ): string[] {
    const canonicalName = toolName.toLowerCase();
    const resources: string[] = [];

    const pathCandidate =
      typeof args.path === "string"
        ? args.path
        : typeof args.filePath === "string"
          ? args.filePath
          : typeof args.targetFile === "string"
            ? args.targetFile
            : typeof args.targetPath === "string"
              ? args.targetPath
              : undefined;

    if (pathCandidate) {
      const resolved = path.isAbsolute(pathCandidate)
        ? path.normalize(pathCandidate)
        : path.normalize(path.join(cwd, pathCandidate));
      resources.push(resolved);
    }

    if (typeof args.source === "string") {
      const resolvedSource = path.isAbsolute(args.source)
        ? path.normalize(args.source)
        : path.normalize(path.join(cwd, args.source));
      resources.push(resolvedSource);
    }

    if (typeof args.target === "string") {
      const resolvedTarget = path.isAbsolute(args.target)
        ? path.normalize(args.target)
        : path.normalize(path.join(cwd, args.target));
      resources.push(resolvedTarget);
    }

    if (Array.isArray(args.files)) {
      for (const item of args.files) {
        if (typeof item === "string") {
          resources.push(path.isAbsolute(item) ? path.normalize(item) : path.normalize(path.join(cwd, item)));
        } else if (item && typeof item === "object" && typeof (item as any).path === "string") {
          const p = (item as any).path;
          resources.push(path.isAbsolute(p) ? path.normalize(p) : path.normalize(path.join(cwd, p)));
        }
      }
    }

    if (resources.length === 0) {
      // Non-file resources or global namespace
      if (canonicalName.includes("db_") || canonicalName.includes("database")) {
        resources.push(`db:${String(args.table || args.collection || "global")}`);
      } else if (canonicalName.includes("wallet")) {
        resources.push(`wallet:${String(args.account || "global")}`);
      } else if (canonicalName === "run_command" || canonicalName === "terminal" || canonicalName === "bash") {
        resources.push("system:process");
      }
    }

    return resources;
  }

  /**
   * Evaluates the safety profile of a tool invocation.
   */
  public evaluateSafety(
    toolName: string,
    args: Record<string, unknown>,
    cwd: string,
    toolDef?: ToolDefinition,
    authority?: ExecutionAuthorityLevel
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

    // Determine requiresConfirmation based on authority
    let requiresConfirmation = riskTier === "CRITICAL" || toolDef?.requiresConfirmation === true;
    if (authority === "autonomous" || authority === "high_throughput") {
      requiresConfirmation = false;
    }

    return {
      toolName,
      riskTier,
      riskScore,
      requiresConfirmation,
      warnings,
      allowedInDryRun: true,
      authorityLevel: authority ?? "balanced",
    };
  }


  /**
   * Simulates a tool execution in dry-run mode without modifying disk state.
   */
  public simulateDryRun(
    toolName: string,
    args: Record<string, unknown>,
    cwd: string,
    toolDef?: ToolDefinition,
    authority: ExecutionAuthorityLevel = "autonomous"
  ): DryRunSimulationResult {
    const safety = this.evaluateSafety(toolName, args, cwd, toolDef, authority);
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

