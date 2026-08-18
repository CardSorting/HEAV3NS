/**
 * broccoli-url-safety-substrate.ts
 *
 * In-memory Hybrid BroccoliDB repository storing URL safety checks, SSRF attempts,
 * custom hostname policies, multi-criteria swimlanes, natural query DSL,
 * SLA health audits, and multi-format exporters (Phase 118 / ADR-094 / Target #87).
 */

import {
  DEFAULT_URL_SAFETY_CONFIG,
  type UrlSafetyCheckResult,
  type UrlSafetyConfig,
  type UrlSafetyMetrics,
  type UrlSafetyWorkspaceSnapshot,
  type UrlSafetyCheckRow,
  type UrlSafetyAuditRow,
  type UrlSafetyHealthAuditReport,
  type UrlSafetyMetricsReport,
  type UrlSafetyHealthStatus,
  type UrlSafetyGroupBy,
  type UrlSafetySortBy,
  type UrlSafetySortDirection,
  type UrlSafetyGroupedLane,
  type UrlSafetyDslQueryFilter,
  type UrlSafetyMutationUndoRecord,
  type UrlSafetyBulkMutationResult,
  type IBroccoliUrlSafetySubstrate,
  type IpAddressCategory,
  type UrlSafetyVerdict,
} from "../../../core/contracts/url-safety.contracts.js";

export class BroccoliUrlSafetySubstrate implements IBroccoliUrlSafetySubstrate {
  private readonly checks: Map<string, UrlSafetyCheckRow> = new Map();
  private readonly audits: UrlSafetyAuditRow[] = [];
  private config: UrlSafetyConfig = { ...DEFAULT_URL_SAFETY_CONFIG };

  // Undo / Redo Stacks
  private readonly undoStack: UrlSafetyMutationUndoRecord[] = [];
  private readonly redoStack: UrlSafetyMutationUndoRecord[] = [];

  private totalChecks = 0;
  private allowedCount = 0;
  private blockedMetadataCount = 0;
  private blockedPrivateCount = 0;
  private blockedLoopbackCount = 0;
  private blockedCustomCount = 0;
  private invalidUrlCount = 0;
  private lastCheckTimestamp?: number;

