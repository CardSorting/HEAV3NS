/**
 * broccoli-osv-substrate.ts
 *
 * In-memory Broccolidb repository storing OSV malware advisory cache,
 * custom blocked packages, scan audit trails, and telemetry metrics (Phase 128 / ADR-104 / Target #61).
 */

import type {
  OsvCachedEntry,
  OsvScannerConfig,
  OsvScannerMetrics,
  OsvScannerWorkspaceSnapshot,
  OsvScanResult,
  ParsedPackageTarget,
} from "../../../core/contracts/osv-scanner.contracts.js";
import { DEFAULT_OSV_SCANNER_CONFIG } from "../../../core/contracts/osv-scanner.contracts.js";

export class BroccoliOsvSubstrate {
  private config: OsvScannerConfig = { ...DEFAULT_OSV_SCANNER_CONFIG };
  private cache = new Map<string, OsvCachedEntry>();
  private customBlocked = new Map<string, ParsedPackageTarget>();
  private metrics: OsvScannerMetrics = {
    totalScans: 0,
    cacheHits: 0,
    malwareBlocked: 0,
    cleanAllowed: 0,
    networkFailures: 0,
  };

  public setConfig(config: Partial<OsvScannerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): OsvScannerConfig {
    return { ...this.config };
  }

  public makeCacheKey(pkg: ParsedPackageTarget): string {
    return `${pkg.ecosystem}:${pkg.name}:${pkg.version || "*"}`;
  }

  public getCachedResult(pkg: ParsedPackageTarget, now = Date.now()): OsvScanResult | undefined {
    const key = this.makeCacheKey(pkg);
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (now >= entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    this.metrics.cacheHits++;
    return { ...entry.result, cached: true };
  }

  public setCachedResult(pkg: ParsedPackageTarget, result: OsvScanResult, now = Date.now()): void {
    this.pruneExpired(now);
    if (this.cache.size >= this.config.maxCacheEntries) {
      // Evict oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    const key = this.makeCacheKey(pkg);
    this.cache.set(key, {
      key,
      result: { ...result },
      expiresAt: now + this.config.cacheTtlMs,
    });
  }

  public pruneExpired(now = Date.now()): void {
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public addCustomBlockedPackage(pkg: ParsedPackageTarget): void {
    const key = this.makeCacheKey(pkg);
    this.customBlocked.set(key, { ...pkg });
  }

  public isCustomBlocked(pkg: ParsedPackageTarget): boolean {
    const key = this.makeCacheKey(pkg);
    const wildcardKey = `${pkg.ecosystem}:${pkg.name}:*`;
    return this.customBlocked.has(key) || this.customBlocked.has(wildcardKey);
  }

  public getCustomBlockedPackages(): ParsedPackageTarget[] {
    return Array.from(this.customBlocked.values()).map((p) => ({ ...p }));
  }

  public recordScan(result: OsvScanResult): void {
    this.metrics.totalScans++;
    if (!result.allowed) {
      this.metrics.malwareBlocked++;
    } else {
      this.metrics.cleanAllowed++;
    }
  }

  public recordNetworkFailure(): void {
    this.metrics.networkFailures++;
  }

  public getMetrics(): OsvScannerMetrics {
    return { ...this.metrics };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): OsvScannerWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
      cacheEntries: Array.from(this.cache.values()).map((e) => ({
        ...e,
        result: { ...e.result },
      })),
      customBlockedPackages: this.getCustomBlockedPackages(),
    };
  }

  public restoreSnapshot(snapshot: OsvScannerWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.metrics = { ...snapshot.metrics };
    this.cache.clear();
    for (const entry of snapshot.cacheEntries) {
      this.cache.set(entry.key, {
        ...entry,
        result: { ...entry.result },
      });
    }
    this.customBlocked.clear();
    for (const pkg of snapshot.customBlockedPackages) {
      this.customBlocked.set(this.makeCacheKey(pkg), { ...pkg });
    }
  }

  public clear(): void {
    this.config = { ...DEFAULT_OSV_SCANNER_CONFIG };
    this.cache.clear();
    this.customBlocked.clear();
    this.metrics = {
      totalScans: 0,
      cacheHits: 0,
      malwareBlocked: 0,
      cleanAllowed: 0,
      networkFailures: 0,
    };
  }
}
