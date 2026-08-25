/**
 * package-dependency-auditor.ts
 *
 * Workspace Package & Dependency Hygiene Auditor.
 * Audits package.json files across the workspace for wildcard semver ranges,
 * overlapping dependencies, git URLs, and missing standard script hooks.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface PackageAuditReportItem {
  readonly path: string;
  readonly name: string;
  readonly version: string;
  readonly totalDependencies: number;
  readonly totalDevDependencies: number;
  readonly issues: string[];
  readonly missingScripts: string[];
}

export interface PackageAuditReport {
  readonly success: boolean;
  readonly totalPackagesAudited: number;
  readonly hasIssues: boolean;
  readonly reports: PackageAuditReportItem[];
}

export class PackageDependencyAuditor {
  private readonly ignoredDirs = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".gemini", "scratch"]);

  /**
   * Audits package.json files across workspace.
   */
  public async audit(rootDir: string, subpath = ""): Promise<PackageAuditReport> {
    const targetDir = subpath ? (path.isAbsolute(subpath) ? subpath : path.resolve(rootDir, subpath)) : rootDir;
    const pkgFiles = await this.collectPackageJsonFiles(targetDir);

    const reports: PackageAuditReportItem[] = [];
    let hasIssues = false;

    for (const filePath of pkgFiles) {
      try {
        const raw = await fs.readFile(filePath, "utf-8");
        const json = JSON.parse(raw);
        const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");

        const deps = json.dependencies || {};
        const devDeps = json.devDependencies || {};
        const scripts = json.scripts || {};

        const issues: string[] = [];
        const missingScripts: string[] = [];

        // Check for wildcards
        for (const [pkg, ver] of Object.entries<string>(deps)) {
          if (ver === "*" || ver === "latest") {
            issues.push(`Unpinned wildcard dependency in dependencies: '${pkg}': '${ver}'`);
          }
          if (ver.startsWith("git+") || ver.startsWith("http")) {
            issues.push(`External git/URL dependency in dependencies: '${pkg}': '${ver}'`);
          }
        }

        // Check for duplicate in deps & devDeps
        for (const pkg of Object.keys(deps)) {
          if (devDeps[pkg]) {
            issues.push(`Overlapping dependency declared in both dependencies and devDependencies: '${pkg}'`);
          }
        }

        // Check essential scripts
        if (!scripts.test) missingScripts.push("test");
        if (!scripts.build) missingScripts.push("build");

        if (issues.length > 0) hasIssues = true;

        reports.push({
          path: relPath,
          name: json.name || "unnamed",
          version: json.version || "0.0.0",
          totalDependencies: Object.keys(deps).length,
          totalDevDependencies: Object.keys(devDeps).length,
          issues,
          missingScripts,
        });
      } catch {
        // Skip invalid JSON
      }
    }

    return {
      success: true,
      totalPackagesAudited: reports.length,
      hasIssues,
      reports,
    };
  }

  private async collectPackageJsonFiles(dir: string): Promise<string[]> {
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
        } else if (entry.isFile() && entry.name === "package.json") {
          results.push(full);
        }
      }
    };

    await walk(dir);
    return results;
  }
}