  public recordCheck(rowInput: Omit<UrlSafetyCheckRow, "checkId"> | UrlSafetyCheckResult): UrlSafetyCheckRow {
    const timestamp = Date.now();
    const checkId = `url_check_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;

    let row: UrlSafetyCheckRow;
    if ("rawUrl" in rowInput) {
      row = {
        ...rowInput,
        checkId,
      };
    } else {
      row = {
        checkId,
        rawUrl: rowInput.normalizedUrl,
        normalizedUrl: rowInput.normalizedUrl,
        hostname: rowInput.hostname,
        verdict: rowInput.verdict,
        isSafe: rowInput.isSafe,
        category: rowInput.category || (rowInput.isSafe ? "public" : "invalid"),
        resolvedIps: [...rowInput.resolvedIps],
        reason: rowInput.reason || (rowInput.isSafe ? "URL allowed" : "URL blocked"),
        timestamp,
        latencyMs: rowInput.latencyMs ?? 0.05,
      };
    }

    this.checks.set(checkId, row);
    this.totalChecks++;
    this.lastCheckTimestamp = timestamp;

    if (row.isSafe) {
      this.allowedCount++;
    } else {
      switch (row.verdict) {
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
        case "invalid_url":
          this.invalidUrlCount++;
          break;
      }
    }

    // Keep bounded in-memory check cache
    if (this.checks.size > 2000) {
      const oldestKey = this.checks.keys().next().value;
      if (oldestKey) this.checks.delete(oldestKey);
    }

    return row;
  }

  public getCheck(checkId: string): UrlSafetyCheckRow | null {
    return this.checks.get(checkId) || null;
  }

  public getRecentChecks(limit = 50): UrlSafetyCheckRow[] {
    const all = Array.from(this.checks.values());
    all.sort((a, b) => b.timestamp - a.timestamp);
    return all.slice(0, limit);
  }

  public getAllChecks(): UrlSafetyCheckRow[] {
    return Array.from(this.checks.values());
  }

  public getBlockedLedger(): readonly UrlSafetyCheckResult[] {
    return Array.from(this.checks.values())
      .filter((c) => !c.isSafe)
      .map((c) => ({
        isSafe: c.isSafe,
        verdict: c.verdict,
        normalizedUrl: c.normalizedUrl,
        hostname: c.hostname,
        resolvedIps: c.resolvedIps,
        reason: c.reason,
        category: c.category,
        latencyMs: c.latencyMs,
      }));
  }

  public getConfig(): UrlSafetyConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<UrlSafetyConfig>): UrlSafetyConfig {
    const previousConfig = { ...this.config };
    this.config = { ...this.config, ...updates };

    this.undoStack.push({
      mutationId: `undo_config_${Date.now()}`,
      timestamp: Date.now(),
      action: "update_config",
      previousRows: [],
      previousConfig,
    });
    this.redoStack.length = 0;

    return this.getConfig();
  }

  public addCustomBlockedHost(host: string): void {
    const clean = host.toLowerCase().trim();
    if (!this.config.customBlockedHosts.includes(clean)) {
      this.updateConfig({
        customBlockedHosts: [...this.config.customBlockedHosts, clean],
      });
    }
  }

  public addCustomAllowedHost(host: string): void {
    const clean = host.toLowerCase().trim();
    if (!this.config.customAllowedHosts.includes(clean)) {
      this.updateConfig({
        customAllowedHosts: [...this.config.customAllowedHosts, clean],
      });
    }
  }

  public isCustomBlocked(host: string): boolean {
    return this.config.customBlockedHosts.includes(host.toLowerCase().trim());
  }

  public isCustomAllowed(host: string): boolean {
    return this.config.customAllowedHosts.includes(host.toLowerCase().trim());
  }

  public getCustomBlockedHosts(): readonly string[] {
    return this.config.customBlockedHosts;
  }

  public getCustomAllowedHosts(): readonly string[] {
    return this.config.customAllowedHosts;
  }

  public getMetrics(): UrlSafetyMetrics {
    return {
      totalChecks: this.totalChecks,
      allowedCount: this.allowedCount,
      blockedMetadataCount: this.blockedMetadataCount,
      blockedPrivateCount: this.blockedPrivateCount,
      blockedLoopbackCount: this.blockedLoopbackCount,
      blockedCustomCount: this.blockedCustomCount,
      invalidUrlCount: this.invalidUrlCount,
      lastCheckTimestamp: this.lastCheckTimestamp,
    };
  }

  public getMetricsReport(): UrlSafetyMetricsReport {
    return {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
      config: this.getConfig(),
      recentChecksCount: this.checks.size,
      activeBlockedHostsCount: this.config.customBlockedHosts.length,
      activeAllowedHostsCount: this.config.customAllowedHosts.length,
    };
  }

  public auditHealth(): UrlSafetyHealthAuditReport {
    const metrics = this.getMetrics();
    const blockedCount =
      metrics.blockedMetadataCount +
      metrics.blockedPrivateCount +
      metrics.blockedLoopbackCount +
      metrics.blockedCustomCount +
      metrics.invalidUrlCount;

    const safeRatioPercent =
      metrics.totalChecks > 0 ? (metrics.allowedCount / metrics.totalChecks) * 100 : 100;

    const allChecks = Array.from(this.checks.values());
    const totalLatency = allChecks.reduce((acc, c) => acc + c.latencyMs, 0);
    const avgLatencyMs = allChecks.length > 0 ? totalLatency / allChecks.length : 0.05;

    const slaViolations: string[] = [];
    let status: UrlSafetyHealthStatus = "optimal";

    if (avgLatencyMs > 1.0) {
      status = "degraded";
      slaViolations.push(`Avg check latency ${avgLatencyMs.toFixed(3)}ms exceeds 1.0ms SLA.`);
    }

    if (metrics.blockedMetadataCount > 50) {
      status = "critical";
      slaViolations.push(`Critical SSRF metadata probe volume: ${metrics.blockedMetadataCount} detected.`);
    }

    const auditRow: UrlSafetyAuditRow = {
      auditId: `audit_${Date.now()}`,
      timestamp: Date.now(),
      status,
      totalChecks: metrics.totalChecks,
      allowedCount: metrics.allowedCount,
      blockedCount,
      slaViolation: slaViolations.length > 0,
      details: slaViolations.join("; ") || "All SSRF defense metrics within SLA thresholds.",
    };
    this.audits.push(auditRow);
    if (this.audits.length > 100) this.audits.shift();

    return {
      status,
      timestamp: Date.now(),
      totalChecks: metrics.totalChecks,
      allowedCount: metrics.allowedCount,
      blockedCount,
      blockedMetadataCount: metrics.blockedMetadataCount,
      blockedPrivateCount: metrics.blockedPrivateCount,
      blockedLoopbackCount: metrics.blockedLoopbackCount,
      blockedCustomCount: metrics.blockedCustomCount,
      safeRatioPercent,
      avgLatencyMs,
      slaViolations,
    };
  }

  public getGroupedChecks(
    groupBy: UrlSafetyGroupBy,
    sortBy: UrlSafetySortBy = "timestamp",
    sortDirection: UrlSafetySortDirection = "desc"
  ): UrlSafetyGroupedLane[] {
    const lanesMap = new Map<string, UrlSafetyCheckRow[]>();

    for (const check of this.checks.values()) {
      let key = "other";
      switch (groupBy) {
        case "verdict":
          key = check.verdict;
          break;
        case "category":
          key = check.category;
          break;
        case "hostname":
          key = check.hostname || "unknown";
          break;
        case "isSafe":
          key = check.isSafe ? "safe" : "blocked";
          break;
      }

      if (!lanesMap.has(key)) lanesMap.set(key, []);
      lanesMap.get(key)!.push(check);
    }

    const lanes: UrlSafetyGroupedLane[] = [];
    for (const [laneId, items] of lanesMap.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case "timestamp":
            cmp = a.timestamp - b.timestamp;
            break;
          case "normalizedUrl":
            cmp = a.normalizedUrl.localeCompare(b.normalizedUrl);
            break;
          case "hostname":
            cmp = a.hostname.localeCompare(b.hostname);
            break;
          case "verdict":
            cmp = a.verdict.localeCompare(b.verdict);
            break;
          case "latencyMs":
            cmp = a.latencyMs - b.latencyMs;
            break;
        }
        return sortDirection === "asc" ? cmp : -cmp;
      });

      lanes.push({
        laneId,
        title: laneId.toUpperCase(),
        count: items.length,
        checks: items,
      });
    }

    return lanes;
  }

  public queryChecksDsl(dslQuery: string | UrlSafetyDslQueryFilter): UrlSafetyCheckRow[] {
    let filter: UrlSafetyDslQueryFilter;

    if (typeof dslQuery === "string") {
      filter = {};
      const tokens = dslQuery.trim().split(/\s+/);
      for (const t of tokens) {
        if (!t) continue;
        const [k, v] = t.split(":");
        if (k && v) {
          const val = v.toLowerCase();
          if (k === "verdict") filter.verdict = val as UrlSafetyVerdict;
          else if (k === "category") filter.category = val as IpAddressCategory;
          else if (k === "host") filter.hostContains = val;
          else if (k === "ip") filter.ipContains = val;
          else if (k === "url") filter.urlContains = val;
          else if (k === "is") {
            if (val === "safe" || val === "allowed") filter.isSafe = true;
            if (val === "blocked" || val === "unsafe") filter.isSafe = false;
          }
        } else {
          filter.urlContains = t.toLowerCase();
        }
      }
    } else {
      filter = dslQuery;
    }

    return Array.from(this.checks.values()).filter((c) => {
      if (filter.verdict && c.verdict !== filter.verdict) return false;
      if (filter.category && c.category !== filter.category) return false;
      if (filter.isSafe !== undefined && c.isSafe !== filter.isSafe) return false;
      if (filter.hostContains && !c.hostname.toLowerCase().includes(filter.hostContains.toLowerCase())) return false;
      if (filter.urlContains && !c.normalizedUrl.toLowerCase().includes(filter.urlContains.toLowerCase())) return false;
      if (filter.ipContains && !c.resolvedIps.some((ip) => ip.includes(filter.ipContains!))) return false;
      if (filter.minTimestamp && c.timestamp < filter.minTimestamp) return false;
      if (filter.maxTimestamp && c.timestamp > filter.maxTimestamp) return false;
      return true;
    });
  }

  public bulkPurgeChecks(checkIds: string[]): UrlSafetyBulkMutationResult {
    const toDelete: UrlSafetyCheckRow[] = [];
    const affectedCheckIds: string[] = [];

    for (const id of checkIds) {
      const existing = this.checks.get(id);
      if (existing) {
        toDelete.push(existing);
        affectedCheckIds.push(id);
        this.checks.delete(id);
      }
    }

    if (affectedCheckIds.length > 0) {
      this.undoStack.push({
        mutationId: `purge_${Date.now()}`,
        timestamp: Date.now(),
        action: "bulk_purge",
        previousRows: toDelete,
      });
      this.redoStack.length = 0;
    }

    return {
      success: true,
      matchedCount: checkIds.length,
      affectedCheckIds,
      timestamp: Date.now(),
    };
  }

  public undo(): boolean {
    const record = this.undoStack.pop();
    if (!record) return false;

    if (record.action === "bulk_purge") {
      for (const row of record.previousRows) {
        this.checks.set(row.checkId, row);
      }
    } else if (record.action === "update_config" && record.previousConfig) {
      this.config = { ...record.previousConfig };
    } else if (record.action === "clear") {
      for (const row of record.previousRows) {
        this.checks.set(row.checkId, row);
      }
      if (record.previousConfig) this.config = { ...record.previousConfig };
    }

    this.redoStack.push(record);
    return true;
  }

  public redo(): boolean {
    const record = this.redoStack.pop();
    if (!record) return false;

    if (record.action === "bulk_purge") {
      for (const row of record.previousRows) {
        this.checks.delete(row.checkId);
      }
    }

    this.undoStack.push(record);
    return true;
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string, frameNumber?: number): UrlSafetyWorkspaceSnapshot {
    return {
      snapshotId,
      frameNumber,
      timestamp: Date.now(),
      blockedLedger: this.getBlockedLedger(),
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: UrlSafetyWorkspaceSnapshot): void {
    this.checks.clear();
    for (const b of snapshot.blockedLedger) {
      const checkId = `url_snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      this.checks.set(checkId, {
        checkId,
        rawUrl: b.normalizedUrl,
        normalizedUrl: b.normalizedUrl,
        hostname: b.hostname,
        verdict: b.verdict,
        isSafe: b.isSafe,
        category: b.category || "invalid",
        resolvedIps: [...b.resolvedIps],
        reason: b.reason || "",
        timestamp: snapshot.timestamp,
        latencyMs: b.latencyMs ?? 0.05,
      });
    }

