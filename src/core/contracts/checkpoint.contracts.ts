/**
 * checkpoint.contracts.ts
 *
 * Core data contracts for the Deterministic Content-Addressable Blob Store,
 * 256-Shard Partitioned CAS Vault, Bloom Filter Probes, Jujutsu Stable Change-IDs,
 * Operation Log (OpLog) Meta-DAG, Ed25519 Cryptographic Signatures, Asynchronous
 * Conflict Materialization, Bisect Engine & State Branch Trees (Phase 87 / ADR-039).
 */

export interface CasChunk {
  readonly hash: string;
  readonly size: number;
  readonly data: Uint8Array;
  readonly offset: number;
  readonly index: number;
}

export interface CasChunkManifest {
  readonly blobHash: string;
  readonly totalSize: number;
  readonly chunkHashes: readonly string[];
  readonly chunkCount: number;
  readonly algorithm: "sha256" | "blake3";
}

export interface CasDeltaPatch {
  readonly sourceHash: string;
  readonly targetHash: string;
  readonly deltaBytes: number;
  readonly deltaData: Uint8Array;
}

export interface CasDeltaCompressionStats {
  readonly originalBytes: number;
  readonly deltaBytes: number;
  readonly savingsRatio: number;
  readonly patchCount: number;
}

export interface CasBlob {
  readonly hash: string;
  readonly shardPrefix: string; // e.g. "a1", "0f" (256-shard partitioning)
  readonly size: number;
  readonly data: Uint8Array;
  readonly mimeType?: string;
  readonly isChunked?: boolean;
  readonly manifest?: CasChunkManifest;
  readonly deltaPatch?: CasDeltaPatch;
}

export interface BloomFilterManifest {
  readonly treeHash: string;
  readonly sizeBits: number;
  readonly hashFunctionsCount: number;
  readonly bitArray: Uint8Array;
}

export interface TreeEntry {
  readonly path: string;
  readonly hash: string;
  readonly mode: number; // e.g. 0o644 (file), 0o755 (exec), 0o120000 (symlink)
  readonly size: number;
  readonly isChunked?: boolean;
  readonly chunkHashes?: readonly string[];
}

