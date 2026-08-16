/**
 * broccoli-title-insights-substrate.ts
 *
 * In-memory Broccolidb repository for Two-Stage Epistemic Session Title Generation,
 * Provenance Ledger, Token Economics, Activity Logs & Multi-Dimensional Analytics (Target #42 / Phase 109 / ADR-085).
 */

import type {
  SessionTitleRecord,
  SessionTitleProvenance,
  SessionActivityEvent,
  ConversationInsightsReport,
  TitleInsightsWorkspaceSnapshot,
  ModelUsageMetric,
  PlatformUsageMetric,
  ToolUsageMetric,
  SkillUsageMetric,
  TopSessionMetric,
  ActivityTrendMetric,
  SessionInsightsOverview,
  SessionTokenEconomics,
} from "../../../core/contracts/title-insights.contracts.js";

export class BroccoliTitleInsightsSubstrate {
  private readonly titles = new Map<string, SessionTitleRecord>();
  private readonly events: SessionActivityEvent[] = [];
  private totalTitlesGeneratedCount = 0;
  private totalInsightsGeneratedCount = 0;

  public getTitle(sessionId: string): SessionTitleRecord | undefined {
    return this.titles.get(sessionId);
  }

  public getAllTitles(): readonly SessionTitleRecord[] {
    return Array.from(this.titles.values());
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

    this.titles.set(record.sessionId, record);
    this.totalTitlesGeneratedCount++;
    return true;
  }

  public deleteTitle(sessionId: string): boolean {
    return this.titles.delete(sessionId);
  }

  public recordActivity(event: SessionActivityEvent): void {
    this.events.push(event);
    // Bounded in-memory event buffer (keep last 50,000 events)
    if (this.events.length > 50000) {
      this.events.shift();
    }
  }

