/**
 * context-breakdown-supervisor.ts
 *
 * Master supervisor coordinating live context token estimation, categorical attribution,
 * compression threshold monitoring, and telemetry ledgers (Phase 127 / ADR-103 / Target #60).
 */

import type { BroccoliContextBreakdownSubstrate } from "../../../sessions/extensions/context_breakdown/broccoli-context-breakdown-substrate.js";
import type { DeterministicContextBreakdownEngine } from "./deterministic-context-breakdown-engine.js";
import type {
  ContextBreakdownConfig,
  ContextBreakdownMetrics,
  ContextBreakdownReport,
} from "../../../core/contracts/context-breakdown.contracts.js";

export class ContextBreakdownSupervisor {
  private readonly substrate: BroccoliContextBreakdownSubstrate;
  private readonly engine: DeterministicContextBreakdownEngine;

  constructor(
    substrate: BroccoliContextBreakdownSubstrate,
    engine: DeterministicContextBreakdownEngine
  ) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public configure(config: Partial<ContextBreakdownConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): ContextBreakdownConfig {
    return this.substrate.getConfig();
  }

  /**
   * Computes a full categorical token breakdown, records metrics, and caches the latest report.
   */
  public computeBreakdown(params: {
    systemPrompt?: string;
    rulesText?: string;
    skillsText?: string;
    memoryText?: string;
    tools?: Array<{ name: string; [key: string]: unknown }>;
    messages?: Array<{ role: string; content: string }>;
    model?: string;
    maxContextTokens?: number;
  }): ContextBreakdownReport {
    const config = this.substrate.getConfig();
    const report = this.engine.computeBreakdown(params, config);
    this.substrate.setLatestReport(report);
    return report;
  }

  /**
   * Returns ASCII bar for latest report or a freshly computed report.
   */
  public renderBar(report?: ContextBreakdownReport, width = 40): string {
    const targetReport = report || this.substrate.getLatestReport();
    if (!targetReport) {
      return "[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% (0 / 128,000 tokens)";
    }
    return this.engine.renderAsciiBar(targetReport, width);
  }

  /**
   * Checks if latest reported token volume is approaching the compression threshold.
   */
  public isCompressionImminent(): boolean {
    const report = this.substrate.getLatestReport();
    return report ? report.compressionImminent : false;
  }

  public getLatestReport(): ContextBreakdownReport | undefined {
    return this.substrate.getLatestReport();
  }

  public getMetrics(): ContextBreakdownMetrics {
    return this.substrate.getMetrics();
  }

  public clear(): void {
    this.substrate.clear();
  }
}
