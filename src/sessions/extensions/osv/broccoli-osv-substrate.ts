/**
 * broccoli-osv-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate storing OSV malware advisory cache,
 * custom blocked packages, scan audit trails, and telemetry metrics (Phase 128 / ADR-104 / Target #81).
 */

import type {
  IBroccoliOsvSubstrate,
  OsvAuditRow,
  OsvBulkMutationResult,
  OsvCachedEntry,
  OsvDslQueryFilter,
  OsvGroupBy,
  OsvGroupedLane,
  OsvHealthAuditReport,
  OsvHealthStatus,
  OsvMetricsReport,
  OsvMutationUndoRecord,
  OsvScannerConfig,
  OsvScannerMetrics,
  OsvScannerWorkspaceSnapshot,
  OsvScanResult,
  OsvScanResultRow,
  OsvSortBy,
  OsvSortDirection,
  ParsedPackageTarget,
} from "../../../core/contracts/osv-scanner.contracts.js";
import { DEFAULT_OSV_SCANNER_CONFIG } from "../../../core/contracts/osv-scanner.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliOsvSubstrate implements IBroccoliOsvSubstrate {
  private config: OsvScannerConfig = { ...DEFAULT_OSV_SCANNER_CONFIG };
  private readonly cache = new Map<string, OsvCachedEntry>();
  private readonly customBlocked = new Map<string, ParsedPackageTarget>();
  private readonly scans = new Map<string, OsvScanResultRow>();
  private readonly audits = new Map<string, OsvAuditRow>();
  private metrics: OsvScannerMetrics = {
    totalScans: 0,
    cacheHits: 0,
    malwareBlocked: 0,
    cleanAllowed: 0,
    networkFailures: 0,
  };

  private readonly undoStack: OsvMutationUndoRecord[] = [];
  private readonly redoStack: OsvMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private scansTable?: IDbTable<OsvScanResultRow>;
  private auditsTable?: IDbTable<OsvAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.scansTable = dbKernel.getTable<OsvScanResultRow>("osv_scan_results");
      this.auditsTable = dbKernel.getTable<OsvAuditRow>("osv_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  public setConfig(config: Partial<OsvScannerConfig>): void {
    const prev = this.exportSnapshot();
    this.config = { ...this.config, ...config };
    this.pushUndoRecord("config_change", prev);
  }

  public getConfig(): OsvScannerConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: OsvMutationUndoRecord["mutationType"], prev: OsvScannerWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliOsvSubstrate.MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  public undo(): boolean {
    const record = this.undoStack.pop();
    if (!record) return false;

    this.redoStack.push({
      mutationType: record.mutationType,
      previousSnapshot: this.exportSnapshot(),
      nextSnapshot: record.nextSnapshot,
      timestampMs: Date.now(),
    });

    this.importSnapshot(record.previousSnapshot);
    return true;
  }

  public redo(): boolean {
    const record = this.redoStack.pop();
    if (!record) return false;

    this.undoStack.push({
      mutationType: record.mutationType,
      previousSnapshot: this.exportSnapshot(),
      nextSnapshot: record.nextSnapshot,
      timestampMs: Date.now(),
    });

    this.importSnapshot(record.nextSnapshot);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Cache Management
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Custom Blocked Packages
  // ---------------------------------------------------------------------------

  public addCustomBlockedPackage(pkg: ParsedPackageTarget): void {
    const prev = this.exportSnapshot();
    const key = this.makeCacheKey(pkg);
    this.customBlocked.set(key, { ...pkg });
    this.pushUndoRecord("block_package", prev);
  }

  public isCustomBlocked(pkg: ParsedPackageTarget): boolean {
    const key = this.makeCacheKey(pkg);
    const wildcardKey = `${pkg.ecosystem}:${pkg.name}:*`;
    return this.customBlocked.has(key) || this.customBlocked.has(wildcardKey);
  }

  public getCustomBlockedPackages(): ParsedPackageTarget[] {
    return Array.from(this.customBlocked.values()).map((p) => ({ ...p }));
  }

  // ---------------------------------------------------------------------------
  // Scan Storage & Metrics
  // ---------------------------------------------------------------------------

  public recordScan(result: OsvScanResult | OsvScanResultRow): void {
    const prev = this.exportSnapshot();
    const scanId = (result as any).scanId || `osv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const pkg = (result as any).package;
    const ecosystem = pkg ? pkg.ecosystem : (result as OsvScanResultRow).ecosystem;
    const packageName = pkg ? pkg.name : (result as OsvScanResultRow).packageName;
    const version = pkg ? pkg.version : (result as OsvScanResultRow).version;

    const row: OsvScanResultRow = {
      scanId,
      ecosystem,
      packageName,
      version,
      allowed: result.allowed,
      cached: result.cached,
      advisories: result.advisories,
      reason: result.reason,
      scanDurationMs: result.scanDurationMs,
      timestamp: (result as any).timestamp || Date.now(),
    };

    this.scans.set(scanId, row);
    this.metrics.totalScans++;
    if (!result.allowed) {
      this.metrics.malwareBlocked++;
    } else {
      this.metrics.cleanAllowed++;
    }

    if (this.scansTable) {
      this.scansTable.put(scanId, row);
    }

    const auditRow: OsvAuditRow = {
      auditId: `osv-audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      totalScans: this.metrics.totalScans,
      cacheHits: this.metrics.cacheHits,
      malwareBlocked: this.metrics.malwareBlocked,
      cleanAllowed: this.metrics.cleanAllowed,
      healthStatus: !result.allowed ? "critical" : "optimal",
      targetPackage: packageName,
      ecosystem,
      action: result.allowed ? "ALLOWED" : "BLOCKED",
      details: result.reason || `Scan completed: ${result.advisories.length} advisories`,
    };
    this.audits.set(auditRow.auditId, auditRow);
    if (this.auditsTable) {
      this.auditsTable.put(auditRow.auditId, auditRow);
    }

    this.pushUndoRecord("add_scan", prev);
  }

  public recordNetworkFailure(): void {
    this.metrics.networkFailures++;
  }

  public getScan(id: string): OsvScanResultRow | undefined {
    return this.scans.get(id);
  }

  public listScans(): readonly OsvScanResultRow[] {
    return Array.from(this.scans.values());
  }

  public getScanResults(): readonly OsvScanResultRow[] {
    return Array.from(this.scans.values());
  }

  public listAudits(): readonly OsvAuditRow[] {
    return Array.from(this.audits.values());
  }

  public getAudits(): readonly OsvAuditRow[] {
    return Array.from(this.audits.values());
  }

  public removeScan(id: string): boolean {
    const exists = this.scans.has(id);
    if (!exists) return false;

    const prev = this.exportSnapshot();
    this.scans.delete(id);

    if (this.scansTable) {
      this.scansTable.delete(id);
    }

    this.pushUndoRecord("clear", prev);
    return true;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): OsvHealthAuditReport {
    let healthStatus: OsvHealthStatus = "optimal";
    const recommendations: string[] = [];

    const hitRate =
      this.metrics.totalScans === 0
        ? 0
        : Number(((this.metrics.cacheHits / this.metrics.totalScans) * 100).toFixed(1));

    if (this.metrics.malwareBlocked > 5) {
      healthStatus = "degraded";
      recommendations.push("Multiple malicious packages intercepted in workspace install commands.");
    }

    if (this.metrics.networkFailures > 10) {
      healthStatus = "critical";
      recommendations.push("High network failure rate when querying OSV API.");
    }

    if (this.metrics.totalScans === 0) {
      healthStatus = "healthy";
      recommendations.push("OSV vulnerability scanner initialized cleanly.");
    }

    const score = healthStatus === "optimal" ? 100 : healthStatus === "healthy" ? 95 : healthStatus === "degraded" ? 75 : 40;

    return {
      ...this.metrics,
      cacheHitRatePercent: hitRate,
      cacheHitRate: hitRate / 100,
      healthStatus,
      status: healthStatus,
      score,
      recommendations,
    };
  }

  public getMetrics(): OsvScannerMetrics {
    return { ...this.metrics };
  }

  public getMetricsReport(): OsvMetricsReport {
    const hitRate =
      this.metrics.totalScans === 0
        ? 0
        : Number(((this.metrics.cacheHits / this.metrics.totalScans) * 100).toFixed(1));

    const scansByEcosystem: Record<string, number> = {};
    for (const scan of this.scans.values()) {
      scansByEcosystem[scan.ecosystem] = (scansByEcosystem[scan.ecosystem] || 0) + 1;
    }

    return {
      ...this.metrics,
      cacheHitRatePercent: hitRate,
      cacheHitRate: hitRate / 100,
      scansByEcosystem,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedScans(
    groupBy: OsvGroupBy = "ecosystem",
    sortBy: OsvSortBy = "timestamp",
    direction: OsvSortDirection = "desc"
  ): readonly OsvGroupedLane[] {
    const lanes = new Map<string, OsvScanResultRow[]>();
    const all = Array.from(this.scans.values());

    for (const scan of all) {
      let key = "default";
      switch (groupBy) {
        case "ecosystem":
          key = scan.ecosystem;
          break;
        case "allowedStatus":
        case "verdict":
          key = scan.allowed ? "allowed" : "blocked";
          break;
        case "isMalware":
          key = scan.advisories.some((a) => a.isMalware) ? "malware" : "clean";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(scan);
    }

    const result: OsvGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = b.timestamp - a.timestamp;
        else if (sortBy === "scanDurationMs") cmp = b.scanDurationMs - a.scanDurationMs;
        else if (sortBy === "packageName") cmp = b.packageName.localeCompare(a.packageName);
        return direction === "asc" ? -cmp : cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        scans: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryScansDsl(query: OsvDslQueryFilter | string): readonly OsvScanResultRow[] {
    const parsed: OsvDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const all = Array.from(this.scans.values());

    return all.filter((scan) => {
      if (parsed.ecosystem && scan.ecosystem.toLowerCase() !== parsed.ecosystem.toLowerCase()) return false;
      if (parsed.allowed !== undefined && scan.allowed !== parsed.allowed) return false;
      if (parsed.hasMalware !== undefined) {
        const isMalware = scan.advisories.some((a) => a.isMalware);
        if (isMalware !== parsed.hasMalware) return false;
      }

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${scan.scanId} ${scan.packageName} ${scan.ecosystem} ${scan.reason || ""}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): OsvDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let ecosystem: any;
    let allowed: boolean | undefined;
    let hasMalware: boolean | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("eco:") || tok.startsWith("ecosystem:")) {
        ecosystem = tok.split(":")[1];
      } else if (tok === "is:blocked" || tok === "status:blocked") {
        allowed = false;
      } else if (tok === "is:allowed" || tok === "status:allowed") {
        allowed = true;
      } else if (tok === "is:malware") {
        hasMalware = true;
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      ecosystem,
      allowed,
      hasMalware,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeScans(ids: readonly string[]): OsvBulkMutationResult {
    const prev = this.exportSnapshot();
    let modified = 0;

    for (const id of ids) {
      if (this.scans.has(id)) {
        this.scans.delete(id);
        if (this.scansTable) this.scansTable.delete(id);
        modified++;
      }
    }

    this.pushUndoRecord("clear", prev);
    return {
      matchedCount: ids.length,
      modifiedCount: modified,
      affectedScanIds: ids,
      affectedCount: modified,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const scans = this.listScans();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI OSV Vulnerability Scanner</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>🛡️ LUMI OSV Malware Scanner</h1>
  <p style="color: #94a3b8;">Deterministic Package Advisory Firewall (Phase 128 / ADR-104)</p>
  
  <div class="grid">
    <div class="card"><div>Total Scanned</div><div class="metric-val">${metrics.totalScans}</div></div>
    <div class="card"><div>Malware Blocked</div><div class="metric-val" style="color:#f43f5e;">${metrics.malwareBlocked}</div></div>
    <div class="card"><div>Cache Hits</div><div class="metric-val" style="color:#10b981;">${metrics.cacheHits}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Scanned Packages Ledger</h2>
  <table>
    <thead><tr><th>Scan ID</th><th>Ecosystem</th><th>Package</th><th>Allowed</th><th>Advisories</th><th>Duration</th></tr></thead>
    <tbody>
      ${scans.map((s) => `<tr><td><code>${s.scanId}</code></td><td>${s.ecosystem}</td><td><b>${s.packageName}</b></td><td>${s.allowed ? "YES" : "NO"}</td><td>${s.advisories.length}</td><td>${s.scanDurationMs.toFixed(2)}ms</td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const scans = this.listScans();

    let md = `# LUMI OSV Scanner Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Scanned:** \`${metrics.totalScans}\` | **Malware Blocked:** \`${metrics.malwareBlocked}\` | **Cache Hits:** \`${metrics.cacheHits}\`\n\n`;
    md += `## Package Scans (${scans.length})\n\n`;
    md += `| Scan ID | Ecosystem | Package | Allowed | Advisories | Duration |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const s of scans) {
      md += `| \`${s.scanId}\` | ${s.ecosystem} | **${s.packageName}** | ${s.allowed ? "YES" : "NO"} | ${s.advisories.length} | ${s.scanDurationMs.toFixed(2)}ms |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "scanId,ecosystem,packageName,allowed,cached,advisoriesCount,durationMs,timestamp\n";
    const rows = Array.from(this.scans.values()).map((s) => {
      return `"${s.scanId}","${s.ecosystem}","${s.packageName}",${s.allowed},${s.cached},${s.advisories.length},${s.scanDurationMs},${s.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): OsvScannerWorkspaceSnapshot {
    return {
      snapshotId: `snap-${Date.now()}`,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
      cacheEntries: Array.from(this.cache.values()).map((e) => ({
        ...e,
        result: { ...e.result },
      })),
      customBlockedPackages: this.getCustomBlockedPackages(),
      scans: Array.from(this.scans.values()),
    };
  }

  public createSnapshot(snapshotId: string): OsvScannerWorkspaceSnapshot {
    const snap = this.exportSnapshot();
    return { ...snap, snapshotId };
  }

  public importSnapshot(snapshot: OsvScannerWorkspaceSnapshot): void {
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
      const key = this.makeCacheKey(pkg);
      this.customBlocked.set(key, { ...pkg });
    }
    this.scans.clear();
    if (snapshot.scans) {
      for (const s of snapshot.scans) {
        this.scans.set(s.scanId, { ...s });
      }
    }
  }

  public restoreSnapshot(snapshot: OsvScannerWorkspaceSnapshot): void {
    this.importSnapshot(snapshot);
  }

  public clear(): void {
    this.config = { ...DEFAULT_OSV_SCANNER_CONFIG };
    this.metrics = {
      totalScans: 0,
      cacheHits: 0,
      malwareBlocked: 0,
      cleanAllowed: 0,
      networkFailures: 0,
    };
    this.cache.clear();
    this.customBlocked.clear();
    this.scans.clear();
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
