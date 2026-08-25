/**
 * unused-export-detector.ts
 *
 * Automated Unused Export & Dead Code Discovery Subsystem.
 * Cross-references exported symbols across workspace files with all project imports
 * to detect dead / orphan declarations with zero external tool dependencies.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface UnusedExportItem {
  readonly file: string;
  readonly symbol: string;
  readonly type: string;
  readonly line: number;
}

export interface UnusedExportReport {
  readonly totalFilesScanned: number;
  readonly totalExportsScanned: number;
  readonly unusedExportsCount: number;
  readonly unusedExports: UnusedExportItem[];
}

export class UnusedExportDetector {
  private readonly ignoredDirs = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".gemini", "scratch"]);
  private readonly supportedExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

  /**
   * Scans workspace to detect unused exports.
   */
  public async detectUnusedExports(rootDir: string, subpath = ""): Promise<UnusedExportReport> {
    const targetDir = subpath ? (path.isAbsolute(subpath) ? subpath : path.resolve(rootDir, subpath)) : rootDir;
    const files = await this.collectFiles(targetDir);

    interface ExportEntry {
      file: string;
      symbol: string;
      type: string;
      line: number;
    }

    const allExports: ExportEntry[] = [];
    const allFileContents: Array<{ path: string; content: string }> = [];

    const exportRegex = /^export\s+(const|let|var|function|class|interface|type|enum)\s+([a-zA-Z0-9_$]+)/gm;

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        allFileContents.push({ path: filePath, content });

        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          let match: RegExpExecArray | null;
          exportRegex.lastIndex = 0;
          if ((match = exportRegex.exec(line)) !== null) {
            allExports.push({
              file: path.relative(rootDir, filePath).replace(/\\/g, "/"),
              type: match[1],
              symbol: match[2],
              line: i + 1,
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    const unusedExports: UnusedExportItem[] = [];

    for (const exp of allExports) {
      let isUsed = false;
      const symbolRegex = new RegExp(`\\b${exp.symbol}\\b`);

      for (const fc of allFileContents) {
        const relPath = path.relative(rootDir, fc.path).replace(/\\/g, "/");
        if (relPath === exp.file) continue; // Don't check declaration file

        if (symbolRegex.test(fc.content)) {
          isUsed = true;
          break;
        }
      }

      if (!isUsed) {
        unusedExports.push(exp);
      }
    }

    return {
      totalFilesScanned: files.length,
      totalExportsScanned: allExports.length,
      unusedExportsCount: unusedExports.length,
      unusedExports,
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
