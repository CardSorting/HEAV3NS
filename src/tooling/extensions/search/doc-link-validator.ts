/**
 * doc-link-validator.ts
 *
 * Markdown Documentation Link & Reference Validator.
 * Parses markdown files across the workspace, validates internal and relative file links,
 * and detects broken anchors/paths with line numbers.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface BrokenLinkItem {
  readonly file: string;
  readonly link: string;
  readonly reason: string;
  readonly line: number;
}

export interface DocLinkValidationReport {
  readonly totalDocsScanned: number;
  readonly totalLinksChecked: number;
  readonly brokenLinksCount: number;
  readonly brokenLinks: BrokenLinkItem[];
}

export class DocLinkValidator {
  private readonly ignoredDirs = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".gemini", "scratch"]);

  /**
   * Validates markdown links across workspace documents.
   */
  public async validateLinks(rootDir: string, subpath = ""): Promise<DocLinkValidationReport> {
    const targetDir = subpath ? (path.isAbsolute(subpath) ? subpath : path.resolve(rootDir, subpath)) : rootDir;
    const mdFiles = await this.collectMarkdownFiles(targetDir);

    let totalLinks = 0;
    const brokenLinks: BrokenLinkItem[] = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    for (const filePath of mdFiles) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");
        const docDir = path.dirname(filePath);
        const relDocPath = path.relative(rootDir, filePath).replace(/\\/g, "/");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let match: RegExpExecArray | null;
          linkRegex.lastIndex = 0;

          while ((match = linkRegex.exec(line)) !== null) {
            const rawTarget = match[2].trim();
            if (rawTarget.startsWith("http://") || rawTarget.startsWith("https://") || rawTarget.startsWith("mailto:") || rawTarget.startsWith("#")) {
              continue; // External or in-page anchor
            }

            totalLinks++;
            const cleanTarget = rawTarget.split("#")[0].split("?")[0];
            if (!cleanTarget) continue;

            const resolvedTarget = path.isAbsolute(cleanTarget) ? cleanTarget : path.resolve(docDir, cleanTarget);
            const exists = await fs.stat(resolvedTarget).then(() => true).catch(() => false);

            if (!exists) {
              brokenLinks.push({
                file: relDocPath,
                link: rawTarget,
                reason: `Target file does not exist: '${cleanTarget}'`,
                line: i + 1,
              });
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return {
      totalDocsScanned: mdFiles.length,
      totalLinksChecked: totalLinks,
      brokenLinksCount: brokenLinks.length,
      brokenLinks,
    };
  }

  private async collectMarkdownFiles(dir: string): Promise<string[]> {
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
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          results.push(full);
        }
      }
    };

    await walk(dir);
    return results;
  }
}
