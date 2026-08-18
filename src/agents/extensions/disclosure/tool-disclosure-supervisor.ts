/**
 * tool-disclosure-supervisor.ts
 *
 * Master Tool Disclosure Supervisor coordinating progressive tool disclosure,
 * dynamic tier evaluation, and deferred tool dispatching (Phase 91 / ADR-043 / Target #83).
 */

import type {
  DeferredToolDefinition,
  DeferredToolRow,
  DisclosureManifest,
  ToolDisclosureConfig,
  ToolDisclosureDslQueryFilter,
  ToolDisclosureGroupBy,
  ToolDisclosureGroupedLane,
  ToolDisclosureHealthAuditReport,
  ToolDisclosureMetrics,
  ToolDisclosureMetricsReport,
  ToolDisclosureSortBy,
  ToolDisclosureSortDirection,
  ToolDisclosureWorkspaceSnapshot,
  ToolSearchResult,
} from "../../../core/contracts/tool-disclosure.contracts.js";
import { DeterministicToolDiscloser } from "../../../tooling/extensions/disclosure/deterministic-tool-discloser.js";
import { BroccoliDisclosureSubstrate } from "../../../sessions/extensions/disclosure/broccoli-disclosure-substrate.js";

export class ToolDisclosureSupervisor {
  private readonly discloser: DeterministicToolDiscloser;
  private readonly substrate: BroccoliDisclosureSubstrate;

  constructor(
    discloser: DeterministicToolDiscloser,
    substrate: BroccoliDisclosureSubstrate
  ) {
    this.discloser = discloser;
    this.substrate = substrate;
  }

  public getSubstrate(): BroccoliDisclosureSubstrate {
    return this.substrate;
  }

  public getDiscloser(): DeterministicToolDiscloser {
    return this.discloser;
  }

  public configure(config: Partial<ToolDisclosureConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): ToolDisclosureConfig {
    return this.substrate.getConfig();
  }

  public registerTool(tool: DeferredToolDefinition): void {
    this.discloser.registerTool(tool);
    this.substrate.registerTool(tool);
  }

  public removeTool(name: string): boolean {
    return this.substrate.removeTool(name);
  }

  /**
   * Searches the deferred tool catalog.
   */
  public searchTools(query: string, tag?: string, namespace?: string): ToolSearchResult {
    this.substrate.recordSearch();
    const result = this.discloser.search(query, tag, namespace);

    const config = this.substrate.getConfig();
    if (config.autoActivateOnSearch) {
      for (const tool of result.tools) {
        this.substrate.activateTool(tool.name);
      }
    }

    return result;
  }

  /**
   * Describes a deferred tool in detail.
   */
  public describeTool(name: string): DeferredToolDefinition | undefined {
    return this.substrate.getTool(name) || this.discloser.getTool(name);
  }

  /**
   * Marks a deferred tool as activated in the session.
   */
  public activateTool(name: string): boolean {
    return this.substrate.activateTool(name);
  }

  public deactivateTool(name: string): boolean {
    return this.substrate.deactivateTool(name);
  }

  /**
   * Returns disclosure tier and active catalog manifest.
   */
  public getManifest(tokenBudget: number = 2000): DisclosureManifest {
    const manifest = this.discloser.determineDisclosureTier(tokenBudget);
    this.substrate.setActiveTier(manifest.activeTier);
    return manifest;
  }

  /**
   * Returns current workspace snapshot.
   */
  public getStats(): ToolDisclosureWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  /**
   * Lists all activated tools in the session.
   */
  public getActivatedTools(): readonly string[] {
    return this.substrate.getActivatedTools();
  }

  public auditHealth(): ToolDisclosureHealthAuditReport {
    return this.substrate.auditHealth();
  }

  public getMetrics(): ToolDisclosureMetrics {
    return this.substrate.getMetrics();
  }

  public getMetricsReport(): ToolDisclosureMetricsReport {
    return this.substrate.getMetricsReport();
  }

  public getGroupedTools(
    groupBy?: ToolDisclosureGroupBy,
    sortBy?: ToolDisclosureSortBy,
    direction?: ToolDisclosureSortDirection
  ): readonly ToolDisclosureGroupedLane[] {
    return this.substrate.getGroupedTools(groupBy, sortBy, direction);
  }

  public queryDsl(query: ToolDisclosureDslQueryFilter | string): readonly DeferredToolRow[] {
    return this.substrate.queryToolsDsl(query);
  }

  public bulkPurge(names: readonly string[]) {
    return this.substrate.bulkPurgeTools(names);
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
