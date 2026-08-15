/**
 * file-mutation-tool-suite.ts
 *
 * Model tool suite exposing transactional patch application and atomic file operations:
 * - `patch_apply`: Applies unified diffs or V4A format patches.
 * - `file_view_paginated`: Views files with line number slicing and binary detection.
 * - `file_replace_content`: Replaces contiguous text with fuzzy tolerance.
 * - `file_multi_replace`: Replaces multiple non-contiguous chunks atomically.
 * - `file_write_atomic`: Writes complete file contents with directory auto-creation.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { AtomicMutationSupervisor } from "../../../agents/extensions/patch/atomic-mutation-supervisor.js";

export class FileMutationToolSuite {
  private readonly supervisor: AtomicMutationSupervisor;

  constructor(supervisor: AtomicMutationSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "patch_apply",
        description: "Applies a unified diff or V4A format patch across one or more files with transactional rollback on failure.",
        parameters: {
          patch: {
            type: "string",
            required: true,
            description: "The complete patch text (Unified Diff or V4A format).",
          },
          dryRun: {
            type: "boolean",
            required: false,
            description: "If true, simulates patch application without mutating disk files.",
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const patchText = String(args.patch || "");
          const dryRun = Boolean(args.dryRun);

          const res = await this.supervisor.applyPatch(patchText, { dryRun, cwd });
          return {
            success: res.success,
            modifiedFiles: res.modifiedFiles,
            errors: res.errors,
            dryRun: res.dryRun,
          };
        },
      },
      {
        name: "file_view_paginated",
        description: "Views a text or code file with optional line-range pagination and automatic binary file detection.",
        parameters: {
          filePath: {
            type: "string",
            required: true,
            description: "Relative or absolute path to the file to view.",
          },
          startLine: {
            type: "number",
            required: false,
            description: "1-indexed start line number (default 1).",
          },
          endLine: {
            type: "number",
            required: false,
            description: "1-indexed end line number (default startLine + 800).",
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const filePath = String(args.filePath || "").trim();
          const startLine = typeof args.startLine === "number" ? args.startLine : undefined;
          const endLine = typeof args.endLine === "number" ? args.endLine : undefined;

          try {
            const res = this.supervisor.readPaginated({ filePath, startLine, endLine }, cwd);
            return {
              success: true,
              filePath: res.filePath,
              content: res.content,
              totalLines: res.totalLines,
              startLine: res.startLine,
              endLine: res.endLine,
              truncated: res.truncated,
              isBinary: res.isBinary,
            };
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, error: msg };
          }
        },
      },
      {
        name: "file_replace_content",
        description: "Replaces a single contiguous block of code or text within a file with fuzzy matching tolerance.",
        parameters: {
          filePath: {
            type: "string",
            required: true,
            description: "Path to the file to edit.",
          },
          targetContent: {
            type: "string",
            required: true,
            description: "The exact string or lines to replace.",
          },
          replacementContent: {
            type: "string",
            required: true,
            description: "The new replacement content.",
          },
          startLine: {
            type: "number",
            required: false,
            description: "Optional start line hint.",
          },
          endLine: {
            type: "number",
            required: false,
            description: "Optional end line hint.",
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const filePath = String(args.filePath || "").trim();
          const targetContent = String(args.targetContent || "");
          const replacementContent = String(args.replacementContent || "");
          const startLine = typeof args.startLine === "number" ? args.startLine : undefined;
          const endLine = typeof args.endLine === "number" ? args.endLine : undefined;

          try {
            const readRes = this.supervisor.readPaginated({ filePath }, cwd);
            const engine = this.supervisor.getPatchEngine();
            const repRes = engine.replaceContiguous(readRes.content, targetContent, replacementContent, {
              startLine,
              endLine,
            });

            if (!repRes.success || repRes.newContent === undefined) {
              return { success: false, error: repRes.error };
            }

            this.supervisor.writeAtomic(filePath, repRes.newContent, true, cwd);
            return {
              success: true,
              filePath,
              replacementsMade: repRes.replacementsMade,
            };
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, error: msg };
          }
        },
      },
      {
        name: "file_write_atomic",
        description: "Atomically creates or overwrites a file with parent directory auto-creation and substrate backup staging.",
        parameters: {
          filePath: {
            type: "string",
            required: true,
            description: "Target file path.",
          },
          content: {
            type: "string",
            required: true,
            description: "Full text content to write.",
          },
          overwrite: {
            type: "boolean",
            required: false,
            description: "Whether to overwrite existing files (default true).",
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const filePath = String(args.filePath || "").trim();
          const content = String(args.content || "");
          const overwrite = args.overwrite !== undefined ? Boolean(args.overwrite) : true;

          try {
            const res = this.supervisor.writeAtomic(filePath, content, overwrite, cwd);
            return {
              success: true,
              filePath,
              bytesWritten: res.bytesWritten,
            };
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, error: msg };
          }
        },
      },
    ];
  }
}
