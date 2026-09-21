/**
 * [LAYER: SESSIONS EXTENSION]
 * Pass 139: Zero-Dependency Broccoli Rollback Coordinator
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/orchestration/RollbackCoordinator.ts).
 * Captures pre-edit file content snapshots before file mutations and executes multi-file atomic
 * transaction restorations upon edit failures or abort signals. Zero external npm dependencies.
 */

import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface FileSnapshotRecord {
  snapshotId: string;
  filePath: string;
  content: string;
  capturedAt: number;
}

export interface RollbackResult {
  restored: string[];
  failed: string[];
}

export class BroccoliRollbackCoordinator {
  private readonly workspaceRoot: string;
  private readonly snapshots = new Map<string, FileSnapshotRecord>();

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Captures in-memory content snapshots for a list of files before mutation.
   */
  public async snapshotBefore(files: string[]): Promise<string[]> {
    const snapshotIds: string[] = [];

    for (const filePath of files) {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(this.workspaceRoot, filePath);

      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const snapshotId = randomUUID();
        this.snapshots.set(snapshotId, {
          snapshotId,
          filePath: fullPath,
          content,
          capturedAt: Date.now(),
        });
        snapshotIds.push(snapshotId);
      } catch {
        // File does not exist yet or unreadable
      }
    }

    return snapshotIds;
  }

  /**
   * Restores files to their exact pre-edit snapshot content.
   */
  public async restore(snapshotIds: string[]): Promise<RollbackResult> {
    const restored: string[] = [];
    const failed: string[] = [];

    for (const snapshotId of snapshotIds) {
      const snap = this.snapshots.get(snapshotId);
      if (!snap) {
        failed.push(snapshotId);
        continue;
      }

      try {
        await fs.mkdir(path.dirname(snap.filePath), { recursive: true });
        await fs.writeFile(snap.filePath, snap.content, "utf-8");
        restored.push(snap.filePath);
      } catch {
        failed.push(snap.filePath);
      }
    }

    return { restored, failed };
  }
}
