/**
 * deterministic-skin-engine.ts
 *
 * Deterministic terminal UI skin engine, theme palette resolver, and banner renderer (Phase 100 / ADR-054).
 */

import type {
  BannerRenderOptions,
  SkinPalette,
  SpinnerConfig,
  TerminalSkinPreset,
} from "../../../core/contracts/terminal-skin.contracts.js";

export class DeterministicSkinEngine {
  private presets: Map<string, TerminalSkinPreset>;

  constructor() {
    this.presets = new Map<string, TerminalSkinPreset>();
    this.initializeBuiltinPresets();
  }

  private initializeBuiltinPresets(): void {
    const defaultSpinner: SpinnerConfig = {
      waitingFaces: ["(⚔)", "(⛨)", "(✦)", "(★)"],
      thinkingFaces: ["(⌁)", "(<>)", "(⚙)", "(⚡)"],
      thinkingVerbs: ["forging", "synthesizing", "reasoning", "orchestrating"],
      wings: [
        ["⟪⚔", "⚔⟫"],
        ["⟪▲", "▲⟫"],
        ["⟪◆", "◆⟫"],
      ],
    };

    // 1. Default (Gold / Bronze)
    this.presets.set("default", {
      name: "default",
      description: "Classic gold and bronze aesthetic with rich terminal accents",
      colors: {
        background: "#0e0e12",
        foreground: "#FFF8DC",
        accent: "#FFD700",
        border: "#CD7F32",
        success: "#4caf50",
        warning: "#ffa726",
        error: "#ef5350",
        dim: "#8B8682",
        text: "#FFF8DC",
        reasoning: "#CC9B1F",
        tool: "#FFBF00",
      },
      spinner: defaultSpinner,
      branding: {
        agentName: "LUMI-JOY",
        welcomeMessage: "LUMI-JOY Deterministic Monolith Ready",
        goodbyeMessage: "Session synchronized and safely persisted.",
        responseLabel: " ⚡ LUMI ",
      },
    });

    // 2. Tokyo Night (Cyber Blue / Purple)
    this.presets.set("tokyo-night", {
      name: "tokyo-night",
      description: "Deep neon blue and cyber-purple night theme",
      colors: {
        background: "#1a1b26",
        foreground: "#c0caf5",
        accent: "#7aa2f7",
        border: "#bb9af7",
        success: "#9ece6a",
        warning: "#e0af68",
        error: "#f7768e",
        dim: "#565f89",
        text: "#c0caf5",
        reasoning: "#2ac3de",
        tool: "#7dcfff",
      },
      spinner: defaultSpinner,
      branding: {
        agentName: "LUMI-TOKYO",
        welcomeMessage: "Tokyo Night Cyberdeck Active",
        goodbyeMessage: "Night shift complete.",
        responseLabel: " 🌃 TOKYO ",
      },
    });

    // 3. Nord (Frost / Arctic Polar)
    this.presets.set("nord", {
      name: "nord",
      description: "Arctic frost palette with cool bluish polar tones",
      colors: {
        background: "#2e3440",
        foreground: "#eceff4",
        accent: "#88c0d0",
        border: "#81a1c1",
        success: "#a3be8c",
        warning: "#ebcb8b",
        error: "#bf616a",
        dim: "#4c566a",
        text: "#d8dee9",
        reasoning: "#5e81ac",
        tool: "#8fbcbb",
      },
      spinner: defaultSpinner,
      branding: {
        agentName: "LUMI-NORD",
        welcomeMessage: "Nord Arctic Engine Initialized",
        goodbyeMessage: "Frozen state preserved.",
        responseLabel: " ❄️ NORD ",
      },
    });

    // 4. Dracula (Goth Purple / Pink)
    this.presets.set("dracula", {
      name: "dracula",
      description: "Iconic dark goth purple and vibrant neon pink",
      colors: {
        background: "#282a36",
        foreground: "#f8f8f2",
        accent: "#ff79c6",
        border: "#bd93f9",
        success: "#50fa7b",
        warning: "#ffb86c",
        error: "#ff5555",
        dim: "#6272a4",
        text: "#f8f8f2",
        reasoning: "#8be9fd",
        tool: "#ff79c6",
      },
      spinner: defaultSpinner,
      branding: {
        agentName: "LUMI-DRACULA",
        welcomeMessage: "Dracula Engine Awakened",
        goodbyeMessage: "Returning to crypt.",
        responseLabel: " 🧛 DRACULA ",
      },
    });

    // 5. Monokai (Vibrant Yellow / Green)
    this.presets.set("monokai", {
      name: "monokai",
      description: "Pro contrast with vivid warm yellow, green, and orange",
      colors: {
        background: "#272822",
        foreground: "#f8f8f2",
        accent: "#e6db74",
        border: "#fd971f",
        success: "#a6e22e",
        warning: "#e6db74",
        error: "#f92672",
        dim: "#75715e",
        text: "#f8f8f2",
        reasoning: "#66d9ef",
        tool: "#ae81ff",
      },
      spinner: defaultSpinner,
      branding: {
        agentName: "LUMI-MONOKAI",
        welcomeMessage: "Monokai Pro Terminal Ready",
        goodbyeMessage: "Session saved.",
        responseLabel: " 🎨 MONOKAI ",
      },
    });

    // 6. Cyberpunk (Neon Yellow / Cyan)
    this.presets.set("cyberpunk", {
      name: "cyberpunk",
      description: "High-voltage neon yellow, hot pink, and matrix cyan",
      colors: {
        background: "#000b1e",
        foreground: "#00ff9f",
        accent: "#fefe00",
        border: "#ff0055",
        success: "#00ff9f",
        warning: "#fefe00",
        error: "#ff0055",
        dim: "#005f73",
        text: "#00ff9f",
        reasoning: "#00b4d8",
        tool: "#f72585",
      },
      spinner: defaultSpinner,
      branding: {
        agentName: "LUMI-CYBER",
        welcomeMessage: "Cyberpunk Substrate Engaged",
        goodbyeMessage: "Jacked out.",
        responseLabel: " ⚡ CYBER ",
      },
    });
  }

