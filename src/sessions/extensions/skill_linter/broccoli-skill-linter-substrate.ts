/**
 * broccoli-skill-linter-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for caching skill lint reports, rules,
 * quality metrics, anti-scaffolding logs, and multi-criteria swimlanes (Phase 135 / ADR-111 / Target #75).
 */

import type {
  IBroccoliSkillLinterSubstrate,
  SkillLintAuditRow,
  SkillLinterBulkMutationResult,
  SkillLinterConfig,
  SkillLinterDslQueryFilter,
  SkillLinterGroupBy,
  SkillLinterGroupedLane,
  SkillLinterHealthAuditReport,
  SkillLinterHealthStatus,
  SkillLinterMetrics,
  SkillLinterMetricsReport,
  SkillLinterMutationUndoRecord,
  SkillLinterSortBy,
  SkillLinterSortDirection,
  SkillLinterWorkspaceSnapshot,
  SkillLintFindingRow,
  SkillLintReport,
  SkillLintReportRow,
} from "../../../core/contracts/skill-linter.contracts.js";
import { DEFAULT_SKILL_LINTER_CONFIG } from "../../../core/contracts/skill-linter.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliSkillLinterSubstrate implements IBroccoliSkillLinterSubstrate {
  private config: SkillLinterConfig = { ...DEFAULT_SKILL_LINTER_CONFIG };
  private readonly reports = new Map<string, SkillLintReport>();
  private readonly undoStack: SkillLinterMutationUndoRecord[] = [];
  private readonly redoStack: SkillLinterMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private reportsTable?: IDbTable<SkillLintReportRow>;
  private auditsTable?: IDbTable<SkillLintAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.reportsTable = dbKernel.getTable<SkillLintReportRow>("skill_lint_reports");
      this.auditsTable = dbKernel.getTable<SkillLintAuditRow>("skill_linter_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  public setConfig(config: Partial<SkillLinterConfig>): void {
    const prev = this.exportSnapshot();
    this.config = { ...this.config, ...config };
    this.pushUndoRecord("config_change", prev);
  }

  public getConfig(): SkillLinterConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: SkillLinterMutationUndoRecord["mutationType"], prev: SkillLinterWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliSkillLinterSubstrate.MAX_UNDO_STACK) {
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
  // Report Storage Operations
  // ---------------------------------------------------------------------------

  public recordReport(report: SkillLintReport): void {
    this.storeReport(report);
  }

  public storeReport(report: SkillLintReport): void {
    const prev = this.exportSnapshot();
    this.reports.set(report.skillName, { ...report });

    if (this.reportsTable) {
      this.reportsTable.put(report.skillName, {
        skillName: report.skillName,
        skillDir: report.skillDir || "",
        isValid: report.isValid,
        errorCount: report.errorCount,
        warningCount: report.warningCount,
        findingsCount: report.findings.length,
        auditDurationMs: report.auditDurationMs,
        timestamp: report.timestamp,
      });
    }

    this.pushUndoRecord("add_report", prev);
  }

  public getReport(skillName: string): SkillLintReport | undefined {
    return this.reports.get(skillName);
  }

  public listReports(): readonly SkillLintReport[] {
    return Array.from(this.reports.values());
  }

  public getAllReports(): SkillLintReport[] {
    return Array.from(this.reports.values());
  }

  public removeReport(skillName: string): boolean {
    const exists = this.reports.has(skillName);
    if (!exists) return false;

    const prev = this.exportSnapshot();
    this.reports.delete(skillName);

    if (this.reportsTable) {
      this.reportsTable.delete(skillName);
    }

    this.pushUndoRecord("bulk_purge", prev);
    return true;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): SkillLinterHealthAuditReport {
    const reports = Array.from(this.reports.values());
    const totalSkills = reports.length;
    let cleanCount = 0;
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const r of reports) {
      if (r.isValid && r.findings.length === 0) cleanCount++;
      totalErrors += r.errorCount;
      totalWarnings += r.warningCount;
    }

    const complianceRate = totalSkills === 0 ? 100 : Math.round((cleanCount / totalSkills) * 100);

    let healthStatus: SkillLinterHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (totalErrors > 0) {
      healthStatus = "degraded";
      recommendations.push(`${totalErrors} skill linter errors detected. Review schema violations and banned utilities.`);
    }

    if (complianceRate < 50 && totalSkills > 0) {
      healthStatus = "critical";
      recommendations.push("Skill tree compliance rate dropped below 50%. Immediate review required.");
    }

    if (totalSkills === 0) {
      healthStatus = "healthy";
      recommendations.push("No skill bundles audited yet in current workspace.");
    }

    return {
      totalSkillsAudited: totalSkills,
      cleanSkillsCount: cleanCount,
      totalErrorsFound: totalErrors,
      totalWarningsFound: totalWarnings,
      complianceRatePercent: complianceRate,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): SkillLinterMetricsReport {
    const reports = Array.from(this.reports.values());
    let totalErrors = 0;
    let totalWarnings = 0;
    let cleanCount = 0;
    let totalDuration = 0;
    const errorsByRuleCode: Record<string, number> = {};
    const reportsByStatus: Record<string, number> = { valid: 0, invalid: 0 };

    for (const r of reports) {
      if (r.isValid) reportsByStatus.valid++;
      else reportsByStatus.invalid++;

      if (r.isValid && r.findings.length === 0) cleanCount++;
      totalErrors += r.errorCount;
      totalWarnings += r.warningCount;
      totalDuration += r.auditDurationMs;

      for (const f of r.findings) {
        if (f.severity === "error") {
          errorsByRuleCode[f.ruleCode] = (errorsByRuleCode[f.ruleCode] || 0) + 1;
        }
      }
    }

    return {
      totalSkillsAudited: reports.length,
      cleanSkillsCount: cleanCount,
      totalErrorsFound: totalErrors,
      totalWarningsFound: totalWarnings,
      avgAuditDurationMs: reports.length === 0 ? 0 : Number((totalDuration / reports.length).toFixed(3)),
      errorsByRuleCode,
      reportsByStatus,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedReports(
    groupBy: SkillLinterGroupBy = "status",
    sortBy: SkillLinterSortBy = "timestamp",
    direction: SkillLinterSortDirection = "desc"
  ): readonly SkillLinterGroupedLane[] {
    const lanes = new Map<string, SkillLintReport[]>();
    const all = Array.from(this.reports.values());

    for (const r of all) {
      let key = "default";
      switch (groupBy) {
        case "status":
          key = r.isValid ? "valid" : "invalid";
          break;
        case "ruleCode":
          key = r.findings.length > 0 ? r.findings[0].ruleCode : "NONE";
          break;
        case "severity":
          key = r.errorCount > 0 ? "error" : r.warningCount > 0 ? "warning" : "clean";
          break;
        case "directory":
          key = r.skillDir || "root";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(r);
    }

    const result: SkillLinterGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "timestamp") cmp = b.timestamp - a.timestamp;
        else if (sortBy === "skillName") cmp = a.skillName.localeCompare(b.skillName);
        else if (sortBy === "errors") cmp = b.errorCount - a.errorCount;
        else if (sortBy === "warnings") cmp = b.warningCount - a.warningCount;
        return direction === "asc" ? -cmp : cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        reports: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryReportsDsl(query: SkillLinterDslQueryFilter | string): readonly SkillLintReport[] {
    const parsed: SkillLinterDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const all = Array.from(this.reports.values());

    return all.filter((r) => {
      if (parsed.valid !== undefined && r.isValid !== parsed.valid) return false;
      if (parsed.skillName && !r.skillName.toLowerCase().includes(parsed.skillName.toLowerCase())) return false;

      if (parsed.ruleCode && !r.findings.some((f) => f.ruleCode === parsed.ruleCode)) return false;
      if (parsed.severity && !r.findings.some((f) => f.severity === parsed.severity)) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${r.skillName} ${r.skillDir || ""} ${r.findings.map((f) => f.message).join(" ")}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): SkillLinterDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let valid: boolean | undefined;
    let ruleCode: any;
    let severity: any;
    let skillName: string | undefined;

    for (const tok of tokens) {
      if (tok === "valid:true" || tok === "is:valid") {
        valid = true;
      } else if (tok === "valid:false" || tok === "is:invalid") {
        valid = false;
      } else if (tok.startsWith("rule:")) {
        ruleCode = tok.slice(5).toUpperCase() as any;
      } else if (tok.startsWith("sev:")) {
        severity = tok.slice(4).toLowerCase() as any;
      } else if (tok.startsWith("name:")) {
        skillName = tok.slice(5);
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      valid,
      ruleCode,
      severity,
      skillName,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeReports(skillNames: readonly string[]): SkillLinterBulkMutationResult {
    const prev = this.exportSnapshot();
    let modified = 0;

    for (const name of skillNames) {
      if (this.reports.has(name)) {
        this.reports.delete(name);
        if (this.reportsTable) this.reportsTable.delete(name);
        modified++;
      }
    }

    this.pushUndoRecord("bulk_purge", prev);
    return {
      matchedCount: skillNames.length,
      modifiedCount: modified,
      affectedSkillNames: skillNames,
    };
  }

  public bulkPurgeInvalid(): SkillLinterBulkMutationResult {
    const prev = this.exportSnapshot();
    const invalidNames = Array.from(this.reports.values())
      .filter((r) => !r.isValid)
      .map((r) => r.skillName);

    for (const name of invalidNames) {
      this.reports.delete(name);
      if (this.reportsTable) this.reportsTable.delete(name);
    }

    this.pushUndoRecord("bulk_purge", prev);
    return {
      matchedCount: invalidNames.length,
      modifiedCount: invalidNames.length,
      affectedSkillNames: invalidNames,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const reports = this.listReports();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Evolutionary Skill Tree Linter Ledger</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
    .badge-valid { padding: 4px 8px; border-radius: 4px; font-size: 12px; background: #065f46; color: #a7f3d0; }
    .badge-invalid { padding: 4px 8px; border-radius: 4px; font-size: 12px; background: #881337; color: #fecdd3; }
  </style>
</head>
<body>
  <h1>🧬 LUMI Skill Tree Linter & Anti-Scaffolding Guard</h1>
  <p style="color: #94a3b8;">Deterministic Skill Tree Validation & Frontmatter Conventions (Phase 135 / ADR-111)</p>
  
  <div class="grid">
    <div class="card"><div>Skills Audited</div><div class="metric-val">${metrics.totalSkillsAudited}</div></div>
    <div class="card"><div>Clean Skills</div><div class="metric-val" style="color:#10b981;">${metrics.cleanSkillsCount}</div></div>
    <div class="card"><div>Errors / Warnings</div><div class="metric-val" style="color:#f43f5e;">${metrics.totalErrorsFound} / ${metrics.totalWarningsFound}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Audited Skill Reports</h2>
  <table>
    <thead><tr><th>Skill Name</th><th>Status</th><th>Errors</th><th>Warnings</th><th>Findings</th></tr></thead>
    <tbody>
      ${reports.map((r) => `<tr><td><code>${r.skillName}</code></td><td><span class="${r.isValid ? 'badge-valid' : 'badge-invalid'}">${r.isValid ? 'VALID' : 'INVALID'}</span></td><td>${r.errorCount}</td><td>${r.warningCount}</td><td>${r.findings.map(f => f.ruleCode).join(', ') || 'None'}</td></tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const reports = this.listReports();

    let md = `# LUMI Skill Tree Linter Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Compliance Rate:** \`${health.complianceRatePercent}%\` | **Total Skills:** \`${metrics.totalSkillsAudited}\` | **Errors:** \`${metrics.totalErrorsFound}\`\n\n`;
    md += `## Audited Skill Bundles (${reports.length})\n\n`;
    md += `| Skill Name | Status | Errors | Warnings | Duration |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const r of reports) {
      md += `| \`${r.skillName}\` | ${r.isValid ? 'VALID' : 'INVALID'} | ${r.errorCount} | ${r.warningCount} | ${r.auditDurationMs.toFixed(2)}ms |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "skillName,isValid,errorCount,warningCount,findingsCount,auditDurationMs,timestamp\n";
    const rows = Array.from(this.reports.values()).map((r) => {
      return `"${r.skillName}",${r.isValid},${r.errorCount},${r.warningCount},${r.findings.length},${r.auditDurationMs.toFixed(2)},${r.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Clearing
  // ---------------------------------------------------------------------------

  public exportSnapshot(): SkillLinterWorkspaceSnapshot {
    const reports = this.getAllReports();
    let totalErrors = 0;
    let totalWarnings = 0;
    let cleanCount = 0;

    for (const r of reports) {
      if (r.isValid && r.findings.length === 0) cleanCount++;
      totalErrors += r.errorCount;
      totalWarnings += r.warningCount;
    }

    return {
      snapshotId: `snap-${Date.now()}`,
      timestamp: Date.now(),
      config: this.getConfig(),
      reports,
      metrics: {
        totalSkillsAudited: reports.length,
        cleanSkillsCount: cleanCount,
        totalErrorsFound: totalErrors,
        totalWarningsFound: totalWarnings,
        lastAuditDurationMs: 0,
      },
    };
  }

  public createSnapshot(snapshotId: string): SkillLinterWorkspaceSnapshot {
    const snap = this.exportSnapshot();
    return { ...snap, snapshotId };
  }

  public importSnapshot(snapshot: SkillLinterWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.reports.clear();
    for (const report of snapshot.reports) {
      this.reports.set(report.skillName, { ...report });
    }
  }

  public restoreSnapshot(snapshot: SkillLinterWorkspaceSnapshot): void {
    this.importSnapshot(snapshot);
  }

  public clear(): void {
    this.config = { ...DEFAULT_SKILL_LINTER_CONFIG };
    this.reports.clear();
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
