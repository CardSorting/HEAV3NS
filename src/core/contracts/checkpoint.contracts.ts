/**
 * checkpoint.contracts.ts
 *
 * Core data contracts for the Deterministic Content-Addressable Blob Store,
 * Filesystem Checkpoint Kernel & State Branch Tree Subsystem (Phase 87 / ADR-039).
 */

export interface CasBlob {
  readonly hash: string;
  readonly size: number;
  readonly data: Uint8Array;
  readonly mimeType?: string;
}

export interface TreeEntry {
  readonly path: string;
  readonly hash: string;
  readonly mode: number;
  readonly size: number;
}

export interface CheckpointNode {
  readonly id: string;
  readonly parentId?: string;
  readonly treeHash: string;
  readonly message: string;
  readonly frameIndex: number;
  readonly timestamp: number;
  readonly stats: {
    readonly fileCount: number;
    readonly byteCount: number;
  };
}

export interface CheckpointRollbackResult {
  readonly success: boolean;
  readonly targetCheckpointId: string;
  readonly restoredFiles: number;
  readonly restoredBytes: number;
  readonly durationMs: number;
  readonly error?: string;
}

export interface CheckpointWorkspaceSnapshot {
  readonly totalBlobs: number;
  readonly totalBytes: number;
  readonly checkpointCount: number;
  readonly currentHeadId?: string;
  readonly timestamp: number;
}
