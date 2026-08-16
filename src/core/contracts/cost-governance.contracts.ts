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
}
