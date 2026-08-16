/**
 * broccoli-checkpoint-substrate.ts
 *
 * In-memory Broccolidb substrate for CAS metadata, Merkle commit history, and checkpoint ledgers (Phase 87 / ADR-039).
 */

import type {
  CheckpointNode,
  CheckpointWorkspaceSnapshot,
} from "../../../core/contracts/checkpoint.contracts.js";

export class BroccoliCheckpointSubstrate {
  private checkpoints: CheckpointNode[];
  private currentHeadId?: string;
  private totalBlobs: number;
  private totalBytes: number;

  constructor() {
    this.checkpoints = [];
    this.totalBlobs = 0;
    this.totalBytes = 0;
  }

  /**
   * Records a new checkpoint commit in the ledger.
   */
  recordCheckpoint(node: CheckpointNode, totalBlobs: number, totalBytes: number): void {
    this.checkpoints.push(node);
    this.currentHeadId = node.id;
    this.totalBlobs = totalBlobs;
    this.totalBytes = totalBytes;

    if (this.checkpoints.length > 200) {
      this.checkpoints.shift();
    }
  }

  /**
   * Sets current HEAD commit pointer.
   */
  setHead(commitId?: string): void {
    this.currentHeadId = commitId;
  }

  /**
   * Lists historical checkpoints.
   */
  listCheckpoints(limit: number = 20): readonly CheckpointNode[] {
    return this.checkpoints.slice(-limit);
  }

  /**
   * Exports full state snapshot.
   */
  exportSnapshot(): CheckpointWorkspaceSnapshot {
    return {
      totalBlobs: this.totalBlobs,
      totalBytes: this.totalBytes,
      checkpointCount: this.checkpoints.length,
      currentHeadId: this.currentHeadId,
      timestamp: Date.now(),
    };
  }

  /**
   * Restores state from a snapshot.
   */
  importSnapshot(snapshot: CheckpointWorkspaceSnapshot): void {
    this.totalBlobs = snapshot.totalBlobs;
    this.totalBytes = snapshot.totalBytes;
    this.currentHeadId = snapshot.currentHeadId;
  }

  /**
   * Clears all stored checkpoint ledgers.
   */
  clear(): void {
    this.checkpoints = [];
    this.currentHeadId = undefined;
    this.totalBlobs = 0;
    this.totalBytes = 0;
  }
}
