/**
 * conversation-insights-engine.ts
 *
 * Multi-Dimensional Session Insights & ANSI Terminal Dashboard Engine (Target #42 / Phase 109 / ADR-085).
 */

import type { BroccoliTitleInsightsSubstrate } from "../../../sessions/extensions/title_insights/broccoli-title-insights-substrate.js";
import type {
  ConversationInsightsReport,
  ToolUsageMetric,
  SkillUsageMetric,
  ModelUsageMetric,
  PlatformUsageMetric,
} from "../../../core/contracts/title-insights.contracts.js";

export class ConversationInsightsEngine {
  private readonly substrate: BroccoliTitleInsightsSubstrate;

  constructor(substrate: BroccoliTitleInsightsSubstrate) {
    this.substrate = substrate;
  }

  public generateReport(days = 30, sourceFilter?: string): ConversationInsightsReport {
    return this.substrate.generateInsights(days, sourceFilter);
  }

  public getUsageBreakdown(days = 30, sourceFilter?: string) {
    const report = this.generateReport(days, sourceFilter);
    return {
      tools: report.tools,
      skills: report.skills,
      tokenEconomics: report.tokenEconomics,
    };
  }

  /**
   * Render simple horizontal bar chart string.
   */
  public renderBar(value: number, max: number, maxWidth = 20): string {
    if (max <= 0 || value <= 0) return "";
    const len = Math.max(1, Math.round((value / max) * maxWidth));
    return "█".repeat(len);
  }

