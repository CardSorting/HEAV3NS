/**
 * broccoli-skin-substrate.ts
 *
 * In-memory Broccolidb repository for active terminal skin configurations, custom presets, and themes (Phase 100 / ADR-054).
 */

import type {
  SkinWorkspaceSnapshot,
  TerminalSkinPreset,
} from "../../../core/contracts/terminal-skin.contracts.js";

export class BroccoliSkinSubstrate {
  private activeSkin: string;
  private customPresets: Map<string, TerminalSkinPreset>;

  constructor() {
    this.activeSkin = "default";
    this.customPresets = new Map<string, TerminalSkinPreset>();
  }

  getActiveSkin(): string {
    return this.activeSkin;
  }

  setActiveSkin(name: string): void {
    this.activeSkin = name;
  }

  setCustomPreset(preset: TerminalSkinPreset): void {
    this.customPresets.set(preset.name, preset);
  }

  getCustomPreset(name: string): TerminalSkinPreset | undefined {
    return this.customPresets.get(name);
  }

  getAllCustomPresets(): readonly TerminalSkinPreset[] {
    return Array.from(this.customPresets.values());
  }

  exportSnapshot(): SkinWorkspaceSnapshot {
    return {
      activeSkin: this.activeSkin,
      customPresets: Array.from(this.customPresets.values()),
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: SkinWorkspaceSnapshot): void {
    this.activeSkin = snapshot.activeSkin || "default";
    this.customPresets.clear();
    for (let i = 0; i < snapshot.customPresets.length; i++) {
      const preset = snapshot.customPresets[i];
      this.customPresets.set(preset.name, preset);
    }
  }

  clear(): void {
    this.activeSkin = "default";
    this.customPresets.clear();
  }
}
