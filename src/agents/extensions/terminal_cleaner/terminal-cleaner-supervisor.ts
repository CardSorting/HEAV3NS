/**
 * terminal-cleaner-supervisor.ts
 *
 * Master supervisor coordinating text output sanitization, display safety,
 * opaque document protections, health matrix audits, and operational metrics (Phase 136 / ADR-112 / Target #76).
 */

import type { BroccoliTerminalCleanerSubstrate } from "../../../sessions/extensions/terminal_cleaner/broccoli-terminal-cleaner-substrate.js";
import type { DeterministicTerminalCleanerEngine } from "./deterministic-terminal-cleaner-engine.js";
import type {
  AnsiCleanMode,
  BinaryAssetClassification,
  TerminalCleanerConfig,
  TerminalCleanerDslQueryFilter,
  TerminalCleanerGroupBy,
  TerminalCleanerHealthAuditReport,
  TerminalCleanerMetricsReport,
  TerminalCleanerSortBy,
  TerminalCleanerSortDirection,
  TerminalCleanResult,
} from "../../../core/contracts/terminal-cleaner.contracts.js";

export class TerminalCleanerSupervisor {
  private readonly substrate: BroccoliTerminalCleanerSubstrate;
  private readonly engine: DeterministicTerminalCleanerEngine;

  constructor(substrate: BroccoliTerminalCleanerSubstrate, engine: DeterministicTerminalCleanerEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public getSubstrate(): BroccoliTerminalCleanerSubstrate {
    return this.substrate;
  }

  public getEngine(): DeterministicTerminalCleanerEngine {
    return this.engine;
  }

  public configure(config: Partial<TerminalCleanerConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): TerminalCleanerConfig {
    return this.substrate.getConfig();
  }

  public getMetrics(): TerminalCleanerMetricsReport {
    return this.substrate.getMetrics();
  }

  public auditHealth(): TerminalCleanerHealthAuditReport {
    return this.substrate.auditHealth();
  }

  /**
   * Strips ANSI escape sequences from text (e.g. before returning tool output to LLM).
   */
  public stripAnsi(text: string): string {
    const config = this.substrate.getConfig();
    if (!config.enabled || !config.stripAnsiSequences) {
      return text;
    }

    const res = this.engine.stripAnsi(text);
    this.substrate.recordClean({
      ansiStrippedCount: res.wasModified ? 1 : 0,
      fastPath: res.fastPath,
    });
    return res.cleaned;
  }

  /**
   * Sanitizes untrusted text for safe terminal display, eliminating control bytes and \r spoofing.
   */
  public sanitizeDisplayText(text: string): string {
    const config = this.substrate.getConfig();
    if (!config.enabled) {
      return text;
    }

    const res = this.engine.sanitizeDisplayText(text);
    this.substrate.recordClean({
      controlFilteredCount: res.wasModified ? 1 : 0,
      fastPath: res.fastPath,
    });
    return res.cleaned;
  }

  /**
   * Performs high-precision text cleaning and returns detailed telemetry.
   */
  public cleanWithMetrics(text: string, mode: AnsiCleanMode = "sanitize_display"): TerminalCleanResult {
    const res = this.engine.cleanWithMetrics(text, mode);
    this.substrate.recordEvent({
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      mode,
      originalLength: res.originalLength,
      cleanedLength: res.cleanedLength,
      ansiCodesCount: res.ansiCodesCount,
      controlCharsCount: res.controlCharsCount,
      durationMs: res.durationMs,
      timestamp: Date.now(),
    });
    return res;
  }

  /**
   * Classifies a path as text, binary, opaque_document, or pdf.
   */
  public classifyPath(filePath: string): BinaryAssetClassification {
    return this.engine.classifyPath(filePath);
  }

  /**
   * Checks whether a path can safely receive a plain-text write/patch.
   */
  public canWriteAsText(filePath: string): { allowed: boolean; reason?: string } {
    const config = this.substrate.getConfig();
    const result = this.engine.canWriteAsText(filePath, config);
    if (!result.allowed) {
      this.substrate.recordBlockedOpaqueWrite();
    }
    return result;
  }

  public getGroupedEvents(groupBy?: TerminalCleanerGroupBy, sortBy?: TerminalCleanerSortBy, direction?: TerminalCleanerSortDirection) {
    return this.substrate.getGroupedEvents(groupBy, sortBy, direction);
  }

  public queryDsl(query: TerminalCleanerDslQueryFilter | string) {
    return this.substrate.queryEventsDsl(query);
  }

  public bulkPurge(ids: readonly string[]) {
    return this.substrate.bulkPurgeEvents(ids);
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