    this.totalChecks = snapshot.metrics.totalChecks;
    this.allowedCount = snapshot.metrics.allowedCount;
    this.blockedMetadataCount = snapshot.metrics.blockedMetadataCount;
    this.blockedPrivateCount = snapshot.metrics.blockedPrivateCount;
    this.blockedLoopbackCount = snapshot.metrics.blockedLoopbackCount;
    this.blockedCustomCount = snapshot.metrics.blockedCustomCount;
    this.invalidUrlCount = snapshot.metrics.invalidUrlCount ?? 0;
  }

  public clear(): void {
    const prevRows = Array.from(this.checks.values());
    const prevConfig = { ...this.config };

    this.undoStack.push({
      mutationId: `clear_${Date.now()}`,
      timestamp: Date.now(),
      action: "clear",
      previousRows: prevRows,
      previousConfig: prevConfig,
    });
    this.redoStack.length = 0;

    this.checks.clear();
    this.config = { ...DEFAULT_URL_SAFETY_CONFIG };
    this.totalChecks = 0;
    this.allowedCount = 0;
    this.blockedMetadataCount = 0;
    this.blockedPrivateCount = 0;
    this.blockedLoopbackCount = 0;
    this.blockedCustomCount = 0;
    this.invalidUrlCount = 0;
  }

  // Multi-Format Exporters
  public exportHtml(): string {
    const checks = Array.from(this.checks.values());
    const metrics = this.getMetrics();
    const rows = checks
      .map(
        (c) => `<tr>
          <td>${c.checkId}</td>
          <td><code>${c.normalizedUrl}</code></td>
          <td><strong>${c.hostname}</strong></td>
          <td><span class="badge ${c.isSafe ? "badge-safe" : "badge-blocked"}">${c.verdict}</span></td>
          <td>${c.category}</td>
          <td>${c.resolvedIps.join(", ") || "-"}</td>
          <td>${c.latencyMs.toFixed(2)}ms</td>
        </tr>`
      )
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI SSRF Firewall & URL Safety Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0d1117; color: #c9d1d9; margin: 20px; }
    h1 { color: #58a6ff; }
    .metrics { display: flex; gap: 15px; margin-bottom: 20px; }
    .metric-card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px 20px; }
    .metric-val { font-size: 24px; font-weight: bold; color: #58a6ff; }
    table { width: 100%; border-collapse: collapse; background: #161b22; border-radius: 6px; overflow: hidden; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #21262d; font-size: 13px; }
    th { background: #21262d; color: #8b949e; }
    .badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
    .badge-safe { background: #238636; color: #fff; }
    .badge-blocked { background: #da3633; color: #fff; }
    code { font-family: monospace; color: #79c0ff; }
  </style>
</head>
<body>
  <h1>SSRF Defense Firewall & URL Safety Dashboard</h1>
  <div class="metrics">
    <div class="metric-card"><div class="metric-val">${metrics.totalChecks}</div>Total Checks</div>
    <div class="metric-card"><div class="metric-val" style="color:#3fb950">${metrics.allowedCount}</div>Allowed</div>
    <div class="metric-card"><div class="metric-val" style="color:#f85149">${metrics.blockedMetadataCount}</div>Metadata Blocks</div>
    <div class="metric-card"><div class="metric-val" style="color:#d29922">${metrics.blockedPrivateCount}</div>Private IP Blocks</div>
    <div class="metric-card"><div class="metric-val" style="color:#a371f7">${metrics.blockedLoopbackCount}</div>Loopback Blocks</div>
  </div>
  <table>
    <thead><tr><th>ID</th><th>Normalized URL</th><th>Hostname</th><th>Verdict</th><th>Category</th><th>Resolved IPs</th><th>Latency</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdown(): string {
    const metrics = this.getMetrics();
    const checks = Array.from(this.checks.values());
    const lines = [
      "# SSRF Defense Firewall & URL Safety Report",
      "",
      `**Total Checks**: ${metrics.totalChecks} | **Allowed**: ${metrics.allowedCount} | **Metadata Blocks**: ${metrics.blockedMetadataCount} | **Private Blocks**: ${metrics.blockedPrivateCount} | **Loopback Blocks**: ${metrics.blockedLoopbackCount}`,
      "",
      "| Check ID | Verdict | Category | Hostname | Latency |",
      "|---|---|---|---|---|",
    ];

    for (const c of checks.slice(0, 50)) {
      lines.push(`| \`${c.checkId}\` | **${c.verdict}** | ${c.category} | \`${c.hostname}\` | ${c.latencyMs.toFixed(2)}ms |`);
    }

    return lines.join("\n");
  }

  public exportCsv(): string {
    const checks = Array.from(this.checks.values());
    const lines = ["checkId,normalizedUrl,hostname,verdict,isSafe,category,resolvedIps,latencyMs,timestamp"];
    for (const c of checks) {
      lines.push(
        `"${c.checkId}","${c.normalizedUrl}","${c.hostname}","${c.verdict}",${c.isSafe},"${c.category}","${c.resolvedIps.join(";")}",${c.latencyMs},${c.timestamp}`
      );
    }
    return lines.join("\n");
  }
}
