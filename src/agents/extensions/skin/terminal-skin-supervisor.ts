/**
 * terminal-skin-supervisor.ts
 *
 * Master supervisor coordinating active theme loading, banner rendering,
 * spinner animation ticks, and palette resolution (Phase 100 / ADR-054).
 */

import type {
  BannerRenderOptions,
  SkinPalette,
  TerminalSkinPreset,
} from "../../../core/contracts/terminal-skin.contracts.js";
import { DeterministicSkinEngine } from "../../../tooling/extensions/skin/deterministic-skin-engine.js";
import { BroccoliSkinSubstrate } from "../../../sessions/extensions/skin/broccoli-skin-substrate.js";

export class TerminalSkinSupervisor {
  private engine: DeterministicSkinEngine;
  private substrate: BroccoliSkinSubstrate;

  constructor(
    engine: DeterministicSkinEngine,
    substrate: BroccoliSkinSubstrate
  ) {
    this.engine = engine;
    this.substrate = substrate;
  }

  getActiveSkinName(): string {
    return this.substrate.getActiveSkin();
  }

  setActiveSkinName(name: string): boolean {
    const preset = this.engine.getPreset(name);
    if (!preset) {
      return false;
    }
    this.substrate.setActiveSkin(name);
    return true;
  }

  renderWelcomeBanner(options: BannerRenderOptions = {}): string {
    const activeSkin = options.activeSkinName || this.substrate.getActiveSkin();
    return this.engine.renderBanner({
      ...options,
      activeSkinName: activeSkin,
    });
  }

  getSpinnerAnimation(
    tickIndex: number,
    phase: "waiting" | "thinking" = "waiting"
  ): string {
    const activeSkin = this.substrate.getActiveSkin();
    return this.engine.getSpinnerFrame(tickIndex, phase, activeSkin);
  }

  getThemePalette(skinName?: string, isLightMode: boolean = false): SkinPalette {
    const targetSkin = skinName || this.substrate.getActiveSkin();
    return this.engine.resolvePalette(targetSkin, isLightMode);
  }

  registerCustomTheme(preset: TerminalSkinPreset): void {
    this.engine.registerCustomPreset(preset);
    this.substrate.setCustomPreset(preset);
  }

  listAvailableThemes(): readonly TerminalSkinPreset[] {
    return this.engine.getAllPresets();
  }
}
