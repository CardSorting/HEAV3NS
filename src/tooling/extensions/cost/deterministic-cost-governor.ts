/**
 * deterministic-cost-governor.ts
 *
 * In-memory zero-GC model pricing catalog and integer micro-cent arithmetic governor (Phase 90 / ADR-042).
 */

import type {
  BudgetCapConfig,
  CostGovernanceResult,
  ModelPricingTier,
} from "../../../core/contracts/cost-governance.contracts.js";

export class DeterministicCostGovernor {
  private pricingCatalog: Map<string, ModelPricingTier>;

  constructor() {
    this.pricingCatalog = new Map<string, ModelPricingTier>();
    this.initDefaultPricingCatalog();
  }

  private initDefaultPricingCatalog(): void {
    const defaultTiers: ModelPricingTier[] = [
      {
        modelId: "gpt-4o",
        provider: "openai",
        promptCostPerMillion: 2.5,
        completionCostPerMillion: 10.0,
        cachedPromptCostPerMillion: 1.25,
      },
      {
        modelId: "gpt-4o-mini",
        provider: "openai",
        promptCostPerMillion: 0.15,
        completionCostPerMillion: 0.6,
        cachedPromptCostPerMillion: 0.075,
      },
      {
        modelId: "claude-3-5-sonnet",
        provider: "anthropic",
        promptCostPerMillion: 3.0,
        completionCostPerMillion: 15.0,
        cachedPromptCostPerMillion: 0.3,
      },
      {
        modelId: "deepseek-chat",
        provider: "deepseek",
        promptCostPerMillion: 0.14,
        completionCostPerMillion: 0.28,
        cachedPromptCostPerMillion: 0.014,
      },
      {
        modelId: "hermes-3-llama-3.1-405b",
        provider: "nous",
        promptCostPerMillion: 1.0,
        completionCostPerMillion: 3.0,
        cachedPromptCostPerMillion: 0.5,
      },
    ];

    for (let i = 0; i < defaultTiers.length; i++) {
      const tier = defaultTiers[i];
      this.pricingCatalog.set(tier.modelId, tier);
    }
  }

  /**
   * Registers or updates a model pricing tier.
   */
  registerTier(tier: ModelPricingTier): void {
    this.pricingCatalog.set(tier.modelId, tier);
  }

  /**
   * Looks up a model tier or defaults to fallback flat pricing.
   */
  getTier(modelId: string): ModelPricingTier {
    return (
      this.pricingCatalog.get(modelId) ?? {
        modelId,
        provider: "custom",
        promptCostPerMillion: 1.0,
        completionCostPerMillion: 2.0,
        cachedPromptCostPerMillion: 0.5,
      }
    );
  }

  /**
   * Formats a cost amount into a user-facing label with sub-cent honesty (fixes #79220).
   */
  formatCostLabel(amountUsd: number): string {
    if (amountUsd <= 0) {
      return "$0.00";
    }
    if (amountUsd < 0.01) {
      if (amountUsd < 0.0001) {
        return "~$<0.0001";
      }
      return `~$${amountUsd.toFixed(4)}`;
    }
    return `~$${amountUsd.toFixed(2)}`;
  }

  /**
   * Calculates turn cost in integer micro-cents (1 USD = 1,000,000 micro-cents) to guarantee zero float drift.
   */
  calculateTurnCost(
    modelId: string,
    promptTokens: number,
    completionTokens: number,
    cachedPromptTokens: number = 0
  ): {
    costMicroCents: number;
    costUsd: number;
    formattedLabel: string;
  } {
    const tier = this.getTier(modelId);

    const nonCachedPromptTokens = Math.max(0, promptTokens - cachedPromptTokens);

    // micro-cents = (tokens * costPerMillion)
    const promptMicroCents = Math.round(nonCachedPromptTokens * tier.promptCostPerMillion);
    const cachedMicroCents = Math.round(
      cachedPromptTokens * (tier.cachedPromptCostPerMillion ?? tier.promptCostPerMillion * 0.5)
    );
    const completionMicroCents = Math.round(completionTokens * tier.completionCostPerMillion);

    const totalMicroCents = promptMicroCents + cachedMicroCents + completionMicroCents;
    const costUsd = Number((totalMicroCents / 1_000_000).toFixed(6));

    return {
      costMicroCents: totalMicroCents,
      costUsd,
      formattedLabel: this.formatCostLabel(costUsd),
    };
  }

  /**
   * Evaluates pre-flight budget eligibility before model dispatch.
   */
  evaluatePreFlight(
    estimatedPromptTokens: number,
    estimatedCompletionTokens: number,
    modelId: string,
    currentSessionCostMicroCents: number,
    config: BudgetCapConfig
  ): CostGovernanceResult {
    const estimated = this.calculateTurnCost(modelId, estimatedPromptTokens, estimatedCompletionTokens);
    const projectedTotalMicroCents = currentSessionCostMicroCents + estimated.costMicroCents;
    const projectedTotalUsd = Number((projectedTotalMicroCents / 1_000_000).toFixed(6));

    if (config.hardCapEnforced) {
      if (typeof config.maxTurnCostUsd === "number" && estimated.costUsd > config.maxTurnCostUsd) {
        return {
          allowed: false,
          estimatedCostMicroCents: estimated.costMicroCents,
          estimatedCostUsd: estimated.costUsd,
          formattedCostLabel: estimated.formattedLabel,
          totalSessionCostUsd: Number((currentSessionCostMicroCents / 1_000_000).toFixed(6)),
          hardCapBreached: true,
          breachReason: `Estimated turn cost (${estimated.formattedLabel}) exceeds turn ceiling ($${config.maxTurnCostUsd.toFixed(2)})`,
        };
      }

      if (typeof config.maxSessionCostUsd === "number" && projectedTotalUsd > config.maxSessionCostUsd) {
        return {
          allowed: false,
          estimatedCostMicroCents: estimated.costMicroCents,
          estimatedCostUsd: estimated.costUsd,
          formattedCostLabel: estimated.formattedLabel,
          totalSessionCostUsd: Number((currentSessionCostMicroCents / 1_000_000).toFixed(6)),
          remainingBudgetUsd: Math.max(0, config.maxSessionCostUsd - Number((currentSessionCostMicroCents / 1_000_000).toFixed(6))),
          hardCapBreached: true,
          breachReason: `Projected session cost (~$${projectedTotalUsd.toFixed(2)}) exceeds session budget limit ($${config.maxSessionCostUsd.toFixed(2)})`,
        };
      }
    }

    const remainingBudget =
      typeof config.maxSessionCostUsd === "number"
        ? Math.max(0, config.maxSessionCostUsd - projectedTotalUsd)
        : undefined;

    return {
      allowed: true,
      estimatedCostMicroCents: estimated.costMicroCents,
      estimatedCostUsd: estimated.costUsd,
      formattedCostLabel: estimated.formattedLabel,
      totalSessionCostUsd: projectedTotalUsd,
      remainingBudgetUsd: remainingBudget,
      hardCapBreached: false,
    };
  }

  /**
   * Resets pricing catalog to default.
   */
  reset(): void {
    this.pricingCatalog.clear();
    this.initDefaultPricingCatalog();
  }
}
