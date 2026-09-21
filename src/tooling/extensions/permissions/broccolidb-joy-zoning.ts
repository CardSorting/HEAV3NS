/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 163: Zero-Dependency Broccoli Joy-Zoning Engine
 *
 * Lifted from external source workspace/codemarie-new/src/utils/joy-zoning.ts.
 * Implements architectural layer classification (getLayer), layer header tag parsing (parseLayerTag),
 * comment style mapping, and header tag injection across TypeScript, JavaScript, Python, Shell, HTML, Rust, Go, SQL. Zero external npm dependencies.
 */

import * as path from "node:path";

export type JoyLayer = "domain" | "core" | "infrastructure" | "plumbing" | "ui";

export type CommentStyle = "jsdoc" | "slash" | "hash" | "dash" | "html";

export const CommentStyleMap = {
  JSDOC: "jsdoc" as CommentStyle,
  SLASH: "slash" as CommentStyle,
  HASH: "hash" as CommentStyle,
  DASH: "dash" as CommentStyle,
  HTML: "html" as CommentStyle,
} as const;

const STYLE_REGISTRY: Record<string, CommentStyle> = {
  ".ts": "jsdoc",
  ".tsx": "jsdoc",
  ".js": "jsdoc",
  ".jsx": "jsdoc",
  ".java": "jsdoc",
  ".go": "slash",
  ".rs": "slash",
  ".proto": "slash",
  ".cpp": "slash",
  ".c": "slash",
  ".h": "slash",
  ".sh": "hash",
  ".py": "hash",
  ".rb": "hash",
  ".yaml": "hash",
  ".yml": "hash",
  ".sql": "dash",
  ".hs": "dash",
  ".lua": "dash",
  ".md": "html",
  ".html": "html",
  ".xml": "html",
};

export class BroccoliJoyZoningEngine {
  private readonly pathLayerCache = new Map<string, JoyLayer>();

  /**
   * Parses an explicit header layer tag from file content.
   */
  public parseLayerTag(content: string): JoyLayer | null {
    const match = content.match(/\[LAYER:\s*(DOMAIN|CORE|INFRASTRUCTURE|PLUMBING|UI)\]/i);
    if (!match) return null;
    return match[1].toLowerCase() as JoyLayer;
  }

  /**
   * Determines the appropriate comment style based on file extension.
   */
  public getCommentStyle(filePath: string): CommentStyle {
    const ext = path.extname(filePath).toLowerCase();
    return STYLE_REGISTRY[ext] || "jsdoc";
  }

  /**
   * Injects or updates an explicit [LAYER: TYPE] tag header in content.
   */
  public injectOrUpdateLayerTag(content: string, filePath: string, layer: JoyLayer): string {
    const style = this.getCommentStyle(filePath);
    const upperLayer = layer.toUpperCase();
    let header = "";

    switch (style) {
      case "jsdoc":
        header = `/**\n * [LAYER: ${upperLayer}]\n */\n`;
        break;
      case "slash":
        header = `// [LAYER: ${upperLayer}]\n`;
        break;
      case "hash":
        header = `# [LAYER: ${upperLayer}]\n`;
        break;
      case "dash":
        header = `-- [LAYER: ${upperLayer}]\n`;
        break;
      case "html":
        header = `<!-- [LAYER: ${upperLayer}] -->\n`;
        break;
    }

    const existingTag = this.parseLayerTag(content);
    if (existingTag) {
      return content.replace(/\[LAYER:\s*(DOMAIN|CORE|INFRASTRUCTURE|PLUMBING|UI)\]/i, `[LAYER: ${upperLayer}]`);
    }

    return header + content;
  }

  /**
   * Resolves the architectural layer for a given file path and optional content.
   */
  public getLayer(filePath: string, content?: string): JoyLayer {
    const normalized = filePath.replace(/\\/g, "/");

    if (content) {
      const explicitTag = this.parseLayerTag(content);
      if (explicitTag) {
        this.pathLayerCache.set(normalized, explicitTag);
        return explicitTag;
      }
    }

    const cached = this.pathLayerCache.get(normalized);
    if (cached) return cached;

    let layer: JoyLayer = "infrastructure";

    if (normalized.includes("/domain/") || normalized.includes("/agents/")) {
      layer = "domain";
    } else if (normalized.includes("/core/") || normalized.includes("/sessions/")) {
      layer = "core";
    } else if (normalized.includes("/ui/") || normalized.includes("/webview/")) {
      layer = "ui";
    } else if (normalized.includes("/plumbing/") || normalized.includes("/utils/")) {
      layer = "plumbing";
    } else if (normalized.includes("/infrastructure/") || normalized.includes("/tooling/")) {
      layer = "infrastructure";
    }

    this.pathLayerCache.set(normalized, layer);
    return layer;
  }
}
