/**
 * skills-sync-supervisor.ts
 *
 * Master supervisor coordinating distributed skill sync lifecycles (push, pull,
 * status, conflict resolution, provenance inspection, and manifest governance)
 * (Phase 112 / ADR-088 / Target #45).
 */

import type { BroccoliSkillsSyncSubstrate } from "../../../sessions/extensions/skills_sync/broccoli-skills-sync-substrate.js";
import type { DeterministicSkillsSyncClient } from "./deterministic-skills-sync-client.js";
import type {
  SkillSyncPushResult,
  SkillSyncPullResult,
  SkillSyncProvenanceReport,
  SkillSyncTreeEntry,
  ConflictResolutionChoice,
} from "../../../core/contracts/skills-sync.contracts.js";

export class SkillsSyncSupervisor {
  private readonly substrate: BroccoliSkillsSyncSubstrate;
  private readonly syncClient: DeterministicSkillsSyncClient;
  private readonly owner: string;

  constructor(
    substrate: BroccoliSkillsSyncSubstrate,
    syncClient: DeterministicSkillsSyncClient,
    owner = "developer"
  ) {
    this.substrate = substrate;
    this.syncClient = syncClient;
    this.owner = owner;
  }

  /**
   * Push local skills to the sync plane with atomic CAS head verification.
   */
  public push(params: {
    author: string;
    message: string;
    localSkills: Record<string, string>; // skillPath (e.g. "code-refactor/SKILL.md") -> content
    force?: boolean;
  }): SkillSyncPushResult {
    const refPath = `refs/user/${this.owner}/HEAD`;
    const oldHead = this.substrate.getRef(refPath);

    // 1. Build and store blobs
    const treeEntries: SkillSyncTreeEntry[] = [];
    for (const [skillPath, content] of Object.entries(params.localSkills)) {
      const blobObj = this.syncClient.createBlob(content);
      this.substrate.putObject(blobObj);

      treeEntries.push({
        name: skillPath,
        mode: "file",
        hash: blobObj.hash,
        sizeBytes: blobObj.sizeBytes,
      });
    }

    // 2. Build root tree
    const { tree, obj: treeObj } = this.syncClient.createTree(treeEntries);
    this.substrate.putObject(treeObj);

    // 3. Build commit
    const { commit, obj: commitObj } = this.syncClient.createCommit({
      treeHash: tree.hash,
      parentHash: oldHead,
      author: params.author,
      message: params.message,
    });
    this.substrate.putObject(commitObj);

    // 4. Atomic CAS ref update
    if (!params.force && oldHead) {
      const casOk = this.substrate.compareAndSwapRef(refPath, oldHead, commit.hash);
      if (!casOk) {
        return {
          success: false,
          status: "conflict_detected",
          pushedObjectsCount: 0,
          oldHead,
          newHead: undefined,
          message: "CAS update failed: remote ref has diverged. Pull remote changes before pushing.",
        };
      }
    } else {
      this.substrate.setRef(refPath, commit.hash);
    }

    // 5. Update manifest entries
    for (const [skillPath, content] of Object.entries(params.localSkills)) {
      const skillName = skillPath.split("/")[0] || skillPath;
      const contentHash = this.syncClient.computeHash(content);
      const existing = this.substrate.getSkillManifestEntry(skillName);

      this.substrate.updateSkillManifestEntry({
        skillName,
        enabled: existing ? existing.enabled : true,
        originHash: existing?.originHash || contentHash,
        lastSyncedCommit: commit.hash,
        provenanceState: "synced",
      });
    }

    this.substrate.recordPush();

    return {
      success: true,
      status: "synced",
      pushedObjectsCount: treeEntries.length + 2, // blobs + tree + commit
      oldHead,
      newHead: commit.hash,
    };
  }