  /**
   * Converts a Hex color code into TrueColor (24-bit) ANSI escape sequence.
   */
  hexToAnsi(hex: string, isBackground: boolean = false): string {
    const cleanHex = hex.replace("#", "");
    let r = 255;
    let g = 255;
    let b = 255;

    if (cleanHex.length === 6) {
      r = parseInt(cleanHex.substring(0, 2), 16) || 0;
      g = parseInt(cleanHex.substring(2, 4), 16) || 0;
      b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    } else if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16) || 0;
      g = parseInt(cleanHex[1] + cleanHex[1], 16) || 0;
      b = parseInt(cleanHex[2] + cleanHex[2], 16) || 0;
    }

    const typeCode = isBackground ? "48;2" : "38;2";
    return `\x1b[${typeCode};${r};${g};${b}m`;
  }

  /**
   * Resolves the complete color palette for a given skin name.
   */
  resolvePalette(skinName: string = "default", isLightMode: boolean = false): SkinPalette {
    const preset = this.presets.get(skinName) || this.presets.get("default")!;
    if (isLightMode && preset.lightColors) {
      return {
        ...preset.colors,
        ...preset.lightColors,
      };
    }
    return preset.colors;
  }

  /**
   * Generates a deterministic Kawaii animated spinner frame string.
   */
  getSpinnerFrame(
    tickIndex: number,
    phase: "waiting" | "thinking" = "waiting",
    skinName: string = "default"
  ): string {
    const preset = this.presets.get(skinName) || this.presets.get("default")!;
    const spinner = preset.spinner;

    const faces = phase === "thinking" ? spinner.thinkingFaces : spinner.waitingFaces;
    const faceIndex = Math.abs(tickIndex) % faces.length;
    const wingIndex = Math.abs(tickIndex) % spinner.wings.length;
    const verbIndex = Math.abs(tickIndex) % spinner.thinkingVerbs.length;

    const face = faces[faceIndex];
    const [wingLeft, wingRight] = spinner.wings[wingIndex];
    const verb = spinner.thinkingVerbs[verbIndex];

    const accentAnsi = this.hexToAnsi(preset.colors.accent);
    const textAnsi = this.hexToAnsi(preset.colors.text);
    const resetAnsi = "\x1b[0m";

    if (phase === "thinking") {
      return `${accentAnsi}${wingLeft} ${face} ${wingRight}${resetAnsi} ${textAnsi}${verb}...${resetAnsi}`;
    }
    return `${accentAnsi}${wingLeft} ${face} ${wingRight}${resetAnsi}`;
  }

  /**
   * Renders a flicker-free ASCII art welcome banner.
   */
  renderBanner(options: BannerRenderOptions = {}): string {
    const skinName = options.activeSkinName || "default";
    const preset = this.presets.get(skinName) || this.presets.get("default")!;
    const palette = preset.colors;

    const width = options.width || 76;
    const borderStyle = options.borderStyle || "rounded";

    const borders = {
      rounded: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" },
      sharp: { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" },
      double: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
      minimal: { tl: " ", tr: " ", bl: " ", br: " ", h: "-", v: "|" },
    }[borderStyle];

    const borderAnsi = this.hexToAnsi(palette.border);
    const accentAnsi = this.hexToAnsi(palette.accent);
    const textAnsi = this.hexToAnsi(palette.text);
    const dimAnsi = this.hexToAnsi(palette.dim);
    const resetAnsi = "\x1b[0m";

    const titleText = ` ${preset.branding.agentName} · ${preset.description} `;
    const innerWidth = width - 2;
    const hBar = borders.h.repeat(innerWidth);

    const lines: string[] = [
      `${borderAnsi}${borders.tl}${hBar}${borders.tr}${resetAnsi}`,
      `${borderAnsi}${borders.v}${resetAnsi}${accentAnsi}${titleText.padEnd(innerWidth)}${resetAnsi}${borderAnsi}${borders.v}${resetAnsi}`,
      `${borderAnsi}${borders.v}${resetAnsi}${" ".repeat(innerWidth)}${borderAnsi}${borders.v}${resetAnsi}`,
    ];

    if (options.showLogo !== false) {
      const logoLines = [
        "██╗     ██╗   ██╗███╗   ███╗██╗      ██╗ ██████╗ ██╗   ██╗",
        "██║     ██║   ██║████╗ ████║██║      ██║██╔═══██╗╚██╗ ██╔╝",
        "██║     ██║   ██║██╔████╔██║██║      ██║██║   ██║ ╚████╔╝ ",
        "██║     ██║   ██║██║╚██╔╝██║██║ ██   ██║██║   ██║  ╚██╔╝  ",
        "███████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚█████╔╝╚██████╔╝   ██║   ",
        "╚══════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚════╝  ╚═════╝    ╚═╝   ",
      ];
      for (const logoLine of logoLines) {
        const paddedLogo = `  ${logoLine}`.padEnd(innerWidth);
        lines.push(`${borderAnsi}${borders.v}${resetAnsi}${accentAnsi}${paddedLogo}${resetAnsi}${borderAnsi}${borders.v}${resetAnsi}`);
      }
    }

    lines.push(`${borderAnsi}${borders.v}${resetAnsi}${" ".repeat(innerWidth)}${borderAnsi}${borders.v}${resetAnsi}`);
    lines.push(
      `${borderAnsi}${borders.v}${resetAnsi}${textAnsi}${`  ${preset.branding.welcomeMessage}`.padEnd(innerWidth)}${resetAnsi}${borderAnsi}${borders.v}${resetAnsi}`
    );
    lines.push(
      `${borderAnsi}${borders.v}${resetAnsi}${dimAnsi}${`  Skin: [${preset.name}] | Zero-GC Monolithic Substrate`.padEnd(innerWidth)}${resetAnsi}${borderAnsi}${borders.v}${resetAnsi}`
    );
    lines.push(`${borderAnsi}${borders.bl}${hBar}${borders.br}${resetAnsi}`);

    return lines.join("\n");
  }

  registerCustomPreset(preset: TerminalSkinPreset): void {
    this.presets.set(preset.name, preset);
  }

  getPreset(name: string): TerminalSkinPreset | undefined {
    return this.presets.get(name);
  }

  getAllPresets(): readonly TerminalSkinPreset[] {
    return Array.from(this.presets.values());
  }
}
