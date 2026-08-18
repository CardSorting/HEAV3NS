/**
 * prompt-cache-supervisor.ts
 *
 * Master Prompt Cache Supervisor coordinating byte-stable system envelopes,
 * 4-breakpoint cache control planning, and <think> reasoning scrubbing (Phase 93 / ADR-045 / Target #82).
 */

import type {
  ByteStablePromptEnvelope,
  PromptCacheBreakpointRow,
  PromptCacheConfig,
  PromptCacheDslQueryFilter,
  PromptCacheGroupBy,
  PromptCacheGroupedLane,
  PromptCacheHealthAuditReport,
  PromptCacheMetrics,
  PromptCacheMetricsReport,
  PromptCacheSortBy,
  PromptCacheSortDirection,
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
