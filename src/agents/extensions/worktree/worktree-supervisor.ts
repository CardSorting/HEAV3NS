/**
 * worktree-supervisor.ts
 *
 * Master supervisor coordinating subagent git worktree provisioning, branch isolation,
 * status inspection, auto-pruning, and in-memory substrate tracking (Phase 123 / ADR-099 / Target #56).
 */

import type { BroccoliWorktreeSubstrate } from "../../../sessions/extensions/worktree/broccoli-worktree-substrate.js";
import type { DeterministicGitWorktree } from "./deterministic-git-worktree.js";
import type {
  WorktreeConfig,
  WorktreeDescriptor,
  WorktreeMetrics,
} from "../../../core/contracts/worktree.contracts.js";

export class WorktreeSupervisor {
  private readonly substrate: BroccoliWorktreeSubstrate;
  private readonly engine: DeterministicGitWorktree;

  constructor(
    substrate: BroccoliWorktreeSubstrate,
    engine: DeterministicGitWorktree
  ) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public configure(config: Partial<WorktreeConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): WorktreeConfig {
    return this.substrate.getConfig();
  }

  public createWorktree(
    repoRoot: string,
    subagentId: string,
    baseCommit = "HEAD"
  ): WorktreeDescriptor {
    const config = this.substrate.getConfig();
    const resolvedRoot = this.engine.resolveRepoRoot(repoRoot) ?? repoRoot;

    // Ensure .gitignore has worktree dir
    this.engine.ensureGitignore(resolvedRoot, config.worktreeDir);

    const descriptor = this.engine.createWorktreeDescriptor(
      resolvedRoot,
      subagentId,
      config,
      baseCommit
    );

    this.substrate.registerWorktree(descriptor);
    return descriptor;
  }

  public inspectWorktree(
    idOrPath: string,
    stagedFiles: string[] = [],
    unstagedFiles: string[] = [],
    commitCount = 0
  ): WorktreeDescriptor {
    let existing = this.substrate.getWorktree(idOrPath);
    if (!existing) {
      existing = this.substrate.getWorktreeByPath(idOrPath);
    }
    if (!existing) {
      throw new Error(`Worktree not found for '${idOrPath}'`);
    }

    const evaluated = this.engine.evaluateStatus(
      existing,
      stagedFiles,
      unstagedFiles,
      commitCount
    );

    const updated = this.substrate.updateWorktree(existing.id, {
      isDirty: evaluated.isDirty,
      commitCount: evaluated.commitCount,
      modifiedFiles: evaluated.modifiedFiles,
      status: evaluated.status,
    });

    return updated!;
  }

  public cleanupWorktree(
    idOrPath: string,
    force = false
  ): { success: boolean; pruned: boolean; reason: string } {
    let existing = this.substrate.getWorktree(idOrPath);
    if (!existing) {
      existing = this.substrate.getWorktreeByPath(idOrPath);
    }
    if (!existing) {
      return { success: false, pruned: false, reason: `Worktree not found: '${idOrPath}'` };
    }

    const config = this.substrate.getConfig();
    const pruneCheck = this.engine.shouldAutoPrune(existing, config.autoPruneClean);

    if (pruneCheck.canPrune || force) {
      this.substrate.recordPrune(existing.id);
      return {
        success: true,
        pruned: true,
        reason: force ? "Forced cleanup requested" : pruneCheck.reason,
      };
    }

    return {
      success: false,
      pruned: false,
      reason: pruneCheck.reason,
    };
  }

  public mergeBranch(
    idOrPath: string,
    targetBranch = "main",
    conflictFiles: string[] = []
  ): { success: boolean; mergeCommit?: string; conflictFiles?: string[] } {
    let existing = this.substrate.getWorktree(idOrPath);
    if (!existing) {
      existing = this.substrate.getWorktreeByPath(idOrPath);
    }
    if (!existing) {
      return { success: false, conflictFiles: [`Worktree not found for '${idOrPath}'`] };
    }

    const mergeResult = this.engine.verifyMergeability(
      existing.branch,
      targetBranch,
      conflictFiles.length > 0,
      conflictFiles
    );

    if (mergeResult.success) {
      this.substrate.recordMerge(existing.id);
    }

    return mergeResult;
  }

  public getActiveWorktrees(): readonly WorktreeDescriptor[] {
    return this.substrate.getActiveWorktrees();
  }

  public getAllWorktrees(): readonly WorktreeDescriptor[] {
    return this.substrate.getAllWorktrees();
  }

  public getMetrics(): WorktreeMetrics {
    return this.substrate.getMetrics();
  }

  public clear(): void {
    this.substrate.clear();
  }
}
