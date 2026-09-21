/**
 * [LAYER: SESSIONS EXTENSION]
 * Pass 148: Zero-Dependency Broccoli CAS Scratchpad Service
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/ScratchpadService.ts).
 * Provides CAS-deduplicated durable task scratchpads with file-based atomic lock handling. Zero external npm dependencies.
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface ScratchpadRecord {
  taskId: string;
  content: string;
  hash: string;
  updatedAt: number;
}

export class BroccoliCASScratchpadService {
  private readonly scratchDir: string;
  private readonly lockDir: string;
  private readonly cache = new Map<string, ScratchpadRecord>();

  constructor(workspaceRoot: string = process.cwd()) {
    this.scratchDir = path.resolve(workspaceRoot, ".broccolidb", "scratchpad");
    this.lockDir = path.resolve(workspaceRoot, ".broccolidb", "locks");
  }

  /**
   * Computes normalized SHA-256 CAS hash for content deduplication.
   */
  public computeHash(content: string): string {
    return createHash("sha256").update(content.trim()).digest("hex");
  }

  /**
   * Ensures storage and lock directories exist on disk.
   */
  public async ensureDirs(): Promise<void> {
    await fs.mkdir(this.scratchDir, { recursive: true });
    await fs.mkdir(this.lockDir, { recursive: true });
  }

  /**
   * Acquires a file-based lock for atomic scratchpad mutations.
   */
  public async acquireLock(key: string): Promise<string> {
    await this.ensureDirs();
    const lockPath = path.join(this.lockDir, `${key}.lock`);

    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        const handle = await fs.open(lockPath, "wx");
        await handle.close();
        return lockPath;
      } catch (err: unknown) {
        const error = err as { code?: string };
        if (error.code === "EEXIST") {
          try {
            const stats = await fs.stat(lockPath);
            if (Date.now() - stats.mtimeMs > 30_000) {
              await fs.unlink(lockPath);
              continue;
            }
          } catch {
            // Stats read or unlink failed
          }
          await new Promise((r) => setTimeout(r, 10));
          continue;
        }
        throw err;
      }
    }
    return lockPath;
  }

  /**
   * Releases an acquired file lock.
   */
  public async releaseLock(lockPath: string): Promise<void> {
    try {
      await fs.unlink(lockPath);
    } catch {
      // Ignored if lock was already released
    }
  }

  /**
   * Writes content to a task scratchpad using CAS deduplication.
   */
  public async writeScratchpad(taskId: string, content: string): Promise<ScratchpadRecord> {
    const hash = this.computeHash(content);
    const existing = this.cache.get(taskId);
    if (existing && existing.hash === hash) {
      return existing;
    }

    const lockPath = await this.acquireLock(taskId);
    try {
      const record: ScratchpadRecord = {
        taskId,
        content,
        hash,
        updatedAt: Date.now(),
      };

      const targetPath = path.join(this.scratchDir, `${taskId}.md`);
      await fs.writeFile(targetPath, content, "utf-8");
      this.cache.set(taskId, record);
      return record;
    } finally {
      await this.releaseLock(lockPath);
    }
  }

  /**
   * Reads task scratchpad content from disk or cache.
   */
  public async readScratchpad(taskId: string): Promise<ScratchpadRecord | null> {
    const cached = this.cache.get(taskId);
    if (cached) return cached;

    const targetPath = path.join(this.scratchDir, `${taskId}.md`);
    try {
      const content = await fs.readFile(targetPath, "utf-8");
      const record: ScratchpadRecord = {
        taskId,
        content,
        hash: this.computeHash(content),
        updatedAt: Date.now(),
      };
      this.cache.set(taskId, record);
      return record;
    } catch {
      return null;
    }
  }
}
