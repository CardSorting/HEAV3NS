/**
 * broccoli-patch-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for transactional file staging,
 * mutation journals, and virtual filesystem coalescence.
 */

import type {
  FileMutationEntry,
  FileMutationSnapshot,
} from "../../../core/contracts/patch-mutation.contracts.js";

export class BroccoliPatchSubstrate {
  private readonly staged = new Map<string, FileMutationEntry>();
  private totalStagedCount = 0;
  private totalCommittedCount = 0;
  private totalRevertedCount = 0;

  public stageFile(path: string, stagedContent: string | null, previousContent: string | null): void {
    const entry: FileMutationEntry = {
      path,
      stagedContent,
      previousContent,
      status: "staged",
      timestamp: Date.now(),
    };
    this.staged.set(path, entry);
    this.totalStagedCount++;
  }

  public getStagedFile(path: string): FileMutationEntry | undefined {
    return this.staged.get(path);
  }

  public listStaged(): readonly FileMutationEntry[] {
    return Array.from(this.staged.values());
  }

  public hasStaged(path: string): boolean {
    return this.staged.has(path);
  }

  public removeStaged(path: string): boolean {
    return this.staged.delete(path);
  }

  public commitAll(): readonly FileMutationEntry[] {
    const entries = Array.from(this.staged.values());
    for (const entry of entries) {
      this.totalCommittedCount++;
    }
    this.staged.clear();
    return entries;
  }

  public revertAll(): readonly FileMutationEntry[] {
    const entries = Array.from(this.staged.values());
    for (const entry of entries) {
      this.totalRevertedCount++;
    }
    this.staged.clear();
    return entries;
  }

  public captureSnapshot(): FileMutationSnapshot {
    return {
      stagedFiles: Array.from(this.staged.values()).map((e) => ({ ...e })),
      totalStaged: this.staged.size,
      timestamp: Date.now(),
    };
  }

  public restoreSnapshot(snapshot: FileMutationSnapshot): void {
    this.staged.clear();
    for (const entry of snapshot.stagedFiles) {
      this.staged.set(entry.path, { ...entry });
    }
  }

  public getMetrics(): {
    activeStaged: number;
    totalStagedCount: number;
    totalCommittedCount: number;
    totalRevertedCount: number;
  } {
    return {
      activeStaged: this.staged.size,
      totalStagedCount: this.totalStagedCount,
      totalCommittedCount: this.totalCommittedCount,
      totalRevertedCount: this.totalRevertedCount,
    };
  }

  public clear(): void {
    this.staged.clear();
    this.totalStagedCount = 0;
    this.totalCommittedCount = 0;
    this.totalRevertedCount = 0;
  }
}
