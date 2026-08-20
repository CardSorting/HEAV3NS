/**
 * prompt-cache-supervisor.ts
 *
 * Master Prompt Cache Supervisor coordinating byte-stable system envelopes,
 * 5-tier cache control planning, reasoning scrubbing, and ROI telemetry (Phase 93 / ADR-045 / Target #82).
 */

import type {
  ByteStablePromptEnvelope,
  HumanDiagnosticSummary,
  PromptCacheAlertEvent,
  PromptCacheAutoTuneResult,
  PromptCacheBreakpointRow,
  PromptCacheConfig,
  PromptCacheDslQueryFilter,
  PromptCacheEfficiencyAnalysis,
  PromptCacheExplainPlan,
  PromptCacheGroupBy,
  PromptCacheGroupedLane,
  PromptCacheHealthAuditReport,
  PromptCacheInvalidationForensic,
  PromptCacheLayeredFingerprint,
  PromptCacheMetrics,
  PromptCacheMetricsReport,
  PromptCacheMultiProviderRoiMatrix,
  PromptCachePrescription,
  PromptCacheRemediationRecipe,
  PromptCacheSavingsForecast,
  PromptCacheSavingsSimulation,
  PromptCacheScorecard,
  PromptCacheSortBy,
  PromptCacheSortDirection,
  PromptCacheTelemetryHeaders,
  PromptCacheWaterfallTrace,
  ProviderCacheDirectives,
  ReasoningSanitizationResult,
} from "../../../core/contracts/prompt-cache.contracts.js";
import { DeterministicPromptCacher } from "../../../tooling/extensions/prompt/deterministic-prompt-cacher.js";
import { BroccoliPromptCacheSubstrate } from "../../../sessions/extensions/prompt/broccoli-prompt-cache-substrate.js";

export class PromptCacheSupervisor {
  private readonly cacher: DeterministicPromptCacher;
  private readonly substrate: BroccoliPromptCacheSubstrate;

  constructor(
    cacher: DeterministicPromptCacher,
    substrate: BroccoliPromptCacheSubstrate
  ) {
    this.cacher = cacher;
    this.substrate = substrate;
  }

  public getSubstrate(): BroccoliPromptCacheSubstrate {
    return this.substrate;
  }

  public getCacher(): DeterministicPromptCacher {
    return this.cacher;
  }

  public configure(config: Partial<PromptCacheConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): PromptCacheConfig {
    return this.substrate.getConfig();
  }

  /**
   * Generates and stores a byte-stable prompt cache plan.
   */
  public generatePlan(
    systemPrompt: string,
    messages: readonly { role: string; content?: string }[] = [],
    tools: readonly unknown[] = []
  ): ByteStablePromptEnvelope {
    const envelope = this.cacher.buildCachePlan(systemPrompt, messages, tools);
    this.substrate.setLatestEnvelope(envelope);
    return envelope;
  }

  /**
   * Scrubs raw <think> tags and chain-of-thought tokens from assistant outputs.
   */
  public sanitizeAssistantResponse(rawContent: string): ReasoningSanitizationResult {
    const result = this.cacher.scrubReasoning(rawContent);
    this.substrate.recordSanitization(result);
    return result;
  }

  /**
   * Retrieves the latest active prompt cache envelope.
   */
  public getLatestEnvelope(): ByteStablePromptEnvelope | undefined {
    return this.substrate.getLatestEnvelope();
  }

  /**
   * Retrieves the sanitization history.
   */
  public getSanitizationStats(): readonly ReasoningSanitizationResult[] {
    return this.substrate.getSanitizationHistory();
  }

  public auditHealth(): PromptCacheHealthAuditReport {
    return this.substrate.auditHealth();
  }

  public getMetrics(): PromptCacheMetrics {
    return this.substrate.getMetrics();
  }

  public getMetricsReport(): PromptCacheMetricsReport {
    return this.substrate.getMetricsReport();
  }

  public getHumanDiagnosticSummary(): HumanDiagnosticSummary {
    return this.substrate.getHumanDiagnosticSummary();
  }

