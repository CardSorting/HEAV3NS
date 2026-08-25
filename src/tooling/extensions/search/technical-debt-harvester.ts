/**
 * technical-debt-harvester.ts
 *
 * Workspace Technical Debt & TODO Marker Harvester.
 * Extracts TODO, FIXME, HACK, OPTIMIZE, BUG, and DEPRECATED annotations
 * across workspace source files with line numbers, authors, and context snippets.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface TechnicalDebtItem {
  readonly file: string;
  readonly line: number;
  readonly tag: string;
  readonly message: string;
  readonly author?: string;
  readonly snippet: string;
}

export interface TechnicalDebtReport {
  readonly totalFilesScanned: number;
  readonly totalItems: number;
  readonly itemsByTag: Record<string, number>;
  readonly items: TechnicalDebtItem[];
}

export class TechnicalDebtHarvester {
  private readonly ignoredDirs = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".gemini", "scratch"]);
  private readonly supportedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".json", ".md", ".css"]);

  /**
   * Harvests technical debt annotations across workspace source files.
   */
  public async harvest(
    rootDir: string,
    options: { subpath?: string; tags?: string[] } = {}
  ): Promise<TechnicalDebtReport> {
    const targetDir = options.subpath
      ? (path.isAbsolute(options.subpath) ? options.subpath : path.resolve(rootDir, options.subpath))
      : rootDir;

    const allowedTags = (options.tags && options.tags.length > 0)
      ? options.tags.map((t) => t.toUpperCase())
      : ["TODO", "FIXME", "HACK", "BUG", "OPTIMIZE", "DEPRECATED"];

    const files = await this.collectFiles(targetDir);
    const items: TechnicalDebtItem[] = [];
    const itemsByTag: Record<string, number> = {};

    for (const tag of allowedTags) {
      itemsByTag[tag] = 0;
    }

    const tagPattern = allowedTags.join("|");
    const markerRegex = new RegExp(`(?:\\/\\/|#|\\/\\*|\\*)\\s*(${tagPattern})(?:\\(([^)]+)\\))?:?\\s*(.*)`, "i");

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");
        const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = markerRegex.exec(line);
          if (match) {
            const tag = match[1].toUpperCase();
            const author = match[2] ? match[2].trim() : undefined;
            const message = match[3] ? match[3].replace(/\*\/$/, "").trim() : "";

            itemsByTag[tag] = (itemsByTag[tag] || 0) + 1;
            items.push({
              file: relPath,
              line: i + 1,
              tag,
              author,
              message,
              snippet: line.trim(),
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return {
      totalFilesScanned: files.length,
      totalItems: items.length,
      itemsByTag,
      items,
    };
  }

  private async collectFiles(dir: string): Promise<string[]> {
    const results: string[] = [];

    const walk = async (current: string) => {
      let entries: any[] = [];
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (this.ignoredDirs.has(entry.name) || entry.name.startsWith(".")) continue;

        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (this.supportedExtensions.has(ext)) {
            results.push(full);
          }
        }
      }
    };

    await walk(dir);
    return results;
  }
}
