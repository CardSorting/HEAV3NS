/**
 * title-insights-supervisor.ts
 *
 * Master Supervisor coordinating Two-Stage Session Titling, Provenance Tracking,
 * Activity Event Recording & Conversation Insights (Target #42 / Phase 109 / ADR-085).
 */

import { DeterministicTitleGenerator } from "./deterministic-title-generator.js";
import { ConversationInsightsEngine } from "./conversation-insights-engine.js";
import type { BroccoliTitleInsightsSubstrate } from "../../../sessions/extensions/title_insights/broccoli-title-insights-substrate.js";
import type {
  SessionTitleRecord,
  SessionTitleProvenance,
  TitleGenerationOptions,
  TitleGenerationResult,
  SessionActivityEvent,
  ConversationInsightsReport,
} from "../../../core/contracts/title-insights.contracts.js";

export class TitleInsightsSupervisor {
  public readonly titleGenerator: DeterministicTitleGenerator;
  public readonly insightsEngine: ConversationInsightsEngine;
  private readonly substrate: BroccoliTitleInsightsSubstrate;

  constructor(
    substrate: BroccoliTitleInsightsSubstrate,
    titleGenerator = new DeterministicTitleGenerator(),
    insightsEngine?: ConversationInsightsEngine
  ) {
    this.substrate = substrate;
    this.titleGenerator = titleGenerator;
    this.insightsEngine = insightsEngine || new ConversationInsightsEngine(substrate);
  }

  /**
   * Handle an opening user message for a session.
   * Runs instant Stage 1 derived titling, records to substrate, and optionally triggers Stage 2 LLM upgrade.
   */
  public async handleOpeningMessage(
    sessionId: string,
    userMessage: string,
    options: TitleGenerationOptions = {},
    llmCall?: (prompt: string) => Promise<string>
  ): Promise<TitleGenerationResult> {
    const existing = this.substrate.getTitle(sessionId);
    if (existing && existing.provenance === "user") {
      return {
        success: true,
        title: existing.title,
        provenance: "user",
        stage: "user_custom",
        latencyMs: 0,
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    const result = await this.titleGenerator.generateTitle(userMessage, options, llmCall);

    const now = Date.now();
    const record: SessionTitleRecord = {
      sessionId,
      title: result.title,
      provenance: result.provenance,
      language: options.language,
      latencyMs: result.latencyMs,
      costUsd: result.costUsd,
      inputChars: userMessage.length,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.substrate.recordTitle(record);
    return result;
  }

  /**
   * Explicitly set or rename a session title with a specific provenance.
   * Setting with provenance 'user' guarantees it cannot be overwritten by LLM or derived titles.
   */
  public setTitle(sessionId: string, title: string, provenance: SessionTitleProvenance = "user"): boolean {
    const clean = this.titleGenerator.cleanTitle(title) || title.trim();
    if (!clean) return false;

    const existing = this.substrate.getTitle(sessionId);
    const now = Date.now();

    const record: SessionTitleRecord = {
      sessionId,
      title: clean,
      provenance,
      latencyMs: 0,
      costUsd: 0,
      inputChars: clean.length,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    return this.substrate.recordTitle(record);
  }

  public getTitle(sessionId: string): SessionTitleRecord | undefined {
    return this.substrate.getTitle(sessionId);
  }

  public getAllTitles(): readonly SessionTitleRecord[] {
    return this.substrate.getAllTitles();
  }

  public deleteTitle(sessionId: string): boolean {
    return this.substrate.deleteTitle(sessionId);
  }

  public recordActivity(event: SessionActivityEvent): void {
    this.substrate.recordActivity(event);
  }

  public generateInsights(days = 30, sourceFilter?: string): ConversationInsightsReport {
    return this.insightsEngine.generateReport(days, sourceFilter);
  }

  public formatTerminalReport(report: ConversationInsightsReport): string {
    return this.insightsEngine.formatTerminalReport(report);
  }

  public getUsageBreakdown(days = 30, sourceFilter?: string) {
    return this.insightsEngine.getUsageBreakdown(days, sourceFilter);
  }
}
