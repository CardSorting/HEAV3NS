/**
 * skills-hub.contracts.ts
 *
 * Core data contracts for Deterministic Skills Hub, Remote Registry Sync
 * & Package Quarantine Subsystem (Phase 89 / ADR-041).
 */

export interface SkillPackage {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly contentHash: string;
  readonly tags: readonly string[];
  readonly dependencies?: readonly string[];
  readonly quarantined?: boolean;
  readonly quarantineReason?: string;
  readonly files: Record<string, string>;
}

export interface SkillRegistryManifest {
  readonly registryUrl: string;
  readonly registryName: string;
  readonly updatedAt: number;
  readonly packages: readonly SkillPackage[];
}

export interface SkillInstallationResult {
  readonly success: boolean;
  readonly packageId: string;
  readonly version: string;
  readonly quarantined: boolean;
  readonly quarantineReason?: string;
  readonly contentHash: string;
  readonly installedAt: number;
  readonly durationMs: number;
  readonly error?: string;
}

export interface SkillsHubWorkspaceSnapshot {
  readonly totalInstalled: number;
  readonly totalQuarantined: number;
  readonly activeRegistries: number;
  readonly totalCachedPackages: number;
  readonly lastSyncTimestamp: number;
  readonly timestamp: number;
}
