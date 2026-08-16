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
