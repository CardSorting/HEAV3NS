/**
 * broccoli-display-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate leveraging the Hybrid BroccoliDB Kernel
 * for Virtual Display actions, Set-of-Marks UI element trees, and SLA health audits (Phase 88 / ADR-040).
 */

import type {
  ComputerActionRow,
  ComputerActionResult,
  ComputerUseBulkMutationResult,
  ComputerUseDslQueryFilter,
  ComputerUseGroupBy,
  ComputerUseGroupedLane,
  ComputerUseHealthAuditReport,
  ComputerUseHealthStatus,
  ComputerUseMetricsReport,
  ComputerUseMutationUndoRecord,
  ComputerUseSortBy,
  ComputerUseSortDirection,
  ComputerWorkspaceSnapshot,
  DisplayAuditRow,
  IBroccoliDisplaySubstrate,
  UiElementRow,
} from "../../../core/contracts/computer-use.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliDisplaySubstrate implements IBroccoliDisplaySubstrate {
  private readonly actions: ComputerActionResult[];
  private displayWidth: number;
  private displayHeight: number;
  private windowCount: number;
  private elementCount: number;
  private currentCursor: { x: number; y: number };
  private readonly auditLogs: DisplayAuditRow[] = [];

  private readonly undoStack: ComputerUseMutationUndoRecord[] = [];
  private readonly redoStack: ComputerUseMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private actionsTable?: IDbTable<ComputerActionRow>;
  private elementsTable?: IDbTable<UiElementRow>;
  private auditsTable?: IDbTable<DisplayAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    this.actions = [];
    this.displayWidth = 1920;
    this.displayHeight = 1080;
    this.windowCount = 1;
    this.elementCount = 3;
    this.currentCursor = { x: 960, y: 540 };

    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.actionsTable = dbKernel.getTable<ComputerActionRow>("computer_actions");
      this.elementsTable = dbKernel.getTable<UiElementRow>("computer_ui_elements");
      this.auditsTable = dbKernel.getTable<DisplayAuditRow>("computer_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: ComputerUseMutationUndoRecord["mutationType"], prev: ComputerWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliDisplaySubstrate.MAX_UNDO_STACK) {
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
  // Core Action Operations
  // ---------------------------------------------------------------------------

  public recordAction(result: ComputerActionResult): void {
    const prev = this.exportSnapshot();
    this.actions.push(result);
    this.displayWidth = result.frame.width;
    this.displayHeight = result.frame.height;
    this.windowCount = result.frame.windows.length;
    this.elementCount = result.frame.elements.length;
    this.currentCursor = { x: result.frame.cursor.x, y: result.frame.cursor.y };

    if (this.actionsTable && result.actionId) {
      this.actionsTable.put(result.actionId, {
        id: result.actionId,
        action: result.action,
        success: result.success,
        frameIndex: result.frame.frameIndex,
        activeWindowId: result.frame.activeWindowId,
        durationMs: result.durationMs,
        timestamp: result.timestamp ?? Date.now(),
      });
    }

    if (this.elementsTable && result.frame.elements.length > 0) {
      for (const el of result.frame.elements) {
        this.elementsTable.put(`elem_${result.frame.frameIndex}_${el.id}`, {
          id: `elem_${result.frame.frameIndex}_${el.id}`,
          elementId: el.id,
          label: el.label,
          role: el.role,
          windowId: result.frame.activeWindowId,
          boundsJson: JSON.stringify(el.bounds),
          timestamp: Date.now(),
        });
      }
    }

    if (this.actions.length > 500) {
      this.actions.shift();
    }

    this.pushUndoRecord("record_action", prev);
    this.recordAudit(result.actionId ?? "act_unknown", "record_action", "driver", `Action ${result.action} on frame #${result.frame.frameIndex}`);
  }

  public getAction(actionId: string): ComputerActionResult | undefined {
    return this.actions.find((a) => a.actionId === actionId);
  }

  public listActions(limit = 20): readonly ComputerActionResult[] {
    return this.actions.slice(-limit);
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): ComputerUseHealthAuditReport {
    const totalActions = this.actions.length;
    const successfulActions = this.actions.filter((a) => a.success).length;
    const failedActions = totalActions - successfulActions;
    const overallSuccessRate = totalActions > 0 ? Number((successfulActions / totalActions).toFixed(2)) : 1.0;

    const totalDuration = this.actions.reduce((sum, a) => sum + a.durationMs, 0);
    const avgLatency = totalActions > 0 ? Number((totalDuration / totalActions).toFixed(2)) : 0;

    let healthStatus: ComputerUseHealthStatus = "optimal";
    if (failedActions > 2) {
      healthStatus = "error_spike";
    } else if (failedActions > 0) {
      healthStatus = "degraded";
    } else if (totalActions > 0) {
      healthStatus = "healthy";
    }

    const recommendations: string[] = [];
    if (failedActions > 0) {
      recommendations.push(`${failedActions} display action(s) failed. Check element coordinates or target visibility.`);
    }
    if (avgLatency > 50) {
      recommendations.push(`Average action latency (${avgLatency} ms) is elevated. Check display buffer frame capture rate.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("Virtual display driver and Set-of-Marks indexing are operating optimally.");
    }

    return {
      totalActions,
      successfulActions,
      failedActions,
      overallSuccessRate,
      avgActionLatencyMs: avgLatency,
      windowCount: this.windowCount,
      elementDensity: this.elementCount,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): ComputerUseMetricsReport {
    const totalActions = this.actions.length;
    const successfulActions = this.actions.filter((a) => a.success).length;
    const failedActions = totalActions - successfulActions;
    const overallSuccessRate = totalActions > 0 ? Number((successfulActions / totalActions).toFixed(2)) : 1.0;

    const totalDuration = this.actions.reduce((sum, a) => sum + a.durationMs, 0);
    const avgLatency = totalActions > 0 ? Number((totalDuration / totalActions).toFixed(2)) : 0;

    const durations = this.actions.map((a) => a.durationMs).sort((a, b) => a - b);
    const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;

    const actionCounts: Record<string, number> = {};
    for (const a of this.actions) {
      actionCounts[a.action] = (actionCounts[a.action] ?? 0) + 1;
    }

    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalActions,
      successfulActions,
      failedActions,
      overallSuccessRate,
      avgActionLatencyMs: avgLatency,
      p50ActionLatencyMs: Number(p50.toFixed(2)),
      p95ActionLatencyMs: Number(p95.toFixed(2)),
      displayResolution: `${this.displayWidth}x${this.displayHeight}`,
      topActions,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedActions(
    groupBy: ComputerUseGroupBy = "action",
    sortBy: ComputerUseSortBy = "timestamp",
    direction: ComputerUseSortDirection = "desc"
  ): readonly ComputerUseGroupedLane[] {
    const lanes = new Map<string, ComputerActionResult[]>();

    for (const a of this.actions) {
      let key = "click";
      switch (groupBy) {
        case "action":
          key = a.action;
          break;
        case "activeWindowId":
          key = a.frame.activeWindowId ?? "none";
          break;
        case "success":
          key = a.success ? "success" : "failure";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(a);
    }

    const result: ComputerUseGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = (a.timestamp ?? 0) - (b.timestamp ?? 0);
        else if (sortBy === "durationMs") cmp = a.durationMs - b.durationMs;
        else if (sortBy === "frameIndex") cmp = a.frame.frameIndex - b.frame.frameIndex;
        return direction === "asc" ? cmp : -cmp;
      });

      const succ = items.filter((i) => i.success).length;
      const rate = items.length > 0 ? Number((succ / items.length).toFixed(2)) : 1.0;

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        successRate: rate,
        actions: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryActionsDsl(query: ComputerUseDslQueryFilter | string): readonly ComputerActionResult[] {
    const parsed: ComputerUseDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;

    return this.actions.filter((a) => {
      if (parsed.action && a.action !== parsed.action) return false;
      if (parsed.success !== undefined && a.success !== parsed.success) return false;
      if (parsed.windowId && a.frame.activeWindowId !== parsed.windowId) return false;

      if (parsed.minDurationMs !== undefined && a.durationMs < parsed.minDurationMs) return false;
      if (parsed.maxDurationMs !== undefined && a.durationMs > parsed.maxDurationMs) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${a.actionId ?? ""} ${a.action} ${a.frame.activeWindowId ?? ""}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): ComputerUseDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let action: ComputerUseDslQueryFilter["action"];
    let success: boolean | undefined;
    let windowId: string | undefined;
    let maxDurationMs: number | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("action:")) {
        action = tok.slice(7) as ComputerUseDslQueryFilter["action"];
      } else if (tok === "status:success" || tok === "success:true") {
        success = true;
      } else if (tok === "status:failure" || tok === "success:false") {
        success = false;
      } else if (tok.startsWith("window:")) {
        windowId = tok.slice(7);
      } else if (tok.startsWith("duration<")) {
        maxDurationMs = Number(tok.slice(9));
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      action,
      success,
      windowId,
      maxDurationMs,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeActions(actionIds: readonly string[]): ComputerUseBulkMutationResult {
    const prev = this.exportSnapshot();
    const set = new Set(actionIds);
    const initialLen = this.actions.length;

    for (let i = this.actions.length - 1; i >= 0; i--) {
      if (this.actions[i].actionId && set.has(this.actions[i].actionId!)) {
        this.actions.splice(i, 1);
      }
    }

    const modified = initialLen - this.actions.length;
    this.pushUndoRecord("bulk", prev);

    return {
      matchedCount: actionIds.length,
      modifiedCount: modified,
      affectedActionIds: actionIds,
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
  <title>LUMI Virtual Display & OS Automation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .badge-succ { background: #16a34a; color: #bbf7d0; }
    .badge-fail { background: #dc2626; color: #fecaca; }
  </style>
</head>
<body>
  <h1>🖥️ LUMI Virtual Display & OS Automation</h1>
  <p style="color: #94a3b8;">Deterministic Computer Use, Set-of-Marks Element Overlay & Telemetry (Phase 88 / ADR-040)</p>
  
  <div class="grid">
    <div class="card"><div>Total Actions</div><div class="metric-val">${metrics.totalActions}</div></div>
    <div class="card"><div>Resolution</div><div class="metric-val" style="font-size:20px; color:#38bdf8;">${metrics.displayResolution}</div></div>
    <div class="card"><div>Success Rate</div><div class="metric-val" style="color:#22c55e;">${(metrics.overallSuccessRate * 100).toFixed(0)}%</div></div>
    <div class="card"><div>Health Status</div><div class="metric-val" style="color:#22c55e;">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Action History</h2>
  <table>
    <thead>
      <tr>
        <th>Action ID</th>
        <th>Action</th>
        <th>Status</th>
        <th>Duration</th>
        <th>Frame</th>
        <th>Active Window</th>
      </tr>
    </thead>
    <tbody>
      ${this.actions.slice(-25).map((a) => `
        <tr>
          <td><code>${a.actionId ?? "-"}</code></td>
          <td>${a.action}</td>
          <td><span class="badge ${a.success ? "badge-succ" : "badge-fail"}">${a.success ? "SUCCESS" : "FAILURE"}</span></td>
          <td>${a.durationMs} ms</td>
          <td>#${a.frame.frameIndex}</td>
          <td>${a.frame.activeWindowId ?? "none"}</td>
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

    let md = `# LUMI Virtual Display & OS Automation Diagnostic Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Success Rate:** \`${(metrics.overallSuccessRate * 100).toFixed(0)}%\` | **Resolution:** \`${metrics.displayResolution}\`\n\n`;
    md += `## Metrics Summary\n`;
    md += `- **Total Actions:** ${metrics.totalActions}\n`;
    md += `- **Successful:** ${metrics.successfulActions}\n`;
    md += `- **Failed:** ${metrics.failedActions}\n`;
    md += `- **Avg Latency:** ${metrics.avgActionLatencyMs} ms (p95: ${metrics.p95ActionLatencyMs} ms)\n\n`;

    md += `## Recent Actions\n\n`;
    md += `| Action ID | Action | Success | Duration | Frame | Window |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const a of this.actions.slice(-20)) {
      md += `| \`${a.actionId ?? "-"}\` | ${a.action} | \`${a.success}\` | ${a.durationMs} ms | #${a.frame.frameIndex} | ${a.frame.activeWindowId ?? "none"} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "actionId,action,success,durationMs,frameIndex,activeWindowId,timestamp\n";
    const rows = this.actions.map((a) => {
      return `"${a.actionId ?? ""}","${a.action}",${a.success},${a.durationMs},${a.frame.frameIndex},"${a.frame.activeWindowId ?? ""}",${a.timestamp ?? 0}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Auditing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): ComputerWorkspaceSnapshot {
    return {
      displayWidth: this.displayWidth,
      displayHeight: this.displayHeight,
      windowCount: this.windowCount,
      elementCount: this.elementCount,
      currentCursor: { ...this.currentCursor },
      totalActions: this.actions.length,
      actions: [...this.actions],
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: ComputerWorkspaceSnapshot): void {
    this.displayWidth = snapshot.displayWidth;
    this.displayHeight = snapshot.displayHeight;
    this.windowCount = snapshot.windowCount;
    this.elementCount = snapshot.elementCount;
    this.currentCursor = { ...snapshot.currentCursor };
    this.actions.length = 0;
    if (snapshot.actions) {
      this.actions.push(...snapshot.actions);
    }
  }

  public recordAudit(actionId: string, action: string, operator: string, details: string): void {
    const row: DisplayAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: `${action}:${actionId}`,
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
    this.actions.length = 0;
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
