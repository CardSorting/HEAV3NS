/**
 * heredoc-terminal-tool-suite.ts
 *
 * Model tool definitions exposing Conservative Heredoc Sanitization, Script Synthesis,
 * Command Safety Analysis, and Failure Diagnostics to agents and CLI (Phase 110 / ADR-086 / Target #43).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { HeredocTerminalSupervisor } from "../../../agents/extensions/heredoc_terminal/heredoc-terminal-supervisor.js";

export class HeredocTerminalToolSuite {
  private readonly supervisor: HeredocTerminalSupervisor;

  constructor(supervisor: HeredocTerminalSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "terminal_sanitize_heredoc",
        description:
          "Masks inert heredoc bodies in a shell command with equivalent newlines while keeping real shell operators visible to security scanners.",
        parameters: {
          command: {
            type: "string",
            description: "The raw shell command string to sanitize and mask.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const command = typeof args.command === "string" ? args.command : "";
          const { sanitization, safety } = this.supervisor.preProcessCommand(command);
          return {
            success: true,
            sanitizedCommand: sanitization.sanitizedCommand,
            maskedBodiesCount: sanitization.maskedBodiesCount,
            hasHeredocs: sanitization.hasHeredocs,
            hadAmbiguity: sanitization.hadAmbiguity,
            riskLevel: safety.riskLevel,
            isSafe: safety.isSafe,
          };
        },
      },
      {
        name: "terminal_synthesize_heredoc",
        description:
          "Synthesizes a safe, canonical quoted heredoc wrapper command to execute multi-line scripts (Python, Node, Bash, OsaScript) cleanly without quoting errors.",
        parameters: {
          script: {
            type: "string",
            description: "The multi-line script content to wrap.",
            required: true,
          },
          interpreter: {
            type: "string",
            description: "Target script interpreter runtime (python, node, osascript, bash, sh, ruby).",
            required: false,
          },
          delimiter: {
            type: "string",
            description: "Optional heredoc delimiter tag (default: EOF).",
            required: false,
          },
          environment_vars: {
            type: "string",
            description: "Optional key-value environment variables as JSON string.",
            required: false,
          },
          extra_args: {
            type: "string",
            description: "Optional space-separated extra command-line flags or arguments.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const script = typeof args.script === "string" ? args.script : "";
          const interpreter = typeof args.interpreter === "string" ? (args.interpreter as any) : undefined;
          const delimiter = typeof args.delimiter === "string" ? args.delimiter : undefined;
          const environmentVars =
            typeof args.environment_vars === "object" && args.environment_vars !== null
              ? (args.environment_vars as Record<string, string>)
              : undefined;
          const extraArgs = Array.isArray(args.extra_args) ? (args.extra_args as string[]) : undefined;

          const result = this.supervisor.synthesizeScript(script, {
            interpreter,
            delimiter,
            environmentVars,
            extraArgs,
          });
          return {
            success: true,
            synthesizedCommandLine: result.synthesizedCommandLine,
            interpreter: result.interpreter,
            delimiter: result.delimiter,
            totalLines: result.totalLines,
          };
        },
      },
      {
        name: "terminal_analyze_command_safety",
        description:
          "Evaluates the safety and risk level of a shell command, detecting background operators, compound pipelines, and dangerous patterns.",
        parameters: {
          command: {
            type: "string",
            description: "The command string to evaluate.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const command = typeof args.command === "string" ? args.command : "";
          const { safety } = this.supervisor.preProcessCommand(command);
          return {
            success: true,
            isSafe: safety.isSafe,
            riskLevel: safety.riskLevel,
            hasBackgroundOperator: safety.hasBackgroundOperator,
            isCompound: safety.isCompound,
            interpreter: safety.interpreter,
            reason: safety.reason,
            suggestedSanitization: safety.suggestedSanitization,
          };
        },
      },
      {
        name: "terminal_diagnose_command_failure",
        description:
          "Analyzes command exit code, stdout, and stderr to diagnose the root cause and generate actionable corrective terminal hints.",
        parameters: {
          exit_code: {
            type: "number",
            description: "The process exit code.",
            required: true,
          },
          stdout: {
            type: "string",
            description: "Standard output captured from the execution.",
            required: true,
          },
          stderr: {
            type: "string",
            description: "Standard error output captured from the execution.",
            required: true,
          },
          execution_time_ms: {
            type: "number",
            description: "Optional command execution time in milliseconds.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const exitCode = typeof args.exit_code === "number" ? args.exit_code : 1;
          const stdout = typeof args.stdout === "string" ? args.stdout : "";
          const stderr = typeof args.stderr === "string" ? args.stderr : "";
          const executionTimeMs = typeof args.execution_time_ms === "number" ? args.execution_time_ms : undefined;

          const diagnostics = this.supervisor.postProcessExecution(exitCode, stdout, stderr, executionTimeMs);
          return {
            success: true,
            isRecoverable: diagnostics.isRecoverable,
            rootCauseSummary: diagnostics.rootCauseSummary,
            primaryHint: diagnostics.primaryHint,
            allHints: diagnostics.allHints,
          };
        },
      },
      {
        name: "terminal_inspect_heredoc_metrics",
        description: "Retrieves telemetry metrics and recent logs for heredoc sanitization and failure diagnostics.",
        parameters: {
          limit: {
            type: "number",
            description: "Number of recent records to retrieve (default: 20).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const limit = typeof args.limit === "number" ? args.limit : 20;
          return {
            success: true,
            metrics: this.supervisor.getMetrics(),
            recentLogs: this.supervisor.getRecentLogs(limit),
            recentDiagnostics: this.supervisor.getRecentDiagnostics(limit),
          };
        },
      },
    ];
  }
}
