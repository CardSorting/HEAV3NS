/**
 * terminal-skin-tool-suite.ts
 *
 * Model tool suite exposing banner rendering, theme palette lookups, and theme switches (Phase 100 / ADR-054).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { TerminalSkinSupervisor } from "../../../agents/extensions/skin/terminal-skin-supervisor.js";

export class TerminalSkinToolSuite {
  private supervisor: TerminalSkinSupervisor;

  constructor(supervisor: TerminalSkinSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "skin_render_banner",
        description: "Renders an ANSI ASCII art terminal welcome banner using the active or specified theme.",
        parameters: {
          skinName: {
            type: "string",
            description: "Optional theme name (e.g. 'default', 'tokyo-night', 'nord', 'dracula', 'monokai', 'cyberpunk')",
            required: false,
          },
          borderStyle: {
            type: "string",
            description: "Border style: 'rounded', 'sharp', 'double', or 'minimal'",
            required: false,
          },
          width: {
            type: "number",
            description: "Target banner width in columns (default: 76)",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const skinName = typeof args.skinName === "string" ? args.skinName : undefined;
          const borderStyle = (typeof args.borderStyle === "string" ? args.borderStyle : "rounded") as "rounded" | "sharp" | "double" | "minimal";
          const width = typeof args.width === "number" ? args.width : 76;

          const rendered = this.supervisor.renderWelcomeBanner({
            activeSkinName: skinName,
            borderStyle,
            width,
          });

          return {
            success: true,
            skinName: skinName || this.supervisor.getActiveSkinName(),
            bannerOutput: rendered,
            renderedLength: rendered.length,
          };
        },
      },
      {
        name: "skin_get_theme_palette",
        description: "Retrieves the complete color hex/RGB palette for a terminal skin preset.",
        parameters: {
          skinName: {
            type: "string",
            description: "The name of the theme skin preset to inspect",
            required: true,
          },
          isLightMode: {
            type: "boolean",
            description: "Whether to return light mode polarity overrides if available",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const skinName = typeof args.skinName === "string" ? args.skinName : "default";
          const isLightMode = typeof args.isLightMode === "boolean" ? args.isLightMode : false;

          const palette = this.supervisor.getThemePalette(skinName, isLightMode);

          return {
            success: true,
            skinName,
            isLightMode,
            palette,
          };
        },
      },
      {
        name: "skin_apply_theme_override",
        description: "Activates a specified theme preset or custom skin override.",
        parameters: {
          skinName: {
            type: "string",
            description: "The theme preset name to activate ('default', 'tokyo-night', 'nord', 'dracula', 'monokai', 'cyberpunk')",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const skinName = typeof args.skinName === "string" ? args.skinName : "default";
          const applied = this.supervisor.setActiveSkinName(skinName);

          return {
            success: applied,
            activeSkin: this.supervisor.getActiveSkinName(),
            message: applied
              ? `Theme '${skinName}' activated successfully.`
              : `Theme '${skinName}' not found. Available: default, tokyo-night, nord, dracula, monokai, cyberpunk.`,
          };
        },
      },
    ];
  }
}
