/**
 * checkpoint-kernel-supervisor.ts
 *
 * Master Checkpoint Kernel Supervisor managing transparent pre-mutation captures,
 * Merkle diffing, and zero-disk state rollbacks (Phase 87 / ADR-039).
 */

import { performance } from "node:perf_hooks";
import type {
  CasBlob,
  CheckpointNode,
  CheckpointWorkspaceSnapshot,
  TreeEntry,
} from "../../../core/contracts/checkpoint.contracts.js";
import { DeterministicCasStore } from "../../../tooling/extensions/checkpoint/deterministic-cas-store.js";
import { BroccoliCheckpointSubstrate } from "../../../sessions/extensions/checkpoint/broccoli-checkpoint-substrate.js";

export class CheckpointKernelSupervisor {
  private store: DeterministicCasStore;
  private substrate: BroccoliCheckpointSubstrate;

  constructor(store: DeterministicCasStore, substrate: BroccoliCheckpointSubstrate) {
    this.store = store;
    this.substrate = substrate;
  }

  /**
   * Creates a Merkle filesystem checkpoint commit.
   */
  checkpoint(
    message: string,
    files: readonly { path: string; data: Uint8Array | string; mode?: number }[],
    frameIndex: number = 1
  ): CheckpointNode {
    const commit = this.store.createCommit(message, files, frameIndex);
    const stats = this.store.getStats();
    this.substrate.recordCheckpoint(commit, stats.totalBlobs, stats.totalBytes);
    return commit;
  }

  /**
   * Restores files from a specific checkpoint commit.
   */
  rollback(checkpointId: string): {
    success: boolean;
    restoredFiles: readonly { path: string; data: Uint8Array; mode: number; size: number }[];
    durationMs: number;
    error?: string;
  } {
    const startedAt = performance.now();
    const commit = this.store.getCommit(checkpointId);
    if (!commit) {
      return {
        success: false,
        restoredFiles: [],
        durationMs: Number((performance.now() - startedAt).toFixed(3)),
        error: `Checkpoint commit '${checkpointId}' not found`,
      };
    }

    const tree = this.store.getTree(commit.treeHash);
    if (!tree) {
      return {
        success: false,
        restoredFiles: [],
        durationMs: Number((performance.now() - startedAt).toFixed(3)),
        error: `Merkle tree '${commit.treeHash}' not found in CAS store`,
      };
    }

    const restoredFiles: { path: string; data: Uint8Array; mode: number; size: number }[] = [];

    for (let i = 0; i < tree.length; i++) {
      const entry = tree[i];
      const blob = this.store.getBlob(entry.hash);
      if (blob) {
        restoredFiles.push({
          path: entry.path,
          data: blob.data,
          mode: entry.mode,
          size: blob.size,
        });
      }
    }

    this.store.setHead(checkpointId);
    this.substrate.setHead(checkpointId);

    const duration = Number((performance.now() - startedAt).toFixed(3));
    return {
      success: true,
      restoredFiles,
      durationMs: duration,
    };
  }

  /**
   * Retrieves a checkpoint commit by ID.
   */
  getCheckpoint(checkpointId: string): CheckpointNode | undefined {
    return this.store.getCommit(checkpointId);
  }

  /**
   * Retrieves a Merkle tree by hash.
   */
  getTree(treeHash: string): readonly TreeEntry[] | undefined {
    return this.store.getTree(treeHash);
  }

  /**
   * Retrieves a blob by hash.
   */
  getBlob(hash: string): CasBlob | undefined {
    return this.store.getBlob(hash);
  }

  /**
   * Returns workspace stats.
   */
  getStats(): CheckpointWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  /**
   * Lists historical checkpoints.
   */
  listCheckpoints(limit: number = 20): readonly CheckpointNode[] {
    return this.substrate.listCheckpoints(limit);
  }
}
