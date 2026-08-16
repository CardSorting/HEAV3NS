/**
 * broccoli-auxiliary-substrate.ts
 *
 * In-memory Broccolidb repository for dynamic auxiliary provider configs,
 * task overrides, and fallback routing tables (Phase 101 / ADR-055).
 */

import type {
  AuxiliaryProviderConfig,
  AuxiliaryWorkspaceSnapshot,
} from "../../../core/contracts/auxiliary-router.contracts.js";

export class BroccoliAuxiliarySubstrate {
  private providers: Map<string, AuxiliaryProviderConfig>;
  private taskOverrides: Map<string, AuxiliaryProviderConfig>;
  private freeOnly: boolean;

  constructor() {
    this.providers = new Map<string, AuxiliaryProviderConfig>();
    this.taskOverrides = new Map<string, AuxiliaryProviderConfig>();
    this.freeOnly = false;
  }

  addProvider(config: AuxiliaryProviderConfig): void {
    this.providers.set(config.provider, config);
  }

  removeProvider(provider: string): boolean {
    return this.providers.delete(provider);
  }

  getProvider(provider: string): AuxiliaryProviderConfig | undefined {
    return this.providers.get(provider);
  }

  getAllProviders(): readonly AuxiliaryProviderConfig[] {
    return Array.from(this.providers.values());
  }

  setOverride(taskType: string, config: AuxiliaryProviderConfig): void {
    this.taskOverrides.set(taskType, config);
  }

  removeOverride(taskType: string): void {
    this.taskOverrides.delete(taskType);
  }

  getOverride(taskType: string): AuxiliaryProviderConfig | undefined {
    return this.taskOverrides.get(taskType);
  }

  getAllOverrides(): Record<string, AuxiliaryProviderConfig> {
    const obj: Record<string, AuxiliaryProviderConfig> = {};
    for (const [key, value] of this.taskOverrides.entries()) {
      obj[key] = value;
    }
    return obj;
  }

  setFreeOnly(enabled: boolean): void {
    this.freeOnly = enabled;
  }

  getFreeOnly(): boolean {
    return this.freeOnly;
  }

  exportSnapshot(): AuxiliaryWorkspaceSnapshot {
    return {
      providers: Array.from(this.providers.values()),
      taskOverrides: this.getAllOverrides(),
      freeOnly: this.freeOnly,
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: AuxiliaryWorkspaceSnapshot): void {
    this.providers.clear();
    for (let i = 0; i < snapshot.providers.length; i++) {
      const p = snapshot.providers[i];
      this.providers.set(p.provider, p);
    }

    this.taskOverrides.clear();
    if (snapshot.taskOverrides) {
      for (const [key, value] of Object.entries(snapshot.taskOverrides)) {
        this.taskOverrides.set(key, value);
      }
    }

    this.freeOnly = Boolean(snapshot.freeOnly);
  }

  clear(): void {
    this.providers.clear();
    this.taskOverrides.clear();
    this.freeOnly = false;
  }
}
