/**
 * website-policy-supervisor.ts
 *
 * Master supervisor coordinating website domain checks, dynamic rule additions,
 * shared file blocklists, and in-memory substrate tracking (Phase 120 / ADR-096 / Target #53).
 */

import type { BroccoliWebsitePolicySubstrate } from "../../../sessions/extensions/website_policy/broccoli-website-policy-substrate.js";
import type { DeterministicWebsitePolicy } from "./deterministic-website-policy.js";
import type {
  WebsiteAccessCheckResult,
  WebsitePolicyMetrics,
  WebsitePolicyRule,
  WebsitePolicySource,
} from "../../../core/contracts/website-policy.contracts.js";

export class WebsitePolicySupervisor {
  private readonly substrate: BroccoliWebsitePolicySubstrate;
  private readonly policyEngine: DeterministicWebsitePolicy;
  private enabled = true;

  constructor(
    substrate: BroccoliWebsitePolicySubstrate,
    policyEngine: DeterministicWebsitePolicy
  ) {
    this.substrate = substrate;
    this.policyEngine = policyEngine;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public addRule(
    pattern: string,
    source: WebsitePolicySource = "runtime",
    sourcePath?: string
  ): boolean {
    const normalized = this.policyEngine.normalizeRule(pattern);
    if (!normalized) {
      return false;
    }
    const rule: WebsitePolicyRule = {
      pattern: normalized,
      source,
      sourcePath,
      enabled: true,
    };
    this.substrate.setRule(rule);
    return true;
  }

  public removeRule(pattern: string): boolean {
    const normalized = this.policyEngine.normalizeRule(pattern);
    if (!normalized) {
      return false;
    }
    return this.substrate.removeRule(normalized);
  }

  public loadSharedBlocklist(fileContent: string, sourcePath: string): number {
    const parsedRules = this.policyEngine.parseBlocklistFile(fileContent, sourcePath);
    for (const rule of parsedRules) {
      this.substrate.setRule(rule);
    }
    return parsedRules.length;
  }

  public checkAccess(urlOrHost: string): WebsiteAccessCheckResult {
    const rules = this.substrate.getRules();
    const result = this.policyEngine.checkAccess(urlOrHost, rules, this.enabled);
    this.substrate.recordCheck(result);
    return result;
  }

  public getRules(): readonly WebsitePolicyRule[] {
    return this.substrate.getRules();
  }

  public getHistory(): readonly WebsiteAccessCheckResult[] {
    return this.substrate.getHistory();
  }

  public getMetrics(): WebsitePolicyMetrics {
    return this.substrate.getMetrics();
  }

  public clear(): void {
    this.substrate.clear();
  }
}
