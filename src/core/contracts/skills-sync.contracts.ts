/**
 * skills-sync.contracts.ts
 *
 * Core contracts, enums, interfaces, and constants for Distributed Content-Addressed
 * Skill Sync Protocol, CAS Ref Head, 3-Way Merge Resolution & Cryptographic Provenance Ledger
 * (Phase 112 / ADR-088 / Target #45).
 */

export const SYNC_WIRE_VERSION = "1";
export const DEFAULT_MAX_SYNC_OBJECT_BYTES = 26214400; // 25 MiB

export type SyncObjectKind = "blob" | "tree" | "commit";
export type TreeEntryMode = "file" | "exec" | "dir";
export type SkillProvenanceState = "pristine" | "locally_modified" | "forked" | "synced";
export type ConflictResolutionChoice = "ours" | "theirs" | "union";

export interface SkillSyncObject {
  readonly hash: string;
  readonly kind: SyncObjectKind;
  readonly sizeBytes: number;
  readonly payload: string; // Raw text or canonical JSON string
}

export interface SkillSyncTreeEntry {
  readonly name: string;
  readonly mode: TreeEntryMode;
  readonly hash: string;
  readonly sizeBytes: number;
}

export interface SkillSyncTree {
  readonly hash: string;
  readonly entries: readonly SkillSyncTreeEntry[];
}

export interface SkillSyncCommit {
  readonly hash: string;
  readonly treeHash: string;
  readonly parentHash?: string;
  readonly author: string;
  readonly message: string;
  readonly timestamp: number;
}

export interface SkillSyncManifestEntry {
  readonly skillName: string;
  readonly enabled: boolean;
  readonly originHash?: string;
  readonly lastSyncedCommit?: string;
  readonly provenanceState: SkillProvenanceState;
}

export interface SkillSyncManifest {
  readonly version: string;
  readonly owner: string;
  readonly skills: readonly SkillSyncManifestEntry[];
}

export interface SkillThreeWayMergeConflict {
  readonly skillName: string;
  readonly filePath: string;
  readonly baseHash?: string;
  readonly remoteHash?: string;
  readonly localHash?: string;
  readonly conflictReason: string;
}

export interface SkillThreeWayMergeResult {
  readonly clean: boolean;
  readonly conflicts: readonly SkillThreeWayMergeConflict[];
  readonly mergedTreeHash?: string;
  readonly autoResolvedCount: number;
}

export interface SkillSyncPushResult {
  readonly success: boolean;
  readonly status: "synced" | "conflict_detected" | "up_to_date" | "rejected";
  readonly pushedObjectsCount: number;
  readonly oldHead?: string;
  readonly newHead?: string;
  readonly message?: string;
}

export interface SkillSyncPullResult {
  readonly success: boolean;
  readonly status: "up_to_date" | "merged_cleanly" | "merge_conflict" | "error";
  readonly pulledObjectsCount: number;
  readonly updatedSkills: readonly string[];
  readonly conflicts: readonly SkillThreeWayMergeConflict[];
  readonly activeHead?: string;
}

export interface SkillSyncProvenanceReport {
  readonly skillName: string;
  readonly originHash?: string;
  readonly currentHash: string;
  readonly state: SkillProvenanceState;
  readonly author: string;
  readonly isSyncEnabled: boolean;
  readonly lastModified: number;
}

export interface SkillSyncWorkspaceSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly currentHead?: string;
  readonly objects: readonly SkillSyncObject[];
  readonly manifest: SkillSyncManifest;
  readonly conflicts: readonly SkillThreeWayMergeConflict[];
}
