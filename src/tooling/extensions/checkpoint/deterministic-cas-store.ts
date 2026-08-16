/**
 * deterministic-cas-store.ts
 *
 * In-memory zero-GC Content-Addressable Storage (CAS) and Merkle tree engine (Phase 87 / ADR-039).
 */

import * as crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import type {
  CasBlob,
  CheckpointNode,
  TreeEntry,
} from "../../../core/contracts/checkpoint.contracts.js";

export class DeterministicCasStore {
  private readonly blobs: Map<string, CasBlob>;
  private readonly trees: Map<string, readonly TreeEntry[]>;
  private readonly commits: Map<string, CheckpointNode>;
  private headId?: string;

  constructor() {
    this.blobs = new Map<string, CasBlob>();
    this.trees = new Map<string, readonly TreeEntry[]>();
    this.commits = new Map<string, CheckpointNode>();
  }

  /**
   * Computes SHA-256 hash of a string or buffer.
   */
  hashData(data: Uint8Array | string): string {
    const hash = crypto.createHash("sha256");
    if (typeof data === "string") {
      hash.update(data, "utf8");
    } else {
      hash.update(data);
    }
    return hash.digest("hex");
  }

  /**
   * Stores a binary blob in the CAS store, deduplicating identical contents.
   */
  putBlob(data: Uint8Array | string, mimeType?: string): CasBlob {
    const rawData = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const hash = this.hashData(rawData);

    const existing = this.blobs.get(hash);
    if (existing) {
      return existing;
    }

    const blob: CasBlob = {
      hash,
      size: rawData.length,
      data: rawData,
      mimeType,
    };
    this.blobs.set(hash, blob);
    return blob;
  }

  /**
   * Retrieves a blob by hash.
   */
  getBlob(hash: string): CasBlob | undefined {
    return this.blobs.get(hash);
  }

  /**
   * Synthesizes and stores a deterministic Merkle tree from a collection of files.
   */
  putTree(files: readonly { path: string; data: Uint8Array | string; mode?: number }[]): {
    treeHash: string;
    entries: readonly TreeEntry[];
    totalBytes: number;
  } {
    const entries: TreeEntry[] = [];
    let totalBytes = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const blob = this.putBlob(file.data);
      totalBytes += blob.size;
      entries.push({
        path: file.path.replace(/\\/g, "/"),
        hash: blob.hash,
        mode: file.mode ?? 0o644,
        size: blob.size,
      });
    }

    // Sort deterministically by file path
    entries.sort((a, b) => a.path.localeCompare(b.path));

    const manifest = entries.map((e) => `${e.mode.toString(8)} ${e.hash} ${e.path}`).join("\n");
    const treeHash = this.hashData(manifest);

    this.trees.set(treeHash, entries);

    return {
      treeHash,
      entries,
      totalBytes,
    };
  }

  /**
   * Retrieves a Merkle tree by hash.
   */
  getTree(treeHash: string): readonly TreeEntry[] | undefined {
    return this.trees.get(treeHash);
  }

  /**
   * Creates and commits a checkpoint node pointing to a Merkle tree.
   */
  createCommit(
    message: string,
    files: readonly { path: string; data: Uint8Array | string; mode?: number }[],
    frameIndex: number = 1
  ): CheckpointNode {
    const { treeHash, entries, totalBytes } = this.putTree(files);
    const commitId = this.hashData(`commit:${this.headId || "root"}:${treeHash}:${message}:${Date.now()}`);

    const commit: CheckpointNode = {
      id: commitId,
      parentId: this.headId,
      treeHash,
      message: message.trim(),
      frameIndex,
      timestamp: Date.now(),
      stats: {
        fileCount: entries.length,
        byteCount: totalBytes,
      },
    };

    this.commits.set(commitId, commit);
    this.headId = commitId;
    return commit;
  }

  /**
   * Retrieves a commit by ID.
   */
  getCommit(commitId: string): CheckpointNode | undefined {
    return this.commits.get(commitId);
  }

  /**
   * Returns the current HEAD commit ID.
   */
  getHead(): CheckpointNode | undefined {
    return this.headId ? this.commits.get(this.headId) : undefined;
  }

  /**
   * Sets the current HEAD to an existing commit.
   */
  setHead(commitId: string): boolean {
    if (!this.commits.has(commitId)) {
      return false;
    }
    this.headId = commitId;
    return true;
  }

  /**
   * Returns storage stats.
   */
  getStats(): { totalBlobs: number; totalBytes: number; checkpointCount: number; currentHeadId?: string } {
    let totalBytes = 0;
    for (const blob of this.blobs.values()) {
      totalBytes += blob.size;
    }
    return {
      totalBlobs: this.blobs.size,
      totalBytes,
      checkpointCount: this.commits.size,
      currentHeadId: this.headId,
    };
  }

  /**
   * Clears all storage.
   */
  clear(): void {
    this.blobs.clear();
    this.trees.clear();
    this.commits.clear();
    this.headId = undefined;
  }
}
