/**
 * broccoli-turn-retry-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate leveraging the Hybrid BroccoliDB Kernel
 * for Turn Retry State Machines, recovery guard ledgers, and SLA health audits (Phase 131 / ADR-107).
 */

import {
  DEFAULT_TURN_RETRY_CONFIG,
  DEFAULT_TURN_RETRY_GUARDS,
  type IBroccoliTurnRetrySubstrate,
  type TurnRetryAttemptRecord,
  type TurnRetryAttemptRow,
  type TurnRetryAuditRow,
  type TurnRetryBulkMutationResult,
  type TurnRetryDslQueryFilter,
  type TurnRetryGroupBy,
  type TurnRetryGroupedLane,
  type TurnRetryHealthAuditReport,
  type TurnRetryHealthStatus,
  type TurnRetryMetricsReport,
  type TurnRetryMutationUndoRecord,
  type TurnRetrySortBy,
  type TurnRetrySortDirection,
  type TurnRetryStateDescriptor,
  type TurnRetryStateRow,
  type TurnRetryWorkspaceSnapshot,
} from "../../../core/contracts/turn-retry.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliTurnRetrySubstrate implements IBroccoliTurnRetrySubstrate {
  private readonly states: Map<string, TurnRetryStateDescriptor>;
  private readonly attempts: Map<string, TurnRetryAttemptRecord>;
  private readonly auditLogs: TurnRetryAuditRow[] = [];
  private activeStateId?: string;

  private readonly undoStack: TurnRetryMutationUndoRecord[] = [];
  private readonly redoStack: TurnRetryMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private statesTable?: IDbTable<TurnRetryStateRow>;
  private attemptsTable?: IDbTable<TurnRetryAttemptRow>;
  private auditsTable?: IDbTable<TurnRetryAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    this.states = new Map<string, TurnRetryStateDescriptor>();
    this.attempts = new Map<string, TurnRetryAttemptRecord>();

    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.statesTable = dbKernel.getTable<TurnRetryStateRow>("turn_retry_states");
      this.attemptsTable = dbKernel.getTable<TurnRetryAttemptRow>("turn_retry_attempts");
      this.auditsTable = dbKernel.getTable<TurnRetryAuditRow>("turn_retry_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: TurnRetryMutationUndoRecord["mutationType"], prev: TurnRetryWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliTurnRetrySubstrate.MAX_UNDO_STACK) {
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
    this.recordAudit(record.previousSnapshot.activeState?.stateId ?? "system", "undo", "system", `Reverted ${record.mutationType}`);
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
    this.recordAudit(record.nextSnapshot.activeState?.stateId ?? "system", "redo", "system", `Reapplied ${record.mutationType}`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Core State & Attempt Operations
  // ---------------------------------------------------------------------------

  public recordState(state: TurnRetryStateDescriptor): void {
    const prev = this.exportSnapshot();
    this.states.set(state.stateId, state);
    this.activeStateId = state.stateId;

    if (this.statesTable) {
      this.statesTable.put(state.stateId, {
        id: state.stateId,
        turnIndex: state.turnIndex,
        attemptIndex: state.attemptIndex,
        status: state.status,
        errorCategory: state.errorCategory,
        timestamp: state.timestamp,
      });
    }

    this.pushUndoRecord("create_state", prev);
    this.recordAudit(state.stateId, "record_state", "supervisor", `State ${state.stateId} recorded for turn #${state.turnIndex}`);
  }

  public getState(stateId: string): TurnRetryStateDescriptor | undefined {
    return this.states.get(stateId);
  }

  public listStates(limit = 50): readonly TurnRetryStateDescriptor[] {
    return Array.from(this.states.values()).slice(0, limit);
  }

  public recordAttempt(attempt: TurnRetryAttemptRecord): void {
    const prev = this.exportSnapshot();
    this.attempts.set(attempt.attemptId, attempt);

    if (this.attemptsTable) {
      this.attemptsTable.put(attempt.attemptId, {
        id: attempt.attemptId,
        stateId: attempt.stateId,
        turnIndex: attempt.turnIndex,
        attemptIndex: attempt.attemptIndex,
        errorCategory: attempt.errorCategory,
        errorMessage: attempt.errorMessage.slice(0, 500),
        guardTriggered: attempt.guardTriggered,
        signalEmitted: attempt.signalEmitted,
        success: attempt.success,
        durationMs: attempt.durationMs,
        timestamp: attempt.timestamp,
      });
    }

    this.pushUndoRecord("recover", prev);
    this.recordAudit(attempt.stateId, "record_attempt", "engine", `Attempt #${attempt.attemptIndex} result: success=${attempt.success}`);
  }

  public listAttempts(stateId?: string, limit = 100): readonly TurnRetryAttemptRecord[] {
    const all = Array.from(this.attempts.values());
    const filtered = stateId ? all.filter((a) => a.stateId === stateId) : all;
    return filtered.slice(0, limit);
  }

  public updateStateStatus(stateId: string, status: TurnRetryStateDescriptor["status"]): boolean {
    const state = this.states.get(stateId);
    if (!state) return false;

    const prev = this.exportSnapshot();
    const updated: TurnRetryStateDescriptor = { ...state, status };
    this.states.set(stateId, updated);

    if (this.statesTable) {
      this.statesTable.put(stateId, {
        id: stateId,
        turnIndex: state.turnIndex,
        attemptIndex: state.attemptIndex,
        status,
        errorCategory: state.errorCategory,
        timestamp: state.timestamp,
      });
    }

    this.pushUndoRecord("reset", prev);
    return true;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditTurnRetryHealth(): TurnRetryHealthAuditReport {
    const stateList = Array.from(this.states.values());
    const attemptList = Array.from(this.attempts.values());

    const totalStates = stateList.length;
    const activeStates = stateList.filter((s) => s.status === "active").length;
    const recoveredCount = stateList.filter((s) => s.status === "recovered").length;
    const exhaustedCount = stateList.filter((s) => s.status === "exhausted").length;

    const recoverySuccessRate = totalStates > 0 ? Number((recoveredCount / totalStates).toFixed(2)) : 1.0;

    let guardTrips = 0;
    for (const state of stateList) {
      for (const val of Object.values(state.guards)) {
        if (val) guardTrips++;
      }
    }
    const maxGuards = totalStates * Object.keys(DEFAULT_TURN_RETRY_GUARDS).length;
    const guardExhaustionIndex = maxGuards > 0 ? Number((guardTrips / maxGuards).toFixed(3)) : 0;

    const totalDur = attemptList.reduce((sum, a) => sum + a.durationMs, 0);
    const avgDuration = attemptList.length > 0 ? Number((totalDur / attemptList.length).toFixed(2)) : 0;

    let healthStatus: TurnRetryHealthStatus = "optimal";
    if (exhaustedCount > 0 && exhaustedCount >= totalStates * 0.3) {
      healthStatus = "exhausted_warning";
    } else if (exhaustedCount > 0 || guardExhaustionIndex > 0.4) {
      healthStatus = "degraded";
    } else if (totalStates > 0) {
      healthStatus = "healthy";
    }

    const recommendations: string[] = [];
    if (exhaustedCount > 0) {
      recommendations.push(`${exhaustedCount} turn(s) exhausted all recovery attempts. Check API provider rate limits or auth keys.`);
    }
    if (guardExhaustionIndex > 0.5) {
      recommendations.push(`High guard trip rate (${(guardExhaustionIndex * 100).toFixed(1)}%). Consider payload compaction before invocation.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("Turn retry state machine and one-shot recovery guards operating optimally.");
    }

    return {
      totalStates,
      activeStates,
      recoveredCount,
      exhaustedCount,
      recoverySuccessRate,
      guardExhaustionIndex,
      avgRecoveryDurationMs: avgDuration,
      healthStatus,
      recommendations,
    };
  }

  public getTurnRetryMetrics(): TurnRetryMetricsReport {
    const stateList = Array.from(this.states.values());
    const attemptList = Array.from(this.attempts.values());

    const guardTriggerCounts: Record<string, number> = {};
    const signalTriggerCounts: Record<string, number> = {};

    for (const state of stateList) {
      for (const [g, val] of Object.entries(state.guards)) {
        if (val) guardTriggerCounts[g] = (guardTriggerCounts[g] ?? 0) + 1;
      }
      for (const [s, val] of Object.entries(state.restartSignals)) {
        if (val) signalTriggerCounts[s] = (signalTriggerCounts[s] ?? 0) + 1;
      }
    }

    const recoveredCount = stateList.filter((s) => s.status === "recovered").length;
    const exhaustedCount = stateList.filter((s) => s.status === "exhausted").length;
    const activeStates = stateList.filter((s) => s.status === "active").length;
    const recoverySuccessRate = stateList.length > 0 ? Number((recoveredCount / stateList.length).toFixed(2)) : 1.0;

    const totalDur = attemptList.reduce((sum, a) => sum + a.durationMs, 0);
    const avgDuration = attemptList.length > 0 ? Number((totalDur / attemptList.length).toFixed(2)) : 0;

    const topGuards = Object.entries(guardTriggerCounts)
      .map(([guard, count]) => ({ guard, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalStates: stateList.length,
      activeStates,
      recoveredCount,
      exhaustedCount,
      totalGuardsTriggered: Object.values(guardTriggerCounts).reduce((a, b) => a + b, 0),
      totalSignalsEmitted: Object.values(signalTriggerCounts).reduce((a, b) => a + b, 0),
      recoverySuccessRate,
      avgRecoveryDurationMs: avgDuration,
      topTriggeredGuards: topGuards,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedStates(
    groupBy: TurnRetryGroupBy = "status",
    sortBy: TurnRetrySortBy = "timestamp",
    direction: TurnRetrySortDirection = "desc"
  ): readonly TurnRetryGroupedLane[] {
    const lanes = new Map<string, TurnRetryStateDescriptor[]>();

    for (const state of this.states.values()) {
      let key = "active";
      switch (groupBy) {
        case "status":
          key = state.status;
          break;
        case "errorCategory":
          key = state.errorCategory ?? "uncategorized";
          break;
        case "turnIndex":
          key = `turn_${state.turnIndex}`;
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(state);
    }

    const result: TurnRetryGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = a.timestamp - b.timestamp;
        else if (sortBy === "attemptIndex") cmp = a.attemptIndex - b.attemptIndex;
        else if (sortBy === "turnIndex") cmp = a.turnIndex - b.turnIndex;
        return direction === "asc" ? cmp : -cmp;
      });

      const recovered = items.filter((s) => s.status === "recovered").length;
      const rate = items.length > 0 ? Number((recovered / items.length).toFixed(2)) : 1.0;

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        recoveryRate: rate,
        states: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryStatesDsl(query: TurnRetryDslQueryFilter | string): readonly TurnRetryStateDescriptor[] {
    const parsed: TurnRetryDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;

    return Array.from(this.states.values()).filter((state) => {
      if (parsed.turnIndex !== undefined && state.turnIndex !== parsed.turnIndex) return false;
      if (parsed.status && state.status !== parsed.status) return false;
      if (parsed.errorCategory && state.errorCategory !== parsed.errorCategory) return false;

      if (parsed.guard && !state.guards[parsed.guard]) return false;
      if (parsed.signal && !state.restartSignals[parsed.signal]) return false;

      if (parsed.minAttempts !== undefined && state.attemptIndex < parsed.minAttempts) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${state.stateId} ${state.status} ${state.errorCategory ?? ""}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): TurnRetryDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let turnIndex: number | undefined;
    let status: TurnRetryDslQueryFilter["status"];
    let errorCategory: TurnRetryDslQueryFilter["errorCategory"];
    let guard: TurnRetryDslQueryFilter["guard"];
    let signal: TurnRetryDslQueryFilter["signal"];
    let minAttempts: number | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("turn:")) {
        turnIndex = Number(tok.slice(5));
      } else if (tok.startsWith("status:")) {
        status = tok.slice(7) as TurnRetryDslQueryFilter["status"];
      } else if (tok.startsWith("category:")) {
        errorCategory = tok.slice(9) as TurnRetryDslQueryFilter["errorCategory"];
      } else if (tok.startsWith("guard:")) {
        guard = tok.slice(6) as TurnRetryDslQueryFilter["guard"];
      } else if (tok.startsWith("signal:")) {
        signal = tok.slice(7) as TurnRetryDslQueryFilter["signal"];
      } else if (tok.startsWith("attempts>=")) {
        minAttempts = Number(tok.slice(10));
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      turnIndex,
      status,
      errorCategory,
      guard,
      signal,
      minAttempts,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkResetStates(stateIds: readonly string[]): TurnRetryBulkMutationResult {
    const prev = this.exportSnapshot();
    const affected: string[] = [];

    for (const id of stateIds) {
      const state = this.states.get(id);
      if (state) {
        this.states.set(id, {
          ...state,
          attemptIndex: 0,
          status: "active",
          guards: { ...DEFAULT_TURN_RETRY_GUARDS },
        });
        affected.push(id);
      }
    }

    this.pushUndoRecord("bulk", prev);
    return {
      matchedCount: stateIds.length,
      modifiedCount: affected.length,
      affectedStateIds: affected,
    };
  }

  public bulkClearGuards(stateIds: readonly string[]): TurnRetryBulkMutationResult {
    const prev = this.exportSnapshot();
    const affected: string[] = [];

    for (const id of stateIds) {
      const state = this.states.get(id);
      if (state) {
        this.states.set(id, {
          ...state,
          guards: { ...DEFAULT_TURN_RETRY_GUARDS },
        });
        affected.push(id);
      }
    }

    this.pushUndoRecord("bulk", prev);
    return {
      matchedCount: stateIds.length,
      modifiedCount: affected.length,
      affectedStateIds: affected,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getTurnRetryMetrics();
    const health = this.auditTurnRetryHealth();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Turn Retry State Machine Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #f59e0b; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #f59e0b; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .badge-rec { background: #16a34a; color: #bbf7d0; }
    .badge-act { background: #d97706; color: #fef3c7; }
  </style>
</head>
<body>
  <h1>🔄 LUMI Turn Retry State Machine & Recovery Guards</h1>
  <p style="color: #94a3b8;">Deterministic One-Shot Recovery Guards & Adaptive Payload Restart (Phase 131 / ADR-107)</p>
  
  <div class="grid">
    <div class="card"><div>Total States</div><div class="metric-val">${metrics.totalStates}</div></div>
    <div class="card"><div>Recovered Turns</div><div class="metric-val" style="color:#22c55e;">${metrics.recoveredCount}</div></div>
    <div class="card"><div>Recovery Rate</div><div class="metric-val" style="color:#f59e0b;">${(metrics.recoverySuccessRate * 100).toFixed(0)}%</div></div>
    <div class="card"><div>Health Status</div><div class="metric-val" style="color:#22c55e;">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Active Retry States</h2>
  <table>
    <thead>
      <tr>
        <th>State ID</th>
        <th>Turn #</th>
        <th>Attempts</th>
        <th>Status</th>
        <th>Error Category</th>
      </tr>
    </thead>
    <tbody>
      ${Array.from(this.states.values()).slice(0, 25).map((s) => `
        <tr>
          <td><code>${s.stateId}</code></td>
          <td>Turn #${s.turnIndex}</td>
          <td>${s.attemptIndex}</td>
          <td><span class="badge ${s.status === "recovered" ? "badge-rec" : "badge-act"}">${s.status}</span></td>
          <td>${s.errorCategory ?? "general"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getTurnRetryMetrics();
    const health = this.auditTurnRetryHealth();

    let md = `# LUMI Turn Retry State Machine Diagnostic Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Recovery Rate:** \`${(metrics.recoverySuccessRate * 100).toFixed(0)}%\` | **Total States:** \`${metrics.totalStates}\`\n\n`;
    md += `## Metrics Summary\n`;
    md += `- **Recovered Turns:** ${metrics.recoveredCount}\n`;
    md += `- **Exhausted Turns:** ${metrics.exhaustedCount}\n`;
    md += `- **Guards Triggered:** ${metrics.totalGuardsTriggered}\n`;
    md += `- **Signals Emitted:** ${metrics.totalSignalsEmitted}\n\n`;

    md += `## Retry States\n\n`;
    md += `| State ID | Turn | Attempts | Status | Category |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const s of Array.from(this.states.values()).slice(0, 20)) {
      md += `| \`${s.stateId}\` | #${s.turnIndex} | ${s.attemptIndex} | \`${s.status}\` | ${s.errorCategory ?? "general"} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "stateId,turnIndex,attemptIndex,status,errorCategory,timestamp\n";
    const rows = Array.from(this.states.values()).map((s) => {
      return `"${s.stateId}",${s.turnIndex},${s.attemptIndex},"${s.status}","${s.errorCategory ?? ""}",${s.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Auditing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): TurnRetryWorkspaceSnapshot {
    const stateList = Array.from(this.states.values());
    const attemptList = Array.from(this.attempts.values());

    const guardTriggerCounts: Record<string, number> = {};
    const signalTriggerCounts: Record<string, number> = {};

    for (const state of stateList) {
      for (const [g, val] of Object.entries(state.guards)) {
        if (val) guardTriggerCounts[g] = (guardTriggerCounts[g] ?? 0) + 1;
      }
      for (const [s, val] of Object.entries(state.restartSignals)) {
        if (val) signalTriggerCounts[s] = (signalTriggerCounts[s] ?? 0) + 1;
      }
    }

    const recoveredCount = stateList.filter((s) => s.status === "recovered").length;
    const recoverySuccessRate = stateList.length > 0 ? Number((recoveredCount / stateList.length).toFixed(2)) : 1.0;

    return {
      snapshotId: `snap_substrate_retry_${Date.now()}`,
      timestamp: Date.now(),
      config: DEFAULT_TURN_RETRY_CONFIG,
      metrics: {
        totalStatesCreated: stateList.length,
        totalGuardsTriggered: Object.values(guardTriggerCounts).reduce((a, b) => a + b, 0),
        totalSignalsEmitted: Object.values(signalTriggerCounts).reduce((a, b) => a + b, 0),
        guardTriggerCounts,
        signalTriggerCounts,
        recoverySuccessRate,
        avgRecoveryDurationMs: 0,
      },
      activeState: this.activeStateId ? this.states.get(this.activeStateId) : undefined,
      states: stateList,
      attempts: attemptList,
      archivedStates: stateList.filter((s) => s.status !== "active"),
    };
  }

  public importSnapshot(snapshot: TurnRetryWorkspaceSnapshot): void {
    this.states.clear();
    this.attempts.clear();

    for (const s of snapshot.states) this.states.set(s.stateId, s);
    for (const a of snapshot.attempts) this.attempts.set(a.attemptId, a);
    this.activeStateId = snapshot.activeState?.stateId;
  }

  public recordAudit(stateId: string, action: string, operator: string, details: string): void {
    const row: TurnRetryAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      stateId,
      action,
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
    this.states.clear();
    this.attempts.clear();
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.activeStateId = undefined;
  }
}
