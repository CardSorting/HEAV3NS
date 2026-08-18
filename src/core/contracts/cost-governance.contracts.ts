/**
 * cost-governance.contracts.ts
 *
 * Core data contracts for Deterministic Model Pricing, Token Accounting
 * & Cost Governance Subsystem (Phase 90 / ADR-042).
 */

export interface ModelPricingTier {
  readonly modelId: string;
  readonly provider: string;
  readonly promptCostPerMillion: number;
  readonly completionCostPerMillion: number;
  readonly cachedPromptCostPerMillion?: number;
}

export interface TokenUsageLedgerEntry {
  readonly turnIndex: number;
  readonly modelId: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly cachedPromptTokens: number;
  readonly estimatedCostMicroCents: number;
  readonly estimatedCostUsd: number;
  readonly formattedCostLabel: string;
  readonly timestamp: number;
}

export interface BudgetCapConfig {
  readonly maxSessionCostUsd?: number;
  readonly maxTurnCostUsd?: number;
  readonly maxPromptTokens?: number;
  readonly maxCompletionTokens?: number;
  readonly hardCapEnforced: boolean;
}

export interface CostGovernanceResult {
  readonly allowed: boolean;
  readonly estimatedCostMicroCents: number;
  readonly estimatedCostUsd: number;
  readonly formattedCostLabel: string;
  readonly totalSessionCostUsd: number;
  readonly remainingBudgetUsd?: number;
  readonly hardCapBreached: boolean;
  readonly breachReason?: string;
}

export interface CostGovernanceWorkspaceSnapshot {
  readonly totalTokens: number;
  readonly totalPromptTokens: number;
  readonly totalCompletionTokens: number;
  readonly totalCachedPromptTokens: number;
  readonly totalCostMicroCents: number;
  readonly totalCostUsd: number;
  readonly formattedTotalCostLabel: string;
  readonly totalTurns: number;
  readonly hardCapBreached: boolean;
  readonly timestamp: number;
  readonly ledger?: readonly TokenUsageLedgerEntry[];
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface CostLedgerRow {
  readonly id: string;
  readonly turnIndex: number;
  readonly modelId: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly cachedPromptTokens: number;
  readonly estimatedCostMicroCents: number;
  readonly estimatedCostUsd: number;
  readonly formattedCostLabel: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface CostPricingTierRow {
  readonly id: string;
  readonly modelId: string;
  readonly provider: string;
  readonly promptCostPerMillion: number;
  readonly completionCostPerMillion: number;
  readonly cachedPromptCostPerMillion?: number;
  readonly [key: string]: unknown;
}

export interface CostBudgetRow {
  readonly id: string;
  readonly maxSessionCostUsd?: number;
  readonly maxTurnCostUsd?: number;
  readonly maxPromptTokens?: number;
  readonly maxCompletionTokens?: number;
  readonly hardCapEnforced: boolean;
  readonly updatedAt: number;
  readonly [key: string]: unknown;
}

export interface CostAuditRow {
  readonly id: string;
  readonly action: string;
  readonly operator: string;
  readonly reason: string;
  readonly amountUsd?: number;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Budget Diagnostics
// ---------------------------------------------------------------------------

export type CostHealthStatus =
  | "optimal"
  | "healthy"
  | "near_ceiling"
  | "budget_exceeded";

export interface CostHealthAuditReport {
  readonly totalCostUsd: number;
  readonly remainingBudgetUsd?: number;
  readonly burnRateUsdPerHour: number;
  readonly healthStatus: CostHealthStatus;
  readonly hardCapBreached: boolean;
  readonly topModelId: string;
  readonly recommendations: readonly string[];
}

export interface CostMetricsReport {
  readonly totalTokens: number;
  readonly totalPromptTokens: number;
  readonly totalCompletionTokens: number;
  readonly totalCachedPromptTokens: number;
  readonly totalCostMicroCents: number;
  readonly totalCostUsd: number;
  readonly formattedTotalCostLabel: string;
  readonly totalTurns: number;
  readonly hardCapBreached: boolean;
  readonly burnRatePerTurnUsd: number;
  readonly modelUsageCounts: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type CostGroupBy = "model" | "provider" | "tier" | "status";

export type CostSortBy = "cost" | "tokens" | "timestamp" | "turnIndex";

export type CostSortDirection = "asc" | "desc";

export interface CostGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly totalCostUsd: number;
  readonly entries: readonly TokenUsageLedgerEntry[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface CostDslQueryFilter {
  readonly rawQuery: string;
  readonly modelId?: string;
  readonly provider?: string;
  readonly minCostUsd?: number;
  readonly maxCostUsd?: number;
  readonly minTokens?: number;
  readonly isCached?: boolean;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface CostMutationUndoRecord {
  readonly mutationType: "record" | "clear" | "budget" | "tier" | "bulk";
  readonly previousSnapshot: CostGovernanceWorkspaceSnapshot;
  readonly nextSnapshot: CostGovernanceWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface CostBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly updatedTurnIndices: readonly number[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliCostSubstrate {
  recordTurnUsage(entry: TokenUsageLedgerEntry): void;
  setHardCapBreached(breached: boolean): void;
  getTotalMicroCents(): number;
  listLedger(limit?: number): readonly TokenUsageLedgerEntry[];
  getCostMetrics(): CostMetricsReport;
  auditCostHealth(budgetCap?: BudgetCapConfig): CostHealthAuditReport;
  getGroupedCosts(groupBy?: CostGroupBy, sortBy?: CostSortBy, direction?: CostSortDirection): readonly CostGroupedLane[];
  queryCostsDsl(query: CostDslQueryFilter | string): readonly TokenUsageLedgerEntry[];
  bulkClearLedger(turnIndices: readonly number[]): CostBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): CostGovernanceWorkspaceSnapshot;
  importSnapshot(snapshot: CostGovernanceWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
