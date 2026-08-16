/**
 * broccoli-website-policy-substrate.ts
 *
 * In-memory Broccolidb repository storing active website policy rules,
 * access decision audit logs, and aggregate metrics (Phase 120 / ADR-096 / Target #53).
 */

import type {
  WebsiteAccessCheckResult,
  WebsitePolicyMetrics,
  WebsitePolicyRule,
  WebsitePolicyWorkspaceSnapshot,
} from "../../../core/contracts/website-policy.contracts.js";

export class BroccoliWebsitePolicySubstrate {
  private readonly rules: Map<string, WebsitePolicyRule> = new Map();
  private readonly history: WebsiteAccessCheckResult[] = [];
  private totalChecks = 0;
  private allowedCount = 0;
  private blockedCount = 0;

  public setRule(rule: WebsitePolicyRule): void {
    this.rules.set(rule.pattern.toLowerCase(), rule);
  }

  public removeRule(pattern: string): boolean {
    return this.rules.delete(pattern.toLowerCase());
  }

  public getRules(): readonly WebsitePolicyRule[] {
    return Array.from(this.rules.values());
  }

  public recordCheck(result: WebsiteAccessCheckResult): void {
    this.totalChecks++;
    if (result.allowed) {
      this.allowedCount++;
    } else {
      this.blockedCount++;
      this.history.push(result);
      if (this.history.length > 500) {
        this.history.shift();
      }
    }
  }

  public getHistory(): readonly WebsiteAccessCheckResult[] {
    return this.history;
  }

  public getMetrics(): WebsitePolicyMetrics {
    return {
      totalChecks: this.totalChecks,
      allowedCount: this.allowedCount,
      blockedCount: this.blockedCount,
      activeRulesCount: this.rules.size,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): WebsitePolicyWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      rules: Array.from(this.rules.values()),
      history: [...this.history],
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: WebsitePolicyWorkspaceSnapshot): void {
    this.rules.clear();
    for (const r of snapshot.rules) {
      this.rules.set(r.pattern.toLowerCase(), r);
    }
    this.history.length = 0;
    this.history.push(...snapshot.history);

    this.totalChecks = snapshot.metrics.totalChecks;
    this.allowedCount = snapshot.metrics.allowedCount;
    this.blockedCount = snapshot.metrics.blockedCount;
  }

  public clear(): void {
    this.rules.clear();
    this.history.length = 0;
    this.totalChecks = 0;
    this.allowedCount = 0;
    this.blockedCount = 0;
  }
}
