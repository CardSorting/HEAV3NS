/**
 * checkpoint-kernel-supervisor.ts
 *
 * Master Checkpoint Kernel Supervisor managing transparent pre-mutation captures,
 * 256-shard CAS storage, Jujutsu-style Change-IDs, OpLog repo time-travel, Ed25519 signatures,
 * Bloom filter path probes, cherry-picking, reverts, bisecting, and zero-disk state rollbacks (Phase 87 / ADR-039).
 */

import { performance } from "node:perf_hooks";
import type {
  CasBlob,
  CasDeltaCompressionStats,
  CasPackfileManifest,
  CheckpointBisectResult,
  CheckpointBisectState,
  CheckpointBlameReport,
  CheckpointBranchRef,
  CheckpointCherryPickResult,
  CheckpointDiffResult,
  CheckpointMergeResult,
  CheckpointNode,
  CheckpointOpLogEntry,
  CheckpointRebaseResult,
  CheckpointRevertResult,
  CheckpointSignatureManifest,
  CheckpointSquashResult,
  CheckpointStagingFile,
  CheckpointTagRef,
  CheckpointWorkingTreeStatus,
  CheckpointWorkspaceSnapshot,
  GitBundlePayload,
  TreeEntry,
} from "../../../core/contracts/checkpoint.contracts.js";
import { DeterministicCasStore } from "../../../tooling/extensions/checkpoint/deterministic-cas-store.js";
import { BroccoliCheckpointSubstrate } from "../../../sessions/extensions/checkpoint/broccoli-checkpoint-substrate.js";

