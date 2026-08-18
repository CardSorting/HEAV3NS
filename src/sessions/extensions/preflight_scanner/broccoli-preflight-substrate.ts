/**
 * broccoli-preflight-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate maintaining pre-flight command security scan history,
 * active threat findings, security policy configurations, and circuit breaker metrics (Phase 113 / ADR-089 / Target #79).
 */

import type {
  IBroccoliPreflightSubstrate,
  PreflightAuditRow,
  PreflightBulkMutationResult,
  PreflightDslQueryFilter,
  PreflightGroupBy,
  PreflightGroupedLane,
  PreflightHealthAuditReport,
  PreflightHealthStatus,
  PreflightMetrics,
  PreflightMetricsReport,
  PreflightMutationUndoRecord,
  PreflightScanResult,
  PreflightScanResultRow,
  PreflightSecurityPolicy,
  PreflightSortBy,
  PreflightSortDirection,
  PreflightWorkspaceSnapshot,
} from "../../../core/contracts/preflight-scanner.contracts.js";
import { DEFAULT_PREFLIGHT_SECURITY_POLICY } from "../../../core/contracts/preflight-scanner.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliPreflightSubstrate implements IBroccoliPreflightSubstrate {
  private readonly scans = new Map<string, PreflightScanResultRow>();
  private readonly scanHistory: PreflightScanResult[] = [];
  private policy: PreflightSecurityPolicy = { ...DEFAULT_PREFLIGHT_SECURITY_POLICY };

  private consecutiveFailures = 0;
  private breakerTripped = false;
  private totalScans = 0;
  private totalBlocked = 0;
  private totalWarned = 0;
  private totalAllowed = 0;

  private readonly undoStack: PreflightMutationUndoRecord[] = [];
  private readonly redoStack: PreflightMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private scansTable?: IDbTable<PreflightScanResultRow>;
  private auditsTable?: IDbTable<PreflightAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.scansTable = dbKernel.getTable<PreflightScanResultRow>("preflight_scan_results");
      this.auditsTable = dbKernel.getTable<PreflightAuditRow>("preflight_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Policy Management
  // ---------------------------------------------------------------------------

  public getPolicy(): PreflightSecurityPolicy {
    return { ...this.policy, blockedCategories: [...this.policy.blockedCategories] };
  }

  public setPolicy(policy: Partial<PreflightSecurityPolicy>): void {
    const prev = this.exportSnapshot();
    this.policy = {
      ...this.policy,
      ...policy,
      blockedCategories: policy.blockedCategories
        ? [...policy.blockedCategories]
        : [...this.policy.blockedCategories],
    };
    this.pushUndoRecord("policy_change", prev);
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: PreflightMutationUndoRecord["mutationType"], prev: PreflightWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliPreflightSubstrate.MAX_UNDO_STACK) {
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
      nextSnapshot: record.previousSnapshot,
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
  // Scan Storage & Recording
  // ---------------------------------------------------------------------------

  public recordScan(result: PreflightScanResultRow | PreflightScanResult): void {
    const prev = this.exportSnapshot();
    const scanId = (result as any).scanId || `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const row: PreflightScanResultRow = {
      scanId,
      command: result.command,
      verdict: result.verdict,
      exitCode: result.exitCode,
      policyDecision: result.policyDecision,
      findings: result.findings,
      scanDurationMs: result.scanDurationMs,
      timestamp: (result as any).timestamp || Date.now(),
    };

    this.scans.set(scanId, row);
    this.scanHistory.push(result);
    this.totalScans++;

    if (result.verdict === "block") {
      this.totalBlocked++;
    } else if (result.verdict === "warn") {
      this.totalWarned++;
    } else {
      this.totalAllowed++;
    }

    if (this.scansTable) {
      this.scansTable.put(scanId, row);
    }

    this.pushUndoRecord("add_scan", prev);
  }

  public getScan(id: string): PreflightScanResultRow | undefined {
    return this.scans.get(id);
  }

  public listScans(): readonly PreflightScanResultRow[] {
    return Array.from(this.scans.values());
  }

  public getScanHistory(): readonly PreflightScanResult[] {
    return [...this.scanHistory];
  }

  public getRecentScans(limit = 10): readonly PreflightScanResult[] {
    return this.scanHistory.slice(-limit);
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
  // Circuit Breaker Operations
  // ---------------------------------------------------------------------------

  public recordScannerSuccess(): void {
    this.consecutiveFailures = 0;
    this.breakerTripped = false;
  }

  public recordScannerFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.policy.circuitBreakerLimit) {
      this.breakerTripped = true;
    }
  }

  public isCircuitBreakerTripped(): boolean {
    return this.breakerTripped;
  }

  public resetCircuitBreaker(): void {
    this.consecutiveFailures = 0;
    this.breakerTripped = false;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): PreflightHealthAuditReport {
    let healthStatus: PreflightHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (this.breakerTripped) {
      healthStatus = "critical";
      recommendations.push("Circuit breaker is TRIPPED. Reset circuit breaker or inspect scanner errors.");
    } else if (this.totalBlocked > 10) {
      healthStatus = "degraded";
      recommendations.push("High volume of blocked threats detected in executed commands.");
    }

    if (this.totalScans === 0) {
      healthStatus = "healthy";
      recommendations.push("Preflight security scanner initialized cleanly.");
    }

    return {
      totalScans: this.totalScans,
      totalBlocked: this.totalBlocked,
      totalWarned: this.totalWarned,
      totalAllowed: this.totalAllowed,
      breakerTripped: this.breakerTripped,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): PreflightMetrics {
    return {
      totalScans: this.totalScans,
      totalAllowed: this.totalAllowed,
      totalBlocked: this.totalBlocked,
      totalWarned: this.totalWarned,
      circuitBreakerTripped: this.breakerTripped,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  public getMetricsReport(): PreflightMetricsReport {
    const blockRate =
      this.totalScans === 0
        ? 0
        : Number(((this.totalBlocked / this.totalScans) * 100).toFixed(1));

    const threatsByCategory: Record<string, number> = {};
    for (const scan of this.scans.values()) {
      for (const finding of scan.findings) {
        threatsByCategory[finding.category] = (threatsByCategory[finding.category] || 0) + 1;
      }
    }

    return {
      totalScans: this.totalScans,
      totalAllowed: this.totalAllowed,
      totalBlocked: this.totalBlocked,
      totalWarned: this.totalWarned,
      blockRatePercent: blockRate,
      threatsByCategory,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedScans(
    groupBy: PreflightGroupBy = "verdict",
    sortBy: PreflightSortBy = "timestamp",
    direction: PreflightSortDirection = "desc"
  ): readonly PreflightGroupedLane[] {
    const lanes = new Map<string, PreflightScanResultRow[]>();
    const all = Array.from(this.scans.values());

    for (const scan of all) {
      let key = "default";
      switch (groupBy) {
        case "verdict":
          key = scan.verdict;
          break;
        case "policyDecision":
          key = scan.policyDecision;
          break;
        case "severity": {
          const maxSev = scan.findings.reduce((acc, f) => {
            if (f.severity === "critical") return "critical";
            if (f.severity === "high" && acc !== "critical") return "high";
            if (f.severity === "medium" && !["critical", "high"].includes(acc)) return "medium";
            return acc;
          }, "none");
          key = maxSev;
          break;
        }
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(scan);
    }

    const result: PreflightGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = b.timestamp - a.timestamp;
        else if (sortBy === "scanDurationMs") cmp = b.scanDurationMs - a.scanDurationMs;
        else if (sortBy === "command") cmp = b.command.localeCompare(a.command);
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

  public queryScansDsl(query: PreflightDslQueryFilter | string): readonly PreflightScanResultRow[] {
    const parsed: PreflightDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const all = Array.from(this.scans.values());

    return all.filter((scan) => {
      if (parsed.verdict && scan.verdict !== parsed.verdict) return false;
      if (parsed.category && !scan.findings.some((f) => f.category === parsed.category)) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${scan.scanId} ${scan.command} ${scan.findings.map((f) => f.description).join(" ")}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): PreflightDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let verdict: any;
    let category: any;

    for (const tok of tokens) {
      if (tok.startsWith("verdict:") || tok.startsWith("is:")) {
        verdict = tok.split(":")[1];
      } else if (tok.startsWith("cat:") || tok.startsWith("category:")) {
        category = tok.split(":")[1];
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      verdict,
      category,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeScans(ids: readonly string[]): PreflightBulkMutationResult {
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
  <title>LUMI Preflight Security Threat Gate</title>
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
  <h1>🔍 LUMI Pre-Exec Threat Gate</h1>
  <p style="color: #94a3b8;">Deterministic Preflight Security & AST Supply-Chain Guard (Phase 113 / ADR-089)</p>
  
  <div class="grid">
    <div class="card"><div>Total Scanned</div><div class="metric-val">${metrics.totalScans}</div></div>
    <div class="card"><div>Threats Blocked</div><div class="metric-val" style="color:#f43f5e;">${metrics.totalBlocked}</div></div>
    <div class="card"><div>Warnings</div><div class="metric-val" style="color:#eab308;">${metrics.totalWarned}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Scanned Commands Ledger</h2>
  <table>
    <thead><tr><th>Scan ID</th><th>Verdict</th><th>Command</th><th>Findings</th><th>Duration</th></tr></thead>
    <tbody>
      ${scans.map((s) => `<tr><td><code>${s.scanId}</code></td><td><b>${s.verdict.toUpperCase()}</b></td><td><code>${s.command}</code></td><td>${s.findings.length} findings</td><td>${s.scanDurationMs.toFixed(2)}ms</td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const scans = this.listScans();

    let md = `# LUMI Preflight Threat Gate Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Scanned:** \`${metrics.totalScans}\` | **Blocked:** \`${metrics.totalBlocked}\` | **Warned:** \`${metrics.totalWarned}\`\n\n`;
    md += `## Scanned Commands (${scans.length})\n\n`;
    md += `| Scan ID | Verdict | Command | Findings | Duration |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const s of scans) {
      md += `| \`${s.scanId}\` | **${s.verdict.toUpperCase()}** | \`${s.command}\` | ${s.findings.length} | ${s.scanDurationMs.toFixed(2)}ms |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "scanId,verdict,policyDecision,command,findingsCount,durationMs,timestamp\n";
    const rows = Array.from(this.scans.values()).map((s) => {
      return `"${s.scanId}","${s.verdict}","${s.policyDecision}","${s.command.replace(/"/g, '""')}",${s.findings.length},${s.scanDurationMs},${s.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): PreflightWorkspaceSnapshot {
    return {
      snapshotId: `snap-${Date.now()}`,
      timestamp: Date.now(),
      policy: this.getPolicy(),
      scanHistory: [...this.scanHistory],
      breakerTripped: this.breakerTripped,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  public createSnapshot(snapshotId: string): PreflightWorkspaceSnapshot {
    const snap = this.exportSnapshot();
    return { ...snap, snapshotId };
  }

  public importSnapshot(snapshot: PreflightWorkspaceSnapshot): void {
    this.policy = {
      ...snapshot.policy,
      blockedCategories: [...snapshot.policy.blockedCategories],
    };
    this.scanHistory.length = 0;
    this.scanHistory.push(...snapshot.scanHistory);
    this.breakerTripped = snapshot.breakerTripped;
    this.consecutiveFailures = snapshot.consecutiveFailures;
  }

  public restoreSnapshot(snapshot: PreflightWorkspaceSnapshot): void {
    this.importSnapshot(snapshot);
  }

  public clear(): void {
    this.scans.clear();
    this.scanHistory.length = 0;
    this.consecutiveFailures = 0;
    this.breakerTripped = false;
    this.totalScans = 0;
    this.totalBlocked = 0;
    this.totalWarned = 0;
    this.totalAllowed = 0;
    this.policy = { ...DEFAULT_PREFLIGHT_SECURITY_POLICY };
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
