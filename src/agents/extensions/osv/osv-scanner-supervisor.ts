/**
 * osv-scanner-supervisor.ts
 *
 * Master supervisor coordinating command pre-flight evaluation, OSV query caching,
 * malware advisory blocking, and fail-open fault tolerance (Phase 128 / ADR-104 / Target #81).
 */

import { performance } from "node:perf_hooks";
import type { BroccoliOsvSubstrate } from "../../../sessions/extensions/osv/broccoli-osv-substrate.js";
import type { DeterministicOsvParser } from "./deterministic-osv-parser.js";
import type {
  OsvAdvisory,
  OsvDslQueryFilter,
  OsvGroupBy,
  OsvGroupedLane,
  OsvHealthAuditReport,
  OsvMetricsReport,
  OsvScannerConfig,
  OsvScannerMetrics,
  OsvScanResult,
  OsvScanResultRow,
  OsvSortBy,
  OsvSortDirection,
  ParsedPackageTarget,
} from "../../../core/contracts/osv-scanner.contracts.js";

export class OsvScannerSupervisor {
  private readonly substrate: BroccoliOsvSubstrate;
  private readonly parser: DeterministicOsvParser;
  private customQueryFn?: (pkg: ParsedPackageTarget) => Promise<OsvAdvisory[]>;

  constructor(
    substrate: BroccoliOsvSubstrate,
    parser: DeterministicOsvParser,
    customQueryFn?: (pkg: ParsedPackageTarget) => Promise<OsvAdvisory[]>
  ) {
    this.substrate = substrate;
    this.parser = parser;
    this.customQueryFn = customQueryFn;
  }

  public getSubstrate(): BroccoliOsvSubstrate {
    return this.substrate;
  }

  public getParser(): DeterministicOsvParser {
    return this.parser;
  }

  public setQueryFunction(fn?: (pkg: ParsedPackageTarget) => Promise<OsvAdvisory[]>): void {
    this.customQueryFn = fn;
  }

  public configure(config: Partial<OsvScannerConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): OsvScannerConfig {
    return this.substrate.getConfig();
  }

  public addCustomBlockedPackage(pkg: ParsedPackageTarget): void {
    this.substrate.addCustomBlockedPackage(pkg);
  }

  public isCustomBlocked(pkg: ParsedPackageTarget): boolean {
    return this.substrate.isCustomBlocked(pkg);
  }

  public clearCache(): void {
    this.substrate.clearCache();
  }

  public getMetrics(): OsvScannerMetrics {
    return this.substrate.getMetrics();
  }

  public getMetricsReport(): OsvMetricsReport {
    return this.substrate.getMetricsReport();
  }

  public auditHealth(): OsvHealthAuditReport {
    return this.substrate.auditHealth();
  }

  /**
   * Scans a target package against the OSV advisory database or in-memory cache.
   */
  public async scanPackage(pkg: ParsedPackageTarget): Promise<OsvScanResult> {
    const tStart = performance.now();
    const config = this.substrate.getConfig();

    // 1. Check custom blocked packages
    if (this.substrate.isCustomBlocked(pkg)) {
      const result: OsvScanResult = {
        allowed: false,
        package: pkg,
        advisories: [
          {
            id: "MAL-CUSTOM-POLICY",
            summary: `Package ${pkg.name} is blocked by custom organization policy`,
            isMalware: true,
          },
        ],
        cached: false,
        reason: `Blocked by custom organization policy: ${pkg.name}`,
        scanDurationMs: performance.now() - tStart,
      };
      this.substrate.recordScan(result);
      return result;
    }

    // 2. Check in-memory cache
    const cached = this.substrate.getCachedResult(pkg);
    if (cached) {
      return cached;
    }

    // 3. Query OSV API or custom handler
    try {
      let advisories: OsvAdvisory[] = [];
      if (this.customQueryFn) {
        advisories = await this.customQueryFn(pkg);
      } else {
        // Query official OSV endpoint
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
        try {
          const body: Record<string, unknown> = {
            package: { name: pkg.name, ecosystem: pkg.ecosystem },
          };
          if (pkg.version) body.version = pkg.version;

          const resp = await fetch(config.osvEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "lumi-agent-osv-check/1.0",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (resp.ok) {
            const data = (await resp.json()) as { vulns?: Array<{ id: string; summary?: string; details?: string; aliases?: string[]; published?: string }> };
            advisories = this.parser.parseAdvisories(data.vulns || []);
          }
        } finally {
          clearTimeout(timeout);
        }
      }

      const malwareAdvisories = advisories.filter((a) => (config.blockMalwareOnly ? a.isMalware : true));
      const allowed = malwareAdvisories.length === 0;

      const result: OsvScanResult = {
        allowed,
        package: pkg,
        advisories: malwareAdvisories,
        cached: false,
        reason: !allowed
          ? `BLOCKED: Package '${pkg.name}' (${pkg.ecosystem}) has known malware advisories: ${malwareAdvisories.map((a) => a.id).join(", ")}`
          : undefined,
        scanDurationMs: performance.now() - tStart,
      };

      this.substrate.setCachedResult(pkg, result);
      this.substrate.recordScan(result);
      return result;
    } catch (err) {
      this.substrate.recordNetworkFailure();
      if (config.failOpen) {
        // Fail-open: allow execution on network/timeout errors without caching
        return {
          allowed: true,
          package: pkg,
          advisories: [],
          cached: false,
          reason: `Fail-open allowed: query failed (${err instanceof Error ? err.message : String(err)})`,
          scanDurationMs: performance.now() - tStart,
        };
      }
      return {
        allowed: false,
        package: pkg,
        advisories: [],
        cached: false,
        reason: `Scan failed in fail-closed mode: ${err instanceof Error ? err.message : String(err)}`,
        scanDurationMs: performance.now() - tStart,
      };
    }
  }

  /**
   * Pre-flight checks a command line string for malicious packages.
   */
  public async checkCommand(command: string, args: string[] = []): Promise<OsvScanResult | undefined> {
    const ecosystem = this.parser.inferEcosystem(command);
    if (!ecosystem) return undefined;

    const pkg = this.parser.parsePackageFromArgs(args, ecosystem);
    if (!pkg) return undefined;

    return this.scanPackage(pkg);
  }

  public getGroupedScans(groupBy?: OsvGroupBy, sortBy?: OsvSortBy, direction?: OsvSortDirection): readonly OsvGroupedLane[] {
    return this.substrate.getGroupedScans(groupBy, sortBy, direction);
  }

  public queryDsl(query: OsvDslQueryFilter | string): readonly OsvScanResultRow[] {
    return this.substrate.queryScansDsl(query);
  }

  public bulkPurge(ids: readonly string[]) {
    return this.substrate.bulkPurgeScans(ids);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }
}
