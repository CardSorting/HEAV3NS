/**
 * billing-usage.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Dollar-Denominated Billing Usage,
 * Top-Up Balance Rollover & Low-Balance Alerting Subsystem (Phase 132 / ADR-108 / Target #65).
 */

export type AccountStatus =
  | "free"
  | "active_paid"
  | "low_balance"
  | "exhausted"
  | "unreachable";

export interface UsageBarDescriptor {
  kind: "plan" | "topup";
  remainingUsd: number;
  totalUsd: number;
  spentUsd: number;
  pctUsed?: number;
  fillFraction: number;
}

export interface UsageModelDescriptor {
  status: AccountStatus;
  planAllowanceUsd: number;
  planRemainingUsd: number;
  planSpentUsd: number;
  topupRemainingUsd: number;
  totalSpendableUsd: number;
  renewalIso?: string;
  renewalFormatted?: string;
  isLowBalance: boolean;
  planBar?: UsageBarDescriptor;
  topupBar?: UsageBarDescriptor;
}

export interface BillingAccountInfo {
  accountId: string;
  planAllowanceUsd: number;
  planRemainingUsd: number;
  topupRemainingUsd: number;
  periodEndIso?: string;
  isPaidPlan: boolean;
}

export interface BillingUsageConfig {
  lowBalanceThresholdUsd: number;
  currencySymbol: string;
  alertOnLowBalance: boolean;
}

export interface BillingTransaction {
  id: string;
  timestamp: number;
  type: "debit" | "topup_credit" | "plan_refresh";
  amountUsd: number;
  planDebitedUsd: number;
  topupDebitedUsd: number;
  reason?: string;
}

export interface BillingUsageMetrics {
  totalQueries: number;
  totalDebits: number;
  totalCredits: number;
  totalSpendUsd: number;
  lastStatus: AccountStatus;
}

export interface BillingUsageWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: BillingUsageConfig;
  accountInfo: BillingAccountInfo;
  transactions: BillingTransaction[];
  metrics: BillingUsageMetrics;
}

export const DEFAULT_LOW_BALANCE_THRESHOLD_USD = 5.0;

export const DEFAULT_BILLING_USAGE_CONFIG: BillingUsageConfig = {
  lowBalanceThresholdUsd: DEFAULT_LOW_BALANCE_THRESHOLD_USD,
  currencySymbol: "$",
  alertOnLowBalance: true,
};

export const DEFAULT_BILLING_ACCOUNT_INFO: BillingAccountInfo = {
  accountId: "default-account",
  planAllowanceUsd: 0,
  planRemainingUsd: 0,
  topupRemainingUsd: 0,
  isPaidPlan: false,
};

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface BillingAccountRow {
  readonly id: string;
  readonly accountId: string;
  readonly planAllowanceUsd: number;
  readonly planRemainingUsd: number;
  readonly topupRemainingUsd: number;
  readonly isPaidPlan: boolean;
  readonly periodEndIso?: string;
  readonly [key: string]: unknown;
}

export interface BillingTransactionRow {
  readonly id: string;
  readonly accountId: string;
  readonly type: "debit" | "topup_credit" | "plan_refresh";
  readonly amountUsd: number;
  readonly planDebitedUsd: number;
  readonly topupDebitedUsd: number;
  readonly reason?: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface BillingBarStateRow {
  readonly id: string;
  readonly accountId: string;
  readonly status: AccountStatus;
  readonly totalSpendableUsd: number;
  readonly planPctUsed: number;
  readonly topupPctUsed: number;
  readonly updatedAt: number;
  readonly [key: string]: unknown;
}

export interface BillingAuditRow {
  readonly id: string;
  readonly action: string;
  readonly operator: string;
  readonly details: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Metrics Telemetry
// ---------------------------------------------------------------------------

export type BillingUsageHealthStatus =
  | "optimal"
  | "healthy"
  | "low_funds"
  | "exhausted_critical";

export interface BillingUsageHealthAuditReport {
  readonly accountId: string;
  readonly status: AccountStatus;
  readonly planRemainingUsd: number;
  readonly topupRemainingUsd: number;
  readonly totalSpendableUsd: number;
  readonly isLowBalance: boolean;
  readonly isExhausted: boolean;
  readonly healthStatus: BillingUsageHealthStatus;
  readonly recommendations: readonly string[];
}

export interface BillingUsageMetricsReport {
  readonly totalAccounts: number;
  readonly activeAccounts: number;
  readonly lowBalanceAccounts: number;
  readonly exhaustedAccounts: number;
  readonly totalTransactions: number;
  readonly totalSpentUsd: number;
  readonly totalCreditedUsd: number;
  readonly averageDebitAmountUsd: number;
  readonly averageLatencyMs: number;
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type BillingUsageGroupBy = "type" | "status" | "tier" | "date";

export type BillingUsageSortBy = "timestamp" | "amount" | "type";

export type BillingUsageSortDirection = "asc" | "desc";

export interface BillingUsageGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly totalAmountUsd: number;
  readonly transactions: readonly BillingTransaction[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface BillingUsageDslQueryFilter {
  readonly rawQuery: string;
  readonly type?: "debit" | "topup_credit" | "plan_refresh";
  readonly minAmountUsd?: number;
  readonly maxAmountUsd?: number;
  readonly reasonTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface BillingUsageMutationUndoRecord {
  readonly mutationType: "debit" | "credit" | "refresh" | "configure" | "bulk";
  readonly previousSnapshot: BillingUsageWorkspaceSnapshot;
  readonly nextSnapshot: BillingUsageWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface BillingUsageBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedTransactionIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliBillingUsageSubstrate {
  getAccount(accountId?: string): BillingAccountInfo;
  setAccount(account: BillingAccountInfo): void;
  getConfig(): BillingUsageConfig;
  setConfig(config: BillingUsageConfig): void;
  recordTransaction(tx: BillingTransaction): void;
  listTransactions(limit?: number): readonly BillingTransaction[];
  getUsageDescriptor(accountId?: string): UsageModelDescriptor;
  getMetrics(): BillingUsageMetricsReport;
  auditHealth(accountId?: string): BillingUsageHealthAuditReport;
  getGroupedTransactions(groupBy?: BillingUsageGroupBy, sortBy?: BillingUsageSortBy, direction?: BillingUsageSortDirection): readonly BillingUsageGroupedLane[];
  queryTransactionsDsl(query: BillingUsageDslQueryFilter | string): readonly BillingTransaction[];
  bulkPurgeTransactions(txIds: readonly string[]): BillingUsageBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): BillingUsageWorkspaceSnapshot;
  importSnapshot(snapshot: BillingUsageWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}

