/**
 * url-safety-supervisor.ts
 *
 * Master supervisor coordinating SSRF firewall checks, URL normalization,
 * in-memory telemetry, custom security rules, SLA health audits, and multi-format exporters
 * (Phase 118 / ADR-094 / Target #87).
 */

import type { BroccoliUrlSafetySubstrate } from "../../../sessions/extensions/url_safety/broccoli-url-safety-substrate.js";
import type { DeterministicUrlSafety } from "./deterministic-url-safety.js";
import type {
  IpAddressCategory,
  UrlSafetyCheckResult,
  UrlSafetyCheckRow,
  UrlSafetyConfig,
  UrlSafetyMetrics,
  UrlSafetyMetricsReport,
  UrlSafetyHealthAuditReport,
  UrlSafetyGroupBy,
  UrlSafetySortBy,
  UrlSafetySortDirection,
  UrlSafetyGroupedLane,
  UrlSafetyDslQueryFilter,
  UrlSafetyBulkMutationResult,
} from "../../../core/contracts/url-safety.contracts.js";

export class UrlSafetySupervisor {
  private readonly substrate: BroccoliUrlSafetySubstrate;
  private readonly urlSafety: DeterministicUrlSafety;

  constructor(
    substrate: BroccoliUrlSafetySubstrate,
    urlSafety: DeterministicUrlSafety,
    config?: Partial<UrlSafetyConfig>
  ) {
    this.substrate = substrate;
    this.urlSafety = urlSafety;
    if (config) {
      this.substrate.updateConfig(config);
    }
  }

  /**
   * Evaluates URL safety, records the result in substrate, and returns verdict.
   */
  public checkUrl(
    url: string,
    overrides?: Partial<UrlSafetyConfig>
  ): UrlSafetyCheckResult {
    const baseConfig = this.substrate.getConfig();
    const mergedConfig: UrlSafetyConfig = {
      ...baseConfig,
      ...overrides,
      customBlockedHosts: [
        ...baseConfig.customBlockedHosts,
        ...(overrides?.customBlockedHosts ?? []),
      ],
      customAllowedHosts: [
        ...baseConfig.customAllowedHosts,
        ...(overrides?.customAllowedHosts ?? []),
      ],
    };

    const result = this.urlSafety.checkUrlSafety(url, mergedConfig);
    this.substrate.recordCheck(result);
    return result;
  }

  public normalizeUrl(url: string): string {
    return this.urlSafety.normalizeUrl(url);
  }

  public classifyIp(ip: string): IpAddressCategory {
    return this.urlSafety.classifyIp(ip);
  }

  public parseAlternativeIp(host: string): string | null {
    return this.urlSafety.parseAlternativeIp(host);
  }

  public addCustomBlockedHost(host: string): void {
    this.substrate.addCustomBlockedHost(host);
  }

  public addCustomAllowedHost(host: string): void {
    this.substrate.addCustomAllowedHost(host);
  }

  public isCustomBlocked(host: string): boolean {
    return this.substrate.isCustomBlocked(host);
  }

  public isCustomAllowed(host: string): boolean {
    return this.substrate.isCustomAllowed(host);
  }

  public getBlockedLedger(): readonly UrlSafetyCheckResult[] {
    return this.substrate.getBlockedLedger();
  }

  public getRecentChecks(limit?: number): UrlSafetyCheckRow[] {
    return this.substrate.getRecentChecks(limit);
  }

  public getAllChecks(): UrlSafetyCheckRow[] {
    return this.substrate.getAllChecks();
  }

  public getMetrics(): UrlSafetyMetrics {
    return this.substrate.getMetrics();
  }

  public getMetricsReport(): UrlSafetyMetricsReport {
    return this.substrate.getMetricsReport();
  }

  public auditHealth(): UrlSafetyHealthAuditReport {
    return this.substrate.auditHealth();
  }

  public getGroupedChecks(
    groupBy: UrlSafetyGroupBy,
    sortBy?: UrlSafetySortBy,
    sortDirection?: UrlSafetySortDirection
  ): UrlSafetyGroupedLane[] {
    return this.substrate.getGroupedChecks(groupBy, sortBy, sortDirection);
  }

  public queryChecksDsl(dslQuery: string | UrlSafetyDslQueryFilter): UrlSafetyCheckRow[] {
    return this.substrate.queryChecksDsl(dslQuery);
  }

  public bulkPurgeChecks(checkIds: string[]): UrlSafetyBulkMutationResult {
    return this.substrate.bulkPurgeChecks(checkIds);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public setConfig(config: Partial<UrlSafetyConfig>): UrlSafetyConfig {
    return this.substrate.updateConfig(config);
  }

  public getConfig(): UrlSafetyConfig {
    return this.substrate.getConfig();
  }

  public formatCheckResult(result: UrlSafetyCheckResult): string {
    return this.urlSafety.formatCheckResult(result);
  }

  public formatUrlSafetyMetrics(metrics: UrlSafetyMetrics): string {
    return this.urlSafety.formatUrlSafetyMetrics(metrics);
  }

  public exportHtml(): string {
    return this.substrate.exportHtml();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdown();
  }

  public exportCsv(): string {
    return this.substrate.exportCsv();
  }

  public clear(): void {
    this.substrate.clear();
  }
}
