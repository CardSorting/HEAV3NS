/**
 * skills-hub-supervisor.ts
 *
 * Master Skills Hub Supervisor coordinating remote package discovery, cryptographic
 * integrity validation, and in-memory registry synchronization (Phase 89 / ADR-041).
 */

import type {
  SkillInstallationResult,
  SkillPackage,
  SkillRegistryManifest,
  SkillsHubWorkspaceSnapshot,
} from "../../../core/contracts/skills-hub.contracts.js";
import { DeterministicSkillsHub } from "../../../tooling/extensions/skills-hub/deterministic-skills-hub.js";
import { BroccoliSkillsHubSubstrate } from "../../../sessions/extensions/skills-hub/broccoli-skills-hub-substrate.js";

export class SkillsHubSupervisor {
  private hub: DeterministicSkillsHub;
  private substrate: BroccoliSkillsHubSubstrate;

  constructor(hub: DeterministicSkillsHub, substrate: BroccoliSkillsHubSubstrate) {
    this.hub = hub;
    this.substrate = substrate;
  }

  /**
   * Searches skill packages across active registries.
   */
  search(query: string, tag?: string): readonly SkillPackage[] {
    return this.hub.search(query, tag);
  }

  /**
   * Installs a skill package with SHA-256 integrity and quarantine triage.
   */
  install(packageId: string): SkillInstallationResult {
    const result = this.hub.installPackage(packageId);
    const pkg = this.hub.findPackage(packageId);
    this.substrate.recordInstallation(result, pkg);
    return result;
  }

  /**
   * Adds a remote registry manifest.
   */
  registerManifest(manifest: SkillRegistryManifest): void {
    this.hub.registerManifest(manifest);
    this.substrate.storeManifest(manifest);
  }

  /**
   * Returns current installed skill packages.
   */
  listInstalled(): readonly SkillPackage[] {
    return this.hub.listInstalled();
  }

  /**
   * Returns quarantined skill packages.
   */
  listQuarantined(): readonly SkillPackage[] {
    return this.hub.listQuarantined();
  }

  /**
   * Returns workspace stats.
   */
  getStats(): SkillsHubWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  /**
   * Returns historical installation logs.
   */
  listHistory(limit: number = 20): readonly SkillInstallationResult[] {
    return this.substrate.listHistory(limit);
  }
}
