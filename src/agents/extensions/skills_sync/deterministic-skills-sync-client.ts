/**
 * deterministic-skills-sync-client.ts
 *
 * Content-addressed SHA-256 object creation (blobs, trees, commits),
 * 3-way tree merge engine, and provenance classifier (Phase 112 / ADR-088 / Target #45).
 */

import { createHash } from "node:crypto";
import type {
  SkillSyncObject,
  SkillSyncTree,
  SkillSyncTreeEntry,
  SkillSyncCommit,
  SkillThreeWayMergeResult,
  SkillThreeWayMergeConflict,
  SkillProvenanceState,
} from "../../../core/contracts/skills-sync.contracts.js";

export class DeterministicSkillsSyncClient {
  /**
   * Compute deterministic SHA-256 hash.
   */
  public computeHash(content: string): string {
    return createHash("sha256").update(content, "utf8").digest("hex");
  }

  /**
   * Create content-addressed blob object.
   */
  public createBlob(content: string): SkillSyncObject {
    const hash = this.computeHash(`blob\0${content}`);
    return {
      hash,
      kind: "blob",
      sizeBytes: Buffer.byteLength(content, "utf8"),
      payload: content,
    };
  }

  /**
   * Create content-addressed tree object with canonical lexicographical sorting.
   */
  public createTree(entries: readonly SkillSyncTreeEntry[]): { tree: SkillSyncTree; obj: SkillSyncObject } {
    // Sort entries strictly by name for canonical Merkle tree hashing
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
    const serialized = JSON.stringify(sorted);
    const hash = this.computeHash(`tree\0${serialized}`);

    const tree: SkillSyncTree = {
      hash,
      entries: sorted,
    };

    const obj: SkillSyncObject = {
      hash,
      kind: "tree",
      sizeBytes: Buffer.byteLength(serialized, "utf8"),
      payload: serialized,
    };

    return { tree, obj };
  }

  /**
   * Create content-addressed commit object.
   */
  public createCommit(params: {
    treeHash: string;
    parentHash?: string;
    author: string;
    message: string;
    timestamp?: number;
  }): { commit: SkillSyncCommit; obj: SkillSyncObject } {
    const timestamp = params.timestamp ?? Date.now();
    const payloadObj = {
      treeHash: params.treeHash,
      parentHash: params.parentHash,
      author: params.author,
      message: params.message,
      timestamp,
    };
    const serialized = JSON.stringify(payloadObj);
    const hash = this.computeHash(`commit\0${serialized}`);

    const commit: SkillSyncCommit = {
      hash,
      treeHash: params.treeHash,
      parentHash: params.parentHash,
      author: params.author,
      message: params.message,
      timestamp,
    };

    const obj: SkillSyncObject = {
      hash,
      kind: "commit",
      sizeBytes: Buffer.byteLength(serialized, "utf8"),
      payload: serialized,
    };

    return { commit, obj };
  }

  /**
   * Perform 3-way tree merge between common ancestor (base), remote, and local workspace tree.
   */
  public mergeTrees(
    baseTree?: SkillSyncTree,
    remoteTree?: SkillSyncTree,
    localTree?: SkillSyncTree
  ): SkillThreeWayMergeResult {
    const baseMap = new Map<string, SkillSyncTreeEntry>();
    const remoteMap = new Map<string, SkillSyncTreeEntry>();
    const localMap = new Map<string, SkillSyncTreeEntry>();

    if (baseTree) {
      for (const entry of baseTree.entries) baseMap.set(entry.name, entry);
    }
    if (remoteTree) {
      for (const entry of remoteTree.entries) remoteMap.set(entry.name, entry);
    }
    if (localTree) {
      for (const entry of localTree.entries) localMap.set(entry.name, entry);
    }

    const allKeys = new Set<string>([
      ...baseMap.keys(),
      ...remoteMap.keys(),
      ...localMap.keys(),
    ]);

    const mergedEntries: SkillSyncTreeEntry[] = [];
    const conflicts: SkillThreeWayMergeConflict[] = [];
    let autoResolvedCount = 0;

    for (const key of allKeys) {
      const base = baseMap.get(key);
      const remote = remoteMap.get(key);
      const local = localMap.get(key);

      const baseHash = base?.hash;
      const remoteHash = remote?.hash;
      const localHash = local?.hash;

      // Case 1: Remote and local are identical -> clean match
      if (remoteHash === localHash && remote) {
        mergedEntries.push(remote);
        continue;
      }

      // Case 2: Changed only on remote (local untouched matches base) -> accept remote
      if (localHash === baseHash && remote) {
        mergedEntries.push(remote);
        autoResolvedCount++;
        continue;
      }

      // Case 3: Changed only on local (remote untouched matches base) -> keep local
      if (remoteHash === baseHash && local) {
        mergedEntries.push(local);
        autoResolvedCount++;
        continue;
      }

      // Case 4: Both added identically
      if (!base && remoteHash && remoteHash === localHash && remote) {
        mergedEntries.push(remote);
        continue;
      }

      // Case 5: Conflicting edits on both remote and local
      conflicts.push({
        skillName: key.split("/")[0] || key,
        filePath: key,
        baseHash,
        remoteHash,
        localHash,
        conflictReason: `Concurrent modification on '${key}' (base: ${baseHash?.slice(0, 7) || "none"}, remote: ${remoteHash?.slice(0, 7) || "none"}, local: ${localHash?.slice(0, 7) || "none"})`,
      });
    }

    if (conflicts.length > 0) {
      return {
        clean: false,
        conflicts,
        autoResolvedCount,
      };
    }

    const { tree } = this.createTree(mergedEntries);
    return {
      clean: true,
      conflicts: [],
      mergedTreeHash: tree.hash,
      autoResolvedCount,
    };
  }

  /**
   * Classify skill provenance state.
   */
  public classifySkillProvenance(
    currentContentHash: string,
    originHash?: string,
    lastSyncedCommitHash?: string
  ): SkillProvenanceState {
    if (!originHash) {
      return "forked";
    }
    if (currentContentHash === originHash) {
      return "pristine";
    }
    if (lastSyncedCommitHash) {
      return "synced";
    }
    return "locally_modified";
  }
}
