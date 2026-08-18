/**
 * context-compression-supervisor.ts
 *
 * Master Context Compression Supervisor orchestrating trajectory compaction,
 * deterministic tool output pruning, token budget governance, and rollback recovery (Phase 86 / ADR-038).
 */

import type {
  CompressedTurnSummary,
  CompressionBulkMutationResult,
  CompressionDslQueryFilter,
  CompressionGroupBy,
  CompressionGroupedLane,
  CompressionHealthAuditReport,
  CompressionMetricsReport,
  CompressionSortBy,
  CompressionSortDirection,
  CompressionStateSnapshot,
  TokenWindowBudget,
  ToolPruningPolicy,
} from "../../../core/contracts/compression.contracts.js";
import { BroccoliCompressionSubstrate } from "../../../sessions/extensions/compaction/broccoli-compression-substrate.js";
import { HeadTailBudgetGovernor } from "../../../tooling/extensions/compaction/head-tail-budget-governor.js";
import { DeterministicToolPruner } from "../../../tooling/extensions/compaction/deterministic-tool-pruner.js";
import { TrajectoryCompactorEngine } from "./trajectory-compactor-engine.js";

export class ContextCompressionSupervisor {
  private readonly substrate: BroccoliCompressionSubstrate;
  private readonly budgetGovernor: HeadTailBudgetGovernor;
  private readonly toolPruner: DeterministicToolPruner;
  private readonly compactorEngine: TrajectoryCompactorEngine;

  constructor(
    substrate?: BroccoliCompressionSubstrate,
    budgetGovernor?: HeadTailBudgetGovernor,
    toolPruner?: DeterministicToolPruner,
    compactorEngine?: TrajectoryCompactorEngine
  ) {
    this.substrate = substrate ?? new BroccoliCompressionSubstrate();
    this.budgetGovernor = budgetGovernor ?? new HeadTailBudgetGovernor();
    this.toolPruner = toolPruner ?? new DeterministicToolPruner();
    this.compactorEngine = compactorEngine ?? new TrajectoryCompactorEngine(this.substrate, this.budgetGovernor, this.toolPruner);
  }

  /**
   * Compacts a multi-turn trajectory according to the allocated token budget.
   */
  public compactTrajectory(
    turns: readonly { turnIndex: number; role: string; content: string }[],
    budget?: Partial<TokenWindowBudget>
  ): {
    compactedTurns: readonly { turnIndex: number; role: string; content: string }[];
    summary?: CompressedTurnSummary;
    tokensSaved: number;
  } {
    const fullBudget = this.budgetGovernor.calculateBudget(
      budget?.totalTokens ?? turns.reduce((acc, t) => acc + Math.ceil(t.content.length / 4), 0),
      budget?.maxContextLimit
    );
    return this.compactorEngine.compactTrajectory(turns, fullBudget);
  }

  /**
   * Prunes a noisy tool output string.
   */
  public pruneToolResult(
    rawOutput: string,
    policy?: Partial<ToolPruningPolicy>
  ): { prunedText: string; originalChars: number; prunedChars: number; wasPruned: boolean } {
    const res = this.toolPruner.pruneToolResult(rawOutput, policy);
    this.substrate.recordPrunedOutput(res.originalChars, res.prunedChars, res.wasPruned);
    return res;
  }

  /**
   * Calculates token window budget allocations.
   */
  public calculateBudget(totalTokens: number, maxLimit?: number): TokenWindowBudget {
    return this.budgetGovernor.calculateBudget(totalTokens, maxLimit);
  }

  // ---------------------------------------------------------------------------
  // Queries & Diagnostics
  // ---------------------------------------------------------------------------

  public getSummary(id: string): CompressedTurnSummary | undefined {
    return this.substrate.getSummary(id);
  }

  public listSummaries(limit: number = 20): readonly CompressedTurnSummary[] {
    return this.substrate.listSummaries(limit);
  }

  public getLatestSummary(): CompressedTurnSummary | undefined {
    return this.substrate.getLatestSummary();
  }

  public auditHealth(): CompressionHealthAuditReport {
    return this.substrate.auditHealth();
  }

  public getMetrics(): CompressionMetricsReport {
    return this.substrate.getMetrics();
  }

  public getGroupedSummaries(groupBy?: CompressionGroupBy, sortBy?: CompressionSortBy, direction?: CompressionSortDirection): readonly CompressionGroupedLane[] {
    return this.substrate.getGroupedSummaries(groupBy, sortBy, direction);
  }

  public queryDsl(query: CompressionDslQueryFilter | string): readonly CompressedTurnSummary[] {
    return this.substrate.querySummariesDsl(query);
  }

  public bulkPurge(summaryIds: readonly string[]): CompressionBulkMutationResult {
    return this.substrate.bulkPurgeSummaries(summaryIds);
  }

  public getStats(): CompressionStateSnapshot {
    return this.substrate.exportSnapshot();
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

  public getSubstrate(): BroccoliCompressionSubstrate {
    return this.substrate;
  }

  public getBudgetGovernor(): HeadTailBudgetGovernor {
    return this.budgetGovernor;
  }

  public getToolPruner(): DeterministicToolPruner {
    return this.toolPruner;
  }

  public getCompactorEngine(): TrajectoryCompactorEngine {
    return this.compactorEngine;
  }
}
