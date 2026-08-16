/**
 * broccoli-skills-sync-substrate.ts
 *
 * In-memory Broccolidb substrate repository maintaining content-addressed sync objects
 * (blobs, trees, commits), ref tables (refs/user/<owner>/HEAD), sync manifests, and
 * active merge conflict ledgers (Phase 112 / ADR-088 / Target #45).
 */

import {
  SYNC_WIRE_VERSION,
  type SkillSyncObject,
  type SkillSyncManifest,
  type SkillSyncManifestEntry,
  type SkillThreeWayMergeConflict,
  type SkillSyncWorkspaceSnapshot,
} from "../../../core/contracts/skills-sync.contracts.js";

export class BroccoliSkillsSyncSubstrate {
  private readonly objects = new Map<string, SkillSyncObject>();
  private readonly refs = new Map<string, string>(); // refPath -> commitHash
  private manifest: SkillSyncManifest = {
    version: SYNC_WIRE_VERSION,
    owner: "default_owner",
    skills: [],
  };
  private readonly activeConflicts: SkillThreeWayMergeConflict[] = [];

  private totalPushes = 0;
  private totalPulls = 0;
  private totalMerges = 0;

  constructor(owner = "default_owner") {
    this.manifest = {
      version: SYNC_WIRE_VERSION,
      owner,
      skills: [],
    };
  }

  // Object Store Operations
  public putObject(obj: SkillSyncObject): void {
    this.objects.set(obj.hash, obj);
  }

  public getObject(hash: string): SkillSyncObject | undefined {
    return this.objects.get(hash);
  }

  public hasObject(hash: string): boolean {
    return this.objects.has(hash);
  }

  public listObjects(): readonly SkillSyncObject[] {
    return Array.from(this.objects.values());
  }

  // Ref Head Management (CAS)
  public getRef(refPath: string): string | undefined {
    return this.refs.get(refPath);
  }

  public setRef(refPath: string, commitHash: string): void {
    this.refs.set(refPath, commitHash);
  }

  /**
   * Atomic Compare-And-Swap on ref head.
   */
  public compareAndSwapRef(refPath: string, expectedOldHash: string | undefined, newHash: string): boolean {
    const current = this.refs.get(refPath);
    if (current !== expectedOldHash) {
      return false;
    }
    this.refs.set(refPath, newHash);
    return true;
  }

  // Manifest Operations
  public getManifest(): SkillSyncManifest {
    return { ...this.manifest, skills: [...this.manifest.skills] };
  }

  public setManifest(manifest: SkillSyncManifest): void {
    this.manifest = { ...manifest, skills: [...manifest.skills] };
  }

  public updateSkillManifestEntry(entry: SkillSyncManifestEntry): void {
    const idx = this.manifest.skills.findIndex((s) => s.skillName === entry.skillName);
    if (idx >= 0) {
      const skills = [...this.manifest.skills];
      skills[idx] = entry;
      this.manifest = { ...this.manifest, skills };
    } else {
      this.manifest = {
        ...this.manifest,
        skills: [...this.manifest.skills, entry],
      };
    }
  }

  public getSkillManifestEntry(skillName: string): SkillSyncManifestEntry | undefined {
    return this.manifest.skills.find((s) => s.skillName === skillName);
  }

  // Conflict Management
  public setConflicts(conflicts: readonly SkillThreeWayMergeConflict[]): void {
    this.activeConflicts.length = 0;
    this.activeConflicts.push(...conflicts);
  }

  public getConflicts(): readonly SkillThreeWayMergeConflict[] {
    return [...this.activeConflicts];
  }

  public resolveConflict(skillName: string, filePath: string): boolean {
    const idx = this.activeConflicts.findIndex(
      (c) => c.skillName === skillName && c.filePath === filePath
    );
    if (idx >= 0) {
      this.activeConflicts.splice(idx, 1);
      return true;
    }
    return false;
  }

  public clearConflicts(): void {
    this.activeConflicts.length = 0;
  }

  // Metrics & Stats
  public recordPush(): void {
    this.totalPushes++;
  }

  public recordPull(): void {
    this.totalPulls++;
  }

  public recordMerge(): void {
    this.totalMerges++;
  }

  public getMetrics() {
    return {
      totalObjects: this.objects.size,
      totalRefs: this.refs.size,
      manifestSkillsCount: this.manifest.skills.length,
      activeConflictsCount: this.activeConflicts.length,
      totalPushes: this.totalPushes,
      totalPulls: this.totalPulls,
      totalMerges: this.totalMerges,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): SkillSyncWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      currentHead: this.refs.get(`refs/user/${this.manifest.owner}/HEAD`),
      objects: Array.from(this.objects.values()),
      manifest: { ...this.manifest, skills: [...this.manifest.skills] },
      conflicts: [...this.activeConflicts],
    };
  }

  public restoreSnapshot(snapshot: SkillSyncWorkspaceSnapshot): void {
    this.objects.clear();
    for (const obj of snapshot.objects) {
      this.objects.set(obj.hash, obj);
    }

    this.refs.clear();
    if (snapshot.currentHead) {
      this.refs.set(`refs/user/${snapshot.manifest.owner}/HEAD`, snapshot.currentHead);
    }

    this.manifest = { ...snapshot.manifest, skills: [...snapshot.manifest.skills] };
    this.activeConflicts.length = 0;
    this.activeConflicts.push(...snapshot.conflicts);
  }

  public clear(): void {
    this.objects.clear();
    this.refs.clear();
    this.manifest = { version: SYNC_WIRE_VERSION, owner: this.manifest.owner, skills: [] };
    this.activeConflicts.length = 0;
    this.totalPushes = 0;
    this.totalPulls = 0;
    this.totalMerges = 0;
  }
}
