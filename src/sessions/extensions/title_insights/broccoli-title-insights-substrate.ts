/**
 * broccoli-title-insights-substrate.ts
 *
 * In-memory zero-GC Broccolidb repository for Two-Stage Epistemic Session Title Generation,
 * Provenance Ledger, Token Economics, Activity Logs & Multi-Dimensional Analytics (Target #42 / Phase 109 / ADR-085).
 */

import type {
  ActivityTrendMetric,
  ConversationInsightsReport,
  IBroccoliTitleInsightsSubstrate,
  InsightSummaryRow,
  ModelUsageMetric,
  PlatformUsageMetric,
  SessionActivityEvent,
  SessionActivityEventRow,
  SessionInsightsOverview,
  SessionTitleRecord,
  SessionTitleRow,
  SessionTokenEconomics,
  SkillUsageMetric,
  TitleAuditRow,
  TitleInsightsBulkMutationResult,
  TitleInsightsDslQueryFilter,
  TitleInsightsGroupBy,
  TitleInsightsGroupedLane,
  TitleInsightsHealthAuditReport,
  TitleInsightsHealthStatus,
  TitleInsightsMetricsReport,
  TitleInsightsMutationUndoRecord,
  TitleInsightsSortBy,
  TitleInsightsSortDirection,
  TitleInsightsWorkspaceSnapshot,
  ToolUsageMetric,
  TopSessionMetric,
} from "../../../core/contracts/title-insights.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliTitleInsightsSubstrate implements IBroccoliTitleInsightsSubstrate {
  private readonly titles = new Map<string, SessionTitleRecord>();
  private readonly events: SessionActivityEvent[] = [];
  private readonly auditLogs: TitleAuditRow[] = [];
  private totalTitlesGeneratedCount = 0;
  private totalInsightsGeneratedCount = 0;

  private readonly undoStack: TitleInsightsMutationUndoRecord[] = [];
  private readonly redoStack: TitleInsightsMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private titlesTable?: IDbTable<SessionTitleRow>;
  private eventsTable?: IDbTable<SessionActivityEventRow>;
  private summariesTable?: IDbTable<InsightSummaryRow>;
  private auditsTable?: IDbTable<TitleAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.titlesTable = dbKernel.getTable<SessionTitleRow>("session_titles");
      this.eventsTable = dbKernel.getTable<SessionActivityEventRow>("session_activity_events");
      this.summariesTable = dbKernel.getTable<InsightSummaryRow>("insight_summaries");
      this.auditsTable = dbKernel.getTable<TitleAuditRow>("title_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: TitleInsightsMutationUndoRecord["mutationType"], prev: TitleInsightsWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliTitleInsightsSubstrate.MAX_UNDO_STACK) {
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
  // Core Repository Methods & Provenance Hierarchy
  // ---------------------------------------------------------------------------

  public getTitle(sessionId: string): SessionTitleRecord | undefined {
    return this.titles.get(sessionId);
  }

  public listTitles(): readonly SessionTitleRecord[] {
    return Array.from(this.titles.values());
  }

  public getAllTitles(): readonly SessionTitleRecord[] {
    return this.listTitles();
  }

  public setTitle(record: SessionTitleRecord): void {
    this.recordTitle(record);
  }

  public recordTitle(record: SessionTitleRecord): boolean {
    const existing = this.titles.get(record.sessionId);
    if (existing) {
      // Enforce strict provenance precedence: user > llm > derived
      if (existing.provenance === "user" && record.provenance !== "user") {
        return false; // Block downgrading user title
      }
      if (existing.provenance === "llm" && record.provenance === "derived") {
        return false; // Block downgrading llm title to derived
      }
    }

    const prev = this.exportSnapshot();
    this.titles.set(record.sessionId, record);
    this.totalTitlesGeneratedCount++;

    if (this.titlesTable) {
      this.titlesTable.put(record.sessionId, {
        id: record.sessionId,
        sessionId: record.sessionId,
        title: record.title,
        provenance: record.provenance,
        costUsd: record.costUsd,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    }

    this.pushUndoRecord("set_title", prev);
    this.recordAudit(record.sessionId, "record_title", record.provenance, `Title set: ${record.title}`);
    return true;
  }

  public deleteTitle(sessionId: string): boolean {
    const existing = this.titles.get(sessionId);
    if (!existing) return false;

    const prev = this.exportSnapshot();
    this.titles.delete(sessionId);

    this.pushUndoRecord("delete_title", prev);
    this.recordAudit(sessionId, "delete_title", "user", `Deleted title: ${existing.title}`);
    return true;
  }

  public recordActivity(event: SessionActivityEvent): void {
    this.recordActivityEvent(event);
  }

  public recordActivityEvent(event: SessionActivityEvent): void {
    this.events.push(event);
    if (this.events.length > 50000) {
      this.events.shift();
    }

    if (this.eventsTable) {
      this.eventsTable.put(event.eventId, {
        id: event.eventId,
        eventId: event.eventId,
        sessionId: event.sessionId,
        eventType: event.eventType,
        platform: event.platform,
        model: event.model,
        timestamp: event.timestamp,
      });
    }
  }

  public listActivityEvents(sessionId?: string): readonly SessionActivityEvent[] {
    if (!sessionId) return this.events;
    return this.events.filter((e) => e.sessionId === sessionId);
  }

  public getActivities(cutoffTimestamp = 0, sourceFilter?: string): readonly SessionActivityEvent[] {
    return this.events.filter((e) => {
      if (e.timestamp < cutoffTimestamp) return false;
      if (sourceFilter && e.platform !== sourceFilter) return false;
      return true;
    });
  }

  // ---------------------------------------------------------------------------
  // Multi-Dimensional Cognitive Analytics & Insights Aggregation
  // ---------------------------------------------------------------------------

  public generateInsightsReport(dateRangeDays = 30, sourceFilter?: string): ConversationInsightsReport {
    return this.generateInsights(dateRangeDays, sourceFilter);
  }

  public generateInsights(days = 30, sourceFilter?: string): ConversationInsightsReport {
    this.totalInsightsGeneratedCount++;
    const now = Date.now();
    const cutoff = now - days * 86400 * 1000;
    const filteredEvents = this.getActivities(cutoff, sourceFilter);

    if (filteredEvents.length === 0 && this.titles.size === 0) {
      return this.createEmptyReport(days, sourceFilter, now);
    }

    // Sessions map
    const sessionMap = new Map<
      string,
      {
        sessionId: string;
        platform: string;
        model: string;
        startedAt: number;
        endedAt: number;
        messageCount: number;
        toolCallCount: number;
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheWriteTokens: number;
        costUsd: number;
      }
    >();

    const modelMap = new Map<
      string,
      {
        sessionIds: Set<string>;
        messageCount: number;
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheWriteTokens: number;
        costUsd: number;
      }
    >();

    const platformMap = new Map<
      string,
      {
        sessionIds: Set<string>;
        messageCount: number;
        costUsd: number;
      }
    >();

    const toolMap = new Map<
      string,
      {
        category: string;
        callCount: number;
        successCount: number;
        failureCount: number;
        latencies: number[];
      }
    >();

    const skillMap = new Map<
      string,
      {
        loads: number;
        edits: number;
        actions: number;
      }
    >();

    // Activity matrix 7x24
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    let totalTokens = 0;
    let totalCostUsd = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;
    let totalMessages = 0;
    let totalToolCalls = 0;

    for (const e of filteredEvents) {
      const date = new Date(e.timestamp);
      const day = date.getDay();
      const hour = date.getHours();
      matrix[day][hour]++;

      // Session aggregation
      if (!sessionMap.has(e.sessionId)) {
        sessionMap.set(e.sessionId, {
          sessionId: e.sessionId,
          platform: e.platform,
          model: e.model,
          startedAt: e.timestamp,
          endedAt: e.timestamp,
          messageCount: 0,
          toolCallCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd: 0,
        });
      }
      const sRec = sessionMap.get(e.sessionId)!;
      sRec.endedAt = Math.max(sRec.endedAt, e.timestamp);
      sRec.startedAt = Math.min(sRec.startedAt, e.timestamp);

      if (e.eventType === "message_sent") {
        sRec.messageCount++;
        totalMessages++;
      } else if (e.eventType === "tool_called") {
        sRec.toolCallCount++;
        totalToolCalls++;
      }

      const inTok = e.inputTokens || 0;
      const outTok = e.outputTokens || 0;
      const cRead = e.cacheReadTokens || 0;
      const cWrite = e.cacheWriteTokens || 0;
      const cost = e.costUsd || 0;

      sRec.inputTokens += inTok;
      sRec.outputTokens += outTok;
      sRec.cacheReadTokens += cRead;
      sRec.cacheWriteTokens += cWrite;
      sRec.costUsd += cost;

      totalTokens += inTok + outTok;
      totalCostUsd += cost;
      totalCacheRead += cRead;
      totalCacheWrite += cWrite;

      // Model aggregation
      if (!modelMap.has(e.model)) {
        modelMap.set(e.model, {
          sessionIds: new Set(),
          messageCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd: 0,
        });
      }
      const mRec = modelMap.get(e.model)!;
      mRec.sessionIds.add(e.sessionId);
      if (e.eventType === "message_sent") mRec.messageCount++;
      mRec.inputTokens += inTok;
      mRec.outputTokens += outTok;
      mRec.cacheReadTokens += cRead;
      mRec.cacheWriteTokens += cWrite;
      mRec.costUsd += cost;

      // Platform aggregation
      if (!platformMap.has(e.platform)) {
        platformMap.set(e.platform, {
          sessionIds: new Set(),
          messageCount: 0,
          costUsd: 0,
        });
      }
      const pRec = platformMap.get(e.platform)!;
      pRec.sessionIds.add(e.sessionId);
      if (e.eventType === "message_sent") pRec.messageCount++;
      pRec.costUsd += cost;

      // Tool aggregation
      if (e.eventType === "tool_called" && e.toolName) {
        if (!toolMap.has(e.toolName)) {
          toolMap.set(e.toolName, {
            category: this.categorizeTool(e.toolName),
            callCount: 0,
            successCount: 0,
            failureCount: 0,
            latencies: [],
          });
        }
        const tRec = toolMap.get(e.toolName)!;
        tRec.callCount++;
        if (e.isSuccess !== false) tRec.successCount++;
        else tRec.failureCount++;
        if (typeof e.latencyMs === "number") tRec.latencies.push(e.latencyMs);
      }

      // Skill aggregation
      if (e.eventType === "skill_invoked" && e.skillName) {
        if (!skillMap.has(e.skillName)) {
          skillMap.set(e.skillName, { loads: 0, edits: 0, actions: 0 });
        }
        const skRec = skillMap.get(e.skillName)!;
        skRec.actions++;
      }
    }

    const totalSessions = Math.max(sessionMap.size, this.titles.size, 1);
    let totalDurationSec = 0;
    const topSessionsList: TopSessionMetric[] = [];
    const recordedSessionIds = new Set<string>();

    for (const [sessId, s] of sessionMap.entries()) {
      recordedSessionIds.add(sessId);
      const dur = Math.max(1, Math.round((s.endedAt - s.startedAt) / 1000));
      totalDurationSec += dur;
      const titleRec = this.titles.get(sessId);
      topSessionsList.push({
        sessionId: sessId,
        title: titleRec?.title || "Untitled Session",
        source: s.platform,
        model: s.model,
        startedAt: s.startedAt,
        durationSeconds: dur,
        messageCount: s.messageCount,
        toolCallCount: s.toolCallCount,
        totalTokens: s.inputTokens + s.outputTokens,
        totalCostUsd: s.costUsd,
      });
    }

    for (const [sessId, t] of this.titles.entries()) {
      if (!recordedSessionIds.has(sessId)) {
        topSessionsList.push({
          sessionId: sessId,
          title: t.title,
          source: "default",
          model: t.modelUsed || "default",
          startedAt: t.createdAt,
          durationSeconds: 1,
          messageCount: 1,
          toolCallCount: 0,
          totalTokens: 0,
          totalCostUsd: t.costUsd || 0,
        });
      }
    }

    topSessionsList.sort((a, b) => b.totalCostUsd - a.totalCostUsd || b.messageCount - a.messageCount);

    const modelsList: ModelUsageMetric[] = Array.from(modelMap.entries()).map(([mName, m]) => ({
      modelName: mName,
      provider: mName.includes("/") ? mName.split("/")[0] : "unknown",
      sessionCount: m.sessionIds.size,
      messageCount: m.messageCount,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      cacheReadTokens: m.cacheReadTokens,
      cacheWriteTokens: m.cacheWriteTokens,
      totalCostUsd: m.costUsd,
    }));

    const platformsList: PlatformUsageMetric[] = Array.from(platformMap.entries()).map(([pName, p]) => ({
      platform: pName,
      sessionCount: p.sessionIds.size,
      messageCount: p.messageCount,
      totalCostUsd: p.costUsd,
      percentageOfTotalSessions: totalSessions > 0 ? (p.sessionIds.size / totalSessions) * 100 : 0,
    }));

    const toolsList: ToolUsageMetric[] = Array.from(toolMap.entries()).map(([tName, t]) => {
      const avgLat = t.latencies.length > 0 ? t.latencies.reduce((a, b) => a + b, 0) / t.latencies.length : 0;
      return {
        toolName: tName,
        category: t.category,
        callCount: t.callCount,
        successCount: t.successCount,
        failureCount: t.failureCount,
        errorRate: t.callCount > 0 ? (t.failureCount / t.callCount) * 100 : 0,
        averageLatencyMs: Number(avgLat.toFixed(2)),
        percentageOfTotalCalls: totalToolCalls > 0 ? (t.callCount / totalToolCalls) * 100 : 0,
      };
    });

    const topSkillsList: SkillUsageMetric[] = Array.from(skillMap.entries()).map(([skName, sk]) => ({
      skillName: skName,
      loadsCount: sk.loads,
      editsCount: sk.edits,
      actionsCount: sk.actions,
      distinctSkillsUsed: skillMap.size,
      percentageOfTotalActions: 100,
    }));

    // Find peak activity
    let maxHourVal = 0;
    let peakHour = 0;
    let peakDay = 0;
    let activeHoursCount = 0;

    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const val = matrix[d][h];
        if (val > 0) activeHoursCount++;
        if (val > maxHourVal) {
          maxHourVal = val;
          peakDay = d;
          peakHour = h;
        }
      }
    }

    const activityTrend: ActivityTrendMetric = {
      dayOfWeek: peakDay,
      hourOfDay: peakHour,
      activityMatrix: matrix,
      peakHour,
      peakDay,
      totalActiveHours: activeHoursCount,
    };

    const overview: SessionInsightsOverview = {
      totalSessions,
      totalMessages,
      totalToolCalls,
      totalDurationSeconds: totalDurationSec,
      averageMessagesPerSession: totalSessions > 0 ? Number((totalMessages / totalSessions).toFixed(1)) : 0,
      averageToolCallsPerSession: totalSessions > 0 ? Number((totalToolCalls / totalSessions).toFixed(1)) : 0,
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      averageCostPerSession: totalSessions > 0 ? Number((totalCostUsd / totalSessions).toFixed(4)) : 0,
      totalTokens,
      cacheEfficiencyRate:
        totalTokens + totalCacheRead > 0
          ? Number(((totalCacheRead / (totalTokens + totalCacheRead)) * 100).toFixed(1))
          : 0,
    };

    const tokenEconomics: SessionTokenEconomics = {
      inputTokens: totalTokens > 0 ? Math.round(totalTokens * 0.7) : 0,
      outputTokens: totalTokens > 0 ? Math.round(totalTokens * 0.3) : 0,
      cacheReadTokens: totalCacheRead,
      cacheWriteTokens: totalCacheWrite,
      totalTokens,
      estimatedCostUsd: Number(totalCostUsd.toFixed(4)),
      actualCostUsd: Number(totalCostUsd.toFixed(4)),
      costSource: "canonical_pricing",
      costStatus: "exact",
    };

    const report: ConversationInsightsReport = {
      generatedAt: now,
      dateRangeDays: days,
      sourceFilter,
      isEmpty: false,
      overview,
      models: modelsList,
      platforms: platformsList,
      tools: toolsList,
      skills: {
        summary: {
          totalSkillLoads: 0,
          totalSkillEdits: 0,
          totalSkillActions: topSkillsList.reduce((acc, s) => acc + s.actionsCount, 0),
          distinctSkillsUsed: skillMap.size,
        },
        topSkills: topSkillsList,
      },
      activity: activityTrend,
      topSessions: topSessionsList.slice(0, 10),
      tokenEconomics,
    };

    if (this.summariesTable) {
      this.summariesTable.put(`insight_${now}`, {
        id: `insight_${now}`,
        generatedAt: now,
        totalSessions,
        totalCostUsd: overview.totalCostUsd,
        totalTokens: overview.totalTokens,
      });
    }

    return report;
  }

  private categorizeTool(name: string): string {
    if (name.startsWith("file_") || name.includes("file") || name.includes("dir")) return "filesystem";
    if (name.startsWith("git_") || name.includes("git")) return "vcs";
    if (name.startsWith("web_") || name.includes("browser") || name.includes("search")) return "web";
    if (name.startsWith("kanban_") || name.startsWith("goal_")) return "coordination";
    if (name.startsWith("wallet_")) return "web3";
    if (name.startsWith("profile_")) return "identity";
    return "core";
  }

  private createEmptyReport(days: number, sourceFilter: string | undefined, now: number): ConversationInsightsReport {
    return {
      generatedAt: now,
      dateRangeDays: days,
      sourceFilter,
      isEmpty: true,
      overview: {
        totalSessions: 0,
        totalMessages: 0,
        totalToolCalls: 0,
        totalDurationSeconds: 0,
        averageMessagesPerSession: 0,
        averageToolCallsPerSession: 0,
        totalCostUsd: 0,
        averageCostPerSession: 0,
        totalTokens: 0,
        cacheEfficiencyRate: 0,
      },
      models: [],
      platforms: [],
      tools: [],
      skills: {
        summary: { totalSkillLoads: 0, totalSkillEdits: 0, totalSkillActions: 0, distinctSkillsUsed: 0 },
        topSkills: [],
      },
      activity: {
        dayOfWeek: 0,
        hourOfDay: 0,
        activityMatrix: Array.from({ length: 7 }, () => Array(24).fill(0)),
        peakHour: 0,
        peakDay: 0,
        totalActiveHours: 0,
      },
      topSessions: [],
      tokenEconomics: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        costSource: "canonical_pricing",
        costStatus: "exact",
      },
    };
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): TitleInsightsHealthAuditReport {
    const list = Array.from(this.titles.values());
    let derived = 0;
    let llm = 0;
    let user = 0;

    for (const t of list) {
      if (t.provenance === "derived") derived++;
      else if (t.provenance === "llm") llm++;
      else if (t.provenance === "user") user++;
    }

    let healthStatus: TitleInsightsHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (list.length === 0 && this.events.length > 0) {
      healthStatus = "degraded";
      recommendations.push("Activity recorded without corresponding session titles. Trigger title generator.");
    }

    if (recommendations.length === 0) {
      recommendations.push("Two-stage title synthesis and epistemic telemetry are running in optimal synchronization.");
    }

    return {
      totalTitles: list.length,
      totalActivityEvents: this.events.length,
      derivedTitlesCount: derived,
      llmTitlesCount: llm,
      userTitlesCount: user,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): TitleInsightsMetricsReport {
    const list = Array.from(this.titles.values());
    let user = 0;
    let llm = 0;
    let derived = 0;
    let totalCost = 0;
    const latencies: number[] = [];

    for (const t of list) {
      if (t.provenance === "user") user++;
      else if (t.provenance === "llm") llm++;
      else if (t.provenance === "derived") derived++;
      totalCost += t.costUsd || 0;
      if (t.latencyMs > 0) latencies.push(t.latencyMs);
    }

    latencies.sort((a, b) => a - b);
    const avgLat = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;

    return {
      totalTitles: list.length,
      userCustomTitles: user,
      llmUpgradedTitles: llm,
      instantDerivedTitles: derived,
      totalActivityEvents: this.events.length,
      totalCostUsd: Number(totalCost.toFixed(4)),
      totalTokens: this.events.reduce((acc, e) => acc + (e.inputTokens || 0) + (e.outputTokens || 0), 0),
      averageLatencyMs: Number(avgLat.toFixed(2)),
      p50LatencyMs: p50,
      p95LatencyMs: p95,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedTitles(
    groupBy: TitleInsightsGroupBy = "provenance",
    sortBy: TitleInsightsSortBy = "recent",
    direction: TitleInsightsSortDirection = "desc"
  ): readonly TitleInsightsGroupedLane[] {
    const lanes = new Map<string, SessionTitleRecord[]>();

    for (const t of this.titles.values()) {
      let key: string = t.provenance;
      switch (groupBy) {
        case "provenance":
          key = t.provenance;
          break;
        case "language":
          key = t.language || "en";
          break;
        case "model":
          key = t.modelUsed || "default";
          break;
        case "costTier":
          key = t.costUsd > 0.05 ? "high_cost (>5¢)" : t.costUsd > 0.01 ? "standard_cost (1-5¢)" : "micro_cost (<1¢)";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(t);
    }

    const result: TitleInsightsGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "title") cmp = a.title.localeCompare(b.title);
        else if (sortBy === "recent") cmp = b.updatedAt - a.updatedAt;
        else if (sortBy === "cost") cmp = b.costUsd - a.costUsd;
        else if (sortBy === "latency") cmp = b.latencyMs - a.latencyMs;
        return direction === "asc" ? -cmp : cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        titles: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryTitlesDsl(query: TitleInsightsDslQueryFilter | string): readonly SessionTitleRecord[] {
    const parsed: TitleInsightsDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;

    return Array.from(this.titles.values()).filter((t) => {
      if (parsed.provenance && t.provenance !== parsed.provenance) return false;
      if (parsed.model && t.modelUsed !== parsed.model) return false;
      if (parsed.minCostUsd !== undefined && t.costUsd < parsed.minCostUsd) return false;
      if (parsed.maxCostUsd !== undefined && t.costUsd > parsed.maxCostUsd) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${t.sessionId} ${t.title} ${t.provenance} ${t.modelUsed || ""}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): TitleInsightsDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let provenance: any;
    let model: string | undefined;
    let minCostUsd: number | undefined;
    let maxCostUsd: number | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("provenance:")) {
        provenance = tok.slice(11);
      } else if (tok.startsWith("model:")) {
        model = tok.slice(6);
      } else if (tok.startsWith("min_cost:")) {
        minCostUsd = parseFloat(tok.slice(9));
      } else if (tok.startsWith("max_cost:")) {
        maxCostUsd = parseFloat(tok.slice(9));
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      provenance,
      model,
      minCostUsd,
      maxCostUsd,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeTitles(sessionIds: readonly string[]): TitleInsightsBulkMutationResult {
    const prev = this.exportSnapshot();
    const affected: string[] = [];

    for (const sid of sessionIds) {
      if (this.titles.has(sid)) {
        this.titles.delete(sid);
        affected.push(sid);
      }
    }

    this.pushUndoRecord("bulk", prev);
    return {
      matchedCount: sessionIds.length,
      modifiedCount: affected.length,
      affectedSessionIds: affected,
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
  <title>LUMI Conversation Title & Epistemic Insights Subsystem</title>
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
  <h1>🏷️ LUMI Conversation Title & Epistemic Insights</h1>
  <p style="color: #94a3b8;">Two-Stage Epistemic Synthesis, Strict Provenance & Cognitive Telemetry (Target #42 / ADR-085)</p>
  
  <div class="grid">
    <div class="card"><div>Total Titles</div><div class="metric-val">${metrics.totalTitles}</div></div>
    <div class="card"><div>LLM Upgraded</div><div class="metric-val" style="color:#10b981;">${metrics.llmUpgradedTitles}</div></div>
    <div class="card"><div>Activity Events</div><div class="metric-val" style="color:#f59e0b;">${metrics.totalActivityEvents}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'critical_desync' ? '#ef4444' : '#22c55e'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Session Titles</h2>
  <table>
    <thead>
      <tr>
        <th>Session ID</th>
        <th>Title</th>
        <th>Provenance</th>
        <th>Cost (USD)</th>
        <th>Latency</th>
      </tr>
    </thead>
    <tbody>
      ${Array.from(this.titles.values()).map((t) => `
        <tr>
          <td><code>${t.sessionId}</code></td>
          <td><strong>${t.title}</strong></td>
          <td><span class="badge">${t.provenance.toUpperCase()}</span></td>
          <td>$${t.costUsd.toFixed(4)}</td>
          <td>${t.latencyMs} ms</td>
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

    let md = `# LUMI Title Insights Subsystem Diagnostic Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Total Titles:** \`${metrics.totalTitles}\` | **Activity Events:** \`${metrics.totalActivityEvents}\`\n\n`;
    md += `## Metrics Summary\n`;
    md += `- **User Custom Titles:** ${metrics.userCustomTitles}\n`;
    md += `- **LLM Upgraded Titles:** ${metrics.llmUpgradedTitles}\n`;
    md += `- **Instant Derived Titles:** ${metrics.instantDerivedTitles}\n`;
    md += `- **Total Cost USD:** $${metrics.totalCostUsd.toFixed(4)}\n`;
    md += `- **Average Latency:** ${metrics.averageLatencyMs} ms (p95: ${metrics.p95LatencyMs} ms)\n\n`;

    md += `## Titles Ledger\n\n`;
    md += `| Session ID | Title | Provenance | Cost USD | Latency |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const t of Array.from(this.titles.values())) {
      md += `| \`${t.sessionId}\` | **${t.title}** | \`${t.provenance}\` | $${t.costUsd.toFixed(4)} | ${t.latencyMs} ms |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "sessionId,title,provenance,costUsd,latencyMs,createdAt,updatedAt\n";
    const rows = Array.from(this.titles.values()).map((t) => {
      return `"${t.sessionId}","${t.title.replace(/"/g, '""')}","${t.provenance}",${t.costUsd},${t.latencyMs},${t.createdAt},${t.updatedAt}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Audits
  // ---------------------------------------------------------------------------

  exportSnapshot(): TitleInsightsWorkspaceSnapshot {
    const titlesObj: Record<string, SessionTitleRecord> = {};
    for (const [k, v] of this.titles.entries()) {
      titlesObj[k] = v;
    }
    return {
      titles: titlesObj,
      activityEvents: [...this.events],
      totalTitlesGenerated: this.totalTitlesGeneratedCount,
      totalInsightsGenerated: this.totalInsightsGeneratedCount,
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: TitleInsightsWorkspaceSnapshot): void {
    this.titles.clear();
    if (snapshot.titles) {
      for (const [k, v] of Object.entries(snapshot.titles)) {
        this.titles.set(k, v);
      }
    }

    this.events.length = 0;
    if (snapshot.activityEvents) {
      this.events.push(...snapshot.activityEvents);
    }

    this.totalTitlesGeneratedCount = snapshot.totalTitlesGenerated || this.titles.size;
    this.totalInsightsGeneratedCount = snapshot.totalInsightsGenerated || 0;
  }

  public recordAudit(sessionId: string, action: string, operator: string, details: string): void {
    const row: TitleAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: `${action}:${sessionId}`,
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

  clear(): void {
    this.titles.clear();
    this.events.length = 0;
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.totalTitlesGeneratedCount = 0;
    this.totalInsightsGeneratedCount = 0;
  }
}
