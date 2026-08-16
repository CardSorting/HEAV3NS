/**
 * deterministic-git-worktree.ts
 *
 * Pure TypeScript Git Worktree Manager, Branch Sandboxing & Subagent Workspace Governance
 * (Phase 123 / ADR-099 / Target #56).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  WorktreeConfig,
  WorktreeDescriptor,
} from "../../../core/contracts/worktree.contracts.js";

export class DeterministicGitWorktree {
  /**
   * Resolves the git repository root for the given directory path.
   */
  public resolveRepoRoot(path: string): string | null {
    if (!path) return null;
    try {
      let current = resolve(path);
      while (current !== "/" && current.length > 1) {
        if (existsSync(join(current, ".git"))) {
          return current;
        }
        const parent = resolve(current, "..");
        if (parent === current) break;
        current = parent;
      }
    } catch {
      // Fallback
    }
    return null;
  }

  /**
   * Ensures that the worktrees folder (default: .worktrees/) is recorded in .gitignore.
   */
  public ensureGitignore(repoRoot: string, worktreeDirName = ".worktrees"): boolean {
    if (!repoRoot) return false;
    const gitignorePath = join(repoRoot, ".gitignore");
    try {
      let content = "";
      if (existsSync(gitignorePath)) {
        content = readFileSync(gitignorePath, "utf-8");
      }
      const pattern = `${worktreeDirName}/`;
      if (!content.includes(pattern) && !content.includes(worktreeDirName)) {
        const appended = content.endsWith("\n") || content.length === 0
          ? `${content}${pattern}\n`
          : `${content}\n${pattern}\n`;
        writeFileSync(gitignorePath, appended, "utf-8");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Constructs an isolated WorktreeDescriptor for the given subagent.
   */
  public createWorktreeDescriptor(
    repoRoot: string,
    subagentId: string,
    config: WorktreeConfig,
    baseCommit = "HEAD"
  ): WorktreeDescriptor {
    const cleanSubagentId = subagentId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const id = `wt-${cleanSubagentId}`;
    const branch = `${config.branchPrefix}/${cleanSubagentId}`;
    const path = join(repoRoot, config.worktreeDir, `subagent-${cleanSubagentId}`);

    return {
      id,
      subagentId,
      branch,
      path,
      repoRoot,
      baseCommit,
      commitCount: 0,
      isDirty: false,
      modifiedFiles: [],
      status: "active",
      createdAt: Date.now(),
    };
  }

  /**
   * Evaluates worktree dirty state, committed count, and modified files.
   */
  public evaluateStatus(
    worktree: WorktreeDescriptor,
    stagedFiles: string[] = [],
    unstagedFiles: string[] = [],
    commitCount = 0
  ): {
    isDirty: boolean;
    commitCount: number;
    modifiedFiles: string[];
    status: WorktreeDescriptor["status"];
  } {
    const allModified = Array.from(new Set([...stagedFiles, ...unstagedFiles]));
    const isDirty = allModified.length > 0;

    let status: WorktreeDescriptor["status"] = "clean";
    if (commitCount > 0) {
      status = "committed";
    } else if (isDirty) {
      status = "dirty";
    }

    return {
      isDirty,
      commitCount,
      modifiedFiles: allModified,
      status,
    };
  }

  /**
   * Determines if a worktree is safe to prune automatically.
   */
  public shouldAutoPrune(
    worktree: WorktreeDescriptor,
    autoPruneClean = true
  ): { canPrune: boolean; reason: string } {
    if (worktree.status === "pruned") {
      return { canPrune: false, reason: "Worktree already pruned" };
    }

    if (worktree.status === "merged") {
      return { canPrune: true, reason: "Branch successfully merged into target" };
    }

    if (worktree.commitCount === 0 && !worktree.isDirty) {
      if (autoPruneClean) {
        return { canPrune: true, reason: "Pristine worktree with 0 commits and clean tree" };
      }
      return { canPrune: false, reason: "Auto-pruning disabled by configuration" };
    }

    return {
      canPrune: false,
      reason: `Worktree contains active modifications (${worktree.commitCount} commits, dirty: ${worktree.isDirty})`,
    };
  }

  /**
   * Simulates/executes deterministic branch merge verification.
   */
  public verifyMergeability(
    branch: string,
    targetBranch = "main",
    hasConflicts = false,
    conflictingFiles: string[] = []
  ): { success: boolean; mergeCommit?: string; conflictFiles?: string[] } {
    if (hasConflicts && conflictingFiles.length > 0) {
      return {
        success: false,
        conflictFiles: conflictingFiles,
      };
    }
    return {
      success: true,
      mergeCommit: `merge-${branch.replace(/\//g, "-")}-into-${targetBranch}`,
    };
  }
}
