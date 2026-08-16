/**
 * self-repo-guard-tool-suite.ts
 *
 * Model tool definitions exposing Self-Repository Mutation Guard & Shell Inspection
 * (Phase 138 / ADR-114 / Target #71).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { SelfRepoGuardSupervisor } from "../../../agents/extensions/self_repo_guard/self-repo-guard-supervisor.js";

export class SelfRepoGuardToolSuite {
  private readonly supervisor: SelfRepoGuardSupervisor;

  constructor(supervisor: SelfRepoGuardSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "self_repo_guard_inspect_command",
        description: "Inspects a shell command string to verify it will not destructively mutate the running agent source checkout.",
        parameters: {
          command: {
            type: "string",
            description: "Shell command string to inspect.",
            required: true,
          },
          cwd: {
            type: "string",
            description: "Current working directory where the command will be executed.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const command = String(args.command || "");
          const cwd = typeof args.cwd === "string" ? args.cwd : undefined;
          const verdict = this.supervisor.inspectShellCommand(command, cwd);

          return {
            success: true,
            allowed: verdict.allowed,
            operation: verdict.operation,
            targetPath: verdict.targetPath,
            runningRoot: verdict.runningRoot,
            reason: verdict.reason,
            suggestedRemediation: verdict.suggestedRemediation,
          };
        },
      },
      {
        name: "self_repo_guard_get_running_root",
        description: "Returns the detected running source checkout root and repository status.",
        parameters: {},
        execute: async () => {
          const runningRoot = this.supervisor.getRunningSourceRoot();
          const config = this.supervisor.getConfig();

          return {
            success: true,
            runningSourceRoot: runningRoot,
            protectionEnabled: config.enabled,
          };
        },
      },
      {
        name: "self_repo_guard_classify_git_operation",
        description: "Classifies a Git subcommand and argument array as safe vs destructive.",
        parameters: {
          subcommand: {
            type: "string",
            description: "Git subcommand (e.g. checkout, status, reset).",
            required: true,
          },
          args: {
            type: "string",
            description: "JSON array or space-separated list of arguments.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const subcommand = String(args.subcommand || "");
          let argList: string[] = [];
          if (Array.isArray(args.args)) {
            argList = args.args.map((a) => String(a));
          } else if (typeof args.args === "string") {
            try {
              const parsed = JSON.parse(args.args);
              if (Array.isArray(parsed)) {
                argList = parsed.map((a) => String(a));
              } else {
                argList = args.args.split(/\s+/).filter(Boolean);
              }
            } catch {
              argList = args.args.split(/\s+/).filter(Boolean);
            }
          }

          const safety = this.supervisor.classifyGitOperation(subcommand, argList);

          return {
            success: true,
            subcommand,
            args: argList,
            safety,
            isDestructive: safety === "destructive_worktree",
          };
        },
      },
      {
        name: "self_repo_guard_configure",
        description: "Configures active self-repository protection policies and running root overrides.",
        parameters: {
          enabled: {
            type: "boolean",
            description: "Whether the self-repo guard is enabled.",
            required: false,
          },
          runningSourceRoot: {
            type: "string",
            description: "Explicit override for the running source checkout root.",
            required: false,
          },
          allowWorktreeSandboxes: {
            type: "boolean",
            description: "Whether to allow external worktree sandbox creation.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const enabled = typeof args.enabled === "boolean" ? args.enabled : undefined;
          const runningSourceRoot =
            typeof args.runningSourceRoot === "string" ? args.runningSourceRoot : undefined;
          const allowWorktreeSandboxes =
            typeof args.allowWorktreeSandboxes === "boolean"
              ? args.allowWorktreeSandboxes
              : undefined;

          this.supervisor.configure({
            enabled,
            runningSourceRoot,
            allowWorktreeSandboxes,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "self_repo_guard_get_metrics",
        description: "Retrieves operational metrics and incident records for self-repo protection.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          const incidents = this.supervisor.getIncidents();

          return {
            success: true,
            metrics,
            recentIncidentCount: incidents.length,
            recentIncidents: incidents.slice(-10),
          };
        },
      },
    ];
  }
}