  public getActivities(cutoffTimestamp = 0, sourceFilter?: string): readonly SessionActivityEvent[] {
    return this.events.filter((e) => {
      if (e.timestamp < cutoffTimestamp) return false;
      if (sourceFilter && e.platform !== sourceFilter) return false;
      return true;
    });
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

    const toolMap = new Map<
      string,
      { name: string; calls: number; success: number; failures: number; totalLatencyMs: number }
    >();

    const skillMap = new Map<
      string,
      { name: string; loads: number; edits: number; actions: number }
    >();

    const modelMap = new Map<
      string,
      {
        name: string;
        provider: string;
        sessions: Set<string>;
        messages: number;
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheWriteTokens: number;
        costUsd: number;
      }
    >();

    const platformMap = new Map<
      string,
      { name: string; sessions: Set<string>; messages: number; costUsd: number }
    >();

    // Activity matrix: 7 days x 24 hours
    const activityMatrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    let totalTokensAll = 0;
    let totalCostAll = 0;
    let totalInputTokensAll = 0;
    let totalOutputTokensAll = 0;
    let totalCacheReadTokensAll = 0;
    let totalCacheWriteTokensAll = 0;

    for (const evt of filteredEvents) {
      // Update session record
      let sess = sessionMap.get(evt.sessionId);
      if (!sess) {
        sess = {
          sessionId: evt.sessionId,
          platform: evt.platform,
          model: evt.model,
          startedAt: evt.timestamp,
          endedAt: evt.timestamp,
          messageCount: 0,
          toolCallCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd: 0,
        };
        sessionMap.set(evt.sessionId, sess);
      }

      sess.endedAt = Math.max(sess.endedAt, evt.timestamp);
      sess.startedAt = Math.min(sess.startedAt, evt.timestamp);

      const inp = evt.inputTokens || 0;
      const out = evt.outputTokens || 0;
      const cr = evt.cacheReadTokens || 0;
      const cw = evt.cacheWriteTokens || 0;
      const cost = evt.costUsd || 0;

      sess.inputTokens += inp;
      sess.outputTokens += out;
      sess.cacheReadTokens += cr;
      sess.cacheWriteTokens += cw;
      sess.costUsd += cost;

      totalInputTokensAll += inp;
      totalOutputTokensAll += out;
      totalCacheReadTokensAll += cr;
      totalCacheWriteTokensAll += cw;
      totalTokensAll += inp + out + cr + cw;
      totalCostAll += cost;

      if (evt.eventType === "message_sent") {
        sess.messageCount++;
      } else if (evt.eventType === "tool_called") {
        sess.toolCallCount++;
        if (evt.toolName) {
          let t = toolMap.get(evt.toolName);
          if (!t) {
            t = { name: evt.toolName, calls: 0, success: 0, failures: 0, totalLatencyMs: 0 };
            toolMap.set(evt.toolName, t);
          }
          t.calls++;
          if (evt.isSuccess !== false) {
            t.success++;
          } else {
            t.failures++;
          }
          t.totalLatencyMs += evt.latencyMs || 0;
        }
      } else if (evt.eventType === "skill_invoked") {
        if (evt.skillName) {
          let sk = skillMap.get(evt.skillName);
          if (!sk) {
            sk = { name: evt.skillName, loads: 0, edits: 0, actions: 0 };
            skillMap.set(evt.skillName, sk);
          }
          sk.actions++;
          sk.loads++;
        }
      }

      // Update model record
      let m = modelMap.get(evt.model);
      if (!m) {
        m = {
          name: evt.model,
          provider: evt.model.includes("gpt") || evt.model.includes("codex") ? "openai" : "anthropic",
          sessions: new Set(),
          messages: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd: 0,
        };
        modelMap.set(evt.model, m);
      }
      m.sessions.add(evt.sessionId);
      if (evt.eventType === "message_sent") m.messages++;
      m.inputTokens += inp;
      m.outputTokens += out;
      m.cacheReadTokens += cr;
      m.cacheWriteTokens += cw;
      m.costUsd += cost;

      // Update platform record
      let p = platformMap.get(evt.platform);
      if (!p) {
        p = { name: evt.platform, sessions: new Set(), messages: 0, costUsd: 0 };
        platformMap.set(evt.platform, p);
      }
      p.sessions.add(evt.sessionId);
      if (evt.eventType === "message_sent") p.messages++;
      p.costUsd += cost;

      // Update activity matrix
      const date = new Date(evt.timestamp);
      const day = date.getDay();
      const hour = date.getHours();
      activityMatrix[day][hour]++;
    }

    // Build metrics
    const totalSessions = Math.max(sessionMap.size, 1);
    let totalMessages = 0;
    let totalToolCalls = 0;
    let totalDurationSeconds = 0;

    const topSessionsList: TopSessionMetric[] = [];
    for (const sess of sessionMap.values()) {
      totalMessages += sess.messageCount;
      totalToolCalls += sess.toolCallCount;
      const dur = Math.max(1, Math.round((sess.endedAt - sess.startedAt) / 1000));
      totalDurationSeconds += dur;

      const titleRec = this.titles.get(sess.sessionId);
      topSessionsList.push({
        sessionId: sess.sessionId,
        title: titleRec?.title || "Untitled Session",
        source: sess.platform,
        model: sess.model,
        startedAt: sess.startedAt,
        durationSeconds: dur,
        messageCount: sess.messageCount,
        toolCallCount: sess.toolCallCount,
        totalTokens: sess.inputTokens + sess.outputTokens + sess.cacheReadTokens + sess.cacheWriteTokens,
        totalCostUsd: Number(sess.costUsd.toFixed(4)),
      });
    }

    topSessionsList.sort((a, b) => b.totalCostUsd - a.totalCostUsd);

    const totalToolCallsCount = Array.from(toolMap.values()).reduce((sum, t) => sum + t.calls, 0);
    const toolsMetrics: ToolUsageMetric[] = Array.from(toolMap.values())
      .map((t) => ({
        toolName: t.name,
        category: t.name.startsWith("browser_")
          ? "browser"
          : t.name.startsWith("fuzzy_")
          ? "fuzzy"
          : t.name.startsWith("patch_")
          ? "filesystem"
          : "general",
        callCount: t.calls,
        successCount: t.success,
        failureCount: t.failures,
        errorRate: t.calls > 0 ? Number((t.failures / t.calls).toFixed(3)) : 0,
        averageLatencyMs: t.calls > 0 ? Math.round(t.totalLatencyMs / t.calls) : 0,
        percentageOfTotalCalls:
          totalToolCallsCount > 0 ? Number(((t.calls / totalToolCallsCount) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.callCount - a.callCount);

    const totalSkillActionsCount = Array.from(skillMap.values()).reduce((sum, s) => sum + s.actions, 0);
    const skillsMetrics: SkillUsageMetric[] = Array.from(skillMap.values())
      .map((s) => ({
        skillName: s.name,
        loadsCount: s.loads,
        editsCount: s.edits,
        actionsCount: s.actions,
        distinctSkillsUsed: 1,
        percentageOfTotalActions:
          totalSkillActionsCount > 0
            ? Number(((s.actions / totalSkillActionsCount) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.actionsCount - a.actionsCount);

    const modelsMetrics: ModelUsageMetric[] = Array.from(modelMap.values())
      .map((m) => ({
        modelName: m.name,
        provider: m.provider,
        sessionCount: m.sessions.size,
        messageCount: m.messages,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        cacheReadTokens: m.cacheReadTokens,
        cacheWriteTokens: m.cacheWriteTokens,
        totalCostUsd: Number(m.costUsd.toFixed(4)),
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount);

    const platformsMetrics: PlatformUsageMetric[] = Array.from(platformMap.values())
      .map((p) => ({
        platform: p.name,
        sessionCount: p.sessions.size,
        messageCount: p.messages,
        totalCostUsd: Number(p.costUsd.toFixed(4)),
        percentageOfTotalSessions: Number(((p.sessions.size / totalSessions) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount);

    // Peak activity calculation
    let maxHourCount = 0;
    let peakHour = 14;
    let maxDayCount = 0;
    let peakDay = 3;
    let totalActiveHours = 0;

    for (let d = 0; d < 7; d++) {
      let daySum = 0;
      for (let h = 0; h < 24; h++) {
        const count = activityMatrix[d][h];
        daySum += count;
        if (count > maxHourCount) {
          maxHourCount = count;
          peakHour = h;
        }
        if (count > 0) totalActiveHours++;
      }
      if (daySum > maxDayCount) {
        maxDayCount = daySum;
        peakDay = d;
      }
    }

    const activityTrend: ActivityTrendMetric = {
      dayOfWeek: peakDay,
      hourOfDay: peakHour,
      activityMatrix,
      peakHour,
      peakDay,
      totalActiveHours,
    };

    const overview: SessionInsightsOverview = {
      totalSessions: sessionMap.size,
      totalMessages,
      totalToolCalls,
      totalDurationSeconds,
      averageMessagesPerSession: Number((totalMessages / totalSessions).toFixed(1)),
      averageToolCallsPerSession: Number((totalToolCalls / totalSessions).toFixed(1)),
      totalCostUsd: Number(totalCostAll.toFixed(4)),
      averageCostPerSession: Number((totalCostAll / totalSessions).toFixed(4)),
      totalTokens: totalTokensAll,
      cacheEfficiencyRate:
        totalTokensAll > 0
          ? Number(((totalCacheReadTokensAll / totalTokensAll) * 100).toFixed(1))
          : 0,
    };

    const tokenEconomics: SessionTokenEconomics = {
      inputTokens: totalInputTokensAll,
      outputTokens: totalOutputTokensAll,
      cacheReadTokens: totalCacheReadTokensAll,
      cacheWriteTokens: totalCacheWriteTokensAll,
      totalTokens: totalTokensAll,
      estimatedCostUsd: Number(totalCostAll.toFixed(4)),
      actualCostUsd: Number(totalCostAll.toFixed(4)),
      costSource: "canonical_pricing",
      costStatus: "exact",
    };

    return {
      generatedAt: now,
      dateRangeDays: days,
      sourceFilter,
      isEmpty: false,
      overview,
      models: modelsMetrics,
      platforms: platformsMetrics,
      tools: toolsMetrics,
      skills: {
        summary: {
          totalSkillLoads: skillsMetrics.reduce((s, k) => s + k.loadsCount, 0),
          totalSkillEdits: skillsMetrics.reduce((s, k) => s + k.editsCount, 0),
          totalSkillActions: totalSkillActionsCount,
          distinctSkillsUsed: skillMap.size,
        },
        topSkills: skillsMetrics.slice(0, 10),
      },
      activity: activityTrend,
      topSessions: topSessionsList.slice(0, 10),
      tokenEconomics,
    };
  }

  private createEmptyReport(days: number, sourceFilter?: string, now = Date.now()): ConversationInsightsReport {
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
        summary: {
          totalSkillLoads: 0,
          totalSkillEdits: 0,
          totalSkillActions: 0,
          distinctSkillsUsed: 0,
        },
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
        costStatus: "unpriced",
      },
    };
  }

  public exportSnapshot(): TitleInsightsWorkspaceSnapshot {
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

  public restoreSnapshot(snapshot: TitleInsightsWorkspaceSnapshot): void {
    this.titles.clear();
    for (const [k, v] of Object.entries(snapshot.titles)) {
      this.titles.set(k, v);
    }
    this.events.length = 0;
    this.events.push(...snapshot.activityEvents);
    this.totalTitlesGeneratedCount = snapshot.totalTitlesGenerated;
    this.totalInsightsGeneratedCount = snapshot.totalInsightsGenerated;
  }

  public clear(): void {
    this.titles.clear();
    this.events.length = 0;
    this.totalTitlesGeneratedCount = 0;
    this.totalInsightsGeneratedCount = 0;
  }
}
