/**
 * url-safety-supervisor.ts
 *
 * Master supervisor coordinating SSRF firewall checks, URL normalization,
 * in-memory telemetry, and custom security rules (Phase 118 / ADR-094 / Target #51).
 */

import type { BroccoliUrlSafetySubstrate } from "../../../sessions/extensions/url_safety/broccoli-url-safety-substrate.js";
import type { DeterministicUrlSafety } from "./deterministic-url-safety.js";
import type {
  IpAddressCategory,
  UrlSafetyCheckResult,
  UrlSafetyConfig,
  UrlSafetyMetrics,
} from "../../../core/contracts/url-safety.contracts.js";

export class UrlSafetySupervisor {
  private readonly substrate: BroccoliUrlSafetySubstrate;
  private readonly urlSafety: DeterministicUrlSafety;
  private config: UrlSafetyConfig;

  constructor(
    substrate: BroccoliUrlSafetySubstrate,
    urlSafety: DeterministicUrlSafety,
    config?: Partial<UrlSafetyConfig>
  ) {
    this.substrate = substrate;
    this.urlSafety = urlSafety;
    this.config = {
      allowPrivateUrls: config?.allowPrivateUrls ?? false,
      allowLocalhost: config?.allowLocalhost ?? false,
      customBlockedHosts: config?.customBlockedHosts ?? [],
      customAllowedHosts: config?.customAllowedHosts ?? [],
    };
  }

  /**
   * Evaluates URL safety, records the result in substrate, and returns verdict.
   */
  public checkUrl(
    url: string,
    overrides?: Partial<UrlSafetyConfig>
  ): UrlSafetyCheckResult {
    const mergedConfig: UrlSafetyConfig = {
      ...this.config,
      ...overrides,
      customBlockedHosts: [
        ...this.config.customBlockedHosts,
        ...this.substrate.getCustomBlockedHosts(),
        ...(overrides?.customBlockedHosts ?? []),
      ],
      customAllowedHosts: [
        ...this.config.customAllowedHosts,
        ...this.substrate.getCustomAllowedHosts(),
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

  public addCustomBlockedHost(host: string): void {
    this.substrate.addCustomBlockedHost(host);
  }

  public addCustomAllowedHost(host: string): void {
    this.substrate.addCustomAllowedHost(host);
  }

  public getBlockedLedger(): readonly UrlSafetyCheckResult[] {
    return this.substrate.getBlockedLedger();
  }

  public getMetrics(): UrlSafetyMetrics {
    return this.substrate.getMetrics();
  }

  public setConfig(config: Partial<UrlSafetyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public clear(): void {
    this.substrate.clear();
  }
}