export interface CheckpointBranchRef {
  readonly name: string;
  readonly commitId: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CheckpointTagRef {
  readonly name: string;
  readonly commitId: string;
  readonly message?: string;
  readonly createdAt: number;
}

export interface CheckpointSignatureManifest {
  readonly commitId: string;
  readonly algorithm: "ed25519";
  readonly publicKeyHex: string;
  readonly signatureHex: string;
  readonly signedAt: number;
  readonly verified: boolean;
}

export interface CheckpointNode {
  readonly id: string;
  readonly changeId: string; // Jujutsu-style stable identity
  readonly parentId?: string;
  readonly treeHash: string;
  readonly message: string;
  readonly frameIndex: number;
  readonly timestamp: number;
  readonly branchName?: string;
  readonly tags?: readonly string[];
  readonly signature?: CheckpointSignatureManifest;
  readonly stats: {
    readonly fileCount: number;
    readonly byteCount: number;
    readonly chunkCount?: number;
  };
}

export interface CheckpointConflictMarker {
  readonly path: string;
  readonly baseHash?: string;
  readonly oursHash: string;
  readonly theirsHash: string;
  readonly conflictType: "content" | "mode" | "delete_modify";
}

export interface CheckpointConflictManifest {
  readonly mergeCommitId: string;
  readonly conflicts: readonly CheckpointConflictMarker[];
  readonly resolvedCount: number;
  readonly isResolved: boolean;
}

export type CheckpointOpLogType =
  | "commit"
  | "rollback"
  | "branch_create"
  | "branch_switch"
  | "rebase"
  | "squash"
  | "cherry_pick"
  | "revert"
  | "merge"
  | "gc"
  | "undo"
  | "redo";

export interface CheckpointOpLogEntry {
  readonly opId: string;
  readonly opType: CheckpointOpLogType;
  readonly timestamp: number;
  readonly description: string;
  readonly headBefore?: string;
  readonly headAfter?: string;
  readonly activeBranchBefore: string;
  readonly activeBranchAfter: string;
  readonly affectedCommitIds: readonly string[];
}

export interface CheckpointRollbackResult {
  readonly success: boolean;
  readonly targetCheckpointId: string;
  readonly restoredFiles: number;
  readonly restoredBytes: number;
  readonly durationMs: number;
  readonly error?: string;
}

export interface CheckpointMergeResult {
  readonly success: boolean;
  readonly mergedCommitId?: string;
  readonly conflicts: readonly string[];
  readonly conflictManifest?: CheckpointConflictManifest;
  readonly ancestorCommitId?: string;
  readonly durationMs: number;
}

export interface CheckpointDiffResult {
  readonly commitA: string;
  readonly commitB: string;
  readonly added: readonly string[];
  readonly modified: readonly string[];
  readonly deleted: readonly string[];
  readonly patch: string;
}

export interface CheckpointStagingFile {
  readonly path: string;
  readonly data: Uint8Array;
  readonly mode: number;
  readonly stagedAt: number;
}

export interface CheckpointWorkingTreeStatus {
  readonly staged: readonly string[];
  readonly unstaged: readonly string[];
  readonly untracked: readonly string[];
  readonly deleted: readonly string[];
  readonly clean: boolean;
}

export interface CheckpointRebaseResult {
  readonly success: boolean;
  readonly newHeadId?: string;
  readonly rebasedCommitsCount: number;
  readonly conflicts: readonly string[];
  readonly durationMs: number;
}

export interface CheckpointSquashResult {
  readonly success: boolean;
  readonly squashedCommitId?: string;
  readonly squashedCount: number;
  readonly message: string;
}

export interface CheckpointCherryPickResult {
  readonly success: boolean;
  readonly newCommitId?: string;
  readonly cherryPickedFrom: string;
  readonly targetBranch: string;
  readonly conflicts: readonly string[];
  readonly durationMs: number;
}

export interface CheckpointRevertResult {
  readonly success: boolean;
  readonly revertCommitId?: string;
  readonly revertedCommitId: string;
  readonly durationMs: number;
}

export interface CheckpointBisectState {
  readonly goodCommitId: string;
  readonly badCommitId: string;
  readonly currentCandidateId?: string;
  readonly remainingCandidates: readonly string[];
  readonly isResolved: boolean;
  readonly culpritCommitId?: string;
  readonly stepCount: number;
}

export interface CheckpointBisectResult {
  readonly state: CheckpointBisectState;
  readonly recommendation: string;
}

export interface CheckpointBlameLine {
  readonly lineNumber: number;
  readonly content: string;
  readonly commitId: string;
  readonly frameIndex: number;
  readonly timestamp: number;
  readonly message: string;
}

export interface CheckpointBlameReport {
  readonly path: string;
  readonly commitId: string;
  readonly totalLines: number;
  readonly lines: readonly CheckpointBlameLine[];
}

export interface CasPackfileManifest {
  readonly packfileId: string;
  readonly blobCount: number;
  readonly totalBytes: number;
  readonly blobHashes: readonly string[];
  readonly createdAt: number;
}

export interface GitBundleManifest {
  readonly version: string;
  readonly exportedAt: number;
  readonly commitCount: number;
  readonly blobCount: number;
  readonly treeCount: number;
  readonly branchCount: number;
  readonly activeBranch: string;
}

export interface GitBundlePayload {
  readonly manifest: GitBundleManifest;
  readonly commits: readonly CheckpointNode[];
  readonly trees: Record<string, readonly TreeEntry[]>;
  readonly blobs: Record<string, { size: number; base64: string; mimeType?: string }>;
  readonly branches: readonly CheckpointBranchRef[];
  readonly tags: readonly CheckpointTagRef[];
}

export interface CheckpointWorkspaceSnapshot {
  readonly totalBlobs: number;
  readonly totalBytes: number;
  readonly totalChunks?: number;
  readonly checkpointCount: number;
  readonly currentHeadId?: string;
  readonly activeBranch?: string;
  readonly branches?: readonly CheckpointBranchRef[];
  readonly timestamp: number;
  readonly checkpoints?: readonly CheckpointNode[];
  readonly stagingArea?: Record<string, CheckpointStagingFile>;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface CheckpointNodeRow {
  readonly id: string;
  readonly changeId: string;
  readonly parentId?: string;
  readonly treeHash: string;
  readonly message: string;
  readonly frameIndex: number;
  readonly timestamp: number;
  readonly fileCount: number;
  readonly byteCount: number;
  readonly branchName?: string;
  readonly [key: string]: unknown;
}

export interface CheckpointBlobRow {
  readonly id: string;
  readonly hash: string;
  readonly shardPrefix: string;
  readonly size: number;
  readonly mimeType?: string;
  readonly isChunked: boolean;
  readonly createdAt: number;
  readonly [key: string]: unknown;
}

export interface CheckpointTreeRow {
  readonly id: string;
  readonly treeHash: string;
  readonly entryCount: number;
  readonly totalSize: number;
  readonly createdAt: number;
  readonly [key: string]: unknown;
}

export interface CheckpointRefRow {
  readonly id: string;
  readonly name: string;
  readonly type: "branch" | "tag";
  readonly commitId: string;
  readonly message?: string;
  readonly updatedAt: number;
  readonly [key: string]: unknown;
}

export interface CheckpointChunkRow {
  readonly id: string;
  readonly hash: string;
  readonly size: number;
  readonly blobHash: string;
  readonly offset: number;
  readonly [key: string]: unknown;
}

export interface CheckpointOpLogRow {
  readonly id: string;
  readonly opType: string;
  readonly description: string;
  readonly headBefore?: string;
  readonly headAfter?: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface CheckpointAuditRow {
  readonly id: string;
  readonly action: string;
  readonly operator: string;
  readonly targetId: string;
  readonly reason: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Checkpoint Diagnostics
// ---------------------------------------------------------------------------

export type CheckpointHealthStatus =
  | "optimal"
  | "healthy"
  | "fragmented"
  | "bloat_warning";

export interface CheckpointHealthAuditReport {
  readonly totalCheckpoints: number;
  readonly totalBlobs: number;
  readonly totalBytes: number;
  readonly totalChunks: number;
  readonly deduplicationRatio: number;
  readonly deltaSavingsRatio?: number;
  readonly healthStatus: CheckpointHealthStatus;
  readonly avgFilesPerCommit: number;
  readonly activeBranches: number;
  readonly activeShards: number;
  readonly opLogCount: number;
  readonly recommendations: readonly string[];
}

export interface CheckpointMetricsReport {
  readonly totalCheckpoints: number;
  readonly totalBlobs: number;
  readonly totalBytes: number;
  readonly totalChunks: number;
  readonly totalTrees: number;
  readonly currentHeadId?: string;
  readonly activeBranch: string;
  readonly deduplicationRatio: number;
  readonly deltaSavingsRatio: number;
  readonly activeShards: number;
  readonly opLogCount: number;
  readonly p50RollbackMs: number;
  readonly p95RollbackMs: number;
  readonly commitFrequencyPerTurn: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type CheckpointGroupBy = "frame" | "size" | "parent" | "date" | "branch";

export type CheckpointSortBy = "timestamp" | "frameIndex" | "byteCount" | "fileCount";

export type CheckpointSortDirection = "asc" | "desc";

export interface CheckpointGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly totalBytes: number;
  readonly checkpoints: readonly CheckpointNode[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface CheckpointDslQueryFilter {
  readonly rawQuery: string;
  readonly commitId?: string;
  readonly branchName?: string;
  readonly frameIndex?: number;
  readonly minFiles?: number;
  readonly maxFiles?: number;
  readonly minBytes?: number;
  readonly maxBytes?: number;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface CheckpointMutationUndoRecord {
  readonly mutationType: "commit" | "rollback" | "prune" | "branch" | "tag" | "rebase" | "squash" | "cherry_pick" | "revert" | "oplog_undo" | "bulk";
  readonly previousSnapshot: CheckpointWorkspaceSnapshot;
  readonly nextSnapshot: CheckpointWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface CheckpointBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly updatedCheckpointIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliCheckpointSubstrate {
  recordCheckpoint(node: CheckpointNode, totalBlobs: number, totalBytes: number, totalChunks?: number): void;
  setHead(commitId?: string): void;
  getHead(): string | undefined;
  setActiveBranch(branchName: string): void;
  getActiveBranch(): string;
  createBranch(name: string, commitId: string): CheckpointBranchRef;
  getBranch(name: string): CheckpointBranchRef | undefined;
  listBranches(): readonly CheckpointBranchRef[];
  createTag(name: string, commitId: string, message?: string): CheckpointTagRef;
  listTags(): readonly CheckpointTagRef[];
  listCheckpoints(limit?: number): readonly CheckpointNode[];
  getCheckpoint(id: string): CheckpointNode | undefined;
  stageFile(path: string, content: Uint8Array | string, mode?: number): void;
  unstageFile(path: string): boolean;
  getStagedFiles(): readonly CheckpointStagingFile[];
  clearStaging(): void;
  recordOpLog(opType: CheckpointOpLogType, description: string, headBefore?: string, headAfter?: string, affectedCommitIds?: readonly string[]): CheckpointOpLogEntry;
  getOpLog(limit?: number): readonly CheckpointOpLogEntry[];
  getCheckpointMetrics(): CheckpointMetricsReport;
  auditCheckpointHealth(): CheckpointHealthAuditReport;
  getGroupedCheckpoints(groupBy?: CheckpointGroupBy, sortBy?: CheckpointSortBy, direction?: CheckpointSortDirection): readonly CheckpointGroupedLane[];
  queryCheckpointsDsl(query: CheckpointDslQueryFilter | string): readonly CheckpointNode[];
  bulkDeleteCheckpoints(checkpointIds: readonly string[]): CheckpointBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): CheckpointWorkspaceSnapshot;
  importSnapshot(snapshot: CheckpointWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
