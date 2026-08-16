/**
 * cost-governance-supervisor.ts
 *
 * Master Cost Governance Supervisor coordinating pre-flight budget verification,
 * live token accumulation, and hard-cap ceiling enforcement (Phase 90 / ADR-042).
 */

import type {
  BudgetCapConfig,
  CostGovernanceResult,
  CostGovernanceWorkspaceSnapshot,
  TokenUsageLedgerEntry,
} from "../../../core/contracts/cost-governance.contracts.js";
import { DeterministicCostGovernor } from "../../../tooling/extensions/cost/deterministic-cost-governor.js";
import { BroccoliCostSubstrate } from "../../../sessions/extensions/cost/broccoli-cost-substrate.js";

export class CostGovernanceSupervisor {
  private governor: DeterministicCostGovernor;
  private substrate: BroccoliCostSubstrate;
  private budgetCap: BudgetCapConfig;

  constructor(
    governor: DeterministicCostGovernor,
    substrate: BroccoliCostSubstrate,
    budgetCap: BudgetCapConfig = { hardCapEnforced: false }
  ) {
    this.governor = governor;
    this.substrate = substrate;
    this.budgetCap = budgetCap;
  }

  /**
   * Sets or updates the active budget cap.
   */
  setBudgetCap(config: BudgetCapConfig): void {
    this.budgetCap = config;
  }

  /**
   * Evaluates pre-flight budget eligibility before model dispatch.
   */
  evaluatePreFlight(
    estimatedPromptTokens: number,
    estimatedCompletionTokens: number,
    modelId: string
  ): CostGovernanceResult {
    const currentCost = this.substrate.getTotalMicroCents();
    const result = this.governor.evaluatePreFlight(
      estimatedPromptTokens,
      estimatedCompletionTokens,
      modelId,
      currentCost,
      this.budgetCap
    );

    if (result.hardCapBreached) {
      this.substrate.setHardCapBreached(true);
    }

    return result;
  }

  /**
   * Records completed turn token usage.
   */
  recordTurn(
    turnIndex: number,
    modelId: string,
    promptTokens: number,
    completionTokens: number,
    cachedPromptTokens: number = 0
  ): TokenUsageLedgerEntry {
    const cost = this.governor.calculateTurnCost(modelId, promptTokens, completionTokens, cachedPromptTokens);

    const entry: TokenUsageLedgerEntry = {
      turnIndex,
      modelId,
      promptTokens,
      completionTokens,
      cachedPromptTokens,
      estimatedCostMicroCents: cost.costMicroCents,
      estimatedCostUsd: cost.costUsd,
      formattedCostLabel: cost.formattedLabel,
      timestamp: Date.now(),
    };

    this.substrate.recordTurnUsage(entry);
    return entry;
  }

  /**
   * Returns workspace stats.
   */
  getStats(): CostGovernanceWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  /**
   * Returns historical turn usage ledger.
   */
  listLedger(limit: number = 20): readonly TokenUsageLedgerEntry[] {
    return this.substrate.listLedger(limit);
  }
}
