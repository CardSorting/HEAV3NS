/**
 * deterministic-osv-parser.ts
 *
 * Pure TypeScript OSV Command Ecosystem Parser, Package Extractor & Malware Filter
 * (Phase 128 / ADR-104 / Target #61).
 */

import type {
  OsvAdvisory,
  OsvScanResult,
  PackageEcosystem,
  ParsedPackageTarget,
} from "../../../core/contracts/osv-scanner.contracts.js";

export class DeterministicOsvParser {
  /**
   * Infers package ecosystem from command executable binary name.
   */
  public inferEcosystem(command: string): PackageEcosystem | undefined {
    if (!command) return undefined;
    const base = command.trim().split(/[\/\\]/).pop()?.toLowerCase() || "";

    if (base === "npx" || base === "npx.cmd" || base === "npm" || base === "yarn" || base === "pnpm" || base === "bunx") {
      return "npm";
    }
    if (base === "uvx" || base === "uvx.cmd" || base === "pipx" || base === "pip" || base === "uv" || base === "poetry") {
      return "PyPI";
    }
    if (base === "cargo") {
      return "crates.io";
    }
    if (base === "go") {
      return "Go";
    }
    if (base === "gem") {
      return "RubyGems";
    }
    if (base === "composer") {
      return "Packagist";
    }
    return undefined;
  }

  /**
   * Extracts package name and optional version from an npm argument token.
   */
  public parseNpmPackage(token: string): { name: string; version?: string; scope?: string } | undefined {
    if (!token) return undefined;
    const clean = token.trim();

    if (clean.startsWith("@")) {
      // Scoped: @scope/name@version or @scope/name
      const match = clean.match(/^(@[^/]+)\/([^@]+)(?:@(.+))?$/);
      if (match) {
        const scope = match[1];
        const pkgBase = match[2];
        const version = match[3];
        return {
          name: `${scope}/${pkgBase}`,
          scope,
          version: version && version !== "latest" ? version : undefined,
        };
      }
      return { name: clean, scope: clean.split("/")[0] };
    }

    if (clean.includes("@")) {
      const parts = clean.split("@");
      const name = parts[0];
      const version = parts[1] && parts[1] !== "latest" ? parts[1] : undefined;
      return { name, version };
    }

    return { name: clean };
  }

  /**
   * Extracts package name and optional version from a PyPI argument token.
   */
  public parsePyPiPackage(token: string): { name: string; version?: string } | undefined {
    if (!token) return undefined;
    const clean = token.trim();

    // name[extras]==version or name==version
    const match = clean.match(/^([a-zA-Z0-9._-]+)(?:\[[^\]]*\])?(?:==(.+))?$/);
    if (match) {
      const name = match[1];
      const version = match[2];
      return { name, version };
    }
    return { name: clean };
  }

  /**
   * Extracts package target from command arguments given an ecosystem.
   */
  public parsePackageFromArgs(
    args: string[],
    ecosystem: PackageEcosystem
  ): ParsedPackageTarget | undefined {
    if (!args || args.length === 0) return undefined;

    let packageToken: string | undefined;
    let takeNext = false;

    const subcommands = new Set(["install", "i", "add", "get", "require", "update", "run", "exec", "build"]);
    for (const arg of args) {
      if (!arg || typeof arg !== "string") continue;
      if (takeNext) {
        packageToken = arg;
        break;
      }
      if (arg === "--package" || arg === "-p") {
        takeNext = true;
        continue;
      }
      if (arg.startsWith("--package=")) {
        packageToken = arg.slice("--package=".length);
        break;
      }
      if (arg.startsWith("-")) {
        continue;
      }
      if (subcommands.has(arg.toLowerCase())) {
        continue;
      }
      packageToken = arg;
      break;
    }

    if (!packageToken) return undefined;

    if (ecosystem === "npm") {
      const parsed = this.parseNpmPackage(packageToken);
      if (!parsed) return undefined;
      return {
        ecosystem,
        name: parsed.name,
        version: parsed.version,
        scope: parsed.scope,
        rawToken: packageToken,
      };
    }

    if (ecosystem === "PyPI") {
      const parsed = this.parsePyPiPackage(packageToken);
      if (!parsed) return undefined;
      return {
        ecosystem,
        name: parsed.name,
        version: parsed.version,
        rawToken: packageToken,
      };
    }

    return {
      ecosystem,
      name: packageToken,
      rawToken: packageToken,
    };
  }

  /**
   * Identifies if an advisory represents confirmed malware (MAL-*).
   */
  public isMalwareAdvisory(advisory: { id: string; [key: string]: unknown }): boolean {
    if (!advisory || !advisory.id) return false;
    return advisory.id.startsWith("MAL-") || advisory.id.includes("MALWARE");
  }

  /**
   * Filters and normalizes raw OSV API JSON response into OsvAdvisory array.
   */
  public parseAdvisories(vulns: Array<{ id: string; summary?: string; details?: string; aliases?: string[]; published?: string }>): OsvAdvisory[] {
    if (!Array.isArray(vulns)) return [];

    return vulns.map((v) => ({
      id: v.id,
      summary: v.summary || v.id,
      details: v.details,
      aliases: v.aliases,
      isMalware: this.isMalwareAdvisory(v),
      published: v.published,
    }));
  }

  public formatScanResult(result: OsvScanResult): string {
    const status = result.allowed ? "ALLOWED" : "BLOCKED";
    return `[OSV:${status}] ${result.package.ecosystem}:${result.package.name} -> ${result.advisories.length} advisories (${result.scanDurationMs.toFixed(2)}ms)`;
  }

  public formatAdvisory(advisory: OsvAdvisory): string {
    const malTag = advisory.isMalware ? " [MALWARE]" : "";
    return `[ADVISORY:${advisory.id}]${malTag} ${advisory.summary.slice(0, 60)}`;
  }
}

