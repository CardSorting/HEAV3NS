/**
 * workspace-tree-generator.ts
 *
 * Interactive Workspace Directory Tree Visualizer.
 * Generates clean Unicode directory hierarchy trees with depth limiting,
 * file size annotations, and optional line count calculation.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface WorkspaceTreeResult {
  readonly success: boolean;
  readonly targetDir: string;
  readonly totalFiles: number;
  readonly totalDirectories: number;
  readonly treeOutput: string;
}

export class WorkspaceTreeGenerator {
  private readonly ignoredDirs = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".gemini", "scratch"]);

  /**
   * Generates a formatted directory tree string.
   */
  public async generateTree(
    rootDir: string,
    options: { subpath?: string; maxDepth?: number; showLineCounts?: boolean; extensionFilter?: string[] } = {}
  ): Promise<WorkspaceTreeResult> {
    const targetDir = options.subpath ? (path.isAbsolute(options.subpath) ? options.subpath : path.resolve(rootDir, options.subpath)) : rootDir;
    const maxDepth = typeof options.maxDepth === "number" ? options.maxDepth : 4;
    const showLineCounts = options.showLineCounts !== false;
    const extFilter = options.extensionFilter ? new Set(options.extensionFilter.map((e) => (e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`))) : null;

    let totalFiles = 0;
    let totalDirectories = 0;

    const buildTree = async (currentDir: string, prefix: string, currentDepth: number): Promise<string[]> => {
      if (currentDepth > maxDepth) return [];

      let entries: any[] = [];
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        return [];
      }

      // Sort directories first, then files
      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      const filteredEntries = entries.filter((e) => !this.ignoredDirs.has(e.name) && !e.name.startsWith("."));
      const lines: string[] = [];

      for (let i = 0; i < filteredEntries.length; i++) {
        const entry = filteredEntries[i];
        const isLast = i === filteredEntries.length - 1;
        const pointer = isLast ? "└── " : "├── ";
        const nextPrefix = prefix + (isLast ? "    " : "│   ");
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          totalDirectories++;
          lines.push(`${prefix}${pointer}${entry.name}/`);
          const subLines = await buildTree(fullPath, nextPrefix, currentDepth + 1);
          lines.push(...subLines);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extFilter && !extFilter.has(ext)) continue;

          totalFiles++;
          let statInfo = "";
          try {
            const stat = await fs.stat(fullPath);
            const sizeKb = (stat.size / 1024).toFixed(1);
            if (showLineCounts && (ext === ".ts" || ext === ".js" || ext === ".json" || ext === ".md" || ext === ".py")) {
              const content = await fs.readFile(fullPath, "utf-8");
              const lineCount = content.split("\n").length;
              statInfo = ` (${lineCount} lines, ${sizeKb} KB)`;
            } else {
              statInfo = ` (${sizeKb} KB)`;
            }
          } catch {
            // Stat info optional
          }

          lines.push(`${prefix}${pointer}${entry.name}${statInfo}`);
        }
      }

      return lines;
    };

    const treeLines = await buildTree(targetDir, "", 1);
    const rootLabel = path.basename(targetDir) || targetDir;
    const treeOutput = [`${rootLabel}/`, ...treeLines].join("\n");

    return {
      success: true,
      targetDir: path.relative(rootDir, targetDir).replace(/\\/g, "/") || ".",
      totalFiles,
      totalDirectories,
      treeOutput,
    };
  }
}
