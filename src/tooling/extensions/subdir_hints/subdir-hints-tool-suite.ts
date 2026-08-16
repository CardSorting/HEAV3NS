/**
 * subdir-hints-tool-suite.ts
 *
 * Model tool definitions exposing Progressive Subdirectory Context Discovery & Dynamic Hints
 * (Phase 129 / ADR-105 / Target #62).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { SubdirHintsSupervisor } from "../../../agents/extensions/subdir_hints/subdir-hints-supervisor.js";

export class SubdirHintsToolSuite {
  private readonly supervisor: SubdirHintsSupervisor;

  constructor(supervisor: SubdirHintsSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "subdir_hints_check_tool",
        description:
          "Evaluates tool arguments (file paths, terminal commands) and progressively discovers new subdirectory instruction files.",
        parameters: {
          toolName: {
            type: "string",
            description: "Name of the tool being invoked (e.g. 'read_file', 'terminal').",
            required: true,
          },
          path: {
            type: "string",
            description: "Optional file path argument accessed by the tool.",
            required: false,
          },
          command: {
            type: "string",
            description: "Optional shell command string executed by the tool.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const toolName = String(args.toolName || "read_file").trim();
          const pathVal = typeof args.path === "string" ? args.path : undefined;
          const command = typeof args.command === "string" ? args.command : undefined;

          const toolArgs: Record<string, unknown> = {};
          if (pathVal) toolArgs.path = pathVal;
          if (command) toolArgs.command = command;

          const result = await this.supervisor.checkToolCall(toolName, toolArgs);

          return {
            success: true,
            result,
          };
        },
      },
      {
        name: "subdir_hints_register_virtual",
        description: "Registers an in-memory virtual guideline/hint file for a specific directory.",
        parameters: {
          directoryPath: {
            type: "string",
            description: "Directory path where the hint file is located.",
            required: true,
          },
          filename: {
            type: "string",
            description: "Filename (e.g. 'AGENTS.md', 'CLAUDE.md').",
            required: true,
          },
          content: {
            type: "string",
            description: "Markdown guideline content of the hint file.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const directoryPath = String(args.directoryPath || "").trim();
          const filename = String(args.filename || "AGENTS.md").trim();
          const content = String(args.content || "").trim();

          if (!directoryPath || !content) {
            return {
              success: false,
              error: "directoryPath and content are required",
            };
          }

          this.supervisor.registerVirtualHint(directoryPath, filename, content);

          return {
            success: true,
            message: `Virtual hint '${filename}' registered for '${directoryPath}'`,
          };
        },
      },
      {
        name: "subdir_hints_list_discovered",
        description: "Lists all discovered subdirectory context hints and their cryptographic digests.",
        parameters: {},
        execute: async () => {
          const hints = this.supervisor.getDiscoveredHints();
          return {
            success: true,
            count: hints.length,
            hints,
          };
        },
      },
      {
        name: "subdir_hints_configure",
        description: "Configures search parameters, ancestor walk limits, and excluded directories.",
        parameters: {
          maxHintChars: {
            type: "number",
            description: "Maximum characters per hint file.",
            required: false,
          },
          maxAncestorWalk: {
            type: "number",
            description: "Maximum levels to walk up parent directories.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const maxHintChars = typeof args.maxHintChars === "number" ? args.maxHintChars : undefined;
          const maxAncestorWalk = typeof args.maxAncestorWalk === "number" ? args.maxAncestorWalk : undefined;

          this.supervisor.configure({
            maxHintChars,
            maxAncestorWalk,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "subdir_hints_get_metrics",
        description: "Retrieves aggregate statistics on hint checks, discoveries, and injected bytes.",
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
