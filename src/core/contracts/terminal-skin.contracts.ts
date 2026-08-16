/**
 * terminal-skin.contracts.ts
 *
 * Core contracts for Terminal UI Skin Engine, Theme Palette, and Animated Banner (Phase 100 / ADR-054).
 */

export interface SkinPalette {
  readonly background: string;
  readonly foreground: string;
  readonly accent: string;
  readonly border: string;
  readonly success: string;
  readonly warning: string;
  readonly error: string;
  readonly dim: string;
  readonly text: string;
  readonly reasoning: string;
  readonly tool: string;
}

export interface SpinnerConfig {
  readonly waitingFaces: readonly string[];
  readonly thinkingFaces: readonly string[];
  readonly thinkingVerbs: readonly string[];
  readonly wings: readonly (readonly [string, string])[];
}

export interface SkinBranding {
  readonly agentName: string;
  readonly welcomeMessage: string;
  readonly goodbyeMessage: string;
  readonly responseLabel: string;
}

export interface TerminalSkinPreset {
  readonly name: string;
  readonly description: string;
  readonly colors: SkinPalette;
  readonly lightColors?: Partial<SkinPalette>;
  readonly spinner: SpinnerConfig;
  readonly branding: SkinBranding;
}

export interface BannerRenderOptions {
  readonly width?: number;
  readonly borderStyle?: "rounded" | "sharp" | "double" | "minimal";
  readonly showLogo?: boolean;
  readonly showSkills?: boolean;
  readonly activeSkinName?: string;
}

export interface SkinWorkspaceSnapshot {
  readonly activeSkin: string;
  readonly customPresets: readonly TerminalSkinPreset[];
  readonly timestamp: number;
}
