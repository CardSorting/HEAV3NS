/**
 * broccoli-review-substrate.ts
 *
 * In-memory zero-GC Broccolidb repository for background review results, candidate facts,
 * session titles, and telemetry insights (Phase 96 / ADR-048 / Target #67).
 */

import type {
  BackgroundReviewBulkMutationResult,
  BackgroundReviewDslQueryFilter,
  BackgroundReviewGroupBy,
  BackgroundReviewGroupedLane,
  BackgroundReviewHealthAuditReport,
  BackgroundReviewHealthStatus,
  BackgroundReviewMetricsReport,
  BackgroundReviewMutationUndoRecord,
  BackgroundReviewSortBy,
  BackgroundReviewSortDirection,
  CandidateFactItem,
  CandidateFactRow,
  CandidateSkillItem,
  CandidateSkillRow,
  IBroccoliReviewSubstrate,
  ReviewAuditRow,
  ReviewTriggerPolicy,
  ReviewWorkspaceSnapshot,
  SessionInsightsBreakdown,
  TurnReviewResult,
  TurnReviewRow,
} from "../../../core/contracts/background-review.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliReviewSubstrate implements IBroccoliReviewSubstrate {
  private reviews: TurnReviewResult[] = [];
  private latestInsights?: SessionInsightsBreakdown;
  private currentTitle?: string;
  private triggerPolicy: ReviewTriggerPolicy = "always";
  private readonly auditLogs: ReviewAuditRow[] = [];

  private readonly undoStack: BackgroundReviewMutationUndoRecord[] = [];
  private readonly redoStack: BackgroundReviewMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private reviewsTable?: IDbTable<TurnReviewRow>;
  private factsTable?: IDbTable<CandidateFactRow>;
  private skillsTable?: IDbTable<CandidateSkillRow>;
  private auditsTable?: IDbTable<ReviewAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.reviewsTable = dbKernel.getTable<TurnReviewRow>("turn_reviews");
      this.factsTable = dbKernel.getTable<CandidateFactRow>("candidate_facts");
      this.skillsTable = dbKernel.getTable<CandidateSkillRow>("candidate_skills");
      this.auditsTable = dbKernel.getTable<ReviewAuditRow>("review_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: BackgroundReviewMutationUndoRecord["mutationType"], prev: ReviewWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliReviewSubstrate.MAX_UNDO_STACK) {
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
  // Core Review Operations
  // ---------------------------------------------------------------------------

  public recordReview(review: TurnReviewResult): void {
    const prev = this.exportSnapshot();
    this.reviews.push(review);
    if (this.reviews.length > 500) {
      this.reviews.shift();
    }

    if (this.reviewsTable) {
      this.reviewsTable.put(review.reviewId, {
        id: review.reviewId,
        reviewId: review.reviewId,
        turnIndex: review.turnIndex,
        userGoal: review.reviewDigest.userGoal,
        assistantActionSummary: review.reviewDigest.assistantActionSummary,
        toolsUsedCount: review.reviewDigest.toolsUsed.length,
        candidateFactsCount: review.candidateFacts.length,
        candidateSkillsCount: review.candidateSkills.length,
        durationMs: review.durationMs,
        timestamp: review.timestamp,
      });
    }

    if (this.factsTable) {
      for (const f of review.candidateFacts) {
        this.factsTable.put(f.factId, {
          id: f.factId,
          factId: f.factId,
          reviewId: review.reviewId,
          subject: f.subject,
          predicate: f.predicate,
          object: f.object,
          confidence: f.confidence,
          category: f.category,
          timestamp: review.timestamp,
        });
      }
    }

    if (this.skillsTable) {
      for (const s of review.candidateSkills) {
        this.skillsTable.put(s.skillId, {
          id: s.skillId,
          skillId: s.skillId,
          reviewId: review.reviewId,
          title: s.title,
          description: s.description,
          codeSnippet: s.codeSnippet,
          timestamp: review.timestamp,
        });
      }
    }

    this.pushUndoRecord("record_review", prev);
    this.recordAuditRow(review.reviewId, "record_review", "system", `Turn #${review.turnIndex}`);
  }

  public getReview(reviewId: string): TurnReviewResult | undefined {
    return this.reviews.find((r) => r.reviewId === reviewId);
  }

  public listReviews(): readonly TurnReviewResult[] {
    return [...this.reviews];
  }

  public getReviews(): readonly TurnReviewResult[] {
    return [...this.reviews];
  }

  public getLatestReview(): TurnReviewResult | undefined {
    return this.reviews[this.reviews.length - 1];
  }

  public getAllFacts(): readonly CandidateFactItem[] {
    const facts: CandidateFactItem[] = [];
    for (const r of this.reviews) {
      facts.push(...r.candidateFacts);
    }
    return facts;
  }

  public getAllSkills(): readonly CandidateSkillItem[] {
    const skills: CandidateSkillItem[] = [];
    for (const r of this.reviews) {
      skills.push(...r.candidateSkills);
    }
    return skills;
  }

  public setLatestInsights(insights: SessionInsightsBreakdown): void {
    this.latestInsights = { ...insights };
  }

  public getLatestInsights(): SessionInsightsBreakdown | undefined {
    return this.latestInsights;
  }

  public setCurrentTitle(title: string): void {
    this.currentTitle = title;
  }

  public getCurrentTitle(): string | undefined {
    return this.currentTitle;
  }

  public setTitle(title: string): void {
    this.currentTitle = title;
  }

  public getTitle(): string | undefined {
    return this.currentTitle;
  }

  public getTriggerPolicy(): ReviewTriggerPolicy {
    return this.triggerPolicy;
  }

  public setTriggerPolicy(policy: ReviewTriggerPolicy): void {
    const prev = this.exportSnapshot();
    this.triggerPolicy = policy;
    this.pushUndoRecord("policy_update", prev);
    this.recordAuditRow("policy", "set_policy", "system", policy);
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): BackgroundReviewHealthAuditReport {
    const totalReviews = this.reviews.length;
    const allFacts = this.getAllFacts();
    const allSkills = this.getAllSkills();
    const latestTurn = totalReviews > 0 ? this.reviews[totalReviews - 1].turnIndex : 0;
    const recommendations: string[] = [];
    let healthStatus: BackgroundReviewHealthStatus = "optimal";

    if (this.triggerPolicy === "disabled") {
      healthStatus = "stalled";
      recommendations.push("Background review trigger policy is currently disabled. Enable 'always' or 'on_milestone' for continuous learning.");
    }

    if (totalReviews > 400) {
      healthStatus = "degraded";
      recommendations.push(`Stored turn reviews (${totalReviews}) approaching capacity (500). Consider purging older turns.`);
    }

    if (recommendations.length === 0) {
      recommendations.push("Post-turn self-improvement background reviews are active and healthy.");
    }

    return {
      totalReviews,
      totalCandidateFacts: allFacts.length,
      totalCandidateSkills: allSkills.length,
      latestTurnIndex: latestTurn,
      triggerPolicy: this.triggerPolicy,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): BackgroundReviewMetricsReport {
    const total = this.reviews.length;
    const allFacts = this.getAllFacts();
    const allSkills = this.getAllSkills();

    const durations = this.reviews.map((r) => r.durationMs).sort((a, b) => a - b);
    const avgDuration = total > 0 ? durations.reduce((a, b) => a + b, 0) / total : 0;
    const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;

    return {
      totalReviewsConducted: total,
      totalCandidateFactsExtracted: allFacts.length,
      totalCandidateSkillsExtracted: allSkills.length,
      averageReviewDurationMs: Number(avgDuration.toFixed(2)),
      p50DurationMs: p50,
      p95DurationMs: p95,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedReviews(
    groupBy: BackgroundReviewGroupBy = "turn_range",
    sortBy: BackgroundReviewSortBy = "turnIndex",
    direction: BackgroundReviewSortDirection = "asc"
  ): readonly BackgroundReviewGroupedLane[] {
    const lanes = new Map<string, TurnReviewResult[]>();

    for (const r of this.reviews) {
      let key = "default";
      switch (groupBy) {
        case "turn_range": {
          const bucket = Math.floor(r.turnIndex / 10) * 10;
          key = `Turns ${bucket}-${bucket + 9}`;
          break;
        }
        case "has_skills":
          key = r.candidateSkills.length > 0 ? "Has Skills" : "No Skills";
          break;
        case "category":
          key = r.candidateFacts.length > 0 ? r.candidateFacts[0].category : "Uncategorized";
          break;
        case "error_status":
          key = r.reviewDigest.errorOccurred ? "Error Observed" : "Success";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(r);
    }

    const result: BackgroundReviewGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "turnIndex") cmp = a.turnIndex - b.turnIndex;
        else if (sortBy === "timestamp") cmp = a.timestamp - b.timestamp;
        else if (sortBy === "durationMs") cmp = a.durationMs - b.durationMs;
        return direction === "asc" ? cmp : -cmp;
      });

      result.push({
        key,
        title: key,
        count: items.length,
        reviews: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryReviewsDsl(query: BackgroundReviewDslQueryFilter | string): readonly TurnReviewResult[] {
    const parsed: BackgroundReviewDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;

    return this.reviews.filter((r) => {
      if (parsed.minTurnIndex !== undefined && r.turnIndex < parsed.minTurnIndex) return false;
      if (parsed.maxTurnIndex !== undefined && r.turnIndex > parsed.maxTurnIndex) return false;
      if (parsed.hasSkills !== undefined && (r.candidateSkills.length > 0) !== parsed.hasSkills) return false;
      if (parsed.hasFacts !== undefined && (r.candidateFacts.length > 0) !== parsed.hasFacts) return false;
      if (parsed.toolName && !r.reviewDigest.toolsUsed.includes(parsed.toolName)) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${r.reviewDigest.userGoal} ${r.reviewDigest.assistantActionSummary} ${r.reviewDigest.toolsUsed.join(" ")}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): BackgroundReviewDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let minTurnIndex: number | undefined;
    let maxTurnIndex: number | undefined;
    let hasSkills: boolean | undefined;
    let hasFacts: boolean | undefined;
    let toolName: string | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("min_turn:")) {
        minTurnIndex = Number(tok.slice(9));
      } else if (tok.startsWith("max_turn:")) {
        maxTurnIndex = Number(tok.slice(9));
      } else if (tok.startsWith("has_skills:")) {
        hasSkills = tok.slice(11).toLowerCase() === "true";
      } else if (tok.startsWith("has_facts:")) {
        hasFacts = tok.slice(10).toLowerCase() === "true";
      } else if (tok.startsWith("tool:")) {
        toolName = tok.slice(5);
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      minTurnIndex,
      maxTurnIndex,
      hasSkills,
      hasFacts,
      toolName,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeReviews(reviewIds: readonly string[]): BackgroundReviewBulkMutationResult {
    const prev = this.exportSnapshot();
    const toPurge = new Set(reviewIds);
    const initialLen = this.reviews.length;
    this.reviews = this.reviews.filter((r) => !toPurge.has(r.reviewId));
    const modified = initialLen - this.reviews.length;

    this.pushUndoRecord("bulk_purge", prev);
    return {
      matchedCount: reviewIds.length,
      modifiedCount: modified,
      affectedReviewIds: reviewIds,
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
  <title>LUMI Background Review & Self-Improvement Dashboard</title>
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
  <h1>🔍 LUMI Background Review & Post-Turn Self-Improvement</h1>
  <p style="color: #94a3b8;">Autonomous Post-Turn Review, Candidate Knowledge Extraction & Insights (Phase 96 / Target #67)</p>
  
  <div class="grid">
    <div class="card"><div>Total Reviews</div><div class="metric-val">${metrics.totalReviewsConducted}</div></div>
    <div class="card"><div>Facts Extracted</div><div class="metric-val" style="color:#10b981;">${metrics.totalCandidateFactsExtracted}</div></div>
    <div class="card"><div>Skills Extracted</div><div class="metric-val" style="color:#8b5cf6;">${metrics.totalCandidateSkillsExtracted}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:#22c55e;">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Turn Reviews Ledger</h2>
  <table>
    <thead>
      <tr>
        <th>Turn</th>
        <th>User Goal</th>
        <th>Tools Used</th>
        <th>Facts</th>
        <th>Skills</th>
      </tr>
    </thead>
    <tbody>
      ${this.reviews.map((r) => `
        <tr>
          <td><strong>#${r.turnIndex}</strong></td>
          <td>${r.reviewDigest.userGoal}</td>
          <td>${r.reviewDigest.toolsUsed.join(", ") || "-"}</td>
          <td><span class="badge">${r.candidateFacts.length} facts</span></td>
          <td><span class="badge" style="background:#6d28d9;">${r.candidateSkills.length} skills</span></td>
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

    let md = `# LUMI Background Review Diagnostic Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Total Reviews:** \`${metrics.totalReviewsConducted}\` | **Policy:** \`${this.triggerPolicy}\`\n\n`;
    md += `## Candidate Knowledge Summary\n`;
    md += `- **Candidate Facts:** ${metrics.totalCandidateFactsExtracted}\n`;
    md += `- **Candidate Skills:** ${metrics.totalCandidateSkillsExtracted}\n`;
    md += `- **Average Latency:** ${metrics.averageReviewDurationMs} ms\n\n`;

    md += `## Reviews Ledger\n\n`;
    md += `| Turn | User Goal | Tools Used | Candidate Facts | Candidate Skills |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const r of this.reviews) {
      md += `| #${r.turnIndex} | ${r.reviewDigest.userGoal} | ${r.reviewDigest.toolsUsed.join(", ") || "-"} | ${r.candidateFacts.length} | ${r.candidateSkills.length} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "reviewId,turnIndex,userGoal,toolsCount,factsCount,skillsCount,durationMs,timestamp\n";
    const rows = this.reviews.map((r) => {
      return `"${r.reviewId}",${r.turnIndex},"${r.reviewDigest.userGoal.replace(/"/g, '""')}",${r.reviewDigest.toolsUsed.length},${r.candidateFacts.length},${r.candidateSkills.length},${r.durationMs},${r.timestamp}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Audits
  // ---------------------------------------------------------------------------

  public exportSnapshot(): ReviewWorkspaceSnapshot {
    return {
      totalReviews: this.reviews.length,
      activeReviews: [...this.reviews],
      latestInsights: this.latestInsights ? { ...this.latestInsights } : undefined,
      currentTitle: this.currentTitle,
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: ReviewWorkspaceSnapshot): void {
    this.reviews = [...snapshot.activeReviews];
    this.latestInsights = snapshot.latestInsights ? { ...snapshot.latestInsights } : undefined;
    this.currentTitle = snapshot.currentTitle;
  }

  private recordAuditRow(reviewId: string, action: string, operator: string, details: string): void {
    const row: ReviewAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: `${action}:${reviewId}`,
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
    this.reviews = [];
    this.latestInsights = undefined;
    this.currentTitle = undefined;
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.triggerPolicy = "always";
  }
}
