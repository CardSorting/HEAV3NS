/**
 * broccoli-streaming-scrubber-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for caching streaming think scrubber events,
 * session holdback states, metrics, and multi-criteria swimlanes (Phase 137 / ADR-113 / Target #77).
 */

import type {
  IBroccoliStreamingScrubberSubstrate,
  StreamingScrubberAuditRow,
  StreamingScrubberBulkMutationResult,
  StreamingScrubberDslQueryFilter,
  StreamingScrubberEventRow,
  StreamingScrubberGroupBy,
  StreamingScrubberGroupedLane,
  StreamingScrubberHealthAuditReport,
  StreamingScrubberHealthStatus,
  StreamingScrubberMetricsReport,
  StreamingScrubberMutationUndoRecord,
  StreamingScrubberSortBy,
  StreamingScrubberSortDirection,
  StreamingScrubberState,
  StreamingThinkScrubberConfig,
  StreamingThinkScrubberMetrics,
  StreamingThinkScrubberWorkspaceSnapshot,
} from "../../../core/contracts/streaming-think-scrubber.contracts.js";
import { DEFAULT_STREAMING_THINK_SCRUBBER_CONFIG } from "../../../core/contracts/streaming-think-scrubber.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliStreamingScrubberSubstrate implements IBroccoliStreamingScrubberSubstrate {
  private config: StreamingThinkScrubberConfig = { ...DEFAULT_STREAMING_THINK_SCRUBBER_CONFIG };
  private metrics: StreamingThinkScrubberMetrics = {
    totalDeltasProcessed: 0,
    reasoningChunksSuppressed: 0,
    heldBackTailEmissions: 0,
    blocksEncountered: 0,
    flushesExecuted: 0,
  };
  private readonly sessionStates = new Map<string, StreamingScrubberState>();
  private readonly events = new Map<string, StreamingScrubberEventRow>();
  private readonly undoStack: StreamingScrubberMutationUndoRecord[] = [];
  private readonly redoStack: StreamingScrubberMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private eventsTable?: IDbTable<StreamingScrubberEventRow>;
  private auditsTable?: IDbTable<StreamingScrubberAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.eventsTable = dbKernel.getTable<StreamingScrubberEventRow>("streaming_scrubber_events");
      this.auditsTable = dbKernel.getTable<StreamingScrubberAuditRow>("streaming_scrubber_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  public setConfig(config: Partial<StreamingThinkScrubberConfig>): void {
    const prev = this.exportSnapshot();
    this.config = { ...this.config, ...config };
    this.pushUndoRecord("config_change", prev);
  }

  public getConfig(): StreamingThinkScrubberConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // Session State Tracking
  // ---------------------------------------------------------------------------

  public getSessionState(sessionId: string): StreamingScrubberState {
    const existing = this.sessionStates.get(sessionId);
    if (existing) {
      return { ...existing };
    }
    const initial: StreamingScrubberState = {
      inBlock: false,
      heldBuffer: "",
      lastEmittedEndedNewline: true,
      turnIndex: 0,
    };
    this.sessionStates.set(sessionId, initial);
    return { ...initial };
  }

  public setSessionState(sessionId: string, state: StreamingScrubberState): void {
    this.sessionStates.set(sessionId, { ...state });
  }

  public resetSession(sessionId: string): void {
    const prev = this.exportSnapshot();
    this.sessionStates.set(sessionId, {
      inBlock: false,
      heldBuffer: "",
      lastEmittedEndedNewline: true,
      turnIndex: (this.sessionStates.get(sessionId)?.turnIndex || 0) + 1,
    });
    this.pushUndoRecord("reset_session", prev);
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: StreamingScrubberMutationUndoRecord["mutationType"], prev: StreamingThinkScrubberWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliStreamingScrubberSubstrate.MAX_UNDO_STACK) {
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
  // Clean Event Storage & Recording
  // ---------------------------------------------------------------------------

  public recordEvent(event: StreamingScrubberEventRow): void {
    const prev = this.exportSnapshot();
    this.events.set(event.id, { ...event });

    if (this.eventsTable) {
      this.eventsTable.put(event.id, { ...event });
    }

    this.pushUndoRecord("add_event", prev);
  }

  public recordDelta(params: {
    suppressed?: boolean;
    blockEntered?: boolean;
    heldBackTail?: boolean;
  }): void {
    this.metrics.totalDeltasProcessed++;
    if (params.suppressed) {
      this.metrics.reasoningChunksSuppressed++;
    }
    if (params.blockEntered) {
      this.metrics.blocksEncountered++;
    }
    if (params.heldBackTail) {
      this.metrics.heldBackTailEmissions++;
    }
  }

  public recordFlush(): void {
    this.metrics.flushesExecuted++;
  }

  public getEvent(id: string): StreamingScrubberEventRow | undefined {
    return this.events.get(id);
  }

  public listEvents(): readonly StreamingScrubberEventRow[] {
    return Array.from(this.events.values());
  }

  public removeEvent(id: string): boolean {
    const exists = this.events.has(id);
    if (!exists) return false;

    const prev = this.exportSnapshot();
    this.events.delete(id);

    if (this.eventsTable) {
      this.eventsTable.delete(id);
    }

    this.pushUndoRecord("clear", prev);
    return true;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): StreamingScrubberHealthAuditReport {
    const activeSessions = this.sessionStates.size;
    let healthStatus: StreamingScrubberHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (this.metrics.reasoningChunksSuppressed > 1000) {
      healthStatus = "degraded";
      recommendations.push("High volume of reasoning tags suppressed in streaming deltas.");
    }

    if (this.metrics.totalDeltasProcessed === 0) {
      healthStatus = "healthy";
      recommendations.push("Streaming scrubber substrate initialized cleanly.");
    }

    return {
      totalDeltasProcessed: this.metrics.totalDeltasProcessed,
      reasoningChunksSuppressed: this.metrics.reasoningChunksSuppressed,
      blocksEncountered: this.metrics.blocksEncountered,
      activeSessions,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): StreamingThinkScrubberMetrics {
    return { ...this.metrics };
  }

  public getMetricsReport(): StreamingScrubberMetricsReport {
    const eventsBySession: Record<string, number> = {};
    for (const ev of this.events.values()) {
      eventsBySession[ev.sessionId] = (eventsBySession[ev.sessionId] || 0) + 1;
    }

    return {
      ...this.metrics,
      activeSessionsCount: this.sessionStates.size,
      eventsBySession,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedEvents(
    groupBy: StreamingScrubberGroupBy = "sessionId",
    sortBy: StreamingScrubberSortBy = "timestamp",
    direction: StreamingScrubberSortDirection = "desc"
  ): readonly StreamingScrubberGroupedLane[] {
    const lanes = new Map<string, StreamingScrubberEventRow[]>();
    const all = Array.from(this.events.values());

    for (const ev of all) {
      let key = "default";
      switch (groupBy) {
        case "sessionId":
          key = ev.sessionId;
          break;
        case "status":
          key = ev.suppressedSize > 0 ? "suppressed" : "clean";
          break;
        case "blockState":
          key = ev.inBlock ? "in_block" : "outside_block";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(ev);
    }

    const result: StreamingScrubberGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = b.timestamp - a.timestamp;
        else if (sortBy === "deltaSize") cmp = b.deltaSize - a.deltaSize;
        else if (sortBy === "durationMs") cmp = b.durationMs - a.durationMs;
        else if (sortBy === "emittedSize") cmp = b.emittedSize - a.emittedSize;
        return direction === "asc" ? -cmp : cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        events: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryEventsDsl(query: StreamingScrubberDslQueryFilter | string): readonly StreamingScrubberEventRow[] {
    const parsed: StreamingScrubberDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const all = Array.from(this.events.values());

    return all.filter((ev) => {
      if (parsed.sessionId && ev.sessionId !== parsed.sessionId) return false;
      if (parsed.inBlock !== undefined && ev.inBlock !== parsed.inBlock) return false;
      if (parsed.minDeltaSize !== undefined && ev.deltaSize < parsed.minDeltaSize) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${ev.id} ${ev.sessionId}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): StreamingScrubberDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let sessionId: string | undefined;
    let inBlock: boolean | undefined;
    let minDeltaSize: number | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("session:")) {
        sessionId = tok.slice(8);
      } else if (tok === "is:block" || tok === "inBlock:true") {
        inBlock = true;
      } else if (tok === "is:outside" || tok === "inBlock:false") {
        inBlock = false;
      } else if (tok.startsWith("minDelta:")) {
        minDeltaSize = parseInt(tok.slice(9), 10);
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      sessionId,
      inBlock,
      minDeltaSize,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeEvents(ids: readonly string[]): StreamingScrubberBulkMutationResult {
    const prev = this.exportSnapshot();
    let modified = 0;

    for (const id of ids) {
      if (this.events.has(id)) {
        this.events.delete(id);
        if (this.eventsTable) this.eventsTable.delete(id);
        modified++;
      }
    }

    this.pushUndoRecord("clear", prev);
    return {
      matchedCount: ids.length,
      modifiedCount: modified,
      affectedIds: ids,
    };
  }

  public bulkResetSessions(sessionIds: readonly string[]): StreamingScrubberBulkMutationResult {
    const prev = this.exportSnapshot();
    let modified = 0;

    for (const sid of sessionIds) {
      if (this.sessionStates.has(sid)) {
        this.sessionStates.set(sid, {
          inBlock: false,
          heldBuffer: "",
          lastEmittedEndedNewline: true,
          turnIndex: (this.sessionStates.get(sid)?.turnIndex || 0) + 1,
        });
        modified++;
      }
    }

    this.pushUndoRecord("reset_session", prev);
    return {
      matchedCount: sessionIds.length,
      modifiedCount: modified,
      affectedIds: sessionIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const events = this.listEvents();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Streaming Reasoning Tag Scrubber Ledger</title>
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
  <h1>🧬 LUMI Streaming Reasoning Tag Scrubber</h1>
  <p style="color: #94a3b8;">Deterministic Boundary Gated Holdback Buffer (Phase 137 / ADR-113)</p>
  
  <div class="grid">
    <div class="card"><div>Deltas Processed</div><div class="metric-val">${metrics.totalDeltasProcessed}</div></div>
    <div class="card"><div>Chunks Suppressed</div><div class="metric-val" style="color:#f43f5e;">${metrics.reasoningChunksSuppressed}</div></div>
    <div class="card"><div>Blocks Encountered</div><div class="metric-val" style="color:#10b981;">${metrics.blocksEncountered}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Recent Delta Scrub Events</h2>
  <table>
    <thead><tr><th>Event ID</th><th>Session</th><th>Turn</th><th>Delta Size</th><th>Emitted Size</th><th>Duration</th></tr></thead>
    <tbody>
      ${events.map((e) => `<tr><td><code>${e.id}</code></td><td>${e.sessionId}</td><td>#${e.turnIndex}</td><td>${e.deltaSize}B</td><td>${e.emittedSize}B</td><td>${e.durationMs.toFixed(2)}ms</td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const events = this.listEvents();

    let md = `# LUMI Streaming Scrubber Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Deltas:** \`${metrics.totalDeltasProcessed}\` | **Suppressed:** \`${metrics.reasoningChunksSuppressed}\` | **Blocks:** \`${metrics.blocksEncountered}\`\n\n`;
    md += `## Scrub Events (${events.length})\n\n`;
    md += `| Event ID | Session | Turn | Delta | Emitted | Duration |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const e of events) {
      md += `| \`${e.id}\` | ${e.sessionId} | #${e.turnIndex} | ${e.deltaSize}B | ${e.emittedSize}B | ${e.durationMs.toFixed(2)}ms |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "id,sessionId,turnIndex,deltaSize,emittedSize,suppressedSize,inBlock,durationMs,timestamp\n";
    const rows = Array.from(this.events.values()).map((e) => {
      return `"${e.id}","${e.sessionId}",${e.turnIndex},${e.deltaSize},${e.emittedSize},${e.suppressedSize},${e.inBlock},${e.durationMs.toFixed(2)},${e.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): StreamingThinkScrubberWorkspaceSnapshot {
    const sessionStatesObj: Record<string, StreamingScrubberState> = {};
    for (const [key, val] of this.sessionStates.entries()) {
      sessionStatesObj[key] = { ...val };
    }

    return {
      snapshotId: `snap-${Date.now()}`,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
      sessionStates: sessionStatesObj,
      events: Array.from(this.events.values()),
    };
  }

  public createSnapshot(snapshotId: string): StreamingThinkScrubberWorkspaceSnapshot {
    const snap = this.exportSnapshot();
    return { ...snap, snapshotId };
  }

  public importSnapshot(snapshot: StreamingThinkScrubberWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.metrics = { ...snapshot.metrics };
    this.sessionStates.clear();
    for (const [key, val] of Object.entries(snapshot.sessionStates)) {
      this.sessionStates.set(key, { ...val });
    }
    this.events.clear();
    if (snapshot.events) {
      for (const ev of snapshot.events) {
        this.events.set(ev.id, { ...ev });
      }
    }
  }

  public restoreSnapshot(snapshot: StreamingThinkScrubberWorkspaceSnapshot): void {
    this.importSnapshot(snapshot);
  }

  public clear(): void {
    this.config = { ...DEFAULT_STREAMING_THINK_SCRUBBER_CONFIG };
    this.metrics = {
      totalDeltasProcessed: 0,
      reasoningChunksSuppressed: 0,
      heldBackTailEmissions: 0,
      blocksEncountered: 0,
      flushesExecuted: 0,
    };
    this.sessionStates.clear();
    this.events.clear();
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
