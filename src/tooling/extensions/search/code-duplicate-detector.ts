/**
 * code-duplicate-detector.ts
 *
 * Multi-File Code Duplicate & Clone Detector.
 * Scans workspace files using sliding line-window hash shingles to detect copy-pasted blocks
 * across files for DRY code refactoring.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface DuplicateOccurrence {
  readonly file: string;
  readonly line: number;
}

export interface DuplicateGroup {
  readonly linesCount: number;
  readonly occurrences: DuplicateOccurrence[];
  readonly snippet: string;
}

export interface DuplicateReport {
  readonly totalFilesScanned: number;
  readonly duplicateGroupsCount: number;
  readonly duplicateGroups: DuplicateGroup[];
}

export class CodeDuplicateDetector {
  private readonly ignoredDirs = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".gemini", "scratch"]);
  private readonly supportedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"]);

  /**
   * Detects duplicate code blocks across workspace files.
   */
  public async detectDuplicates(
    rootDir: string,
    options: { subpath?: string; minLines?: number } = {}
  ): Promise<DuplicateReport> {
    const minLines = options.minLines || 5;
    const targetDir = options.subpath ? (path.isAbsolute(options.subpath) ? options.subpath : path.resolve(rootDir, options.subpath)) : rootDir;
    const files = await this.collectFiles(targetDir);

    const blockMap = new Map<string, DuplicateOccurrence[]>();
    const snippetMap = new Map<string, string>();

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");
        const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");

        if (lines.length < minLines) continue;

        for (let i = 0; i <= lines.length - minLines; i++) {
          const windowLines = lines.slice(i, i + minLines);
          const normalized = windowLines.map((l) => l.trim()).join("\n");
          if (normalized.length < 40) continue; // Skip trivial short blocks

          let occurrences = blockMap.get(normalized);
          if (!occurrences) {
            occurrences = [];
            blockMap.set(normalized, occurrences);
            snippetMap.set(normalized, windowLines.slice(0, 3).join("\n"));
          }
          occurrences.push({ file: relPath, line: i + 1 });
        }
      } catch {
        // Skip unreadable files
      }
    }

    const duplicateGroups: DuplicateGroup[] = [];

    for (const [normBlock, occurrences] of blockMap.entries()) {
      // Must appear in at least 2 distinct files or distinct locations
      const distinctFiles = new Set(occurrences.map((o) => o.file));
      if (occurrences.length >= 2 && distinctFiles.size >= 2) {
        duplicateGroups.push({
          linesCount: minLines,
          occurrences,
          snippet: snippetMap.get(normBlock) || "",
        });
      }
    }

    return {
      totalFilesScanned: files.length,
      duplicateGroupsCount: duplicateGroups.length,
      duplicateGroups: duplicateGroups.slice(0, 20),
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
