/**
 * broccoli-patch-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for transactional file staging,
 * mutation journals, and virtual filesystem coalescence (Phase 77 / ADR-029 / Target #74).
 */

import type {
  FileMutationEntry,
  FileMutationRow,
  FileMutationSnapshot,
  IBroccoliPatchSubstrate,
  PatchAuditRow,
  PatchBulkMutationResult,
  PatchMutationDslQueryFilter,
  PatchMutationGroupBy,
  PatchMutationGroupedLane,
  PatchMutationHealthAuditReport,
  PatchMutationHealthStatus,
  PatchMutationMetricsReport,
  PatchMutationSortBy,
  PatchMutationSortDirection,
  PatchMutationUndoRecord,
} from "../../../core/contracts/patch-mutation.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliPatchSubstrate implements IBroccoliPatchSubstrate {
  private readonly staged = new Map<string, FileMutationEntry>();
  private readonly history: FileMutationEntry[] = [];
  private totalStagedCount = 0;
  private totalCommittedCount = 0;
  private totalRevertedCount = 0;

  private readonly undoStack: PatchMutationUndoRecord[] = [];
  private readonly redoStack: PatchMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private mutationsTable?: IDbTable<FileMutationRow>;
  private auditsTable?: IDbTable<PatchAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.mutationsTable = dbKernel.getTable<FileMutationRow>("staged_mutations");
      this.auditsTable = dbKernel.getTable<PatchAuditRow>("patch_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: PatchMutationUndoRecord["mutationType"], prev: FileMutationSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliPatchSubstrate.MAX_UNDO_STACK) {
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
  // Transactional Staging Operations
  // ---------------------------------------------------------------------------

  public stageFile(path: string, stagedContent: string | null, previousContent: string | null = null): FileMutationEntry {
    const prev = this.exportSnapshot();
    const entry: FileMutationEntry = {
      path,
      stagedContent,
      previousContent,
      status: "staged",
      timestamp: Date.now(),
    };

    this.staged.set(path, entry);
    this.totalStagedCount++;

    if (this.mutationsTable) {
      this.mutationsTable.put(path, {
        path,
        status: "staged",
        previousContentLength: previousContent ? previousContent.length : 0,
        stagedContentLength: stagedContent ? stagedContent.length : 0,
        timestamp: entry.timestamp,
      });
    }

    this.pushUndoRecord("stage_file", prev);
    return entry;
  }

  public getEntry(path: string): FileMutationEntry | undefined {
    return this.staged.get(path);
  }

  public getStagedFile(path: string): FileMutationEntry | undefined {
    return this.staged.get(path);
  }

  public listStaged(): readonly FileMutationEntry[] {
    return Array.from(this.staged.values());
  }

  public hasStaged(path: string): boolean {
    return this.staged.has(path);
  }

  public removeStaged(path: string): boolean {
    return this.unstageFile(path);
  }

  public unstageFile(path: string): boolean {
    const exists = this.staged.has(path);
    if (!exists) return false;

    const prev = this.exportSnapshot();
    this.staged.delete(path);

    if (this.mutationsTable) {
      this.mutationsTable.delete(path);
    }

    this.pushUndoRecord("bulk_purge", prev);
    return true;
  }

  public commitFile(path: string): boolean {
    const entry = this.staged.get(path);
    if (!entry) return false;

    const prev = this.exportSnapshot();
    const committed: FileMutationEntry = { ...entry, status: "committed", timestamp: Date.now() };
    this.history.push(committed);
    this.staged.delete(path);
    this.totalCommittedCount++;

    if (this.mutationsTable) {
      this.mutationsTable.delete(path);
    }

    this.pushUndoRecord("commit", prev);
    return true;
  }

  public revertFile(path: string): boolean {
    const entry = this.staged.get(path);
    if (!entry) return false;

    const prev = this.exportSnapshot();
    const reverted: FileMutationEntry = { ...entry, status: "reverted", timestamp: Date.now() };
    this.history.push(reverted);
    this.staged.delete(path);
    this.totalRevertedCount++;

    if (this.mutationsTable) {
      this.mutationsTable.delete(path);
    }

    this.pushUndoRecord("revert", prev);
    return true;
  }

  public commitAll(): readonly FileMutationEntry[] {
    const prev = this.exportSnapshot();
    const entries = Array.from(this.staged.values());
    for (const entry of entries) {
      this.totalCommittedCount++;
      this.history.push({ ...entry, status: "committed" });
    }
    this.staged.clear();
    this.pushUndoRecord("commit", prev);
    return entries;
  }

  public revertAll(): readonly FileMutationEntry[] {
    const prev = this.exportSnapshot();
    const entries = Array.from(this.staged.values());
    for (const entry of entries) {
      this.totalRevertedCount++;
      this.history.push({ ...entry, status: "reverted" });
    }
    this.staged.clear();
    this.pushUndoRecord("revert", prev);
    return entries;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): PatchMutationHealthAuditReport {
    const activeStaged = this.staged.size;
    let healthStatus: PatchMutationHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (activeStaged > 50) {
      healthStatus = "degraded";
      recommendations.push(`High number of uncommitted staged files (${activeStaged}). Consider committing or unstaging.`);
    }

    if (this.totalRevertedCount > this.totalCommittedCount && this.totalRevertedCount > 5) {
      healthStatus = "critical";
      recommendations.push("High mutation revert rate detected.");
    }

    if (activeStaged === 0 && this.totalCommittedCount === 0) {
      healthStatus = "healthy";
      recommendations.push("No active staged files in transaction buffer.");
    }

    return {
      totalStaged: activeStaged,
      totalCommitted: this.totalCommittedCount,
      totalReverted: this.totalRevertedCount,
      conflictCount: 0,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): PatchMutationMetricsReport {
    const entries = Array.from(this.staged.values());
    let totalLinesModified = 0;
    let totalBytesStaged = 0;

    const stagedByStatus: Record<string, number> = {
      staged: entries.length,
      committed: this.totalCommittedCount,
      reverted: this.totalRevertedCount,
    };

    for (const e of entries) {
      if (e.stagedContent) {
        totalBytesStaged += e.stagedContent.length;
        totalLinesModified += e.stagedContent.split("\n").length;
      }
    }

    return {
      totalStaged: entries.length,
      activeStaged: entries.length,
      totalStagedCount: this.totalStagedCount,
      totalCommitted: this.totalCommittedCount,
      totalReverted: this.totalRevertedCount,
      totalLinesModified,
      totalBytesStaged,
      stagedByStatus,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedMutations(
    groupBy: PatchMutationGroupBy = "status",
    sortBy: PatchMutationSortBy = "timestamp",
    direction: PatchMutationSortDirection = "desc"
  ): readonly PatchMutationGroupedLane[] {
    const lanes = new Map<string, FileMutationEntry[]>();
    const all = Array.from(this.staged.values());

    for (const e of all) {
      let key = "default";
      switch (groupBy) {
        case "status":
          key = e.status;
          break;
        case "extension": {
          const dot = e.path.lastIndexOf(".");
          key = dot !== -1 ? e.path.slice(dot) : "none";
          break;
        }
        case "directory": {
          const slash = e.path.lastIndexOf("/");
          key = slash !== -1 ? e.path.slice(0, slash) : ".";
          break;
        }
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(e);
    }

    const result: PatchMutationGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = b.timestamp - a.timestamp;
        else if (sortBy === "path") cmp = a.path.localeCompare(b.path);
        else if (sortBy === "size") {
          const lenA = a.stagedContent ? a.stagedContent.length : 0;
          const lenB = b.stagedContent ? b.stagedContent.length : 0;
          cmp = lenB - lenA;
        }
        return direction === "asc" ? -cmp : cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        entries: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryMutationsDsl(query: PatchMutationDslQueryFilter | string): readonly FileMutationEntry[] {
    const parsed: PatchMutationDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const all = Array.from(this.staged.values());

    return all.filter((e) => {
      if (parsed.status && e.status !== parsed.status) return false;
      if (parsed.extension && !e.path.endsWith(parsed.extension)) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${e.path} ${e.status} ${e.stagedContent || ""}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): PatchMutationDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let status: "staged" | "committed" | "reverted" | undefined;
    let extension: string | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("status:")) {
        status = tok.slice(7) as any;
      } else if (tok.startsWith("ext:")) {
        extension = tok.slice(4);
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      status,
      extension,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeStaged(paths: readonly string[]): PatchBulkMutationResult {
    const prev = this.exportSnapshot();
    let modified = 0;

    for (const p of paths) {
      if (this.staged.has(p)) {
        this.staged.delete(p);
        modified++;
      }
    }

    this.pushUndoRecord("bulk_purge", prev);
    return {
      matchedCount: paths.length,
      modifiedCount: modified,
      affectedPaths: paths,
    };
  }

  public bulkCommitStaged(): PatchBulkMutationResult {
    const prev = this.exportSnapshot();
    const paths = Array.from(this.staged.keys());
    const count = paths.length;

    for (const p of paths) {
      const e = this.staged.get(p)!;
      this.totalCommittedCount++;
      this.history.push({ ...e, status: "committed" });
    }
    this.staged.clear();

    this.pushUndoRecord("commit", prev);
    return {
      matchedCount: count,
      modifiedCount: count,
      affectedPaths: paths,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const entries = this.listStaged();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Patch Mutation & Staged Files Ledger</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; background: #0284c7; color: #bae6fd; }
  </style>
</head>
<body>
  <h1>📝 LUMI Patch Mutation & Staged Files Ledger</h1>
  <p style="color: #94a3b8;">Transactional File Staging & Unified Diff Resolver (Phase 77 / ADR-029)</p>
  
  <div class="grid">
    <div class="card"><div>Active Staged</div><div class="metric-val">${metrics.totalStaged}</div></div>
    <div class="card"><div>Total Committed</div><div class="metric-val" style="color:#10b981;">${metrics.totalCommitted}</div></div>
    <div class="card"><div>Total Reverted</div><div class="metric-val" style="color:#f43f5e;">${metrics.totalReverted}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Currently Staged Mutations</h2>
  <table>
    <thead><tr><th>File Path</th><th>Status</th><th>Staged Size</th><th>Timestamp</th></tr></thead>
    <tbody>
      ${entries.map((e) => `<tr><td><code>${e.path}</code></td><td><span class="badge">${e.status.toUpperCase()}</span></td><td>${e.stagedContent ? e.stagedContent.length : 0} bytes</td><td>${new Date(e.timestamp).toISOString()}</td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const entries = this.listStaged();

    let md = `# LUMI Patch Mutation Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Staged Files:** \`${metrics.totalStaged}\` | **Committed:** \`${metrics.totalCommitted}\` | **Reverted:** \`${metrics.totalReverted}\`\n\n`;
    md += `## Staged Entries (${entries.length})\n\n`;
    md += `| File Path | Status | Staged Size | Timestamp |\n`;
    md += `|---|---|---|---|\n`;
    for (const e of entries) {
      md += `| \`${e.path}\` | ${e.status.toUpperCase()} | ${e.stagedContent ? e.stagedContent.length : 0} bytes | ${e.timestamp} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "path,status,previousLength,stagedLength,timestamp\n";
    const rows = Array.from(this.staged.values()).map((e) => {
      const prevLen = e.previousContent ? e.previousContent.length : 0;
      const stgLen = e.stagedContent ? e.stagedContent.length : 0;
      return `"${e.path}","${e.status}",${prevLen},${stgLen},${e.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): FileMutationSnapshot {
    return {
      stagedFiles: Array.from(this.staged.values()).map((e) => ({ ...e })),
      totalStaged: this.staged.size,
      timestamp: Date.now(),
    };
  }

  public captureSnapshot(): FileMutationSnapshot {
    return this.exportSnapshot();
  }

  public importSnapshot(snapshot: FileMutationSnapshot): void {
    this.staged.clear();
    for (const entry of snapshot.stagedFiles) {
      this.staged.set(entry.path, { ...entry });
    }
  }

  public restoreSnapshot(snapshot: FileMutationSnapshot): void {
    this.importSnapshot(snapshot);
  }

  public clear(): void {
    this.staged.clear();
    this.history.length = 0;
    this.totalStagedCount = 0;
    this.totalCommittedCount = 0;
    this.totalRevertedCount = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
