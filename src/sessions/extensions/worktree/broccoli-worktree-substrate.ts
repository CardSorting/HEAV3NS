/**
 * broccoli-worktree-substrate.ts
 *
 * In-memory Broccolidb repository storing allocated git worktrees, branch metadata,
 * commit ledgers, and merge audit trails (Phase 123 / ADR-099 / Target #56).
 */

import type {
  WorktreeConfig,
  WorktreeDescriptor,
  WorktreeMetrics,
  WorktreeWorkspaceSnapshot,
} from "../../../core/contracts/worktree.contracts.js";
import { DEFAULT_WORKTREE_CONFIG } from "../../../core/contracts/worktree.contracts.js";

export class BroccoliWorktreeSubstrate {
  private config: WorktreeConfig = { ...DEFAULT_WORKTREE_CONFIG };
  private readonly worktrees: Map<string, WorktreeDescriptor> = new Map();
  private totalCreated = 0;
  private totalPruned = 0;
  private totalMerged = 0;

  public setConfig(config: Partial<WorktreeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): WorktreeConfig {
    return { ...this.config };
  }

  public registerWorktree(worktree: WorktreeDescriptor): void {
    this.totalCreated++;
    this.worktrees.set(worktree.id, { ...worktree });
  }

  public updateWorktree(
    id: string,
    updates: Partial<WorktreeDescriptor>
  ): WorktreeDescriptor | undefined {
    const existing = this.worktrees.get(id);
    if (!existing) return undefined;
    const updated: WorktreeDescriptor = {
      ...existing,
      ...updates,
      lastInspectedAt: Date.now(),
    };
    this.worktrees.set(id, updated);
    return updated;
  }

  public getWorktree(id: string): WorktreeDescriptor | undefined {
    const found = this.worktrees.get(id);
    return found ? { ...found } : undefined;
  }

  public getWorktreeBySubagent(subagentId: string): WorktreeDescriptor | undefined {
    for (const wt of this.worktrees.values()) {
      if (wt.subagentId === subagentId && wt.status !== "pruned") {
        return { ...wt };
      }
    }
    return undefined;
  }

  public getWorktreeByPath(path: string): WorktreeDescriptor | undefined {
    for (const wt of this.worktrees.values()) {
      if (wt.path === path) {
        return { ...wt };
      }
    }
    return undefined;
  }

  public recordPrune(id: string): boolean {
    const existing = this.worktrees.get(id);
    if (!existing) return false;
    existing.status = "pruned";
    this.totalPruned++;
    return true;
  }

  public recordMerge(id: string): boolean {
    const existing = this.worktrees.get(id);
    if (!existing) return false;
    existing.status = "merged";
    this.totalMerged++;
    return true;
  }

  public getAllWorktrees(): readonly WorktreeDescriptor[] {
    return Array.from(this.worktrees.values());
  }

  public getActiveWorktrees(): readonly WorktreeDescriptor[] {
    return Array.from(this.worktrees.values()).filter(
      (wt) => wt.status !== "pruned" && wt.status !== "merged"
    );
  }

  public getMetrics(): WorktreeMetrics {
    const activeCount = Array.from(this.worktrees.values()).filter(
      (wt) => wt.status !== "pruned" && wt.status !== "merged"
    ).length;

    return {
      totalCreated: this.totalCreated,
      totalPruned: this.totalPruned,
      totalMerged: this.totalMerged,
      activeCount,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): WorktreeWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      worktrees: Array.from(this.worktrees.values()).map((wt) => ({ ...wt })),
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: WorktreeWorkspaceSnapshot): void {
    this.worktrees.clear();
    for (const wt of snapshot.worktrees) {
      this.worktrees.set(wt.id, { ...wt });
    }
    this.totalCreated = snapshot.metrics.totalCreated;
    this.totalPruned = snapshot.metrics.totalPruned;
    this.totalMerged = snapshot.metrics.totalMerged;
  }

  public clear(): void {
    this.worktrees.clear();
    this.totalCreated = 0;
    this.totalPruned = 0;
    this.totalMerged = 0;
  }
}
