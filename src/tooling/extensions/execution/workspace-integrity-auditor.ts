/**
 * workspace-integrity-auditor.ts
 *
 * High-Throughput Workspace File Integrity & Hash Fingerprinting Auditor.
 * Fast parallel cryptographic checksum verification across workspace source files.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface FileIntegrityRecord {
  readonly path: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface WorkspaceIntegrityReport {
  readonly totalFiles: number;
  readonly totalSizeBytes: number;
  readonly durationMs: number;
  readonly files: FileIntegrityRecord[];
}

export class WorkspaceIntegrityAuditor {
  private readonly ignoredDirs = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".gemini", "scratch"]);

  /**
   * Scans and generates SHA-256 integrity fingerprints for workspace files.
   */
  public async auditIntegrity(
    rootDir: string,
    options: { subpath?: string; maxFiles?: number } = {}
  ): Promise<WorkspaceIntegrityReport> {
    const startTime = performance.now();
    const subpath = options.subpath || "";
    const targetDir = subpath ? (path.isAbsolute(subpath) ? subpath : path.resolve(rootDir, subpath)) : rootDir;
    const maxFiles = options.maxFiles || 200;

    const files = await this.collectFiles(targetDir, maxFiles);
    const records: FileIntegrityRecord[] = [];
    let totalBytes = 0;

    for (const filePath of files) {
      try {
        const buffer = await fs.readFile(filePath);
        const hash = crypto.createHash("sha256").update(buffer).digest("hex");
        const rel = path.relative(rootDir, filePath);
        totalBytes += buffer.length;

        records.push({
          path: rel,
          sha256: hash,
          sizeBytes: buffer.length,
        });
      } catch {
        // Skip unreadable files
      }
    }

    const durationMs = Number((performance.now() - startTime).toFixed(2));

    return {
      totalFiles: records.length,
      totalSizeBytes: totalBytes,
      durationMs,
      files: records,
    };
  }

  private async collectFiles(dir: string, limit: number): Promise<string[]> {
    const results: string[] = [];

    const walk = async (current: string) => {
      if (results.length >= limit) return;
      let entries: any[] = [];
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (results.length >= limit) break;
        if (this.ignoredDirs.has(entry.name) || entry.name.startsWith(".")) continue;

        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          results.push(full);
        }
      }
    };

    await walk(dir);
    return results;
  }
}
