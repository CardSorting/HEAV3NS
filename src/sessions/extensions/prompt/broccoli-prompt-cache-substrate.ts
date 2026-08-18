/**
 * broccoli-prompt-cache-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for active prompt cache plans,
 * byte-stable envelopes, and reasoning sanitization audit records (Phase 93 / ADR-045 / Target #82).
 */

import type {
  ByteStablePromptEnvelope,
  IBroccoliPromptCacheSubstrate,
  PromptCacheAuditRow,
  PromptCacheBreakpointRow,
  PromptCacheBulkMutationResult,
  PromptCacheConfig,
  PromptCacheDslQueryFilter,
  PromptCacheGroupBy,
  PromptCacheGroupedLane,
  PromptCacheHealthAuditReport,
  PromptCacheHealthStatus,
  PromptCacheMetrics,
  PromptCacheMetricsReport,
  PromptCacheMutationUndoRecord,
  PromptCacheSortBy,
  PromptCacheSortDirection,
  PromptCacheWorkspaceSnapshot,
  ReasoningSanitizationResult,
} from "../../../core/contracts/prompt-cache.contracts.js";
import { DEFAULT_PROMPT_CACHE_CONFIG } from "../../../core/contracts/prompt-cache.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliPromptCacheSubstrate implements IBroccoliPromptCacheSubstrate {
  private config: PromptCacheConfig = { ...DEFAULT_PROMPT_CACHE_CONFIG };
  private latestEnvelope?: ByteStablePromptEnvelope;
  private readonly sanitizationHistory: ReasoningSanitizationResult[] = [];
  private readonly breakpoints = new Map<string, PromptCacheBreakpointRow>();
  private totalEnvelopesCalculated = 0;
  private totalBreakpointsInserted = 0;
  private totalSanitizedReasonings = 0;
  private estimatedTokensCached = 0;
  private staticPrefixBytesAcc = 0;

  private readonly undoStack: PromptCacheMutationUndoRecord[] = [];
  private readonly redoStack: PromptCacheMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private breakpointsTable?: IDbTable<PromptCacheBreakpointRow>;
  private auditsTable?: IDbTable<PromptCacheAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.breakpointsTable = dbKernel.getTable<PromptCacheBreakpointRow>("prompt_cache_breakpoints");
      this.auditsTable = dbKernel.getTable<PromptCacheAuditRow>("prompt_cache_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  public setConfig(config: Partial<PromptCacheConfig>): void {
    const prev = this.exportSnapshot();
    this.config = { ...this.config, ...config };
    this.pushUndoRecord("config_change", prev);
  }

  public getConfig(): PromptCacheConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: PromptCacheMutationUndoRecord["mutationType"], prev: PromptCacheWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliPromptCacheSubstrate.MAX_UNDO_STACK) {
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
  // Envelope & Breakpoint Management
  // ---------------------------------------------------------------------------

  public setLatestEnvelope(envelope: ByteStablePromptEnvelope): void {
    const prev = this.exportSnapshot();
    this.latestEnvelope = envelope;
    this.totalEnvelopesCalculated++;
    this.staticPrefixBytesAcc += envelope.staticPrefixBytes;

    for (const bp of envelope.breakpoints) {
      const breakpointId = `bp-${envelope.systemPromptHash.slice(0, 6)}-${bp.breakpointIndex}-${Date.now()}`;
      const row: PromptCacheBreakpointRow = {
        breakpointId,
        breakpointIndex: bp.breakpointIndex,
        target: bp.target,
        breakpointType: bp.breakpointType,
        byteOffset: bp.byteOffset,
        tokenEstimate: bp.tokenEstimate,
        envelopeHash: envelope.systemPromptHash,
        timestamp: Date.now(),
      };
      this.breakpoints.set(breakpointId, row);
      this.totalBreakpointsInserted++;
      this.estimatedTokensCached += bp.tokenEstimate;

      if (this.breakpointsTable) {
        this.breakpointsTable.put(breakpointId, row);
      }
    }

    this.pushUndoRecord("add_breakpoint", prev);
  }

  public getLatestEnvelope(): ByteStablePromptEnvelope | undefined {
    return this.latestEnvelope;
  }

  public recordBreakpoint(row: PromptCacheBreakpointRow): void {
    const prev = this.exportSnapshot();
    this.breakpoints.set(row.breakpointId, row);
    this.totalBreakpointsInserted++;
    this.estimatedTokensCached += row.tokenEstimate;

    if (this.breakpointsTable) {
      this.breakpointsTable.put(row.breakpointId, row);
    }
    this.pushUndoRecord("add_breakpoint", prev);
  }

  public getBreakpoint(id: string): PromptCacheBreakpointRow | undefined {
    return this.breakpoints.get(id);
  }

  public listBreakpoints(): readonly PromptCacheBreakpointRow[] {
    return Array.from(this.breakpoints.values());
  }

  public removeBreakpoint(id: string): boolean {
    const exists = this.breakpoints.has(id);
    if (!exists) return false;

    const prev = this.exportSnapshot();
    this.breakpoints.delete(id);
    if (this.breakpointsTable) this.breakpointsTable.delete(id);

    this.pushUndoRecord("clear", prev);
    return true;
  }

  public recordSanitization(result: ReasoningSanitizationResult): void {
    this.sanitizationHistory.push(result);
    if (result.hasThinkTags) {
      this.totalSanitizedReasonings++;
    }
    if (this.sanitizationHistory.length > 500) {
      this.sanitizationHistory.shift();
    }
  }

  public getSanitizationHistory(): readonly ReasoningSanitizationResult[] {
    return this.sanitizationHistory;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): PromptCacheHealthAuditReport {
    let healthStatus: PromptCacheHealthStatus = "optimal";
    const recommendations: string[] = [];

    const staticPrefixCoverage =
      this.totalEnvelopesCalculated === 0
        ? 100
        : Number(((this.staticPrefixBytesAcc / (this.totalEnvelopesCalculated * 4096)) * 100).toFixed(1));

    if (this.totalEnvelopesCalculated > 0 && this.totalBreakpointsInserted === 0) {
      healthStatus = "degraded";
      recommendations.push("Envelopes calculated without active prompt cache breakpoints.");
    }

    if (this.totalEnvelopesCalculated === 0) {
      healthStatus = "healthy";
      recommendations.push("Prompt cache substrate initialized cleanly.");
    }

    return {
      totalEnvelopes: this.totalEnvelopesCalculated,
      totalBreakpoints: this.totalBreakpointsInserted,
      totalTokensCached: this.estimatedTokensCached,
      staticPrefixCoveragePercent: Math.min(100, staticPrefixCoverage),
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): PromptCacheMetrics {
    const avgPrefix =
      this.totalEnvelopesCalculated === 0
        ? 0
        : Math.round(this.staticPrefixBytesAcc / this.totalEnvelopesCalculated);

    return {
      totalEnvelopesCalculated: this.totalEnvelopesCalculated,
      totalBreakpointsInserted: this.totalBreakpointsInserted,
      totalSanitizedReasonings: this.totalSanitizedReasonings,
      estimatedTokensCached: this.estimatedTokensCached,
      staticPrefixBytesAvg: avgPrefix,
    };
  }

  public getMetricsReport(): PromptCacheMetricsReport {
    const metrics = this.getMetrics();
    const breakpointsByType: Record<string, number> = {};
    const breakpointsByTarget: Record<string, number> = {};

    for (const bp of this.breakpoints.values()) {
      breakpointsByType[bp.breakpointType] = (breakpointsByType[bp.breakpointType] || 0) + 1;
      breakpointsByTarget[bp.target] = (breakpointsByTarget[bp.target] || 0) + 1;
    }

    return {
      ...metrics,
      breakpointsByType,
      breakpointsByTarget,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedBreakpoints(
    groupBy: PromptCacheGroupBy = "target",
    sortBy: PromptCacheSortBy = "timestamp",
    direction: PromptCacheSortDirection = "desc"
  ): readonly PromptCacheGroupedLane[] {
    const lanes = new Map<string, PromptCacheBreakpointRow[]>();
    const all = Array.from(this.breakpoints.values());

    for (const bp of all) {
      let key = "default";
      switch (groupBy) {
        case "target":
          key = bp.target;
          break;
        case "breakpointType":
          key = bp.breakpointType;
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(bp);
    }

    const result: PromptCacheGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = b.timestamp - a.timestamp;
        else if (sortBy === "byteOffset") cmp = b.byteOffset - a.byteOffset;
        else if (sortBy === "tokenEstimate") cmp = b.tokenEstimate - a.tokenEstimate;
        return direction === "asc" ? -cmp : cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        breakpoints: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryBreakpointsDsl(query: PromptCacheDslQueryFilter | string): readonly PromptCacheBreakpointRow[] {
    const parsed: PromptCacheDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const all = Array.from(this.breakpoints.values());

    return all.filter((bp) => {
      if (parsed.target && bp.target !== parsed.target) return false;
      if (parsed.breakpointType && bp.breakpointType !== parsed.breakpointType) return false;
      if (parsed.minTokens !== undefined && bp.tokenEstimate < parsed.minTokens) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${bp.breakpointId} ${bp.target} ${bp.breakpointType} ${bp.envelopeHash}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): PromptCacheDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let target: any;
    let breakpointType: any;
    let minTokens: number | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("target:")) {
        target = tok.split(":")[1];
      } else if (tok.startsWith("type:")) {
        breakpointType = tok.split(":")[1];
      } else if (tok.startsWith("minTokens:")) {
        minTokens = parseInt(tok.split(":")[1], 10);
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      target,
      breakpointType,
      minTokens,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeBreakpoints(ids: readonly string[]): PromptCacheBulkMutationResult {
    const prev = this.exportSnapshot();
    let modified = 0;

    for (const id of ids) {
      if (this.breakpoints.has(id)) {
        this.breakpoints.delete(id);
        if (this.breakpointsTable) this.breakpointsTable.delete(id);
        modified++;
      }
    }

    this.pushUndoRecord("clear", prev);
    return {
      matchedCount: ids.length,
      modifiedCount: modified,
      affectedBreakpointIds: ids,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const bps = this.listBreakpoints();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Prompt Cache Boundary Dashboard</title>
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
  <h1>⚡ LUMI Prompt Cache Optimizer</h1>
  <p style="color: #94a3b8;">Byte-Stable Boundary & Reasoning Sanitizer (Phase 93 / ADR-045)</p>
  
  <div class="grid">
    <div class="card"><div>Envelopes Calculated</div><div class="metric-val">${metrics.totalEnvelopesCalculated}</div></div>
    <div class="card"><div>Breakpoints Inserted</div><div class="metric-val" style="color:#10b981;">${metrics.totalBreakpointsInserted}</div></div>
    <div class="card"><div>Tokens Cached (~est)</div><div class="metric-val" style="color:#a855f7;">${metrics.estimatedTokensCached}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Active Breakpoints Ledger</h2>
  <table>
    <thead><tr><th>Breakpoint ID</th><th>Target</th><th>Type</th><th>Byte Offset</th><th>Est. Tokens</th><th>Envelope Hash</th></tr></thead>
    <tbody>
      ${bps.map((b) => `<tr><td><code>${b.breakpointId}</code></td><td>${b.target}</td><td><b>${b.breakpointType}</b></td><td>${b.byteOffset}B</td><td>~${b.tokenEstimate}</td><td><code>${b.envelopeHash.slice(0, 10)}</code></td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const bps = this.listBreakpoints();

    let md = `# LUMI Prompt Cache Boundary Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Envelopes:** \`${metrics.totalEnvelopesCalculated}\` | **Breakpoints:** \`${metrics.totalBreakpointsInserted}\` | **Tokens Cached:** \`~${metrics.estimatedTokensCached}\`\n\n`;
    md += `## Breakpoints Ledger (${bps.length})\n\n`;
    md += `| Breakpoint ID | Target | Type | Byte Offset | Token Est. | Hash |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const b of bps) {
      md += `| \`${b.breakpointId}\` | ${b.target} | **${b.breakpointType}** | ${b.byteOffset}B | ~${b.tokenEstimate} | \`${b.envelopeHash.slice(0, 8)}\` |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "breakpointId,target,breakpointType,byteOffset,tokenEstimate,envelopeHash,timestamp\n";
    const rows = Array.from(this.breakpoints.values()).map((b) => {
      return `"${b.breakpointId}","${b.target}","${b.breakpointType}",${b.byteOffset},${b.tokenEstimate},"${b.envelopeHash}",${b.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): PromptCacheWorkspaceSnapshot {
    return {
      snapshotId: `snap-${Date.now()}`,
      envelopeHash: this.latestEnvelope ? this.latestEnvelope.systemPromptHash : "",
      totalBreakpoints: this.latestEnvelope ? this.latestEnvelope.breakpoints.length : 0,
      activeBreakpoints: this.latestEnvelope ? [...this.latestEnvelope.breakpoints] : [],
      metrics: this.getMetrics(),
      config: this.getConfig(),
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: PromptCacheWorkspaceSnapshot): void {
    if (snapshot.config) this.config = { ...snapshot.config };
    if (snapshot.envelopeHash && snapshot.envelopeHash.length > 0) {
      this.latestEnvelope = {
        staticPrefixBytes: 0,
        systemPromptHash: snapshot.envelopeHash,
        dynamicSuffixBytes: 0,
        totalPromptBytes: 0,
        breakpoints: [...snapshot.activeBreakpoints],
      };
    } else {
      this.latestEnvelope = undefined;
    }
  }

  public clear(): void {
    this.config = { ...DEFAULT_PROMPT_CACHE_CONFIG };
    this.latestEnvelope = undefined;
    this.sanitizationHistory.length = 0;
    this.breakpoints.clear();
    this.totalEnvelopesCalculated = 0;
    this.totalBreakpointsInserted = 0;
    this.totalSanitizedReasonings = 0;
    this.estimatedTokensCached = 0;
    this.staticPrefixBytesAcc = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
