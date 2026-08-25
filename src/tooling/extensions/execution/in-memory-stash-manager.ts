/**
 * in-memory-stash-manager.ts
 *
 * In-Memory Workspace Working-Tree Stash Manager.
 * Allows agents to save, pop, inspect, and drop workspace snapshot stashes
 * without requiring git repository locks or shell subprocesses.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface StashedFile {
  readonly path: string;
  readonly content: string;
}

export interface StashRecord {
  readonly id: string;
  readonly message: string;
  readonly timestamp: number;
  readonly files: StashedFile[];
}

export class InMemoryStashManager {
  private stashes: StashRecord[] = [];

  /**
   * Saves a workspace snapshot into the in-memory stash stack.
   */
  public async stashSave(
    rootDir: string,
    filePaths: string[],
    message = "WIP stash"
  ): Promise<{ success: boolean; stashId: string; fileCount: number }> {
    const stashedFiles: StashedFile[] = [];

    for (const relPath of filePaths) {
      const full = path.isAbsolute(relPath) ? relPath : path.resolve(rootDir, relPath);
      try {
        const content = await fs.readFile(full, "utf-8");
        stashedFiles.push({
          path: path.relative(rootDir, full),
          content,
        });
      } catch {
        // Skip unreadable files
      }
    }

    const stashId = `stash_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const record: StashRecord = {
      id: stashId,
      message,
      timestamp: Date.now(),
      files: stashedFiles,
    };

    this.stashes.unshift(record);

    return {
      success: true,
      stashId,
      fileCount: stashedFiles.length,
    };
  }

  /**
   * Restores a stash from memory and writes files back to disk.
   */
  public async stashPop(
    rootDir: string,
    stashId?: string
  ): Promise<{ success: boolean; stashId: string; restoredCount: number; restoredPaths: string[] }> {
    if (this.stashes.length === 0) {
      return { success: false, stashId: "", restoredCount: 0, restoredPaths: [] };
    }

    const index = stashId ? this.stashes.findIndex((s) => s.id === stashId) : 0;
    if (index === -1) {
      return { success: false, stashId: stashId || "", restoredCount: 0, restoredPaths: [] };
    }

    const stash = this.stashes.splice(index, 1)[0];
    const restoredPaths: string[] = [];

    for (const file of stash.files) {
      const full = path.resolve(rootDir, file.path);
      try {
        await fs.mkdir(path.dirname(full), { recursive: true });
        await fs.writeFile(full, file.content, "utf-8");
        restoredPaths.push(file.path);
      } catch {
        // Skip write errors
      }
    }

    return {
      success: true,
      stashId: stash.id,
      restoredCount: restoredPaths.length,
      restoredPaths,
    };
  }

  /**
   * Lists active stashes.
   */
  public stashList(): Array<{ id: string; message: string; timestamp: number; fileCount: number }> {
    return this.stashes.map((s) => ({
      id: s.id,
      message: s.message,
      timestamp: s.timestamp,
      fileCount: s.files.length,
    }));
  }

  /**
   * Drops a stash by ID or drops the most recent stash.
   */
  public stashDrop(stashId?: string): boolean {
    if (this.stashes.length === 0) return false;
    if (!stashId) {
      this.stashes.shift();
      return true;
    }
    const idx = this.stashes.findIndex((s) => s.id === stashId);
    if (idx !== -1) {
      this.stashes.splice(idx, 1);
      return true;
    }
    return false;
  }
}