  public getScorecard(): PromptCacheScorecard {
    return this.substrate.getScorecard();
  }

  public getInvalidationForensics(previousPrompt?: string): PromptCacheInvalidationForensic {
    return this.substrate.getInvalidationForensic(previousPrompt);
  }

  public detectInvalidationPoint(prevSystemPrompt: string, newSystemPrompt: string): PromptCacheInvalidationForensic {
    return this.cacher.detectInvalidationPoint(prevSystemPrompt, newSystemPrompt);
  }

  public getOptimizationPrescriptions(): readonly PromptCachePrescription[] {
    return this.substrate.getOptimizationPrescriptions();
  }

  public getMultiProviderRoiMatrix(
    promptTokens?: number,
    cachedTokens?: number
  ): PromptCacheMultiProviderRoiMatrix {
    return this.substrate.getMultiProviderRoiMatrix(promptTokens, cachedTokens);
  }

  public getTelemetryHeaders(): PromptCacheTelemetryHeaders {
    return this.substrate.getTelemetryHeaders();
  }

  public getSavingsForecast(projectedDailyTurns?: number, modelId?: string): PromptCacheSavingsForecast {
    return this.substrate.getSavingsForecast(projectedDailyTurns, modelId);
  }

  public getLayeredFingerprint(
    systemPrompt?: string,
    tools?: readonly unknown[],
    messages?: readonly { role: string; content?: string }[]
  ): PromptCacheLayeredFingerprint {
    return this.substrate.getLayeredFingerprint(systemPrompt, tools, messages);
  }

  public getRemediationRecipes(): readonly PromptCacheRemediationRecipe[] {
    return this.substrate.getRemediationRecipes();
  }

  public getWaterfallTrace(modelId?: string): PromptCacheWaterfallTrace {
    return this.substrate.getWaterfallTrace(modelId);
  }

  public auditAlerts(): readonly PromptCacheAlertEvent[] {
    return this.substrate.auditAlerts();
  }

  public explainPlan(
    systemPrompt?: string,
    tools?: readonly unknown[],
    messages?: readonly { role: string; content?: string }[],
    modelId?: string
  ): PromptCacheExplainPlan {
    return this.substrate.explainPlan(systemPrompt, tools, messages, modelId);
  }

  public autoTuneSystemPrompt(systemPrompt: string): PromptCacheAutoTuneResult {
    return this.substrate.autoTuneSystemPrompt(systemPrompt);
  }

  public analyzePromptEfficiency(
    systemPrompt: string,
    messages: readonly { role: string; content?: string }[] = [],
    tools: readonly unknown[] = [],
    modelId?: string
  ): PromptCacheEfficiencyAnalysis {
    return this.cacher.analyzeEfficiency(systemPrompt, messages, tools, modelId);
  }

  public simulateSavings(
    modelId?: string,
    turnCount?: number,
    promptTokens?: number
  ): PromptCacheSavingsSimulation {
    return this.cacher.simulateSavings(modelId, turnCount, promptTokens);
  }

  public getProviderDirectives(modelId?: string): ProviderCacheDirectives {
    return this.cacher.getProviderDirectives(modelId);
  }

  public canonicalizeTools(tools: readonly unknown[] = []): string {
    return this.cacher.canonicalizeToolDefinitions(tools);
  }

  public getGroupedBreakpoints(
    groupBy?: PromptCacheGroupBy,
    sortBy?: PromptCacheSortBy,
    direction?: PromptCacheSortDirection
  ): readonly PromptCacheGroupedLane[] {
    return this.substrate.getGroupedBreakpoints(groupBy, sortBy, direction);
  }

  public queryDsl(query: PromptCacheDslQueryFilter | string): readonly PromptCacheBreakpointRow[] {
    return this.substrate.queryBreakpointsDsl(query);
  }

  public bulkPurge(ids: readonly string[]) {
    return this.substrate.bulkPurgeBreakpoints(ids);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }
}

