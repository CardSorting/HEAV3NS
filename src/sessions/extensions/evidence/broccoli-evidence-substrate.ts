/**
 * broccoli-evidence-substrate.ts
 *
 * In-memory zero-GC Broccolidb repository for verification evidence records,
 * stop-gate evaluations, and modified file ledgers (Phase 92 / ADR-044 / Target #73).
 */

import type {
  EvidenceAuditRow,
  EvidenceKind,
  EvidenceScope,
  IBroccoliEvidenceSubstrate,
  VerificationEvidenceBulkMutationResult,
  VerificationEvidenceDslQueryFilter,
  VerificationEvidenceGroupBy,
  VerificationEvidenceGroupedLane,
  VerificationEvidenceHealthAuditReport,
  VerificationEvidenceHealthStatus,
  VerificationEvidenceMetricsReport,
  VerificationEvidenceMutationUndoRecord,
  VerificationEvidenceRecord,
  VerificationEvidenceRow,
  VerificationEvidenceSortBy,
  VerificationEvidenceSortDirection,
  VerificationEvidenceWorkspaceSnapshot,
} from "../../../core/contracts/verification-evidence.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliEvidenceSubstrate implements IBroccoliEvidenceSubstrate {
  private records: VerificationEvidenceRecord[] = [];
  private readonly recordsById = new Map<string, VerificationEvidenceRecord>();
  private readonly modifiedFiles = new Set<string>();
  private readonly auditLogs: EvidenceAuditRow[] = [];

  private readonly undoStack: VerificationEvidenceMutationUndoRecord[] = [];
  private readonly redoStack: VerificationEvidenceMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private evidenceTable?: IDbTable<VerificationEvidenceRow>;
  private auditsTable?: IDbTable<EvidenceAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.evidenceTable = dbKernel.getTable<VerificationEvidenceRow>("verification_evidence");
      this.auditsTable = dbKernel.getTable<EvidenceAuditRow>("evidence_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: VerificationEvidenceMutationUndoRecord["mutationType"], prev: VerificationEvidenceWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliEvidenceSubstrate.MAX_UNDO_STACK) {
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
  // Verification Evidence Operations
  // ---------------------------------------------------------------------------

  public recordEvidence(evidence: VerificationEvidenceRecord): void {
    const prev = this.exportSnapshot();
    this.records.push(evidence);
    this.recordsById.set(evidence.id, evidence);

    if (this.evidenceTable) {
      this.evidenceTable.put(evidence.id, {
        id: evidence.id,
        frameIndex: evidence.frameIndex,
        command: evidence.command,
        kind: evidence.kind,
        scope: evidence.scope,
        passed: evidence.passed,
        exitCode: evidence.exitCode,
        durationMs: evidence.durationMs,
        outputSummary: evidence.outputSummary,
        verifiedPathsJson: JSON.stringify(evidence.verifiedPaths),
        timestamp: evidence.timestamp,
      });
    }

    this.pushUndoRecord("record_evidence", prev);
  }

  public addRecord(record: VerificationEvidenceRecord): void {
    this.recordEvidence(record);
  }

  public getEvidence(id: string): VerificationEvidenceRecord | undefined {
    return this.recordsById.get(id);
  }

  public listEvidence(): readonly VerificationEvidenceRecord[] {
    return [...this.records];
  }

  public getRecords(): readonly VerificationEvidenceRecord[] {
    return this.listEvidence();
  }

  public getLatestEvidence(): VerificationEvidenceRecord | undefined {
    if (this.records.length === 0) return undefined;
    return this.records[this.records.length - 1];
  }

  public deleteEvidence(id: string): boolean {
    const exists = this.recordsById.has(id);
    if (!exists) return false;

    const prev = this.exportSnapshot();
    this.recordsById.delete(id);
    this.records = this.records.filter((r) => r.id !== id);

    if (this.evidenceTable) {
      this.evidenceTable.delete(id);
    }

    this.pushUndoRecord("bulk_purge", prev);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Modified Code File Tracking
  // ---------------------------------------------------------------------------

  public trackModifiedFile(filePath: string): void {
    const prev = this.exportSnapshot();
    this.modifiedFiles.add(filePath);
    this.pushUndoRecord("track_file", prev);
  }

  public addModifiedFile(filePath: string): void {
    this.trackModifiedFile(filePath);
  }

  public getModifiedFiles(): readonly string[] {
    return Array.from(this.modifiedFiles);
  }

  public clearModifiedFiles(): void {
    const prev = this.exportSnapshot();
    this.modifiedFiles.clear();
    this.pushUndoRecord("clear", prev);
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): VerificationEvidenceHealthAuditReport {
    const total = this.records.length;
    const passed = this.records.filter((r) => r.passed).length;
    const failed = total - passed;
    const passRate = total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 100;
    const unverified = this.modifiedFiles.size;

    let healthStatus: VerificationEvidenceHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (unverified > 0) {
      healthStatus = "degraded";
      recommendations.push(`${unverified} modified code files pending verification runs before turn completion.`);
    }

    if (failed > 0 && failed > passed) {
      healthStatus = "critical";
      recommendations.push("More than 50% of recent verification runs failed.");
    }

    if (total === 0 && unverified === 0) {
      healthStatus = "healthy";
      recommendations.push("No evidence records logged yet. Run tests or build tasks to record evidence.");
    }

    return {
      totalEvidenceCount: total,
      passedCount: passed,
      failedCount: failed,
      passRatePercent: passRate,
      unverifiedFilesCount: unverified,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): VerificationEvidenceMetricsReport {
    const total = this.records.length;
    const passed = this.records.filter((r) => r.passed).length;
    const failed = total - passed;
    const passRate = total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 100;
    const totalDuration = this.records.reduce((acc, r) => acc + r.durationMs, 0);

    const evidenceByKind: Record<EvidenceKind, number> = {
      test: 0,
      build: 0,
      typecheck: 0,
      lint: 0,
      manual: 0,
    };

    for (const r of this.records) {
      if (evidenceByKind[r.kind] !== undefined) {
        evidenceByKind[r.kind]++;
      }
    }

    return {
      totalEvidenceCount: total,
      passedEvidenceCount: passed,
      failedEvidenceCount: failed,
      passRatePercent: passRate,
      totalUnverifiedFiles: this.modifiedFiles.size,
      averageDurationMs: total > 0 ? Math.round(totalDuration / total) : 0,
      evidenceByKind,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedEvidence(
    groupBy: VerificationEvidenceGroupBy = "kind",
    sortBy: VerificationEvidenceSortBy = "timestamp",
    direction: VerificationEvidenceSortDirection = "desc"
  ): readonly VerificationEvidenceGroupedLane[] {
    const lanes = new Map<string, VerificationEvidenceRecord[]>();

    for (const r of this.records) {
      let key = "default";
      switch (groupBy) {
        case "kind":
          key = r.kind;
          break;
        case "scope":
          key = r.scope;
          break;
        case "status":
          key = r.passed ? "passed" : "failed";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(r);
    }

    const result: VerificationEvidenceGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = b.timestamp - a.timestamp;
        else if (sortBy === "durationMs") cmp = b.durationMs - a.durationMs;
        else if (sortBy === "frameIndex") cmp = b.frameIndex - a.frameIndex;
        return direction === "asc" ? -cmp : cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        records: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryEvidenceDsl(query: VerificationEvidenceDslQueryFilter | string): readonly VerificationEvidenceRecord[] {
    const parsed: VerificationEvidenceDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;

    return this.records.filter((r) => {
      if (parsed.kind && r.kind !== parsed.kind) return false;
      if (parsed.scope && r.scope !== parsed.scope) return false;
      if (parsed.passed !== undefined && r.passed !== parsed.passed) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${r.id} ${r.command} ${r.kind} ${r.scope} ${r.outputSummary}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): VerificationEvidenceDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let kind: EvidenceKind | undefined;
    let scope: EvidenceScope | undefined;
    let passed: boolean | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("kind:")) {
        kind = tok.slice(5) as EvidenceKind;
      } else if (tok.startsWith("scope:")) {
        scope = tok.slice(6) as EvidenceScope;
      } else if (tok.startsWith("passed:")) {
        passed = tok.slice(7).toLowerCase() === "true";
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      kind,
      scope,
      passed,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeEvidence(evidenceIds: readonly string[]): VerificationEvidenceBulkMutationResult {
    const prev = this.exportSnapshot();
    const toPurge = new Set(evidenceIds);
    let modified = 0;

    for (const id of toPurge) {
      if (this.recordsById.has(id)) {
        this.recordsById.delete(id);
        modified++;
      }
    }
    this.records = this.records.filter((r) => !toPurge.has(r.id));

    this.pushUndoRecord("bulk_purge", prev);
    return {
      matchedCount: evidenceIds.length,
      modifiedCount: modified,
      affectedEvidenceIds: evidenceIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const records = this.listEvidence();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Verification Evidence & Quality Gates Ledger</title>
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
  <h1>🛡️ LUMI Verification Evidence & Quality Gates Ledger</h1>
  <p style="color: #94a3b8;">Deterministic Coding Evidence, Stop-Gate Policies & Compliance (Phase 92 / ADR-044)</p>
  
  <div class="grid">
    <div class="card"><div>Total Evidence</div><div class="metric-val">${metrics.totalEvidenceCount}</div></div>
    <div class="card"><div>Pass Rate</div><div class="metric-val" style="color:#10b981;">${metrics.passRatePercent}%</div></div>
    <div class="card"><div>Unverified Files</div><div class="metric-val" style="color:#eab308;">${metrics.totalUnverifiedFiles}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Logged Verification Records</h2>
  <table>
    <thead><tr><th>ID</th><th>Kind</th><th>Scope</th><th>Command</th><th>Status</th><th>Duration</th></tr></thead>
    <tbody>
      ${records.map((r) => `<tr><td><code>${r.id}</code></td><td><span class="badge">${r.kind.toUpperCase()}</span></td><td>${r.scope}</td><td><code>${r.command}</code></td><td style="color:${r.passed ? '#22c55e' : '#ef4444'};">${r.passed ? 'PASSED' : 'FAILED'}</td><td>${r.durationMs} ms</td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const records = this.listEvidence();

    let md = `# LUMI Verification Evidence Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Total Runs:** \`${metrics.totalEvidenceCount}\` | **Pass Rate:** \`${metrics.passRatePercent}%\` | **Unverified Files:** \`${metrics.totalUnverifiedFiles}\`\n\n`;
    md += `## Evidence Records (${records.length})\n\n`;
    md += `| ID | Kind | Scope | Command | Status | Duration |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const r of records) {
      md += `| \`${r.id}\` | ${r.kind.toUpperCase()} | ${r.scope} | \`${r.command}\` | ${r.passed ? 'PASSED' : 'FAILED'} | ${r.durationMs}ms |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "id,frameIndex,command,kind,scope,passed,exitCode,durationMs,timestamp\n";
    const rows = this.records.map((r) => {
      return `"${r.id}",${r.frameIndex},"${r.command}","${r.kind}","${r.scope}",${r.passed},${r.exitCode},${r.durationMs},${r.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): VerificationEvidenceWorkspaceSnapshot {
    return {
      totalRecords: this.records.length,
      records: [...this.records],
      modifiedCodeFiles: Array.from(this.modifiedFiles),
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: VerificationEvidenceWorkspaceSnapshot): void {
    this.records = [...snapshot.records];
    this.recordsById.clear();
    for (const r of this.records) {
      this.recordsById.set(r.id, r);
    }
    this.modifiedFiles.clear();
    for (const f of snapshot.modifiedCodeFiles) {
      this.modifiedFiles.add(f);
    }
  }

  public clear(): void {
    this.records = [];
    this.recordsById.clear();
    this.modifiedFiles.clear();
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
