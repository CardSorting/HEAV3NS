/**
 * broccoli-url-safety-substrate.ts
 *
 * In-memory Broccolidb repository storing blocked SSRF attempts,
 * custom hostname policies, and aggregate firewall telemetry (Phase 118 / ADR-094 / Target #51).
 */

import type {
  UrlSafetyCheckResult,
  UrlSafetyMetrics,
  UrlSafetyWorkspaceSnapshot,
} from "../../../core/contracts/url-safety.contracts.js";

export class BroccoliUrlSafetySubstrate {
  private readonly blockedLedger: UrlSafetyCheckResult[] = [];
  private readonly customBlockedHosts = new Set<string>();
  private readonly customAllowedHosts = new Set<string>();

  private totalChecks = 0;
  private allowedCount = 0;
  private blockedMetadataCount = 0;
  private blockedPrivateCount = 0;
  private blockedLoopbackCount = 0;
  private blockedCustomCount = 0;

  public recordCheck(result: UrlSafetyCheckResult): void {
    this.totalChecks++;
    if (result.isSafe) {
      this.allowedCount++;
    } else {
      this.blockedLedger.push(result);
      if (this.blockedLedger.length > 500) {
        this.blockedLedger.shift();
      }

      switch (result.verdict) {
        case "blocked_cloud_metadata":
          this.blockedMetadataCount++;
          break;
        case "blocked_private_ip":
          this.blockedPrivateCount++;
          break;
        case "blocked_loopback":
          this.blockedLoopbackCount++;
          break;
        case "blocked_custom_rule":
          this.blockedCustomCount++;
          break;
      }
    }
  }

  public getBlockedLedger(): readonly UrlSafetyCheckResult[] {
    return this.blockedLedger;
  }

  public addCustomBlockedHost(host: string): void {
    this.customBlockedHosts.add(host.toLowerCase().trim());
  }

  public addCustomAllowedHost(host: string): void {
    this.customAllowedHosts.add(host.toLowerCase().trim());
  }

  public isCustomBlocked(host: string): boolean {
    return this.customBlockedHosts.has(host.toLowerCase().trim());
  }

  public isCustomAllowed(host: string): boolean {
    return this.customAllowedHosts.has(host.toLowerCase().trim());
  }

  public getCustomBlockedHosts(): readonly string[] {
    return Array.from(this.customBlockedHosts);
  }

  public getCustomAllowedHosts(): readonly string[] {
    return Array.from(this.customAllowedHosts);
  }

  public getMetrics(): UrlSafetyMetrics {
    return {
      totalChecks: this.totalChecks,
      allowedCount: this.allowedCount,
      blockedMetadataCount: this.blockedMetadataCount,
      blockedPrivateCount: this.blockedPrivateCount,
      blockedLoopbackCount: this.blockedLoopbackCount,
      blockedCustomCount: this.blockedCustomCount,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): UrlSafetyWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      blockedLedger: [...this.blockedLedger],
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: UrlSafetyWorkspaceSnapshot): void {
    this.blockedLedger.length = 0;
    this.blockedLedger.push(...snapshot.blockedLedger);

    this.totalChecks = snapshot.metrics.totalChecks;
    this.allowedCount = snapshot.metrics.allowedCount;
    this.blockedMetadataCount = snapshot.metrics.blockedMetadataCount;
    this.blockedPrivateCount = snapshot.metrics.blockedPrivateCount;
    this.blockedLoopbackCount = snapshot.metrics.blockedLoopbackCount;
    this.blockedCustomCount = snapshot.metrics.blockedCustomCount;
  }

  public clear(): void {
    this.blockedLedger.length = 0;
    this.customBlockedHosts.clear();
    this.customAllowedHosts.clear();
    this.totalChecks = 0;
    this.allowedCount = 0;
    this.blockedMetadataCount = 0;
    this.blockedPrivateCount = 0;
    this.blockedLoopbackCount = 0;
    this.blockedCustomCount = 0;
  }
}
