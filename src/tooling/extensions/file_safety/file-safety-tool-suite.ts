/**
 * file-safety-tool-suite.ts
 *
 * Model tool definitions exposing File Safety Mutation Guards & Sensitive Path Firewall to agents
 * (Phase 126 / ADR-102 / Target #59).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { FileSafetySupervisor } from "../../../agents/extensions/file_safety/file-safety-supervisor.js";

export class FileSafetyToolSuite {
  private readonly supervisor: FileSafetySupervisor;

  constructor(supervisor: FileSafetySupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "file_safety_check_write",
        description:
          "Pre-flight evaluates if a target file path is safe to write, hard-denied, or requires approval.",
        parameters: {
          path: {
            type: "string",
            description: "Target file or directory path for write mutation.",
            required: true,
          },
          cwd: {
            type: "string",
            description: "Current working directory context.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const path = typeof args.path === "string" ? args.path : "";
          const cwd = typeof args.cwd === "string" ? args.cwd : process.cwd();

          const evalResult = this.supervisor.checkWrite(path, cwd);
          return {
            success: true,
            allowed: evalResult.allowed,
            verdict: evalResult.verdict,
            path: evalResult.path,
            normalizedPath: evalResult.normalizedPath,
            reason: evalResult.reason,
            isSensitive: evalResult.isSensitive,
          };
        },
      },
      {
        name: "file_safety_check_read",
        description:
          "Evaluates if a target read path accesses sensitive credential stores or secret files.",
        parameters: {
          path: {
            type: "string",
            description: "Target file or directory path for read access.",
            required: true,
          },
          cwd: {
            type: "string",
            description: "Current working directory context.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const path = typeof args.path === "string" ? args.path : "";
          const cwd = typeof args.cwd === "string" ? args.cwd : process.cwd();

          const evalResult = this.supervisor.checkRead(path, cwd);
          return {
            success: true,
            allowed: evalResult.allowed,
            verdict: evalResult.verdict,
            path: evalResult.path,
            normalizedPath: evalResult.normalizedPath,
            isSensitive: evalResult.isSensitive,
            reason: evalResult.reason,
          };
        },
      },
      {
        name: "file_safety_add_safe_root",
        description:
          "Dynamically registers an authorized root directory for write operations.",
        parameters: {
          rootPath: {
            type: "string",
            description: "Absolute or relative path to register as an authorized safe write root.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const rootPath = typeof args.rootPath === "string" ? args.rootPath : "";
          if (!rootPath) {
            return { success: false, error: "rootPath parameter is required" };
          }

          this.supervisor.addSafeRoot(rootPath);
          return {
            success: true,
            message: `Added safe write root: ${rootPath}`,
            safeRoots: this.supervisor.getConfig().safeRoots,
          };
        },
      },
      {
        name: "file_safety_inspect_rules",
        description:
          "Lists active file safety policy configuration, custom rules, and registered safe roots.",
        parameters: {},
        execute: async () => {
          const config = this.supervisor.getConfig();
          return {
            success: true,
            config,
          };
        },
      },
      {
        name: "file_safety_get_metrics",
        description:
          "Retrieves aggregate statistics on safety evaluations, write permits, and policy denials.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          return {
            success: true,
            metrics,
          };
        },
      },
    ];
  }
}
