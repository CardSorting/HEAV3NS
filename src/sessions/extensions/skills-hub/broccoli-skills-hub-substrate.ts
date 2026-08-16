/**
 * broccoli-skills-hub-substrate.ts
 *
 * In-memory Broccolidb repository for installed skill packages, remote manifests,
 * quarantine isolation vaults, and audit logs (Phase 89 / ADR-041).
 */

import type {
  SkillInstallationResult,
  SkillPackage,
  SkillRegistryManifest,
  SkillsHubWorkspaceSnapshot,
} from "../../../core/contracts/skills-hub.contracts.js";

export class BroccoliSkillsHubSubstrate {
  private installed: Map<string, SkillPackage>;
  private quarantined: Map<string, SkillPackage>;
  private manifests: Map<string, SkillRegistryManifest>;
  private history: SkillInstallationResult[];

  constructor() {
    this.installed = new Map<string, SkillPackage>();
    this.quarantined = new Map<string, SkillPackage>();
    this.manifests = new Map<string, SkillRegistryManifest>();
    this.history = [];
  }

  recordInstallation(result: SkillInstallationResult, pkg?: SkillPackage): void {
    this.history.push(result);
    if (result.success && pkg) {
      this.installed.set(pkg.id, pkg);
      this.quarantined.delete(pkg.id);
    } else if (result.quarantined && pkg) {
      this.quarantined.set(pkg.id, pkg);
      this.installed.delete(pkg.id);
    }

    if (this.history.length > 200) {
      this.history.shift();
    }
  }

  storeManifest(manifest: SkillRegistryManifest): void {
    this.manifests.set(manifest.registryUrl, manifest);
  }

  listInstalled(): readonly SkillPackage[] {
    return Array.from(this.installed.values());
  }

  listQuarantined(): readonly SkillPackage[] {
    return Array.from(this.quarantined.values());
  }

  listHistory(limit: number = 20): readonly SkillInstallationResult[] {
    return this.history.slice(-limit);
  }

  exportSnapshot(): SkillsHubWorkspaceSnapshot {
    let totalCached = 0;
    for (const m of this.manifests.values()) {
      totalCached += m.packages.length;
    }

    return {
      totalInstalled: this.installed.size,
      totalQuarantined: this.quarantined.size,
      activeRegistries: this.manifests.size,
      totalCachedPackages: totalCached,
      lastSyncTimestamp: Date.now(),
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: SkillsHubWorkspaceSnapshot): void {
    // Retain only elements within snapshot bounds
    if (snapshot.totalInstalled === 0) {
      this.installed.clear();
    }
    if (snapshot.totalQuarantined === 0) {
      this.quarantined.clear();
    }
  }

  clear(): void {
    this.installed.clear();
    this.quarantined.clear();
    this.manifests.clear();
    this.history = [];
  }
}
