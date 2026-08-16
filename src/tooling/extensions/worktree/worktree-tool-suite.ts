/**
 * worktree-tool-suite.ts
 *
 * Model tool definitions exposing Git Worktree Isolation & Branch Sandboxing to agents
 * (Phase 123 / ADR-099 / Target #56).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { WorktreeSupervisor } from "../../../agents/extensions/worktree/worktree-supervisor.js";

export class WorktreeToolSuite {
  private readonly supervisor: WorktreeSupervisor;

  constructor(supervisor: WorktreeSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "worktree_create",
        description:
          "Creates a dedicated git worktree and branch for an isolated subagent workspace.",
        parameters: {
          subagentId: {
            type: "string",
            description: "Unique subagent identifier.",
            required: true,
          },
          repoRoot: {
            type: "string",
            description: "Target git repository root path.",
            required: false,
          },
          baseCommit: {
            type: "string",
            description: "Base git commit/ref to checkout from (default: 'HEAD').",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const subagentId = typeof args.subagentId === "string" ? args.subagentId : "";
          if (!subagentId) {
            return { success: false, error: "subagentId is required" };
          }
          const repoRoot = typeof args.repoRoot === "string" ? args.repoRoot : process.cwd();
          const baseCommit = typeof args.baseCommit === "string" ? args.baseCommit : "HEAD";

          try {
            const descriptor = this.supervisor.createWorktree(repoRoot, subagentId, baseCommit);
            return {
              success: true,
              id: descriptor.id,
              branch: descriptor.branch,
              path: descriptor.path,
              repoRoot: descriptor.repoRoot,
              baseCommit: descriptor.baseCommit,
              status: descriptor.status,
            };
          } catch (err: any) {
            return { success: false, error: err.message || String(err) };
          }
        },
      },
      {
        name: "worktree_inspect",
        description:
          "Inspects commit counts, dirty state, and modified files in a subagent worktree.",
        parameters: {
          idOrPath: {
            type: "string",
            description: "Worktree ID or directory path.",
            required: true,
          },
          stagedFiles: {
            type: "string",
            description: "Optional comma-separated or JSON list of staged modified files.",
            required: false,
          },
          unstagedFiles: {
            type: "string",
            description: "Optional comma-separated or JSON list of unstaged modified files.",
            required: false,
          },
          commitCount: {
            type: "number",
            description: "Optional new commits count.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const idOrPath = typeof args.idOrPath === "string" ? args.idOrPath : "";
          if (!idOrPath) {
            return { success: false, error: "idOrPath is required" };
          }
          let staged: string[] = [];
          if (Array.isArray(args.stagedFiles)) staged = args.stagedFiles as string[];
          else if (typeof args.stagedFiles === "string" && args.stagedFiles) {
            try { staged = JSON.parse(args.stagedFiles); } catch { staged = args.stagedFiles.split(",").map((s) => s.trim()); }
          }
          let unstaged: string[] = [];
          if (Array.isArray(args.unstagedFiles)) unstaged = args.unstagedFiles as string[];
          else if (typeof args.unstagedFiles === "string" && args.unstagedFiles) {
            try { unstaged = JSON.parse(args.unstagedFiles); } catch { unstaged = args.unstagedFiles.split(",").map((s) => s.trim()); }
          }
          const commits = typeof args.commitCount === "number" ? args.commitCount : 0;

          try {
            const inspected = this.supervisor.inspectWorktree(idOrPath, staged, unstaged, commits);
            return {
              success: true,
              id: inspected.id,
              branch: inspected.branch,
              path: inspected.path,
              isDirty: inspected.isDirty,
              commitCount: inspected.commitCount,
              modifiedFiles: inspected.modifiedFiles,
              status: inspected.status,
            };
          } catch (err: any) {
            return { success: false, error: err.message || String(err) };
          }
        },
      },
      {
        name: "worktree_cleanup",
        description:
          "Cleans up or prunes a subagent worktree (auto-prunes clean trees, or force cleans).",
        parameters: {
          idOrPath: {
            type: "string",
            description: "Worktree ID or directory path.",
            required: true,
          },
          force: {
            type: "boolean",
            description: "If true, forcefully removes worktree even if dirty.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const idOrPath = typeof args.idOrPath === "string" ? args.idOrPath : "";
          if (!idOrPath) {
            return { success: false, error: "idOrPath is required" };
          }
          const force = args.force === true;

          const result = this.supervisor.cleanupWorktree(idOrPath, force);
          return {
            success: result.success,
            pruned: result.pruned,
            reason: result.reason,
          };
        },
      },
      {
        name: "worktree_merge_branch",
        description:
          "Verifies and merges a subagent branch back into the parent branch.",
        parameters: {
          idOrPath: {
            type: "string",
            description: "Worktree ID or directory path.",
            required: true,
          },
          targetBranch: {
            type: "string",
            description: "Target branch to merge into (default: 'main').",
            required: false,
          },
          conflictFiles: {
            type: "string",
            description: "Optional JSON list or comma-separated conflicting file paths.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const idOrPath = typeof args.idOrPath === "string" ? args.idOrPath : "";
          if (!idOrPath) {
            return { success: false, error: "idOrPath is required" };
          }
          const target = typeof args.targetBranch === "string" ? args.targetBranch : "main";
          let conflicts: string[] = [];
          if (Array.isArray(args.conflictFiles)) conflicts = args.conflictFiles as string[];
          else if (typeof args.conflictFiles === "string" && args.conflictFiles) {
            try { conflicts = JSON.parse(args.conflictFiles); } catch { conflicts = args.conflictFiles.split(",").map((s) => s.trim()); }
          }

          const result = this.supervisor.mergeBranch(idOrPath, target, conflicts);
          return {
            success: result.success,
            mergeCommit: result.mergeCommit,
            conflictFiles: result.conflictFiles,
          };
        },
      },
      {
        name: "worktree_get_metrics",
        description:
          "Retrieves aggregate statistics for worktree allocations, pruning, and merges.",
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
