/**
 * terminal-cleaner-tool-suite.ts
 *
 * Model tool definitions exposing Terminal ANSI Cleaning, Display Sanitization
 * & Binary Asset Classification (Phase 136 / ADR-112 / Target #69).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { TerminalCleanerSupervisor } from "../../../agents/extensions/terminal_cleaner/terminal-cleaner-supervisor.js";

export class TerminalCleanerToolSuite {
  private readonly supervisor: TerminalCleanerSupervisor;

  constructor(supervisor: TerminalCleanerSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "terminal_cleaner_strip_ansi",
        description: "Removes all ANSI and ECMA-48 escape sequences from a command output or string.",
        parameters: {
          text: {
            type: "string",
            description: "Text containing ANSI escape sequences to strip.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const text = String(args.text || "");
          const cleaned = this.supervisor.stripAnsi(text);
          return {
            success: true,
            originalLength: text.length,
            cleanedLength: cleaned.length,
            cleaned,
          };
        },
      },
      {
        name: "terminal_cleaner_sanitize_display",
        description: "Sanitizes text for safe terminal display, removing escape codes, control characters, and normalizing carriage returns.",
        parameters: {
          text: {
            type: "string",
            description: "Text to sanitize for terminal display.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const text = String(args.text || "");
          const cleaned = this.supervisor.sanitizeDisplayText(text);
          return {
            success: true,
            originalLength: text.length,
            cleanedLength: cleaned.length,
            cleaned,
          };
        },
      },
      {
        name: "terminal_cleaner_classify_path",
        description: "Classifies a file path as text, binary, opaque document (.docx/.xlsx), or pdf.",
        parameters: {
          filePath: {
            type: "string",
            description: "File path to inspect and classify.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const filePath = String(args.filePath || "");
          const classification = this.supervisor.classifyPath(filePath);
          const writeCheck = this.supervisor.canWriteAsText(filePath);

          return {
            success: true,
            filePath,
            classification,
            canWriteAsText: writeCheck.allowed,
            reason: writeCheck.reason,
          };
        },
      },
      {
        name: "terminal_cleaner_configure",
        description: "Configures terminal cleaning policies, escape stripping, and opaque document protection.",
        parameters: {
          enabled: {
            type: "boolean",
            description: "Whether the terminal cleaner is enabled.",
            required: false,
          },
          stripAnsiSequences: {
            type: "boolean",
            description: "Whether to strip ANSI sequences from output.",
            required: false,
          },
          guardOpaqueDocuments: {
            type: "boolean",
            description: "Whether to block plain-text writes to opaque container documents.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const enabled = typeof args.enabled === "boolean" ? args.enabled : undefined;
          const stripAnsiSequences =
            typeof args.stripAnsiSequences === "boolean" ? args.stripAnsiSequences : undefined;
          const guardOpaqueDocuments =
            typeof args.guardOpaqueDocuments === "boolean" ? args.guardOpaqueDocuments : undefined;

          this.supervisor.configure({
            enabled,
            stripAnsiSequences,
            guardOpaqueDocuments,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "terminal_cleaner_get_metrics",
        description: "Retrieves operational metrics for terminal output cleaning and binary protection.",
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