  /**
   * Format full ANSI terminal dashboard report.
   */
  public formatTerminalReport(report: ConversationInsightsReport): string {
    if (report.isEmpty) {
      return [
        "╔════════════════════════════════════════════════════════════════╗",
        "║                LUMI CONVERSATION INSIGHTS DASHBOARD            ║",
        "╚════════════════════════════════════════════════════════════════╝",
        "",
        `  No session activity found for the last ${report.dateRangeDays} days.`,
        "",
      ].join("\n");
    }

    const { overview, tokenEconomics, tools, skills, models, platforms, activity } = report;
    const lines: string[] = [];

    lines.push("╔══════════════════════════════════════════════════════════════════════════════╗");
    lines.push("║                     LUMI CONVERSATION INSIGHTS DASHBOARD                     ║");
    lines.push("╚══════════════════════════════════════════════════════════════════════════════╝");
    lines.push(`  Timeframe: Last ${report.dateRangeDays} Days ${report.sourceFilter ? `[Platform: ${report.sourceFilter}]` : "[All Platforms]"}`);
    lines.push("");

    // Overview Card
    lines.push("┌─ [OVERVIEW METRICS] ─────────────────────────────────────────────────────────┐");
    lines.push(`│  Total Sessions:       ${overview.totalSessions.toString().padEnd(12)} Total Messages:      ${overview.totalMessages.toString().padEnd(12)}│`);
    lines.push(`│  Total Tool Calls:     ${overview.totalToolCalls.toString().padEnd(12)} Total Duration:      ${(overview.totalDurationSeconds + "s").padEnd(12)}│`);
    lines.push(`│  Avg Msgs/Session:     ${overview.averageMessagesPerSession.toString().padEnd(12)} Avg Tools/Session:   ${overview.averageToolCallsPerSession.toString().padEnd(12)}│`);
    lines.push(`│  Total Cost:           $${overview.totalCostUsd.toFixed(4).padEnd(11)} Avg Cost/Session:    $${overview.averageCostPerSession.toFixed(4).padEnd(11)}│`);
    lines.push(`│  Total Tokens:         ${overview.totalTokens.toLocaleString().padEnd(12)} Cache Hit Rate:      ${(overview.cacheEfficiencyRate + "%").padEnd(12)}│`);
    lines.push("└──────────────────────────────────────────────────────────────────────────────┘");
    lines.push("");

    // Token Economics
    lines.push("┌─ [TOKEN ECONOMICS & CACHE ACCELERATION] ────────────────────────────────────┐");
    lines.push(`│  Input Tokens:        ${tokenEconomics.inputTokens.toLocaleString().padEnd(15)} Output Tokens:       ${tokenEconomics.outputTokens.toLocaleString().padEnd(15)}│`);
    lines.push(`│  Cache Read Tokens:   ${tokenEconomics.cacheReadTokens.toLocaleString().padEnd(15)} Cache Write Tokens:  ${tokenEconomics.cacheWriteTokens.toLocaleString().padEnd(15)}│`);
    lines.push(`│  Estimated Spend:     $${tokenEconomics.estimatedCostUsd.toFixed(4).padEnd(14)} Actual Invoiced:     $${tokenEconomics.actualCostUsd.toFixed(4).padEnd(14)}│`);
    lines.push("└──────────────────────────────────────────────────────────────────────────────┘");
    lines.push("");

    // Top Tools
    if (tools.length > 0) {
      lines.push("┌─ [TOP TOOLS UTILIZATION] ───────────────────────────────────────────────────┐");
      lines.push("│ Tool Name             Calls   Errors  Error Rate  Latency     Share          │");
      lines.push("├──────────────────────────────────────────────────────────────────────────────┤");
      const maxCalls = Math.max(...tools.map((t) => t.callCount), 1);
      for (const t of tools.slice(0, 8)) {
        const bar = this.renderBar(t.callCount, maxCalls, 10);
        const name = t.toolName.slice(0, 20).padEnd(20);
        const calls = t.callCount.toString().padEnd(7);
        const errors = t.failureCount.toString().padEnd(7);
        const errRate = (t.errorRate * 100).toFixed(1) + "%";
        const lat = (t.averageLatencyMs + "ms").padEnd(11);
        lines.push(`│ ${name}  ${calls} ${errors} ${errRate.padEnd(11)} ${lat} ${bar.padEnd(10)} │`);
      }
      lines.push("└──────────────────────────────────────────────────────────────────────────────┘");
      lines.push("");
    }

    // Top Skills
    if (skills.topSkills.length > 0) {
      lines.push("┌─ [SKILL ENGAGEMENT] ─────────────────────────────────────────────────────────┐");
      lines.push("│ Skill Name                      Loads   Edits   Actions   Share              │");
      lines.push("├──────────────────────────────────────────────────────────────────────────────┤");
      const maxActions = Math.max(...skills.topSkills.map((s) => s.actionsCount), 1);
      for (const s of skills.topSkills.slice(0, 5)) {
        const bar = this.renderBar(s.actionsCount, maxActions, 12);
        const name = s.skillName.slice(0, 30).padEnd(30);
        const loads = s.loadsCount.toString().padEnd(7);
        const edits = s.editsCount.toString().padEnd(7);
        const actions = s.actionsCount.toString().padEnd(9);
        lines.push(`│ ${name}  ${loads} ${edits} ${actions} ${bar.padEnd(12)} │`);
      }
      lines.push("└──────────────────────────────────────────────────────────────────────────────┘");
      lines.push("");
    }

    // Model & Platform Breakdown
    if (models.length > 0 || platforms.length > 0) {
      lines.push("┌─ [MODELS & PLATFORMS DISTRIBUTION] ─────────────────────────────────────────┐");
      for (const m of models.slice(0, 4)) {
        lines.push(`│  Model: ${m.modelName.padEnd(24)} Sessions: ${m.sessionCount.toString().padEnd(5)} Cost: $${m.totalCostUsd.toFixed(4).padEnd(10)} │`);
      }
      for (const p of platforms.slice(0, 3)) {
        lines.push(`│  Platform: ${p.platform.padEnd(21)} Sessions: ${p.sessionCount.toString().padEnd(5)} Share: ${(p.percentageOfTotalSessions + "%").padEnd(9)} │`);
      }
      lines.push("└──────────────────────────────────────────────────────────────────────────────┘");
      lines.push("");
    }

    // Peak Activity
    const daysName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    lines.push(`  Peak Activity: ${daysName[activity.peakDay]} at ${activity.peakHour}:00 (Total Active Windows: ${activity.totalActiveHours})`);

    return lines.join("\n");
  }
}
