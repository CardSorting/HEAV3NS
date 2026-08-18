/**
 * broccoli-compression-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate leveraging the Hybrid BroccoliDB Kernel
 * for Context Compaction summaries, pruned tool traces, and SLA health audits (Phase 86 / ADR-038).
 */

import type {
  CompressedTurnSummary,
  CompressionAuditRow,
  CompressionBulkMutationResult,
  CompressionDslQueryFilter,
  CompressionGroupBy,
  CompressionGroupedLane,
  CompressionHealthAuditReport,
  CompressionHealthStatus,
  CompressionMetricsReport,
  CompressionMutationUndoRecord,
  CompressionSortBy,
  CompressionSortDirection,
  CompressionStateSnapshot,
  CompressionSummaryRow,
  IBroccoliCompressionSubstrate,
  PrunedToolOutputRow,
} from "../../../core/contracts/compression.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliCompressionSubstrate implements IBroccoliCompressionSubstrate {
  private readonly summaries: Map<string, CompressedTurnSummary>;
  private readonly prunedOutputs: PrunedToolOutputRow[] = [];
  private readonly auditLogs: CompressionAuditRow[] = [];

  private readonly undoStack: CompressionMutationUndoRecord[] = [];
  private readonly redoStack: CompressionMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private summariesTable?: IDbTable<CompressionSummaryRow>;
  private prunedOutputsTable?: IDbTable<PrunedToolOutputRow>;
  private auditsTable?: IDbTable<CompressionAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    this.summaries = new Map<string, CompressedTurnSummary>();

    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.summariesTable = dbKernel.getTable<CompressionSummaryRow>("compression_summaries");
      this.prunedOutputsTable = dbKernel.getTable<PrunedToolOutputRow>("pruned_tool_outputs");
      this.auditsTable = dbKernel.getTable<CompressionAuditRow>("compression_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: CompressionMutationUndoRecord["mutationType"], prev: CompressionStateSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliCompressionSubstrate.MAX_UNDO_STACK) {
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
    this.recordAudit("system", "undo", "system", `Reverted ${record.mutationType}`);
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
    this.recordAudit("system", "redo", "system", `Reapplied ${record.mutationType}`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Core Summary & Pruning Operations
  // ---------------------------------------------------------------------------

  public recordSummary(summary: CompressedTurnSummary): void {
    const prev = this.exportSnapshot();
    this.summaries.set(summary.id, summary);

    if (this.summariesTable) {
      this.summariesTable.put(summary.id, {
        id: summary.id,
        sourceTurnStart: summary.sourceTurnStart,
        sourceTurnEnd: summary.sourceTurnEnd,
        originalTokens: summary.originalTokens,
        compressedTokens: summary.compressedTokens,
        tokensSaved: Math.max(0, summary.originalTokens - summary.compressedTokens),
        timestampMs: summary.timestampMs,
      });
    }

    this.pushUndoRecord("record_summary", prev);
    this.recordAudit(summary.id, "record_summary", "compactor", `Compacted turns #${summary.sourceTurnStart}-#${summary.sourceTurnEnd}, saved ${summary.originalTokens - summary.compressedTokens} tokens`);
  }

  public getSummary(id: string): CompressedTurnSummary | undefined {
    return this.summaries.get(id);
  }

  public listSummaries(limit = 20): readonly CompressedTurnSummary[] {
    return Array.from(this.summaries.values()).slice(-limit);
  }

  public getLatestSummary(): CompressedTurnSummary | undefined {
    const list = Array.from(this.summaries.values());
    return list.length > 0 ? list[list.length - 1] : undefined;
  }

  public recordPrunedOutput(originalChars: number, prunedChars: number, wasPruned: boolean): void {
    const row: PrunedToolOutputRow = {
      id: `prune_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      originalChars,
      prunedChars,
      charsSaved: Math.max(0, originalChars - prunedChars),
      wasPruned,
      timestamp: Date.now(),
    };
    this.prunedOutputs.unshift(row);
    if (this.prunedOutputs.length > 200) this.prunedOutputs.pop();

    if (this.prunedOutputsTable) {
      this.prunedOutputsTable.put(row.id, row);
    }
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): CompressionHealthAuditReport {
    const list = Array.from(this.summaries.values());
    const totalSummaries = list.length;
    let totalCompactedTurns = 0;
    let totalOriginal = 0;
    let totalCompressed = 0;

    for (const s of list) {
      totalCompactedTurns += Math.max(1, s.sourceTurnEnd - s.sourceTurnStart + 1);
      totalOriginal += s.originalTokens;
      totalCompressed += s.compressedTokens;
    }

    const totalTokensSaved = Math.max(0, totalOriginal - totalCompressed);
    const avgCompressionRatio = totalOriginal > 0 ? Number((totalCompressed / totalOriginal).toFixed(2)) : 1.0;

    let overflowRiskScore = 0.0;
    let healthStatus: CompressionHealthStatus = "optimal";

    if (avgCompressionRatio > 0.8 && totalSummaries > 0) {
      overflowRiskScore = 0.6;
      healthStatus = "degraded";
    } else if (totalSummaries > 0) {
      healthStatus = "healthy";
    }

    const recommendations: string[] = [];
    if (avgCompressionRatio > 0.75) {
      recommendations.push("Compression ratio is above 75%. Consider switching to 'aggressive' compression policy.");
    }
    if (recommendations.length === 0) {
      recommendations.push("Context compactor and tool pruner are operating within optimal token bounds.");
    }

    return {
      totalSummaries,
      totalCompactedTurns,
      totalTokensSaved,
      avgCompressionRatio,
      overflowRiskScore,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): CompressionMetricsReport {
    const list = Array.from(this.summaries.values());
    const totalSummaries = list.length;
    let totalCompactedTurns = 0;
    let totalOriginal = 0;
    let totalCompressed = 0;

    const savingsList: number[] = [];
    for (const s of list) {
      totalCompactedTurns += Math.max(1, s.sourceTurnEnd - s.sourceTurnStart + 1);
      totalOriginal += s.originalTokens;
      totalCompressed += s.compressedTokens;
      savingsList.push(Math.max(0, s.originalTokens - s.compressedTokens));
    }

    const totalTokensSaved = Math.max(0, totalOriginal - totalCompressed);
    const avgOriginal = totalSummaries > 0 ? Math.round(totalOriginal / totalSummaries) : 0;
    const avgCompressed = totalSummaries > 0 ? Math.round(totalCompressed / totalSummaries) : 0;
    const overallSavings = totalOriginal > 0 ? Number(((totalTokensSaved / totalOriginal) * 100).toFixed(1)) : 0;

    savingsList.sort((a, b) => a - b);
    const p50 = savingsList.length > 0 ? savingsList[Math.floor(savingsList.length * 0.5)] : 0;
    const p95 = savingsList.length > 0 ? savingsList[Math.floor(savingsList.length * 0.95)] : 0;

    return {
      totalSummaries,
      totalCompactedTurns,
      totalTokensSaved,
      avgOriginalTokens: avgOriginal,
      avgCompressedTokens: avgCompressed,
      overallSavingsPercentage: overallSavings,
      p50TokensSaved: p50,
      p95TokensSaved: p95,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedSummaries(
    groupBy: CompressionGroupBy = "savingsTier",
    sortBy: CompressionSortBy = "timestamp",
    direction: CompressionSortDirection = "desc"
  ): readonly CompressionGroupedLane[] {
    const lanes = new Map<string, CompressedTurnSummary[]>();

    for (const s of this.summaries.values()) {
      const saved = Math.max(0, s.originalTokens - s.compressedTokens);
      let key = "tier_low";

      switch (groupBy) {
        case "savingsTier":
          key = saved > 2000 ? "high (>2k tokens)" : (saved > 500 ? "medium (500-2k tokens)" : "low (<500 tokens)");
          break;
        case "turnRange":
          key = `turns_${Math.floor(s.sourceTurnStart / 10) * 10}-${Math.floor(s.sourceTurnStart / 10) * 10 + 9}`;
          break;
        case "goalStatus":
          key = s.resolvedGoals.length > 0 ? "has_resolved_goals" : "no_resolved_goals";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(s);
    }

    const result: CompressionGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = a.timestampMs - b.timestampMs;
        else if (sortBy === "tokensSaved") cmp = (a.originalTokens - a.compressedTokens) - (b.originalTokens - b.compressedTokens);
        else if (sortBy === "compressedTokens") cmp = a.compressedTokens - b.compressedTokens;
        return direction === "asc" ? cmp : -cmp;
      });

      const totalSaved = items.reduce((sum, i) => sum + Math.max(0, i.originalTokens - i.compressedTokens), 0);

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        totalTokensSaved: totalSaved,
        summaries: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public querySummariesDsl(query: CompressionDslQueryFilter | string): readonly CompressedTurnSummary[] {
    const parsed: CompressionDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;

    return Array.from(this.summaries.values()).filter((s) => {
      const saved = Math.max(0, s.originalTokens - s.compressedTokens);
      if (parsed.minTokensSaved !== undefined && saved < parsed.minTokensSaved) return false;
      if (parsed.maxCompressedTokens !== undefined && s.compressedTokens > parsed.maxCompressedTokens) return false;

      if (parsed.turnIndex !== undefined) {
        if (parsed.turnIndex < s.sourceTurnStart || parsed.turnIndex > s.sourceTurnEnd) return false;
      }

      if (parsed.goalTerm) {
        const hasGoal = s.resolvedGoals.some((g) => g.toLowerCase().includes(parsed.goalTerm!.toLowerCase())) ||
                        s.pendingGoals.some((g) => g.toLowerCase().includes(parsed.goalTerm!.toLowerCase()));
        if (!hasGoal) return false;
      }

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${s.id} ${s.summaryText}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): CompressionDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let minTokensSaved: number | undefined;
    let maxCompressedTokens: number | undefined;
    let turnIndex: number | undefined;
    let goalTerm: string | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("savings>")) {
        minTokensSaved = Number(tok.slice(8));
      } else if (tok.startsWith("compressed<")) {
        maxCompressedTokens = Number(tok.slice(11));
      } else if (tok.startsWith("turn:")) {
        turnIndex = Number(tok.slice(5));
      } else if (tok.startsWith("goal:")) {
        goalTerm = tok.slice(5);
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      minTokensSaved,
      maxCompressedTokens,
      turnIndex,
      goalTerm,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeSummaries(summaryIds: readonly string[]): CompressionBulkMutationResult {
    const prev = this.exportSnapshot();
    const affected: string[] = [];

    for (const id of summaryIds) {
      if (this.summaries.delete(id)) {
        affected.push(id);
      }
    }

    this.pushUndoRecord("bulk", prev);
    return {
      matchedCount: summaryIds.length,
      modifiedCount: affected.length,
      affectedSummaryIds: affected,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Context Compression & Trajectory Compaction</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #f59e0b; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #f59e0b; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; background: #10b981; color: #bbf7d0; }
  </style>
</head>
<body>
  <h1>📦 LUMI Semantic Context Compression</h1>
  <p style="color: #94a3b8;">Deterministic Trajectory Compactor, Token Attention Pruner & Telemetry (Phase 86 / ADR-038)</p>
  
  <div class="grid">
    <div class="card"><div>Total Summaries</div><div class="metric-val">${metrics.totalSummaries}</div></div>
    <div class="card"><div>Compacted Turns</div><div class="metric-val" style="color:#38bdf8;">${metrics.totalCompactedTurns}</div></div>
    <div class="card"><div>Tokens Saved</div><div class="metric-val" style="color:#10b981;">${metrics.totalTokensSaved.toLocaleString()}</div></div>
    <div class="card"><div>Savings Rate</div><div class="metric-val" style="color:#22c55e;">${metrics.overallSavingsPercentage}%</div></div>
  </div>

  <h2>Compacted Summaries</h2>
  <table>
    <thead>
      <tr>
        <th>Summary ID</th>
        <th>Turn Span</th>
        <th>Original</th>
        <th>Compressed</th>
        <th>Tokens Saved</th>
      </tr>
    </thead>
    <tbody>
      ${Array.from(this.summaries.values()).slice(0, 25).map((s) => `
        <tr>
          <td><code>${s.id}</code></td>
          <td>Turns #${s.sourceTurnStart} - #${s.sourceTurnEnd}</td>
          <td>${s.originalTokens} tokens</td>
          <td>${s.compressedTokens} tokens</td>
          <td><span class="badge">+${s.originalTokens - s.compressedTokens}</span></td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();

    let md = `# LUMI Semantic Context Compression Diagnostic Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Total Saved:** \`${metrics.totalTokensSaved.toLocaleString()} tokens\` | **Savings Rate:** \`${metrics.overallSavingsPercentage}%\`\n\n`;
    md += `## Metrics Summary\n`;
    md += `- **Total Summaries:** ${metrics.totalSummaries}\n`;
    md += `- **Compacted Turns:** ${metrics.totalCompactedTurns}\n`;
    md += `- **Avg Original Tokens:** ${metrics.avgOriginalTokens} tokens\n`;
    md += `- **Avg Compressed Tokens:** ${metrics.avgCompressedTokens} tokens\n`;
    md += `- **p95 Tokens Saved:** ${metrics.p95TokensSaved} tokens\n\n`;

    md += `## Recent Summaries\n\n`;
    md += `| ID | Turn Range | Original | Compressed | Saved |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const s of Array.from(this.summaries.values()).slice(0, 20)) {
      md += `| \`${s.id}\` | #${s.sourceTurnStart}-#${s.sourceTurnEnd} | ${s.originalTokens} | ${s.compressedTokens} | **+${s.originalTokens - s.compressedTokens}** |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "id,sourceTurnStart,sourceTurnEnd,originalTokens,compressedTokens,tokensSaved,timestampMs\n";
    const rows = Array.from(this.summaries.values()).map((s) => {
      return `"${s.id}",${s.sourceTurnStart},${s.sourceTurnEnd},${s.originalTokens},${s.compressedTokens},${Math.max(0, s.originalTokens - s.compressedTokens)},${s.timestampMs}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Auditing
  // ---------------------------------------------------------------------------

  public exportSnapshot(tick = 0): CompressionStateSnapshot {
    const list = Array.from(this.summaries.values());
    let totalCompactedTurns = 0;
    let totalOriginal = 0;
    let totalCompressed = 0;

    for (const s of list) {
      totalCompactedTurns += Math.max(1, s.sourceTurnEnd - s.sourceTurnStart + 1);
      totalOriginal += s.originalTokens;
      totalCompressed += s.compressedTokens;
    }

    return {
      summaries: list,
      totalCompactedTurns,
      totalTokensSaved: Math.max(0, totalOriginal - totalCompressed),
      snapshotTick: tick,
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: CompressionStateSnapshot): void {
    this.summaries.clear();
    for (const s of snapshot.summaries) {
      this.summaries.set(s.id, s);
    }
  }

  public recordAudit(summaryId: string, action: string, operator: string, details: string): void {
    const row: CompressionAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: `${action}:${summaryId}`,
      operator,
      details,
      timestamp: Date.now(),
    };
    this.auditLogs.unshift(row);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
    if (this.auditsTable) {
      this.auditsTable.put(row.id, row);
    }
  }

  public clear(): void {
    this.summaries.clear();
    this.prunedOutputs.length = 0;
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
