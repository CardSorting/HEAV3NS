/**
 * v4a-patch-tool-suite.ts
 *
 * Model tool definitions exposing V4A Multi-File Patch Parser & Working Diff to agents
 * (Phase 119 / ADR-095 / Target #52).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { V4aPatchSupervisor } from "../../../agents/extensions/v4a_patch/v4a-patch-supervisor.js";
import type { WorkingDiffMode } from "../../../core/contracts/v4a-patch.contracts.js";

export class V4aPatchToolSuite {
  private readonly supervisor: V4aPatchSupervisor;
  private readonly vfsStorage = new Map<string, string>();

  constructor(supervisor: V4aPatchSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "v4a_apply_patch",
        description:
          "Parses and atomically applies a multi-file V4A patch block across the workspace.",
        parameters: {
          patch: {
            type: "string",
            description: "The complete multi-file patch in V4A format (*** Begin Patch ... *** End Patch).",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const patch = typeof args.patch === "string" ? args.patch : "";
          if (!patch) {
            return { success: false, error: "patch is required" };
          }

          const reader = (p: string) => this.vfsStorage.get(p) ?? null;
          const writer = (p: string, c: string | null) => {
            if (c === null) {
              this.vfsStorage.delete(p);
            } else {
              this.vfsStorage.set(p, c);
            }
          };

          const result = this.supervisor.applyPatch(patch, reader, writer);
          return {
            success: result.success,
            appliedOperations: result.appliedOperations,
            modifiedFiles: result.modifiedFiles,
            error: result.error,
          };
        },
      },
      {
        name: "v4a_parse_patch_manifest",
        description:
          "Parses and inspects the operations and hunks in a V4A patch without applying it.",
        parameters: {
          patch: {
            type: "string",
            description: "The V4A patch string to validate and inspect.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const patch = typeof args.patch === "string" ? args.patch : "";
          if (!patch) {
            return { success: false, error: "patch is required" };
          }

          const result = this.supervisor.parsePatch(patch);
          return {
            success: result.success,
            operationsCount: result.operations.length,
            operations: result.operations,
            error: result.error,
          };
        },
      },
      {
        name: "v4a_collect_working_diff",
        description:
          "Collects git working tree diffs (working, staged, all) with synthesized untracked files.",
        parameters: {
          mode: {
            type: "string",
            description: "Diff mode: 'working' (unstaged + untracked), 'staged' (cached), or 'all' (HEAD -> worktree).",
            required: false,
          },
          cwd: {
            type: "string",
            description: "Optional working directory path (defaults to process.cwd()).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const mode: WorkingDiffMode =
            args.mode === "staged" || args.mode === "all" ? args.mode : "working";
          const cwd = typeof args.cwd === "string" ? args.cwd : process.cwd();

          const result = await this.supervisor.collectWorkingDiff(cwd, mode);
          return {
            success: result.success,
            mode: result.mode,
            stat: result.stat,
            diff: result.diff,
            untracked: result.untracked,
            empty: result.empty,
            error: result.error,
          };
        },
      },
      {
        name: "v4a_inspect_patch_history",
        description:
          "Inspects recently applied V4A patch transactions in the current session.",
        parameters: {},
        execute: async () => {
          const history = this.supervisor.getPatchHistory();
          return {
            success: true,
            totalApplied: history.length,
            history: history.slice(-50),
          };
        },
      },
      {
        name: "v4a_get_engine_metrics",
        description:
          "Retrieves aggregate V4A patch parser and applicator performance metrics.",
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
