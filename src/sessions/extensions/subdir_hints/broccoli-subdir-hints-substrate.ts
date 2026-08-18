/**
 * broccoli-subdir-hints-substrate.ts
 *
 * In-memory zero-GC Broccolidb repository storing discovered hints, loaded directory sets,
 * SHA-256 digest sets, virtual hint files, and telemetry metrics (Phase 129 / ADR-105 / Target #84).
 */

import type {
  DiscoveredSubdirHint,
  IBroccoliSubdirectoryHintsSubstrate,
  SubdirectoryHintAuditRow,
  SubdirectoryHintRow,
  SubdirectoryHintsBulkMutationResult,
  SubdirectoryHintsConfig,
  SubdirectoryHintsDslQueryFilter,
  SubdirectoryHintsGroupBy,
  SubdirectoryHintsGroupedLane,
  SubdirectoryHintsHealthAuditReport,
  SubdirectoryHintsHealthStatus,
  SubdirectoryHintsMetrics,
  SubdirectoryHintsMetricsReport,
  SubdirectoryHintsMutationUndoRecord,
  SubdirectoryHintsSortBy,
  SubdirectoryHintsSortDirection,
  SubdirectoryHintsWorkspaceSnapshot,
} from "../../../core/contracts/subdirectory-hints.contracts.js";
import { DEFAULT_SUBDIRECTORY_HINTS_CONFIG } from "../../../core/contracts/subdirectory-hints.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliSubdirHintsSubstrate implements IBroccoliSubdirectoryHintsSubstrate {
  private config: SubdirectoryHintsConfig = { ...DEFAULT_SUBDIRECTORY_HINTS_CONFIG };
  private readonly loadedDirectories = new Set<string>();
  private readonly loadedDigests = new Set<string>();
  private readonly discoveredHints = new Map<string, DiscoveredSubdirHint>();
  private readonly virtualHints = new Map<string, { directoryPath: string; filename: string; content: string }>();
  private metrics: SubdirectoryHintsMetrics = {
    totalToolChecks: 0,
    pathsEvaluated: 0,
    hintsDiscovered: 0,
    duplicatesSkipped: 0,
    bytesInjected: 0,
  };

  private readonly undoStack: SubdirectoryHintsMutationUndoRecord[] = [];
  private readonly redoStack: SubdirectoryHintsMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // Hybrid BroccoliDB Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private hintsTable?: IDbTable<SubdirectoryHintRow>;
  private auditsTable?: IDbTable<SubdirectoryHintAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.hintsTable = dbKernel.getTable<SubdirectoryHintRow>("subdir_hints");
      this.auditsTable = dbKernel.getTable<SubdirectoryHintAuditRow>("subdir_hint_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  public setConfig(config: Partial<SubdirectoryHintsConfig>): void {
    const prev = this.exportSnapshot();
    this.config = { ...this.config, ...config };
    this.pushUndoRecord("config_change", prev);
  }

  public getConfig(): SubdirectoryHintsConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: SubdirectoryHintsMutationUndoRecord["mutationType"], prev: SubdirectoryHintsWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliSubdirHintsSubstrate.MAX_UNDO_STACK) {
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
  // Loaded Directories & Digests
  // ---------------------------------------------------------------------------

  public hasDirectory(dirPath: string): boolean {
    return this.loadedDirectories.has(dirPath);
  }

  public isDirectoryLoaded(dirPath: string): boolean {
    return this.loadedDirectories.has(dirPath);
  }

  public addLoadedDirectory(dirPath: string): void {
    this.loadedDirectories.add(dirPath);
  }

  public markDirectoryLoaded(dirPath: string): void {
    this.loadedDirectories.add(dirPath);
  }

  public getLoadedDirectories(): readonly string[] {
    return Array.from(this.loadedDirectories);
  }

  public hasDigest(digest: string): boolean {
    return this.loadedDigests.has(digest);
  }

  public isDigestLoaded(digest: string): boolean {
    return this.loadedDigests.has(digest);
  }

  public markDigestLoaded(digest: string): void {
    this.loadedDigests.add(digest);
  }

  // ---------------------------------------------------------------------------
  // Discovered Hints Management
  // ---------------------------------------------------------------------------

  public addDiscoveredHint(hint: DiscoveredSubdirHint): void {
    const prev = this.exportSnapshot();
    const key = `${hint.directoryPath}:${hint.filename}`;
    this.discoveredHints.set(key, { ...hint });
    this.loadedDigests.add(hint.contentDigest);
    this.metrics = {
      ...this.metrics,
      hintsDiscovered: this.metrics.hintsDiscovered + 1,
      bytesInjected: this.metrics.bytesInjected + hint.charCount,
    };

    if (this.hintsTable) {
      this.hintsTable.put(key, {
        hintKey: key,
        directoryPath: hint.directoryPath,
        relativeDirectory: hint.relativeDirectory,
        filename: hint.filename,
        contentPreview: hint.content.slice(0, 100),
        contentDigest: hint.contentDigest,
        charCount: hint.charCount,
        discoveredAt: hint.discoveredAt,
      });
    }

    this.pushUndoRecord("add_hint", prev);
  }

  public getDiscoveredHints(): readonly DiscoveredSubdirHint[] {
    return Array.from(this.discoveredHints.values()).map((h) => ({ ...h }));
  }

  // ---------------------------------------------------------------------------
  // Virtual Hints Management
  // ---------------------------------------------------------------------------

  public registerVirtualHint(directoryPath: string, filename: string, content: string): void {
    const prev = this.exportSnapshot();
    const key = `${directoryPath}:${filename}`;
    this.virtualHints.set(key, { directoryPath, filename, content });
    this.pushUndoRecord("add_virtual_hint", prev);
  }

  public getVirtualHint(directoryPath: string, filename: string): { directoryPath: string; filename: string; content: string } | undefined {
    const key = `${directoryPath}:${filename}`;
    return this.virtualHints.get(key);
  }

  public getVirtualHints(): ReadonlyArray<{ directoryPath: string; filename: string; content: string }> {
    return Array.from(this.virtualHints.values()).map((v) => ({ ...v }));
  }

  public getVirtualHintsForDirectory(directoryPath: string): Array<{ filename: string; content: string }> {
    const results: Array<{ filename: string; content: string }> = [];
    for (const [key, v] of this.virtualHints.entries()) {
      if (key.startsWith(`${directoryPath}:`)) {
        results.push({ filename: v.filename, content: v.content });
      }
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Telemetry & Metrics
  // ---------------------------------------------------------------------------

  public recordCheck(pathsCount: number): void {
    this.metrics = {
      ...this.metrics,
      totalToolChecks: this.metrics.totalToolChecks + 1,
      pathsEvaluated: this.metrics.pathsEvaluated + pathsCount,
    };
  }

  public recordDuplicateSkipped(): void {
    this.metrics = {
      ...this.metrics,
      duplicatesSkipped: this.metrics.duplicatesSkipped + 1,
    };
  }

  public getMetrics(): SubdirectoryHintsMetrics {
    return { ...this.metrics };
  }

  public getMetricsReport(): SubdirectoryHintsMetricsReport {
    const hintsByFilename: Record<string, number> = {};
    const hintsByDirectory: Record<string, number> = {};

    for (const h of this.discoveredHints.values()) {
      hintsByFilename[h.filename] = (hintsByFilename[h.filename] || 0) + 1;
      hintsByDirectory[h.relativeDirectory || "."] = (hintsByDirectory[h.relativeDirectory || "."] || 0) + 1;
    }

    return {
      ...this.getMetrics(),
      hintsByFilename,
      hintsByDirectory,
    };
  }

  public auditHealth(): SubdirectoryHintsHealthAuditReport {
    const totalHints = this.discoveredHints.size;
    const totalBytes = this.metrics.bytesInjected;
    const maxChars = this.config.maxHintChars;
    const utilPercent = maxChars > 0 ? Number(((totalBytes / maxChars) * 100).toFixed(1)) : 0;

    let healthStatus: SubdirectoryHintsHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (utilPercent > 90) {
      healthStatus = "critical";
      recommendations.push("Subdirectory hint byte budget almost exhausted (> 90%). Increase maxHintChars.");
    } else if (utilPercent > 70) {
      healthStatus = "degraded";
      recommendations.push("High hint budget utilization (> 70%).");
    }

    if (this.metrics.duplicatesSkipped > 100) {
      recommendations.push("High deduplication rate indicates repeated access to known directory trees.");
    }

    return {
      totalHints,
      totalLoadedDirectories: this.loadedDirectories.size,
      totalVirtualHints: this.virtualHints.size,
      totalBytesInjected: totalBytes,
      maxCharsAllowed: maxChars,
      budgetUtilizationPercent: utilPercent,
      healthStatus,
      recommendations,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedHints(
    groupBy: SubdirectoryHintsGroupBy = "directory",
    sortBy: SubdirectoryHintsSortBy = "filename",
    direction: SubdirectoryHintsSortDirection = "asc"
  ): readonly SubdirectoryHintsGroupedLane[] {
    const lanes = new Map<string, SubdirectoryHintRow[]>();
    const allRows: SubdirectoryHintRow[] = Array.from(this.discoveredHints.values()).map((h) => ({
      hintKey: `${h.directoryPath}:${h.filename}`,
      directoryPath: h.directoryPath,
      relativeDirectory: h.relativeDirectory,
      filename: h.filename,
      contentPreview: h.content.slice(0, 100),
      contentDigest: h.contentDigest,
      charCount: h.charCount,
      discoveredAt: h.discoveredAt,
    }));

    for (const hint of allRows) {
      let key = "default";
      if (groupBy === "directory") key = hint.relativeDirectory || ".";
      else if (groupBy === "filename") key = hint.filename;

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(hint);
    }

    const result: SubdirectoryHintsGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "filename") cmp = a.filename.localeCompare(b.filename);
        else if (sortBy === "charCount") cmp = a.charCount - b.charCount;
        else if (sortBy === "discoveredAt") cmp = a.discoveredAt - b.discoveredAt;
        return direction === "asc" ? cmp : -cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        hints: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryHintsDsl(query: SubdirectoryHintsDslQueryFilter | string): readonly SubdirectoryHintRow[] {
    const parsed: SubdirectoryHintsDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const allRows: SubdirectoryHintRow[] = Array.from(this.discoveredHints.values()).map((h) => ({
      hintKey: `${h.directoryPath}:${h.filename}`,
      directoryPath: h.directoryPath,
      relativeDirectory: h.relativeDirectory,
      filename: h.filename,
      contentPreview: h.content.slice(0, 100),
      contentDigest: h.contentDigest,
      charCount: h.charCount,
      discoveredAt: h.discoveredAt,
    }));

    return allRows.filter((hint) => {
      if (parsed.directory && !hint.directoryPath.toLowerCase().includes(parsed.directory.toLowerCase()) && !hint.relativeDirectory.toLowerCase().includes(parsed.directory.toLowerCase())) return false;
      if (parsed.filename && !hint.filename.toLowerCase().includes(parsed.filename.toLowerCase())) return false;
      if (parsed.minChars !== undefined && hint.charCount < parsed.minChars) return false;
      if (parsed.maxChars !== undefined && hint.charCount > parsed.maxChars) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${hint.directoryPath} ${hint.relativeDirectory} ${hint.filename} ${hint.contentPreview}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): SubdirectoryHintsDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let directory: string | undefined;
    let filename: string | undefined;
    let minChars: number | undefined;
    let maxChars: number | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("dir:") || tok.startsWith("directory:")) {
        directory = tok.split(":")[1];
      } else if (tok.startsWith("file:") || tok.startsWith("filename:")) {
        filename = tok.split(":")[1];
      } else if (tok.startsWith("minChars:")) {
        minChars = parseInt(tok.split(":")[1], 10);
      } else if (tok.startsWith("maxChars:")) {
        maxChars = parseInt(tok.split(":")[1], 10);
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      directory,
      filename,
      minChars,
      maxChars,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeHints(hintKeys: readonly string[]): SubdirectoryHintsBulkMutationResult {
    const prev = this.exportSnapshot();
    let modified = 0;

    for (const key of hintKeys) {
      if (this.discoveredHints.has(key)) {
        const hint = this.discoveredHints.get(key)!;
        this.discoveredHints.delete(key);
        this.loadedDigests.delete(hint.contentDigest);
        if (this.hintsTable) this.hintsTable.delete(key);
        modified++;
      }
    }

    this.pushUndoRecord("clear", prev);
    return {
      matchedCount: hintKeys.length,
      modifiedCount: modified,
      affectedHintKeys: hintKeys,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const hints = this.getDiscoveredHints();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Subdirectory Hints Dashboard</title>
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
  <h1>📁 LUMI Subdirectory Context Hints</h1>
  <p style="color: #94a3b8;">Hierarchical Workspace Rules & Dynamic Instructions (Phase 129 / ADR-105)</p>
  
  <div class="grid">
    <div class="card"><div>Discovered Hints</div><div class="metric-val">${health.totalHints}</div></div>
    <div class="card"><div>Loaded Directories</div><div class="metric-val" style="color:#10b981;">${health.totalLoadedDirectories}</div></div>
    <div class="card"><div>Injected Bytes</div><div class="metric-val" style="color:#a855f7;">${metrics.bytesInjected} B</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Discovered Rule Ledger</h2>
  <table>
    <thead><tr><th>Filename</th><th>Directory</th><th>Chars</th><th>Digest</th></tr></thead>
    <tbody>
      ${hints.map((h) => `<tr><td><code>${h.filename}</code></td><td>${h.relativeDirectory || '.'}</td><td>${h.charCount}</td><td><code>${h.contentDigest.slice(0, 10)}...</code></td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const hints = this.getDiscoveredHints();

    let md = `# LUMI Subdirectory Hints Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Total Hints:** \`${health.totalHints}\` | **Loaded Dirs:** \`${health.totalLoadedDirectories}\` | **Bytes Injected:** \`${metrics.bytesInjected} B\`\n\n`;
    md += `## Discovered Rules Ledger (${hints.length})\n\n`;
    md += `| Filename | Directory | Chars | Digest |\n`;
    md += `|---|---|---|---|\n`;
    for (const h of hints) {
      md += `| \`${h.filename}\` | \`${h.relativeDirectory || "."}\` | ${h.charCount} | \`${h.contentDigest.slice(0, 12)}\` |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "filename,relativeDirectory,directoryPath,charCount,contentDigest\n";
    const rows = Array.from(this.discoveredHints.values()).map((h) => {
      return `"${h.filename}","${h.relativeDirectory || '.'}","${h.directoryPath}",${h.charCount},"${h.contentDigest}"`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): SubdirectoryHintsWorkspaceSnapshot {
    return {
      snapshotId: `snap-${Date.now()}`,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
      loadedDirectories: Array.from(this.loadedDirectories),
      loadedDigests: Array.from(this.loadedDigests),
      discoveredHints: this.getDiscoveredHints(),
      virtualHints: Array.from(this.virtualHints.values()).map((v) => ({ ...v })),
    };
  }

  public importSnapshot(snapshot: SubdirectoryHintsWorkspaceSnapshot): void {
    if (snapshot.config) this.config = { ...snapshot.config };
    if (snapshot.metrics) this.metrics = { ...snapshot.metrics };
    this.loadedDirectories.clear();
    for (const d of snapshot.loadedDirectories) this.loadedDirectories.add(d);
    this.loadedDigests.clear();
    for (const dig of snapshot.loadedDigests) this.loadedDigests.add(dig);

    this.discoveredHints.clear();
    for (const hint of snapshot.discoveredHints) {
      this.discoveredHints.set(`${hint.directoryPath}:${hint.filename}`, hint);
    }

    this.virtualHints.clear();
    for (const v of snapshot.virtualHints) {
      this.virtualHints.set(`${v.directoryPath}:${v.filename}`, v);
    }
  }

  public createSnapshot(snapshotId: string): SubdirectoryHintsWorkspaceSnapshot {
    return {
      ...this.exportSnapshot(),
      snapshotId,
    };
  }

  public restoreSnapshot(snapshot: SubdirectoryHintsWorkspaceSnapshot): void {
    this.importSnapshot(snapshot);
  }

  public clear(): void {
    this.config = { ...DEFAULT_SUBDIRECTORY_HINTS_CONFIG };
    this.loadedDirectories.clear();
    this.loadedDigests.clear();
    this.discoveredHints.clear();
    this.virtualHints.clear();
    this.metrics = {
      totalToolChecks: 0,
      pathsEvaluated: 0,
      hintsDiscovered: 0,
      duplicatesSkipped: 0,
      bytesInjected: 0,
    };
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
