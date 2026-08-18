/**
 * broccoli-execution-guard-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for tool execution batch segments,
 * loop guardrail records, and SLA health auditing (Phase 94 / ADR-046 / Target #85).
 */

import type {
  IBroccoliExecutionGuardSubstrate,
  ToolExecutionAuditRow,
  ToolExecutionBatchSegment,
  ToolExecutionGuardBulkMutationResult,
  ToolExecutionGuardConfig,
  ToolExecutionGuardDslQueryFilter,
  ToolExecutionGuardGroupBy,
  ToolExecutionGuardGroupedLane,
  ToolExecutionGuardHealthAuditReport,
  ToolExecutionGuardHealthStatus,
  ToolExecutionGuardMetrics,
  ToolExecutionGuardMetricsReport,
  ToolExecutionGuardMutationUndoRecord,
  ToolExecutionGuardSortBy,
  ToolExecutionGuardSortDirection,
  ToolExecutionSegmentRow,
  ToolExecutionWorkspaceSnapshot,
  ToolLoopViolationRecord,
  ToolLoopViolationRow,
} from "../../../core/contracts/tool-execution-segment.contracts.js";
import { DEFAULT_TOOL_EXECUTION_GUARD_CONFIG } from "../../../core/contracts/tool-execution-segment.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliExecutionGuardSubstrate implements IBroccoliExecutionGuardSubstrate {
  private config: ToolExecutionGuardConfig = { ...DEFAULT_TOOL_EXECUTION_GUARD_CONFIG };
  private readonly violations = new Map<string, ToolLoopViolationRow>();
  private readonly violationRecords: ToolLoopViolationRecord[] = [];
  private latestSegments: ToolExecutionBatchSegment[] = [];

  private totalPlansPlanned = 0;
  private totalSegmentsExecuted = 0;
  private totalViolationsDetected = 0;
  private parallelBatchesCreated = 0;
  private sequentialBarriersEnforced = 0;
  private blockedInvocations = 0;
  private abortedTurns = 0;

  private readonly undoStack: ToolExecutionGuardMutationUndoRecord[] = [];
  private readonly redoStack: ToolExecutionGuardMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private violationsTable?: IDbTable<ToolLoopViolationRow>;
  private segmentsTable?: IDbTable<ToolExecutionSegmentRow>;
  private auditsTable?: IDbTable<ToolExecutionAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.violationsTable = dbKernel.getTable<ToolLoopViolationRow>("tool_loop_violations");
      this.segmentsTable = dbKernel.getTable<ToolExecutionSegmentRow>("tool_execution_segments");
      this.auditsTable = dbKernel.getTable<ToolExecutionAuditRow>("tool_execution_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  public setConfig(config: Partial<ToolExecutionGuardConfig>): void {
    const normalized: Partial<ToolExecutionGuardConfig> = { ...config };
    if (normalized.maxDuplicateExecutions !== undefined && normalized.maxConsecutiveIdenticalCalls === undefined) {
      normalized.maxConsecutiveIdenticalCalls = normalized.maxDuplicateExecutions;
    }
    if (normalized.defaultMutating !== undefined && normalized.failSafeMutatingDefault === undefined) {
      normalized.failSafeMutatingDefault = normalized.defaultMutating;
    }
    const prev = this.exportSnapshot();
    this.config = { ...this.config, ...normalized };
    this.pushUndoRecord("config_change", prev);
  }

  public getConfig(): ToolExecutionGuardConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(
    mutationType: ToolExecutionGuardMutationUndoRecord["mutationType"],
    prev: ToolExecutionWorkspaceSnapshot
  ): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliExecutionGuardSubstrate.MAX_UNDO_STACK) {
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

  public getUndoStackDepth(): number {
    return this.undoStack.length;
  }

  public getRedoStackDepth(): number {
    return this.redoStack.length;
  }

  // ---------------------------------------------------------------------------
  // Violations & Segments Management
  // ---------------------------------------------------------------------------

  public recordViolation(record: ToolLoopViolationRecord): void {
    const prev = this.exportSnapshot();
    this.violationRecords.push(record);
    if (this.violationRecords.length > 500) {
      this.violationRecords.shift();
    }

    const id = `viol-${record.toolName}-${record.frameIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const row: ToolLoopViolationRow = {
      id,
      frameIndex: record.frameIndex,
      toolName: record.toolName,
      argsHash: record.argsHash,
      repetitionCount: record.repetitionCount,
      actionTaken: record.actionTaken,
      timestamp: record.timestamp,
    };
    this.violations.set(id, row);
    this.totalViolationsDetected++;

    if (record.actionTaken === "block_synthetic") {
      this.blockedInvocations++;
    } else if (record.actionTaken === "abort_turn") {
      this.abortedTurns++;
    }

    if (this.violationsTable) {
      this.violationsTable.put(id, row);
    }

    this.pushUndoRecord("record_violation", prev);
  }

  public getViolations(): readonly ToolLoopViolationRecord[] {
    return this.violationRecords;
  }

  public getViolationRows(): readonly ToolLoopViolationRow[] {
    return Array.from(this.violations.values());
  }

  public getViolation(id: string): ToolLoopViolationRow | undefined {
    return this.violations.get(id);
  }

  public removeViolation(id: string): boolean {
    const exists = this.violations.has(id);
    if (!exists) return false;

    const prev = this.exportSnapshot();
    this.violations.delete(id);
    if (this.violationsTable) this.violationsTable.delete(id);

    this.pushUndoRecord("clear", prev);
    return true;
  }

  public setLatestSegments(segments: readonly ToolExecutionBatchSegment[]): void {
    this.latestSegments = [...segments];
    this.totalPlansPlanned++;
    this.totalSegmentsExecuted += segments.length;

    for (const seg of segments) {
      if (seg.mode === "parallel") {
        this.parallelBatchesCreated++;
      } else if (seg.isMutating) {
        this.sequentialBarriersEnforced++;
      }

      if (this.segmentsTable) {
        const segId = `seg-${Date.now()}-${seg.segmentIndex}`;
        const row: ToolExecutionSegmentRow = {
          id: segId,
          planId: `plan-${this.totalPlansPlanned}`,
          segmentIndex: seg.segmentIndex,
          mode: seg.mode,
          toolCount: seg.toolCalls.length,
          toolNames: seg.toolCalls.map((c) => c.toolName),
          isMutating: seg.isMutating,
          timestamp: Date.now(),
        };
        this.segmentsTable.put(segId, row);
      }
    }
  }

  public getLatestSegments(): readonly ToolExecutionBatchSegment[] {
    return this.latestSegments;
  }

  public getPlans(): readonly ToolExecutionBatchSegment[] {
    return this.latestSegments;
  }

  public getPlanById(planId: string): ToolExecutionBatchSegment | ToolExecutionSegmentRow | undefined {
    if (this.segmentsTable) {
      const row = this.segmentsTable.get(planId);
      if (row) return row;
    }
    return this.latestSegments.find(
      (s, idx) =>
        `plan-${idx}` === planId ||
        `seg-${idx}` === planId ||
        String(s.segmentIndex) === planId ||
        String(idx) === planId
    );
  }

  public getGroupedPlans(
    groupBy: ToolExecutionGuardGroupBy | string = "mode",
    sortBy: ToolExecutionGuardSortBy | string = "segmentIndex",
    direction: ToolExecutionGuardSortDirection = "asc"
  ): readonly ToolExecutionGuardGroupedLane[] {
    const lanes = new Map<string, ToolLoopViolationRow[]>();
    for (const seg of this.latestSegments) {
      let key = "sequential";
      if (groupBy === "mode" || groupBy === "hasParallel") {
        key = seg.mode;
      } else if (groupBy === "isMutating") {
        key = seg.isMutating ? "mutating" : "read_only";
      } else if (groupBy === "totalCalls" || groupBy === "segmentCount") {
        key = `calls_${seg.toolCalls.length}`;
      } else {
        key = seg.mode;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push({
        id: `seg-${seg.segmentIndex}`,
        frameIndex: seg.segmentIndex,
        toolName: seg.toolCalls.map((c) => c.toolName).join(", "),
        argsHash: "",
        repetitionCount: seg.toolCalls.length,
        actionTaken: seg.mode,
        timestamp: Date.now(),
      });
    }

    const result: ToolExecutionGuardGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        violations: items,
      });
    }
    return result;
  }

  public queryPlansDsl(filter: ToolExecutionGuardDslQueryFilter | string): readonly ToolExecutionBatchSegment[] {
    const parsed: ToolExecutionGuardDslQueryFilter =
      typeof filter === "string" ? this.parseDslQuery(filter) : filter;

    return this.latestSegments.filter((seg) => {
      if (parsed.hasParallel !== undefined) {
        const isParallel = seg.mode === "parallel";
        if (isParallel !== parsed.hasParallel) return false;
      }
      if (parsed.minCalls !== undefined && seg.toolCalls.length < parsed.minCalls) return false;
      if (parsed.maxCalls !== undefined && seg.toolCalls.length > parsed.maxCalls) return false;
      if (parsed.toolName && !seg.toolCalls.some((c) => c.toolName === parsed.toolName)) return false;
      if (parsed.queryText) {
        const q = parsed.queryText.toLowerCase();
        const text = `${seg.mode} ${seg.toolCalls.map((c) => c.toolName).join(" ")}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }

  public bulkPurgePlans(options?: { olderThanMs?: number } | readonly string[]): ToolExecutionGuardBulkMutationResult {
    const prev = this.exportSnapshot();
    const count = this.latestSegments.length;
    this.latestSegments = [];
    this.pushUndoRecord("clear", prev);
    return {
      matchedCount: count,
      modifiedCount: count,
      affectedViolationIds: [],
      purgedCount: count,
    };
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): ToolExecutionGuardHealthAuditReport {
    let healthStatus: ToolExecutionGuardHealthStatus = "optimal";
    const recommendations: string[] = [];

    const totalSegs = this.totalSegmentsExecuted;
    const parallelRatio =
      totalSegs === 0 ? 0 : Number(((this.parallelBatchesCreated / totalSegs) * 100).toFixed(1));

    if (this.abortedTurns > 0) {
      healthStatus = "critical";
      recommendations.push(`Detected ${this.abortedTurns} aborted turn(s) due to extreme tool repetition loops.`);
    } else if (this.blockedInvocations > 0) {
      healthStatus = "degraded";
      recommendations.push(`Blocked ${this.blockedInvocations} repetitive tool call invocation(s).`);
    } else if (this.violationRecords.length > 0) {
      healthStatus = "healthy";
      recommendations.push("Tool loop warnings active without severe blocks.");
    } else {
      healthStatus = "optimal";
      recommendations.push("No tool loop violations or execution abnormalities detected.");
    }

    return {
      totalPlans: this.totalPlansPlanned,
      totalSegments: this.totalSegmentsExecuted,
      totalViolations: this.totalViolationsDetected,
      blockedViolations: this.blockedInvocations,
      abortViolations: this.abortedTurns,
      parallelRatioPercent: parallelRatio,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): ToolExecutionGuardMetrics {
    return {
      totalPlansPlanned: this.totalPlansPlanned,
      totalSegmentsExecuted: this.totalSegmentsExecuted,
      totalViolationsDetected: this.totalViolationsDetected,
      parallelBatchesCreated: this.parallelBatchesCreated,
      sequentialBarriersEnforced: this.sequentialBarriersEnforced,
      blockedInvocations: this.blockedInvocations,
      abortedTurns: this.abortedTurns,
    };
  }

  public getMetricsReport(): ToolExecutionGuardMetricsReport {
    const metrics = this.getMetrics();
    const violationsByTool: Record<string, number> = {};
    const violationsByAction: Record<string, number> = {};

    for (const v of this.violations.values()) {
      violationsByTool[v.toolName] = (violationsByTool[v.toolName] || 0) + 1;
      violationsByAction[v.actionTaken] = (violationsByAction[v.actionTaken] || 0) + 1;
    }

    return {
      ...metrics,
      violationsByTool,
      violationsByAction,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedViolations(
    groupBy: ToolExecutionGuardGroupBy = "toolName",
    sortBy: ToolExecutionGuardSortBy = "timestamp",
    direction: ToolExecutionGuardSortDirection = "desc"
  ): readonly ToolExecutionGuardGroupedLane[] {
    const lanes = new Map<string, ToolLoopViolationRow[]>();
    const all = Array.from(this.violations.values());

    for (const v of all) {
      let key = "default";
      switch (groupBy) {
        case "toolName":
          key = v.toolName;
          break;
        case "actionTaken":
          key = v.actionTaken;
          break;
        case "frameIndex":
          key = `frame_${v.frameIndex}`;
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(v);
    }

    const result: ToolExecutionGuardGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = b.timestamp - a.timestamp;
        else if (sortBy === "repetitionCount") cmp = b.repetitionCount - a.repetitionCount;
        else if (sortBy === "frameIndex") cmp = b.frameIndex - a.frameIndex;
        return direction === "asc" ? -cmp : cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        violations: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryViolationsDsl(
    query: ToolExecutionGuardDslQueryFilter | string
  ): readonly ToolLoopViolationRow[] {
    const parsed: ToolExecutionGuardDslQueryFilter =
      typeof query === "string" ? this.parseDslQuery(query) : query;
    const all = Array.from(this.violations.values());

    return all.filter((v) => {
      if (parsed.toolName && v.toolName !== parsed.toolName) return false;
      if (parsed.action && v.actionTaken !== parsed.action) return false;
      if (parsed.minRepetitions !== undefined && v.repetitionCount < parsed.minRepetitions) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${v.id} ${v.toolName} ${v.actionTaken} ${v.argsHash}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): ToolExecutionGuardDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let toolName: string | undefined;
    let action: string | undefined;
    let minRepetitions: number | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("tool:")) {
        toolName = tok.split(":")[1];
      } else if (tok.startsWith("action:")) {
        action = tok.split(":")[1];
      } else if (tok.startsWith("minReps:") || tok.startsWith("minRepetitions:")) {
        minRepetitions = parseInt(tok.split(":")[1], 10);
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      toolName,
      action,
      minRepetitions,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeViolations(target?: readonly string[] | { olderThanMs?: number }): ToolExecutionGuardBulkMutationResult {
    const prev = this.exportSnapshot();
    const affectedIds: string[] = [];

    if (Array.isArray(target)) {
      for (const id of target) {
        if (this.violations.has(id)) {
          this.violations.delete(id);
          if (this.violationsTable) this.violationsTable.delete(id);
          affectedIds.push(id);
        }
      }
    } else if (target && "olderThanMs" in target && typeof target.olderThanMs === "number") {
      const cutoff = Date.now() - target.olderThanMs;
      for (const [id, row] of this.violations.entries()) {
        if (row.timestamp <= cutoff) {
          this.violations.delete(id);
          if (this.violationsTable) this.violationsTable.delete(id);
          affectedIds.push(id);
        }
      }
    } else {
      for (const id of this.violations.keys()) {
        affectedIds.push(id);
      }
      this.violations.clear();
      this.violationRecords.length = 0;
    }

    this.pushUndoRecord("clear", prev);
    return {
      matchedCount: affectedIds.length,
      modifiedCount: affectedIds.length,
      affectedViolationIds: affectedIds,
      purgedCount: affectedIds.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportPlansMarkdown(): string {
    let md = `# LUMI Tool Execution Plans Report\n\n`;
    md += `**Total Plans Planned:** \`${this.totalPlansPlanned}\` | **Total Segments:** \`${this.latestSegments.length}\`\n\n`;
    md += `| Segment Index | Mode | Mutating | Tool Calls |\n`;
    md += `|---|---|---|---|\n`;
    for (const seg of this.latestSegments) {
      md += `| #${seg.segmentIndex} | \`${seg.mode}\` | ${seg.isMutating ? "Yes" : "No"} | ${seg.toolCalls.map((c) => c.toolName).join(", ")} |\n`;
    }
    return md;
  }

  public exportPlansHtml(): string {
    return `<!DOCTYPE html>
<html>
<head><title>Tool Execution Plans</title></head>
<body>
  <h1>Tool Execution Plans</h1>
  <table border="1">
    <tr><th>Index</th><th>Mode</th><th>Mutating</th><th>Tool Calls</th></tr>
    ${this.latestSegments
      .map(
        (s) =>
          `<tr><td>#${s.segmentIndex}</td><td>${s.mode}</td><td>${s.isMutating ? "Yes" : "No"}</td><td>${s.toolCalls.map((c) => c.toolName).join(", ")}</td></tr>`
      )
      .join("")}
  </table>
</body>
</html>`;
  }

  public exportPlansCsv(): string {
    const header = "segmentIndex,mode,isMutating,toolCount,toolNames\n";
    const rows = this.latestSegments
      .map(
        (s) =>
          `${s.segmentIndex},"${s.mode}",${s.isMutating},${s.toolCalls.length},"${s.toolCalls.map((c) => c.toolName).join(";")}"`
      )
      .join("\n");
    return header + rows;
  }

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const viols = this.getViolationRows();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Tool Execution Guard Dashboard</title>
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
  <h1>🛡️ LUMI Tool Execution Segmenter & Loop Guardrail</h1>
  <p style="color: #94a3b8;">Batch Parallelism Scheduler & Infinite Loop Firewall (Phase 94 / ADR-046 / Target #85)</p>
  
  <div class="grid">
    <div class="card"><div>Plans Planned</div><div class="metric-val">${metrics.totalPlansPlanned}</div></div>
    <div class="card"><div>Segments Executed</div><div class="metric-val" style="color:#10b981;">${metrics.totalSegmentsExecuted}</div></div>
    <div class="card"><div>Parallel Batches</div><div class="metric-val" style="color:#a855f7;">${metrics.parallelBatchesCreated}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : health.healthStatus === 'healthy' ? '#38bdf8' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Active Violations Ledger</h2>
  <table>
    <thead><tr><th>Violation ID</th><th>Tool Name</th><th>Frame</th><th>Repetitions</th><th>Action Taken</th><th>Hash</th></tr></thead>
    <tbody>
      ${viols.map((v) => `<tr><td><code>${v.id}</code></td><td><b>${v.toolName}</b></td><td>#${v.frameIndex}</td><td>${v.repetitionCount}x</td><td><span style="color:${v.actionTaken === 'abort_turn' ? '#ef4444' : v.actionTaken === 'block_synthetic' ? '#eab308' : '#38bdf8'}">${v.actionTaken}</span></td><td><code>${v.argsHash.slice(0, 8)}</code></td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const viols = this.getViolationRows();

    let md = `# LUMI Tool Execution Guardrail Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Plans:** \`${metrics.totalPlansPlanned}\` | **Segments:** \`${metrics.totalSegmentsExecuted}\` | **Parallel Batches:** \`${metrics.parallelBatchesCreated}\` | **Violations:** \`${metrics.totalViolationsDetected}\`\n\n`;
    md += `## Violations Ledger (${viols.length})\n\n`;
    md += `| Violation ID | Tool Name | Frame | Repetitions | Action | Hash |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const v of viols) {
      md += `| \`${v.id}\` | **${v.toolName}** | #${v.frameIndex} | ${v.repetitionCount}x | \`${v.actionTaken}\` | \`${v.argsHash.slice(0, 8)}\` |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "id,toolName,frameIndex,repetitionCount,actionTaken,argsHash,timestamp\n";
    const rows = Array.from(this.violations.values())
      .map((v) => {
        return `"${v.id}","${v.toolName}",${v.frameIndex},${v.repetitionCount},"${v.actionTaken}","${v.argsHash}",${v.timestamp}`;
      })
      .join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): ToolExecutionWorkspaceSnapshot {
    return {
      totalViolations: this.violationRecords.length,
      activeViolations: [...this.violationRecords],
      lastRepetitionHash:
        this.violationRecords.length > 0
          ? this.violationRecords[this.violationRecords.length - 1].argsHash
          : undefined,
      metrics: this.getMetrics(),
      config: this.getConfig(),
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: ToolExecutionWorkspaceSnapshot): void {
    if (snapshot.config) this.config = { ...snapshot.config };
    this.violationRecords.length = 0;
    this.violationRecords.push(...snapshot.activeViolations);
    this.violations.clear();
    for (const rec of snapshot.activeViolations) {
      const id = `viol-${rec.toolName}-${rec.frameIndex}-${rec.timestamp}`;
      this.violations.set(id, {
        id,
        frameIndex: rec.frameIndex,
        toolName: rec.toolName,
        argsHash: rec.argsHash,
        repetitionCount: rec.repetitionCount,
        actionTaken: rec.actionTaken,
        timestamp: rec.timestamp,
      });
    }
    this.latestSegments = [];
  }

  public clear(): void {
    this.config = { ...DEFAULT_TOOL_EXECUTION_GUARD_CONFIG };
    this.violationRecords.length = 0;
    this.violations.clear();
    this.latestSegments = [];
    this.totalPlansPlanned = 0;
    this.totalSegmentsExecuted = 0;
    this.totalViolationsDetected = 0;
    this.parallelBatchesCreated = 0;
    this.sequentialBarriersEnforced = 0;
    this.blockedInvocations = 0;
    this.abortedTurns = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

export { BroccoliExecutionGuardSubstrate as BroccoliToolExecutionGuardSubstrate };