export class CheckpointKernelSupervisor {
  private readonly store: DeterministicCasStore;
  private readonly substrate: BroccoliCheckpointSubstrate;

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
    frameIndex: number = 1,
    parentId?: string,
    branchName?: string,
    existingChangeId?: string
  ): CheckpointNode {
    const commit = this.store.createCommit(message, files, frameIndex, parentId, branchName, existingChangeId);
    const stats = this.store.getStats();
    this.substrate.recordCheckpoint(commit, stats.totalBlobs, stats.totalBytes, stats.totalChunks);
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
        const data = blob.isChunked ? this.store.rehydrateBlob(entry.hash) ?? blob.data : blob.data;
        restoredFiles.push({
          path: entry.path,
          data,
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
   * Dry-run preview of files that would be restored on rollback.
   */
  rollbackDryRun(checkpointId: string): {
    success: boolean;
    fileCount: number;
    totalBytes: number;
    files: readonly string[];
    error?: string;
  } {
    const commit = this.store.getCommit(checkpointId);
    if (!commit) return { success: false, fileCount: 0, totalBytes: 0, files: [], error: `Commit '${checkpointId}' not found` };

    const tree = this.store.getTree(commit.treeHash);
    if (!tree) return { success: false, fileCount: 0, totalBytes: 0, files: [], error: `Tree '${commit.treeHash}' not found` };

    return {
      success: true,
      fileCount: tree.length,
      totalBytes: commit.stats.byteCount,
      files: tree.map((e) => e.path),
    };
  }

  /**
   * Cryptographic commit signing & verification.
   */
  signCommit(commitId: string, privateKeyHex?: string, publicKeyHex?: string): CheckpointSignatureManifest {
    return this.store.signCommit(commitId, privateKeyHex, publicKeyHex);
  }

  verifyCommitSignature(commitId: string): boolean {
    return this.store.verifyCommitSignature(commitId);
  }

  /**
   * Jujutsu-style Change-ID lookup.
   */
  getCommitByChangeId(changeId: string): CheckpointNode | undefined {
    return this.store.getCommitByChangeId(changeId);
  }

  /**
   * Operation Log (OpLog) access.
   */
  getOpLog(limit: number = 50): readonly CheckpointOpLogEntry[] {
    return this.store.getOpLog(limit);
  }

  /**
   * Bloom filter fast path probe.
   */
  probeBloomFilter(treeHash: string, path: string): boolean {
    return this.store.probeBloomFilter(treeHash, path);
  }

  /**
   * Cherry-pick a commit onto a target branch.
   */
  cherryPick(commitId: string, targetBranch: string): CheckpointCherryPickResult {
    const res = this.store.cherryPick(commitId, targetBranch);
    if (res.success && res.newCommitId) {
      const c = this.store.getCommit(res.newCommitId);
      if (c) {
        const stats = this.store.getStats();
        this.substrate.recordCheckpoint(c, stats.totalBlobs, stats.totalBytes, stats.totalChunks);
      }
    }
    return res;
  }

  /**
   * Revert a commit by creating an inverse delta anti-commit.
   */
  revert(commitId: string): CheckpointRevertResult {
    const res = this.store.revert(commitId);
    if (res.success && res.revertCommitId) {
      const c = this.store.getCommit(res.revertCommitId);
      if (c) {
        const stats = this.store.getStats();
        this.substrate.recordCheckpoint(c, stats.totalBlobs, stats.totalBytes, stats.totalChunks);
      }
    }
    return res;
  }

  /**
   * Bisect regression locator.
   */
  startBisect(goodCommitId: string, badCommitId: string): CheckpointBisectResult {
    return this.store.startBisect(goodCommitId, badCommitId);
  }

  stepBisect(verdict: "good" | "bad"): CheckpointBisectResult {
    return this.store.stepBisect(verdict);
  }

  getBisectState(): CheckpointBisectState | undefined {
    return this.store.getBisectState();
  }

  /**
   * Line-level evolution blame attribution.
   */
  blame(path: string, commitId?: string): CheckpointBlameReport {
    return this.store.blame(path, commitId);
  }

  /**
   * Packfile operations.
   */
  createPackfile(blobHashes: readonly string[]): CasPackfileManifest {
    return this.store.createPackfile(blobHashes);
  }

  getPackfile(packfileId: string): CasPackfileManifest | undefined {
    return this.store.getPackfile(packfileId);
  }

  /**
   * Virtual Staging Area Operations.
   */
  stageFile(path: string, content: Uint8Array | string, mode?: number): void {
    this.store.stageFile(path, content, mode);
    this.substrate.stageFile(path, content, mode);
  }

  unstageFile(path: string): boolean {
    const ok = this.store.unstageFile(path);
    if (ok) this.substrate.unstageFile(path);
    return ok;
  }

  getStagedFiles(): readonly CheckpointStagingFile[] {
    return this.store.getStagedFiles();
  }

  clearStaging(): void {
    this.store.clearStaging();
    this.substrate.clearStaging();
  }

  commitStaged(message: string, frameIndex: number = 1): CheckpointNode | undefined {
    const commit = this.store.commitStaged(message, frameIndex);
    if (commit) {
      const stats = this.store.getStats();
      this.substrate.recordCheckpoint(commit, stats.totalBlobs, stats.totalBytes, stats.totalChunks);
      this.substrate.clearStaging();
    }
    return commit;
  }

  getWorkingTreeStatus(currentFiles: readonly { path: string; data: Uint8Array | string }[]): CheckpointWorkingTreeStatus {
    return this.store.getWorkingTreeStatus(currentFiles);
  }

  /**
   * Computes file-level diff between two commits.
   */
  diff(commitA: string, commitB: string): CheckpointDiffResult {
    return this.store.diffCommits(commitA, commitB);
  }

  /**
   * Merges two branches or commits with 3-way conflict detection.
   */
  merge(oursId: string, theirsId: string, baseId?: string): CheckpointMergeResult {
    const res = this.store.mergeCheckpoints(oursId, theirsId, baseId);
    if (res.success && res.mergedCommitId) {
      const mergedCommit = this.store.getCommit(res.mergedCommitId);
      if (mergedCommit) {
        const stats = this.store.getStats();
        this.substrate.recordCheckpoint(mergedCommit, stats.totalBlobs, stats.totalBytes, stats.totalChunks);
      }
    }
    return res;
  }

  /**
   * Rebase branch onto target branch.
   */
  rebase(sourceBranchName: string, ontoBranchName: string): CheckpointRebaseResult {
    return this.store.rebase(sourceBranchName, ontoBranchName);
  }

  /**
   * Squash multiple commits into one.
   */
  squash(commitIds: readonly string[], message: string): CheckpointSquashResult {
    return this.store.squash(commitIds, message);
  }

  /**
   * Git Bundle Interoperability.
   */
  exportGitBundle(): GitBundlePayload {
    return this.store.exportGitBundle();
  }

  importGitBundle(payload: GitBundlePayload): { importedCommits: number; importedBlobs: number } {
    return this.store.importGitBundle(payload);
  }

  getDeltaCompressionStats(): CasDeltaCompressionStats {
    return this.store.getDeltaCompressionStats();
  }

  // ---------------------------------------------------------------------------
  // Branch & Tag Operations
  // ---------------------------------------------------------------------------

  createBranch(name: string, commitId?: string): CheckpointBranchRef {
    const ref = this.store.createBranch(name, commitId);
    this.substrate.createBranch(name, ref.commitId);
    return ref;
  }

  switchBranch(name: string): boolean {
    const ok = this.store.switchBranch(name);
    if (ok) {
      this.substrate.setActiveBranch(name);
    }
    return ok;
  }

  listBranches(): readonly CheckpointBranchRef[] {
    return this.store.listBranches();
  }

  createTag(name: string, commitId: string, message?: string): CheckpointTagRef {
    const tag = this.store.createTag(name, commitId, message);
    this.substrate.createTag(name, commitId, message);
    return tag;
  }

  listTags(): readonly CheckpointTagRef[] {
    return this.store.listTags();
  }

  // ---------------------------------------------------------------------------
  // Maintenance & Forensics
  // ---------------------------------------------------------------------------

  pruneOrphans(): { reclaimedBlobs: number; reclaimedBytes: number; remainingBlobs: number } {
    return this.store.pruneOrphanBlobs();
  }

  verifyIntegrity(): { valid: boolean; verifiedCommits: number; verifiedTrees: number; verifiedBlobs: number; errors: readonly string[] } {
    return this.store.verifyIntegrity();
  }

  getCheckpoint(checkpointId: string): CheckpointNode | undefined {
    return this.store.getCommit(checkpointId);
  }

  getTree(treeHash: string): readonly TreeEntry[] | undefined {
    return this.store.getTree(treeHash);
  }

  getBlob(hash: string): CasBlob | undefined {
    return this.store.getBlob(hash);
  }

  getStats(): CheckpointWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  listCheckpoints(limit: number = 20): readonly CheckpointNode[] {
    return this.substrate.listCheckpoints(limit);
  }

  getStore(): DeterministicCasStore {
    return this.store;
  }

  getSubstrate(): BroccoliCheckpointSubstrate {
    return this.substrate;
  }
}
