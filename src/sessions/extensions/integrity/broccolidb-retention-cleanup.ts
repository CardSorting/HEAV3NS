/**
 * [LAYER: SESSIONS EXTENSION]
 * Pass 151: Zero-Dependency Broccoli Retention Cleanup Service
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/CleanupService.ts).
 * Automatic workspace memory retention garbage collection, lock file pruning, and temporary file purging
 * with unref'd interval timers. Zero external npm dependencies.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface CleanupMetrics {
  lastRunAt: number | null;
  prunedLocksCount: number;
  prunedTempFilesCount: number;
  lastError: string | null;
}

export class BroccoliRetentionCleanupService {
  private readonly workspaceRoot: string;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private lastRunAt: number | null = null;
  private prunedLocksCount = 0;
  private prunedTempFilesCount = 0;
  private lastError: string | null = null;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Starts background retention cleanup interval timer.
   */
  public start(intervalMs = 60_000): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.runBackgroundCleanup().catch((err: unknown) => {
        this.lastError = err instanceof Error ? err.message : String(err);
      });
    }, intervalMs);

    this.cleanupInterval.unref();
  }

  /**
   * Stops the background cleanup timer.
   */
  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Purges stale lock files older than the specified max age.
   */
  public async purgeStaleLocks(maxAgeMs = 60_000): Promise<number> {
    const lockDir = path.resolve(this.workspaceRoot, ".broccolidb", "locks");
    let count = 0;

    try {
      const entries = await fs.readdir(lockDir);
      const now = Date.now();

      for (const entry of entries) {
        if (!entry.endsWith(".lock")) continue;
        const fullPath = path.join(lockDir, entry);
        try {
          const stats = await fs.stat(fullPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            await fs.unlink(fullPath);
            count++;
          }
        } catch {
          // Stat/unlink failed
        }
      }
    } catch {
      // Lock directory does not exist yet
    }

    this.prunedLocksCount += count;
    return count;
  }

  /**
   * Cleans up temporary sidechain files and scratchpad artifacts.
   */
  public async cleanupTempFiles(maxAgeMs = 86_400_000): Promise<number> {
    const tempDir = path.resolve(this.workspaceRoot, ".broccolidb", "temp");
    let count = 0;

    try {
      const entries = await fs.readdir(tempDir);
      const now = Date.now();

      for (const entry of entries) {
        const fullPath = path.join(tempDir, entry);
        try {
          const stats = await fs.stat(fullPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            await fs.unlink(fullPath);
            count++;
          }
        } catch {
          // Ignored
        }
      }
    } catch {
      // Temp directory does not exist
    }

    this.prunedTempFilesCount += count;
    return count;
  }

  /**
   * Executes a full background cleanup pass.
   */
  public async runBackgroundCleanup(): Promise<CleanupMetrics> {
    this.lastRunAt = Date.now();

    try {
      await this.purgeStaleLocks();
      await this.cleanupTempFiles();
      this.lastError = null;
    } catch (err: unknown) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }

    return this.getMetrics();
  }

  /**
   * Returns current metrics for the cleanup service.
   */
  public getMetrics(): CleanupMetrics {
    return {
      lastRunAt: this.lastRunAt,
      prunedLocksCount: this.prunedLocksCount,
      prunedTempFilesCount: this.prunedTempFilesCount,
      lastError: this.lastError,
    };
  }
}