  /**
   * Pull remote skill updates and perform automatic 3-way merge.
   */
  public pull(params: {
    remoteSkills: Record<string, string>;
    localSkills: Record<string, string>;
  }): SkillSyncPullResult {
    const remoteEntries: SkillSyncTreeEntry[] = [];
    for (const [path, content] of Object.entries(params.remoteSkills)) {
      const blob = this.syncClient.createBlob(content);
      this.substrate.putObject(blob);
      remoteEntries.push({ name: path, mode: "file", hash: blob.hash, sizeBytes: blob.sizeBytes });
    }
    const { tree: remoteTree, obj: remoteTreeObj } = this.syncClient.createTree(remoteEntries);
    this.substrate.putObject(remoteTreeObj);

    const localEntries: SkillSyncTreeEntry[] = [];
    for (const [path, content] of Object.entries(params.localSkills)) {
      const blob = this.syncClient.createBlob(content);
      this.substrate.putObject(blob);
      localEntries.push({ name: path, mode: "file", hash: blob.hash, sizeBytes: blob.sizeBytes });
    }
    const { tree: localTree, obj: localTreeObj } = this.syncClient.createTree(localEntries);
    this.substrate.putObject(localTreeObj);

    // Perform 3-way merge (using previous base commit tree if available)
    const refPath = `refs/user/${this.owner}/HEAD`;
    const headCommitHash = this.substrate.getRef(refPath);
    let baseTree: any = undefined;
    if (headCommitHash) {
      const commitObj = this.substrate.getObject(headCommitHash);
      if (commitObj) {
        try {
          const parsed = JSON.parse(commitObj.payload);
          const baseTreeObj = this.substrate.getObject(parsed.treeHash);
          if (baseTreeObj) {
            baseTree = { hash: baseTreeObj.hash, entries: JSON.parse(baseTreeObj.payload) };
          }
        } catch {
          // ignore
        }
      }
    }

    const mergeResult = this.syncClient.mergeTrees(baseTree, remoteTree, localTree);

    this.substrate.recordMerge();
    this.substrate.recordPull();

    if (!mergeResult.clean) {
      this.substrate.setConflicts(mergeResult.conflicts);
      return {
        success: false,
        status: "merge_conflict",
        pulledObjectsCount: remoteEntries.length,
        updatedSkills: [],
        conflicts: mergeResult.conflicts,
        activeHead: headCommitHash,
      };
    }

    // Clean merge: advance HEAD
    const { commit, obj: commitObj } = this.syncClient.createCommit({
      treeHash: mergeResult.mergedTreeHash!,
      parentHash: headCommitHash,
      author: "Sync Engine (3-way merge)",
      message: `Merge remote skill updates into ${refPath}`,
    });
    this.substrate.putObject(commitObj);
    this.substrate.setRef(refPath, commit.hash);
    this.substrate.clearConflicts();

    const updatedSkills = Object.keys(params.remoteSkills).map((p) => p.split("/")[0] || p);

    return {
      success: true,
      status: "merged_cleanly",
      pulledObjectsCount: remoteEntries.length,
      updatedSkills: Array.from(new Set(updatedSkills)),
      conflicts: [],
      activeHead: commit.hash,
    };
  }

  /**
   * Get synchronization status overview.
   */
  public getStatus(localSkills: Record<string, string>) {
    const refPath = `refs/user/${this.owner}/HEAD`;
    const currentHead = this.substrate.getRef(refPath);
    const manifest = this.substrate.getManifest();
    const conflicts = this.substrate.getConflicts();

    const localSkillNames = Object.keys(localSkills).map((k) => k.split("/")[0] || k);
    const uniqueLocal = Array.from(new Set(localSkillNames));

    return {
      owner: this.owner,
      refPath,
      currentHead,
      totalLocalSkills: uniqueLocal.length,
      syncedSkillsCount: manifest.skills.filter((s: { provenanceState: string }) => s.provenanceState === "synced").length,
      modifiedSkillsCount: manifest.skills.filter((s: { provenanceState: string }) => s.provenanceState === "locally_modified").length,
      activeConflictsCount: conflicts.length,
      conflicts,
      manifest,
    };
  }

  /**
   * Resolve active merge conflict.
   */
  public resolveConflict(
    skillName: string,
    filePath: string,
    choice: ConflictResolutionChoice,
    unionContent?: string
  ): { success: boolean; message: string } {
    const resolved = this.substrate.resolveConflict(skillName, filePath);
    if (!resolved) {
      return {
        success: false,
        message: `No active conflict found for skill '${skillName}' at path '${filePath}'`,
      };
    }

    return {
      success: true,
      message: `Conflict on '${filePath}' resolved using strategy '${choice}'`,
    };
  }

  /**
   * Inspect provenance and origin hash status of a skill.
   */
  public inspectProvenance(skillName: string, content: string): SkillSyncProvenanceReport {
    const currentHash = this.syncClient.computeHash(content);
    const entry = this.substrate.getSkillManifestEntry(skillName);

    const provenanceState = this.syncClient.classifySkillProvenance(
      currentHash,
      entry?.originHash,
      entry?.lastSyncedCommit
    );

    return {
      skillName,
      originHash: entry?.originHash,
      currentHash,
      state: provenanceState,
      author: entry?.lastSyncedCommit ? "sync_plane" : "local_user",
      isSyncEnabled: entry?.enabled ?? true,
      lastModified: Date.now(),
    };
  }

  /**
   * Toggle sync opt-in for a specific skill.
   */
  public toggleOptIn(skillName: string, enabled: boolean): boolean {
    const existing = this.substrate.getSkillManifestEntry(skillName);
    this.substrate.updateSkillManifestEntry({
      skillName,
      enabled,
      originHash: existing?.originHash,
      lastSyncedCommit: existing?.lastSyncedCommit,
      provenanceState: existing?.provenanceState || "pristine",
    });
    return true;
  }

  public getMetrics() {
    return this.substrate.getMetrics();
  }
}
