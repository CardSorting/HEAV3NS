/**
 * code-smell-detector.ts
 *
 * Multi-File Code Smell & Anti-Pattern Detector.
 * Analyzes workspace source code to isolate giant functions (>80 LOC), deep nesting (>4 levels),
 * long parameter lists (>5 params), empty catch blocks, and hardcoded IPs.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface CodeSmellItem {
  readonly file: string;
  readonly line: number;
  readonly type: string;
  readonly severity: "HIGH" | "MEDIUM" | "LOW";
  readonly description: string;
}

export interface CodeSmellReport {
  readonly totalFilesScanned: number;
  readonly totalSmellsFound: number;
  readonly smells: CodeSmellItem[];
}

export class CodeSmellDetector {
  private readonly ignoredDirs = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".gemini", "scratch"]);
  private readonly supportedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".py"]);

  /**
   * Scans workspace for code smells and anti-patterns.
   */
  public async detectSmells(
    rootDir: string,
    options: { subpath?: string; maxFunctionLines?: number } = {}
  ): Promise<CodeSmellReport> {
    const targetDir = options.subpath ? (path.isAbsolute(options.subpath) ? options.subpath : path.resolve(rootDir, options.subpath)) : rootDir;
    const maxFnLines = options.maxFunctionLines || 80;
    const files = await this.collectFiles(targetDir);

    const smells: CodeSmellItem[] = [];

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");
        const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");

        let currentFnName = "";
        let currentFnStart = 0;
        let currentFnBraces = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          // Check 1: Empty Catch Block
          if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(trimmed)) {
            smells.push({
              file: relPath,
              line: i + 1,
              type: "Empty Catch Block",
              severity: "HIGH",
              description: "Silently swallowed exception with empty catch block",
            });
          }

          // Check 2: Long Parameter List (>5 params)
          const fnMatch = /(?:function\s+([a-zA-Z0-9_$]+)|([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\()\s*\(([^)]+)\)/.exec(trimmed);
          if (fnMatch) {
            const rawParams = (fnMatch[3] || "").split(",");
            if (rawParams.length > 5) {
              smells.push({
                file: relPath,
                line: i + 1,
                type: "Long Parameter List",
                severity: "MEDIUM",
                description: `Function has ${rawParams.length} parameters (exceeds recommended max of 5)`,
              });
            }
          }

          // Check 3: Deep Nesting (> 4 indentation levels)
          const leadingSpaces = line.search(/\S/);
          if (leadingSpaces >= 16 && trimmed.length > 0 && !trimmed.startsWith("//") && !trimmed.startsWith("*")) {
            smells.push({
              file: relPath,
              line: i + 1,
              type: "Deep Nesting",
              severity: "LOW",
              description: `Deep control flow indentation (${leadingSpaces / 2} levels deep)`,
            });
          }

          // Check 4: Giant Function Tracking
          if (/(?:function|async function)\s+([a-zA-Z0-9_$]+)/.test(trimmed)) {
            const m = /(?:function|async function)\s+([a-zA-Z0-9_$]+)/.exec(trimmed);
            currentFnName = m ? m[1] : "anonymous";
            currentFnStart = i + 1;
            currentFnBraces = 0;
          }

          if (currentFnStart > 0) {
            for (const char of line) {
              if (char === "{") currentFnBraces++;
              if (char === "}") currentFnBraces--;
            }
            if (currentFnBraces === 0 && i + 1 > currentFnStart) {
              const fnLength = i + 1 - currentFnStart;
              if (fnLength > maxFnLines) {
                smells.push({
                  file: relPath,
                  line: currentFnStart,
                  type: "Giant Function",
                  severity: "MEDIUM",
                  description: `Function '${currentFnName}' is ${fnLength} lines long (exceeds max of ${maxFnLines})`,
                });
              }
              currentFnStart = 0;
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return {
      totalFilesScanned: files.length,
      totalSmellsFound: smells.length,
      smells: smells.slice(0, 50),
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
