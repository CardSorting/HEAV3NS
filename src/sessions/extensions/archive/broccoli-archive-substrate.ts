/**
 * broccoli-archive-substrate.ts
 *
 * In-memory zero-GC Broccolidb repository for session export documents and archive manifests
 * (Phase 99 / ADR-053 / Target #70).
 */

import type {
  ArchiveAuditRow,
  ArchiveManifestRow,
  ArchiveWorkspaceSnapshot,
  ExportedDocumentResult,
  ExportedDocumentRow,
  IBroccoliArchiveSubstrate,
  SessionArchiveBulkMutationResult,
  SessionArchiveDslQueryFilter,
  SessionArchiveGroupBy,
  SessionArchiveGroupedLane,
  SessionArchiveHealthAuditReport,
  SessionArchiveHealthStatus,
  SessionArchiveManifest,
  SessionArchiveMetricsReport,
  SessionArchiveMutationUndoRecord,
  SessionArchiveSortBy,
  SessionArchiveSortDirection,
  SessionExportFormat,
} from "../../../core/contracts/session-archive.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliArchiveSubstrate implements IBroccoliArchiveSubstrate {
  private documents = new Map<string, ExportedDocumentResult>();
  private manifests = new Map<string, SessionArchiveManifest>();
  private readonly auditLogs: ArchiveAuditRow[] = [];

  private readonly undoStack: SessionArchiveMutationUndoRecord[] = [];
  private readonly redoStack: SessionArchiveMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private manifestsTable?: IDbTable<ArchiveManifestRow>;
  private documentsTable?: IDbTable<ExportedDocumentRow>;
  private auditsTable?: IDbTable<ArchiveAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.manifestsTable = dbKernel.getTable<ArchiveManifestRow>("session_archives");
      this.documentsTable = dbKernel.getTable<ExportedDocumentRow>("exported_documents");
      this.auditsTable = dbKernel.getTable<ArchiveAuditRow>("archive_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: SessionArchiveMutationUndoRecord["mutationType"], prev: ArchiveWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliArchiveSubstrate.MAX_UNDO_STACK) {
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
    this.recordAuditRow("system", "undo", "system", `Reverted ${record.mutationType}`);
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
    this.recordAuditRow("system", "redo", "system", `Reapplied ${record.mutationType}`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Session Archive Operations
  // ---------------------------------------------------------------------------

  public recordArchive(
    manifestOrDoc: SessionArchiveManifest | ExportedDocumentResult,
    documentOrSessionId?: ExportedDocumentResult | string,
    turnCount?: number
  ): SessionArchiveManifest {
    const prev = this.exportSnapshot();
    let manifest: SessionArchiveManifest;

    if ("turnCount" in manifestOrDoc && typeof (manifestOrDoc as any).turnCount === "number") {
      // Direct manifest passed
      manifest = manifestOrDoc as SessionArchiveManifest;
      if (documentOrSessionId && typeof documentOrSessionId === "object") {
        this.documents.set(manifest.archiveId, documentOrSessionId as ExportedDocumentResult);
      }
    } else {
      // Legacy signature: recordArchive(document, sessionId, turnCount)
      const doc = manifestOrDoc as ExportedDocumentResult;
      const sessionId = typeof documentOrSessionId === "string" ? documentOrSessionId : "unknown-session";
      const turns = typeof turnCount === "number" ? turnCount : 1;

      manifest = {
        archiveId: doc.archiveId,
        sessionId,
        format: doc.format,
        turnCount: turns,
        totalSizeBytes: doc.sizeBytes,
        sha256Checksum: doc.sha256Checksum,
        createdAt: Date.now(),
      };
      this.documents.set(doc.archiveId, doc);
    }

    this.manifests.set(manifest.archiveId, manifest);

    if (this.manifestsTable) {
      this.manifestsTable.put(manifest.archiveId, {
        id: manifest.archiveId,
        archiveId: manifest.archiveId,
        sessionId: manifest.sessionId,
        format: manifest.format,
        turnCount: manifest.turnCount,
        totalSizeBytes: manifest.totalSizeBytes,
        sha256Checksum: manifest.sha256Checksum,
        createdAt: manifest.createdAt,
      });
    }

    this.pushUndoRecord("record_archive", prev);
    this.recordAuditRow(manifest.archiveId, "record_archive", "system", `Format: ${manifest.format}, Session: ${manifest.sessionId}`);
    return manifest;
  }

  public getArchive(archiveId: string): ExportedDocumentResult | undefined {
    return this.documents.get(archiveId);
  }

  public getDocument(archiveId: string): ExportedDocumentResult | undefined {
    return this.documents.get(archiveId);
  }

  public getManifest(archiveId: string): SessionArchiveManifest | undefined {
    return this.manifests.get(archiveId);
  }

  public listManifests(): readonly SessionArchiveManifest[] {
    return Array.from(this.manifests.values());
  }

  public getAllManifests(): readonly SessionArchiveManifest[] {
    return this.listManifests();
  }

  public listBySession(sessionId: string): readonly SessionArchiveManifest[] {
    return Array.from(this.manifests.values()).filter((m) => m.sessionId === sessionId);
  }

  public getManifestsForSession(sessionId: string): readonly SessionArchiveManifest[] {
    return this.listBySession(sessionId);
  }

  public purgeArchive(archiveId: string): boolean {
    const exists = this.manifests.has(archiveId);
    if (!exists) return false;

    const prev = this.exportSnapshot();
    this.documents.delete(archiveId);
    this.manifests.delete(archiveId);

    if (this.manifestsTable) {
      this.manifestsTable.delete(archiveId);
    }
    if (this.documentsTable) {
      this.documentsTable.delete(archiveId);
    }

    this.pushUndoRecord("purge_archive", prev);
    this.recordAuditRow(archiveId, "purge_archive", "system", `Deleted archive ${archiveId}`);
    return true;
  }

  public deleteArchive(archiveId: string): boolean {
    return this.purgeArchive(archiveId);
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): SessionArchiveHealthAuditReport {
    const all = Array.from(this.manifests.values());
    const totalSizeBytes = all.reduce((acc, m) => acc + m.totalSizeBytes, 0);
    const formatsDistribution: Record<SessionExportFormat, number> = {
      markdown: 0,
      html: 0,
      jsonl: 0,
      binary_archive: 0,
    };

    for (const m of all) {
      if (formatsDistribution[m.format] !== undefined) {
        formatsDistribution[m.format]++;
      }
    }

    let healthStatus: SessionArchiveHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (totalSizeBytes > 100 * 1024 * 1024) {
      healthStatus = "degraded";
      recommendations.push("Archive vault storage footprint exceeds 100MB. Consider pruning legacy exports.");
    }

    if (all.length === 0) {
      healthStatus = "healthy";
      recommendations.push("No session archives recorded. Use `archive_export_markdown` or `archive_export_html` to create exports.");
    }

    return {
      totalArchivesCount: all.length,
      totalSizeBytes,
      formatsDistribution,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): SessionArchiveMetricsReport {
    const all = Array.from(this.manifests.values());
    const totalSizeBytes = all.reduce((acc, m) => acc + m.totalSizeBytes, 0);
    const totalTurns = all.reduce((acc, m) => acc + m.turnCount, 0);
    const formatBreakdown: Record<SessionExportFormat, number> = {
      markdown: 0,
      html: 0,
      jsonl: 0,
      binary_archive: 0,
    };

    for (const m of all) {
      if (formatBreakdown[m.format] !== undefined) {
        formatBreakdown[m.format]++;
      }
    }

    return {
      totalExportsAttempted: all.length,
      totalBytesArchived: totalSizeBytes,
      totalTurnsExported: totalTurns,
      averageExportSizeBytes: all.length > 0 ? Math.round(totalSizeBytes / all.length) : 0,
      formatBreakdown,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedArchives(
    groupBy: SessionArchiveGroupBy = "format",
    sortBy: SessionArchiveSortBy = "createdAt",
    direction: SessionArchiveSortDirection = "desc"
  ): readonly SessionArchiveGroupedLane[] {
    const lanes = new Map<string, SessionArchiveManifest[]>();

    for (const m of this.manifests.values()) {
      let key = "default";
      switch (groupBy) {
        case "format":
          key = m.format;
          break;
        case "session":
          key = m.sessionId;
          break;
        case "size_tier":
          key = m.totalSizeBytes < 1024 ? "Small (<1KB)" : m.totalSizeBytes < 50000 ? "Medium (<50KB)" : "Large (>50KB)";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(m);
    }

    const result: SessionArchiveGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "createdAt") cmp = b.createdAt - a.createdAt;
        else if (sortBy === "totalSizeBytes") cmp = b.totalSizeBytes - a.totalSizeBytes;
        else if (sortBy === "turnCount") cmp = b.turnCount - a.turnCount;
        return direction === "asc" ? -cmp : cmp;
      });

      const totalSizeBytes = items.reduce((acc, i) => acc + i.totalSizeBytes, 0);

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        totalSizeBytes,
        manifests: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryArchivesDsl(query: SessionArchiveDslQueryFilter | string): readonly SessionArchiveManifest[] {
    const parsed: SessionArchiveDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;

    return Array.from(this.manifests.values()).filter((m) => {
      if (parsed.format && m.format !== parsed.format) return false;
      if (parsed.sessionId && m.sessionId !== parsed.sessionId) return false;
      if (parsed.minTurns !== undefined && m.turnCount < parsed.minTurns) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${m.archiveId} ${m.sessionId} ${m.format} ${m.sha256Checksum}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): SessionArchiveDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let format: SessionExportFormat | undefined;
    let sessionId: string | undefined;
    let minTurns: number | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("format:")) {
        format = tok.slice(7) as SessionExportFormat;
      } else if (tok.startsWith("session:")) {
        sessionId = tok.slice(8);
      } else if (tok.startsWith("min_turns:")) {
        minTurns = Number(tok.slice(10));
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      format,
      sessionId,
      minTurns,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeArchives(archiveIds: readonly string[]): SessionArchiveBulkMutationResult {
    const prev = this.exportSnapshot();
    const toPurge = new Set(archiveIds);
    let modified = 0;

    for (const id of toPurge) {
      if (this.manifests.has(id)) {
        this.manifests.delete(id);
        this.documents.delete(id);
        modified++;
      }
    }

    this.pushUndoRecord("bulk_purge", prev);
    return {
      matchedCount: archiveIds.length,
      modifiedCount: modified,
      affectedArchiveIds: archiveIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const manifests = Array.from(this.manifests.values());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Session Archive & Cold Storage Vault</title>
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
  <h1>📦 LUMI Session Archive & Cold Storage Vault</h1>
  <p style="color: #94a3b8;">Multi-Format Session Export, Fast Tiering & SHA-256 Verified Storage (Phase 99 / Target #70)</p>
  
  <div class="grid">
    <div class="card"><div>Total Archives</div><div class="metric-val">${metrics.totalExportsAttempted}</div></div>
    <div class="card"><div>Total Turns</div><div class="metric-val" style="color:#10b981;">${metrics.totalTurnsExported}</div></div>
    <div class="card"><div>Bytes Archived</div><div class="metric-val" style="color:#8b5cf6;">${(metrics.totalBytesArchived / 1024).toFixed(1)} KB</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Archived Session Manifests</h2>
  <table>
    <thead>
      <tr>
        <th>Archive ID</th>
        <th>Session</th>
        <th>Format</th>
        <th>Turns</th>
        <th>Size</th>
        <th>SHA-256</th>
      </tr>
    </thead>
    <tbody>
      ${manifests.map((m) => `
        <tr>
          <td><code>${m.archiveId}</code></td>
          <td><strong>${m.sessionId}</strong></td>
          <td><span class="badge">${m.format.toUpperCase()}</span></td>
          <td>${m.turnCount}</td>
          <td>${m.totalSizeBytes} B</td>
          <td><code>${m.sha256Checksum.slice(0, 12)}...</code></td>
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
    const manifests = Array.from(this.manifests.values());

    let md = `# LUMI Session Archive & Cold Storage Report\n\n`;
    md += `**Health Posture:** \`${health.healthStatus.toUpperCase()}\` | **Total Archives:** \`${metrics.totalExportsAttempted}\` | **Total Bytes:** \`${metrics.totalBytesArchived} B\`\n\n`;
    md += `## Format Distribution\n`;
    md += `- **Markdown:** ${metrics.formatBreakdown.markdown}\n`;
    md += `- **HTML:** ${metrics.formatBreakdown.html}\n`;
    md += `- **JSONL:** ${metrics.formatBreakdown.jsonl}\n`;
    md += `- **Binary:** ${metrics.formatBreakdown.binary_archive}\n\n`;

    md += `## Archived Manifests (${manifests.length})\n\n`;
    md += `| Archive ID | Session | Format | Turns | Size | SHA-256 |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const m of manifests) {
      md += `| \`${m.archiveId}\` | \`${m.sessionId}\` | ${m.format.toUpperCase()} | ${m.turnCount} | ${m.totalSizeBytes} B | \`${m.sha256Checksum.slice(0, 12)}...\` |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "archiveId,sessionId,format,turnCount,totalSizeBytes,sha256Checksum,createdAt\n";
    const rows = Array.from(this.manifests.values()).map((m) => {
      return `"${m.archiveId}","${m.sessionId}","${m.format}",${m.turnCount},${m.totalSizeBytes},"${m.sha256Checksum}",${m.createdAt}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Audits
  // ---------------------------------------------------------------------------

  public exportSnapshot(): ArchiveWorkspaceSnapshot {
    return {
      totalArchives: this.manifests.size,
      activeManifests: Array.from(this.manifests.values()),
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: ArchiveWorkspaceSnapshot): void {
    this.manifests.clear();
    for (const manifest of snapshot.activeManifests) {
      this.manifests.set(manifest.archiveId, manifest);
    }
  }

  private recordAuditRow(archiveId: string, action: string, operator: string, details: string): void {
    const row: ArchiveAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: `${action}:${archiveId}`,
      operator,
      details,
      timestamp: Date.now(),
    };
    this.auditLogs.unshift(row as any);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
    if (this.auditsTable) {
      this.auditsTable.put(row.id, row);
    }
  }

  public clear(): void {
    this.documents.clear();
    this.manifests.clear();
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
