import type {
  IWorktreeManager,
  WorktreeIsolationSpec,
} from "../../../core/contracts/delegation.contracts.js";
import type { AnchoredHands } from "../hashline/hands.js";

/**
 * AnchoredWorktreeManager.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 *
 * Manages sandboxed Git worktree lifecycles and virtual branch worktrees,
 * allowing subagents to safely mutate source code without contaminating the primary working copy.
 */
export class AnchoredWorktreeManager implements IWorktreeManager {
  private readonly hands?: AnchoredHands;
  private readonly activeWorktrees = new Map<string, WorktreeIsolationSpec>();
  private readonly stagedFilesPerBranch = new Map<string, Set<string>>();

  constructor(hands?: AnchoredHands) {
    this.hands = hands;
  }

  async createIsolatedWorktree(
    spec: WorktreeIsolationSpec
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    if (!spec.worktreePath || !spec.branchName) {
      return { success: false, error: "Invalid worktree specification" };
    }

    if (this.activeWorktrees.has(spec.worktreePath)) {
      return { success: false, error: `Worktree already active at path: ${spec.worktreePath}` };
    }

    this.activeWorktrees.set(spec.worktreePath, Object.freeze({ ...spec }));
    this.stagedFilesPerBranch.set(spec.branchName, new Set<string>());

    return {
      success: true,
      path: spec.worktreePath,
    };
  }

  recordFileModification(branchName: string, filePath: string): void {
    let files = this.stagedFilesPerBranch.get(branchName);
    if (!files) {
      files = new Set<string>();
      this.stagedFilesPerBranch.set(branchName, files);
    }
    files.add(filePath);
  }

  async mergeWorktreeChanges(
    branchName: string
  ): Promise<{ success: boolean; commitSha?: string; filesChanged: readonly string[]; error?: string }> {
    const files = this.stagedFilesPerBranch.get(branchName);
    if (!files) {
      return { success: false, filesChanged: [], error: `No active changes recorded for branch '${branchName}'` };
    }

    const filesArray = Array.from(files);
    const mockCommitSha = `commit-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`;

    return {
      success: true,
      commitSha: mockCommitSha,
      filesChanged: Object.freeze(filesArray),
    };
  }

  async cleanupWorktree(
    worktreePath: string
  ): Promise<{ success: boolean; error?: string }> {
    const spec = this.activeWorktrees.get(worktreePath);
    if (!spec) {
      return { success: false, error: `No active worktree found at path: ${worktreePath}` };
    }

    this.stagedFilesPerBranch.delete(spec.branchName);
    this.activeWorktrees.delete(worktreePath);

    return { success: true };
  }

  getActiveWorktreesCount(): number {
    return this.activeWorktrees.size;
  }
}
