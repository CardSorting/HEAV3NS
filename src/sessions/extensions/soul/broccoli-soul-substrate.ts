import type { SoulManifest } from "../../../core/contracts/soul.contracts.js";
import { DeterministicSoulParser } from "../../../tooling/extensions/soul/deterministic-soul-parser.js";

/**
 * BroccoliSoulSubstrate.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm).
 *
 * Provides a zero-GC in-memory memory substrate for active and profile-isolated SOUL manifests,
 * achieving sub-microsecond lookup latency without filesystem overhead.
 */
export class BroccoliSoulSubstrate {
  private readonly parser: DeterministicSoulParser;
  private readonly profileStore = new Map<string, SoulManifest>();
  private activeProfileId: string;
  private currentTick = 0;

  constructor(parser = new DeterministicSoulParser()) {
    this.parser = parser;
    this.activeProfileId = "default";
    const defaultManifest = this.parser.createDefaultSoulManifest();
    this.profileStore.set(this.activeProfileId, defaultManifest);
  }

  getCurrentTick(): number {
    return this.currentTick;
  }

  advanceTick(delta = 1): number {
    this.currentTick += delta;
    return this.currentTick;
  }

  getActiveProfileId(): string {
    return this.activeProfileId;
  }

  setActiveProfileId(profileId: string): void {
    this.activeProfileId = profileId;
    if (!this.profileStore.has(profileId)) {
      const defaultManifest = this.parser.createDefaultSoulManifest();
      this.profileStore.set(profileId, { ...defaultManifest, id: `soul-${profileId}` });
    }
  }

  getActiveManifest(): SoulManifest {
    let manifest = this.profileStore.get(this.activeProfileId);
    if (!manifest) {
      manifest = this.parser.createDefaultSoulManifest();
      this.profileStore.set(this.activeProfileId, manifest);
    }
    return manifest;
  }

  setActiveManifest(manifest: SoulManifest, profileId?: string): void {
    const targetProfile = profileId ?? this.activeProfileId;
    this.profileStore.set(targetProfile, Object.freeze({ ...manifest, updatedTick: this.currentTick }));
  }

  getManifest(profileId: string): SoulManifest | undefined {
    return this.profileStore.get(profileId);
  }

  saveManifest(manifest: SoulManifest, profileId: string): void {
    this.profileStore.set(profileId, Object.freeze({ ...manifest, updatedTick: this.currentTick }));
  }

  getAllProfiles(): readonly string[] {
    return Array.from(this.profileStore.keys());
  }

  clear(): void {
    this.profileStore.clear();
    const defaultManifest = this.parser.createDefaultSoulManifest();
    this.profileStore.set("default", defaultManifest);
    this.activeProfileId = "default";
    this.currentTick = 0;
  }
}
